"""Semantic graph endpoint — builds a polysemy knowledge graph from the curated dataset.

Algorithm
---------
For each word the graph contains:
  • One root node (the bare Tamil word form)
  • One sense node per unique meaning (labelled with English + Tamil gloss, coloured by POS)
  • Up to MAX_MORPH morphological-variant nodes per sense  (inflected forms attested in the
    dataset, e.g. ஆற்றில் / ஆற்றை / ஆறாக for the River sense of ஆறு)
  • Root → sense edges, labelled with POS
  • Cross-sense edges whose weight is computed via sentence-transformer cosine similarity
    (paraphrase-multilingual-MiniLM-L12-v2) blended with POS agreement:
        sim = 0.3 × POS_similarity  +  0.7 × cosine(embedding(sense1), embedding(sense2))
    Falls back to Jaccard keyword overlap when embeddings are unavailable.
  • Sense → morph-variant edges
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dataset import get_entries_for_word

log = logging.getLogger(__name__)

router = APIRouter()
MAX_MORPH = 3   # morphological variants shown per sense node

# ── Stop-words for Jaccard fallback ──────────────────────────────────────────
_STOP = {
    'a', 'an', 'the', 'to', 'of', 'for', 'in', 'on', 'at', 'by', 'or', 'and',
    'is', 'be', 'as', 'its', 'into', 'with', 'from', 'up', 'out', 'act',
}

# ── Embedding-based similarity (loaded lazily) ──────────────────────────────
_embeddings_available = None  # tri-state: None=untried, True, False

def _try_embeddings():
    global _embeddings_available
    if _embeddings_available is None:
        try:
            from services.embeddings import encode
            encode(["test"])  # warm up / verify
            _embeddings_available = True
            log.info("Sentence-transformer embeddings loaded successfully")
        except Exception as e:
            _embeddings_available = False
            log.warning("Embeddings unavailable, falling back to Jaccard: %s", e)
    return _embeddings_available

# ── Pydantic response schemas ─────────────────────────────────────────────────

class RootInfo(BaseModel):
    word_ta: str
    romanized: str

class GraphNode(BaseModel):
    id: str
    label_ta: str
    label_en: str
    pos: str
    domain: str
    node_type: str   # 'sense' | 'morph'

class GraphEdge(BaseModel):
    from_: str
    to: str
    relation: str
    weight: float
    context: str

class ExampleWord(BaseModel):
    sense_id: str
    example_ta: str
    example_en: str

class GraphResponse(BaseModel):
    root: RootInfo
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    example_words: list[ExampleWord]
    algorithm: str  # 'sentence-transformer' or 'jaccard-fallback'

# ── Similarity helpers ────────────────────────────────────────────────────────

def _tokens(text: str) -> set[str]:
    """Lower-cased content words from an English sense description."""
    return {
        w.strip('.,/()-').lower()
        for w in text.split()
        if len(w) > 2 and w.lower().strip('.,/()-') not in _STOP
    }


def _sense_similarity(pos1: str, pos2: str, sense1: str, sense2: str) -> tuple[float, str]:
    """
    Returns (similarity_score ∈ [0,1], relation_label).

    Uses sentence-transformer embeddings when available:
      • POS similarity   (0.3 weight) — 1.0 if same POS, 0.2 otherwise
      • Cosine similarity (0.7 weight) — from multilingual MiniLM embeddings

    Falls back to Jaccard keyword overlap when embeddings are unavailable.
    """
    p1, p2 = pos1.lower().split()[0], pos2.lower().split()[0]
    pos_sim = 1.0 if p1 == p2 else 0.2

    if _try_embeddings():
        from services.embeddings import cosine_similarity
        semantic_sim = max(0.0, cosine_similarity(sense1, sense2))
        score = round(0.3 * pos_sim + 0.7 * semantic_sim, 3)
    else:
        # Jaccard fallback
        t1, t2 = _tokens(sense1), _tokens(sense2)
        union = t1 | t2
        jaccard = len(t1 & t2) / len(union) if union else 0.0
        score = round(0.4 * pos_sim + 0.6 * jaccard, 3)

    if p1 == p2:
        label = f"same {p1.capitalize()} form"
    elif {p1, p2} <= {"noun", "verb"}:
        label = "semantic shift"
    else:
        label = "related meaning"

    return score, label

# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/{word_ta}/graph", response_model=GraphResponse)
def get_word_graph(word_ta: str):
    entries = get_entries_for_word(word_ta)
    if not entries:
        raise HTTPException(404, f"'{word_ta}' is not in the dataset yet")

    romanized = entries[0].get("word_romanized", "")

    # ── Collect unique senses + their attested morphological forms ────────
    sense_map: dict[str, dict] = {}           # sense_en → first dataset entry
    sense_morphs: dict[str, list[str]] = {}   # sense_en → unique correct_answer forms

    for e in entries:
        s = e.get("sense", "")
        if not s:
            continue
        if s not in sense_map:
            sense_map[s] = e
            sense_morphs[s] = []
        ca = e.get("correct_answer", "")
        if ca and ca not in sense_morphs[s]:
            sense_morphs[s].append(ca)

    if not sense_map:
        raise HTTPException(422, f"No sense data found for '{word_ta}'")

    sense_list = list(sense_map.items())   # ordered list of (sense_en, entry)

    # ── Sense nodes ───────────────────────────────────────────────────────
    sense_nodes: list[GraphNode] = []
    for i, (sense_en, entry) in enumerate(sense_list):
        pos_raw = entry.get("pos", "noun")
        sense_nodes.append(GraphNode(
            id=f"sense_{i}",
            label_ta=entry.get("sense_ta", ""),
            label_en=sense_en,
            pos=pos_raw.capitalize(),
            domain=pos_raw.capitalize(),
            node_type="sense",
        ))

    # ── Morphological-variant nodes ───────────────────────────────────────
    morph_nodes: list[GraphNode] = []
    morph_edges: list[GraphEdge] = []
    for i, (sense_en, _) in enumerate(sense_list):
        for j, form in enumerate(sense_morphs[sense_en][:MAX_MORPH]):
            mid = f"morph_{i}_{j}"
            morph_nodes.append(GraphNode(
                id=mid,
                label_ta=form,
                label_en="",
                pos=sense_nodes[i].pos,
                domain="morph",
                node_type="morph",
            ))
            morph_edges.append(GraphEdge(
                from_=f"sense_{i}",
                to=mid,
                relation="form",
                weight=0.85,
                context="morphological variant",
            ))

    # ── Root → sense edges ────────────────────────────────────────────────
    root_edges: list[GraphEdge] = [
        GraphEdge(
            from_="root",
            to=n.id,
            relation=n.pos,
            weight=1.0,
            context=n.domain,
        )
        for n in sense_nodes
    ]

    # ── Cross-sense similarity edges ──────────────────────────────────────
    cross_edges: list[GraphEdge] = []
    for i in range(len(sense_list)):
        for j in range(i + 1, len(sense_list)):
            weight, label = _sense_similarity(
                sense_nodes[i].pos, sense_nodes[j].pos,
                sense_list[i][0], sense_list[j][0],
            )
            cross_edges.append(GraphEdge(
                from_=f"sense_{i}",
                to=f"sense_{j}",
                relation=label,
                weight=weight,
                context=f"{sense_nodes[i].pos} ↔ {sense_nodes[j].pos}",
            ))

    # ── Example sentences (one per sense) ────────────────────────────────
    examples: list[ExampleWord] = []
    for i, (sense_en, entry) in enumerate(sense_list):
        sentence = entry.get("game_sentence", "")
        answer   = entry.get("correct_answer", "")
        examples.append(ExampleWord(
            sense_id=f"sense_{i}",
            example_ta=sentence.replace("______", answer),
            example_en=sense_en,
        ))

    algo = "sentence-transformer" if _try_embeddings() else "jaccard-fallback"

    return GraphResponse(
        root=RootInfo(word_ta=word_ta, romanized=romanized),
        nodes=sense_nodes + morph_nodes,
        edges=root_edges + cross_edges + morph_edges,
        example_words=examples,
        algorithm=algo,
    )
