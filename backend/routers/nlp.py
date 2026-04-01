"""NLP analysis endpoints — exposes IndicBERT and embedding capabilities.

These endpoints let judges inspect the live NLP pipeline:
  • /api/nlp/distractor-score — scores distractors using IndicBERT fill-mask
  • /api/nlp/similarity — computes sentence-transformer cosine similarity
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

log = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class DistractorScoreRequest(BaseModel):
    sentence: str           # Tamil sentence with ______ blank
    correct_answer: str
    distractors: list[str]


class DistractorScore(BaseModel):
    word: str
    score: float
    is_good_distractor: bool


class DistractorScoreResponse(BaseModel):
    correct_answer: str
    correct_score: float
    distractor_scores: list[DistractorScore]
    model: str


class SimilarityRequest(BaseModel):
    text_a: str
    text_b: str


class SimilarityResponse(BaseModel):
    similarity: float
    model: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/distractor-score", response_model=DistractorScoreResponse)
def score_distractors(req: DistractorScoreRequest):
    """Score how well distractors fit a sentence blank using IndicBERT fill-mask."""
    try:
        from services.indic_bert import score_distractors as _score
        results = _score(req.sentence, req.correct_answer, req.distractors)
        # Also score the correct answer for comparison
        correct_results = _score(req.sentence, req.correct_answer, [req.correct_answer])
        correct_score = correct_results[0]["score"] if correct_results else 0.0
        return DistractorScoreResponse(
            correct_answer=req.correct_answer,
            correct_score=correct_score,
            distractor_scores=[DistractorScore(**r) for r in results],
            model="ai4bharat/indic-bert",
        )
    except Exception as e:
        log.error("IndicBERT scoring failed: %s", e)
        raise HTTPException(503, f"IndicBERT model unavailable: {e}")


@router.post("/similarity", response_model=SimilarityResponse)
def compute_similarity(req: SimilarityRequest):
    """Compute cosine similarity between two texts using sentence-transformers."""
    try:
        from services.embeddings import cosine_similarity
        sim = cosine_similarity(req.text_a, req.text_b)
        return SimilarityResponse(
            similarity=round(sim, 4),
            model="paraphrase-multilingual-MiniLM-L12-v2",
        )
    except Exception as e:
        log.error("Embeddings similarity failed: %s", e)
        raise HTTPException(503, f"Sentence-transformer model unavailable: {e}")
