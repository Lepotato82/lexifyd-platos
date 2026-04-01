"""
Automated dataset builder — reads Tamil Wikipedia, generates game entries via
Groq LLM, validates them, and writes to a NEW file (does NOT overwrite the
curated lexifyd_dataset.json).

Demonstrates the full pipeline:
  Tamil Wikipedia raw text
    → Phase 1: sentence extraction
    → Phase 2: LLM question generation (Groq llama-3.3-70b-versatile)
    → Phase 3: structural validation
    → data/lexifyd_dataset_generated.json

Run from the backend/ directory:
    python scripts/build_dataset.py
"""

import json
import logging
import os
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

# ── Path / env setup ──────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

# Output goes to a SEPARATE file — curated dataset is never touched
OUTPUT_PATH  = BACKEND_DIR / "data" / "lexifyd_dataset_generated.json"
RAW_FILES_DIR = BACKEND_DIR / "data" / "tamil_wiki" / "raw_text_files"

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Regex helpers ─────────────────────────────────────────────────────────────
TAMIL_RE      = re.compile(r"[\u0B80-\u0BFF]")
SKIP_START_RE = re.compile(r"^\s*(<doc|</doc|\{\{|==|\*|#|\[|:|;)")
HTML_ENTITY_RE = re.compile(r"&lt;|&gt;|&quot;|&amp;|&#160;")
BRACKET_RE    = re.compile(r"\[\[.*?\]\]|\{\{.*?\}\}|<[^>]+>")

# ── Polysemous word definitions ───────────────────────────────────────────────
POLYSEMOUS_WORDS = [
    {
        "word_ta": "ஆறு",
        "romanized": "Aaru",
        "search_forms": ["ஆறு", "ஆற்றில்", "ஆற்றை", "ஆற்றின்", "ஆறாக", "ஆற்று"],
        "senses": ["river", "six", "to cool down / to calm"],
    },
    {
        "word_ta": "படி",
        "romanized": "Padi",
        "search_forms": ["படி", "படித்", "படிக்", "படிகள்", "படியில்", "படியை"],
        "senses": ["to read / to study", "staircase / step", "a unit of measure"],
    },
    {
        "word_ta": "கல்",
        "romanized": "Kal",
        "search_forms": ["கல்", "கல்லை", "கல்லில்", "கற்க", "கற்று", "கல்வி"],
        "senses": ["stone / rock", "to learn"],
    },
    {
        "word_ta": "திங்கள்",
        "romanized": "Thingal",
        "search_forms": ["திங்கள்", "திங்களில்", "திங்களன்று"],
        "senses": ["Monday", "moon", "month"],
    },
    {
        "word_ta": "முகம்",
        "romanized": "Mugam",
        "search_forms": ["முகம்", "முகத்தை", "முகத்தில்", "முகமாக"],
        "senses": ["face", "entrance / front"],
    },
    {
        "word_ta": "தலை",
        "romanized": "Thalai",
        "search_forms": ["தலை", "தலையில்", "தலையை", "தலைவர்", "தலைமை"],
        "senses": ["head", "chief / leader", "beginning"],
    },
    {
        "word_ta": "வாய்",
        "romanized": "Vaai",
        "search_forms": ["வாய்", "வாயில்", "வாயை", "வாயால்"],
        "senses": ["mouth", "opening / entrance", "opportunity"],
    },
    {
        "word_ta": "காலம்",
        "romanized": "Kaalam",
        "search_forms": ["காலம்", "காலத்தில்", "காலத்தை", "காலமாக"],
        "senses": ["time / era", "death / end"],
    },
    {
        "word_ta": "நிலம்",
        "romanized": "Nilam",
        "search_forms": ["நிலம்", "நிலத்தில்", "நிலத்தை", "நிலமாக"],
        "senses": ["land / earth", "floor / ground", "colour blue"],
    },
    {
        "word_ta": "விழி",
        "romanized": "Vizhi",
        "search_forms": ["விழி", "விழியில்", "விழியை", "விழுந்த", "விழுந்து"],
        "senses": ["eye", "to fall"],
    },
]

# ── LLM prompt ────────────────────────────────────────────────────────────────
GENERATION_PROMPT = """\
You are a Tamil linguistics expert building a verified game dataset.

Root word: {word_ta} ({romanized})
Known senses: {senses}

Here are real sentences from Tamil Wikipedia containing this word:
{sentences_list}

For each sentence:
1. Identify which sense of {word_ta} is being used
2. Find the exact inflected form of {word_ta} in the sentence
3. Create a game question by replacing that form with ______
4. Generate 3 distractors that are other inflected forms of {word_ta}
   (wrong grammatical case/tense for this context — NOT a different root word)

CRITICAL RULES:
- Only include sentences where the sense is 100% clear from context
- Skip sentences where the sense is ambiguous
- correct_answer must be the EXACT form as it appears in the sentence
- All distractors must derive from {word_ta} only
- Return at most 4 entries total

Return a JSON array. For each valid sentence:
{{
  "word_ta": "{word_ta}",
  "word_romanized": "{romanized}",
  "sense": "English sense label",
  "sense_ta": "Tamil sense label",
  "pos": "Noun or Verb or Adjective",
  "original_sentence": "full original sentence",
  "game_sentence": "sentence with ______ replacing the word",
  "correct_answer": "exact inflected form",
  "distractors": ["wrong_form1", "wrong_form2", "wrong_form3"],
  "corpus_grounded": true,
  "source": "Tamil Wikipedia",
  "difficulty": "easy"
}}

Return ONLY the JSON array, no markdown, no explanation.\
"""


# ── Phase 1: extract sentences from Wikipedia files ───────────────────────────

def _clean_line(line: str) -> str:
    if SKIP_START_RE.match(line):
        return ""
    line = HTML_ENTITY_RE.sub(" ", line)
    line = BRACKET_RE.sub("", line)
    line = line.strip()
    if not TAMIL_RE.search(line):
        return ""
    total = len(line.replace(" ", ""))
    if total == 0:
        return ""
    english = sum(1 for c in line if c.isascii() and c.isalpha())
    if english / total > 0.40:
        return ""
    if len(line.split()) < 5:
        return ""
    return line


def _extract_sentences(text: str) -> list[str]:
    sentences = []
    for part in re.split(r"[।]|\.\s+", text):
        part = part.strip()
        words = part.split()
        if 6 <= len(words) <= 25 and TAMIL_RE.search(part):
            sentences.append(part)
    return sentences


def phase1_collect(max_per_word: int = 8) -> dict[str, list[str]]:
    """Walk wiki files, collect up to max_per_word sentences per target word."""
    txt_files = list(RAW_FILES_DIR.rglob("*.txt"))
    logger.info(f"Phase 1 — scanning {len(txt_files)} Wikipedia files …")

    word_sentences: dict[str, list[str]] = defaultdict(list)

    for path in txt_files:
        # Stop early if all words already have enough sentences
        if all(len(word_sentences[wd["word_ta"]]) >= max_per_word
               for wd in POLYSEMOUS_WORDS):
            break
        try:
            raw = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        cleaned = " ".join(
            ln for ln in (_clean_line(l) for l in raw.splitlines()) if ln
        )
        sentences = _extract_sentences(cleaned)

        for word_def in POLYSEMOUS_WORDS:
            wt = word_def["word_ta"]
            if len(word_sentences[wt]) >= max_per_word:
                continue
            for form in word_def["search_forms"]:
                for sent in sentences:
                    if form in sent and sent not in word_sentences[wt]:
                        word_sentences[wt].append(sent)
                    if len(word_sentences[wt]) >= max_per_word:
                        break
                if len(word_sentences[wt]) >= max_per_word:
                    break

    logger.info("Phase 1 done:")
    for wd in POLYSEMOUS_WORDS:
        wt = wd["word_ta"]
        logger.info(f"  {wt} ({wd['romanized']}): {len(word_sentences[wt])} sentences")

    return dict(word_sentences)


# ── Phase 2: generate questions via Groq ──────────────────────────────────────

def _call_groq(prompt: str, api_key: str) -> list[dict]:
    """Call Groq API synchronously, parse JSON array from response."""
    from groq import Groq
    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=2048,
    )
    raw = response.choices[0].message.content.strip()
    # Strip markdown fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


def phase2_generate(
    word_sentences: dict[str, list[str]],
    api_key: str,
) -> list[dict]:
    """For each word with collected sentences, call the LLM to generate entries."""
    master: list[dict] = []

    words_with_data = [
        wd for wd in POLYSEMOUS_WORDS
        if word_sentences.get(wd["word_ta"])
    ]
    logger.info(f"Phase 2 — generating entries for {len(words_with_data)} words via Groq …")

    for idx, word_def in enumerate(words_with_data):
        wt       = word_def["word_ta"]
        sentences = word_sentences[wt]

        sentences_block = "\n".join(f"{i+1}. {s}" for i, s in enumerate(sentences))
        prompt = GENERATION_PROMPT.format(
            word_ta=wt,
            romanized=word_def["romanized"],
            senses=", ".join(word_def["senses"]),
            sentences_list=sentences_block,
        )

        logger.info(f"  [{idx+1}/{len(words_with_data)}] {wt} — calling LLM …")
        try:
            entries = _call_groq(prompt, api_key)
            if isinstance(entries, list):
                master.extend(entries)
                logger.info(f"    → {len(entries)} entries returned")
            else:
                logger.warning(f"    → unexpected response type: {type(entries)}")
        except Exception as exc:
            logger.error(f"    → LLM call failed: {exc}")

        # Respect Groq free-tier rate limits between words (not after the last one)
        if idx < len(words_with_data) - 1:
            logger.info("    (pausing 90 s for Groq rate limit…)")
            time.sleep(90)

    return master


# ── Phase 3: validate and save to new file ────────────────────────────────────

def _validate(entry: dict) -> tuple[bool, str]:
    game     = entry.get("game_sentence", "")
    original = entry.get("original_sentence", "")
    correct  = entry.get("correct_answer", "")
    dists    = entry.get("distractors", [])

    if game.count("______") != 1:
        return False, f"game_sentence has {game.count('______')} blanks (expected 1)"
    if not correct:
        return False, "empty correct_answer"
    if correct not in original:
        return False, f"'{correct}' not found in original_sentence"
    if len(dists) != 3:
        return False, f"{len(dists)} distractors (expected 3)"
    if correct in dists:
        return False, "correct_answer duplicated in distractors"
    return True, ""


def phase3_save(master: list[dict]) -> list[dict]:
    valid: list[dict] = []
    failures: dict[str, int] = {}

    for entry in master:
        ok, reason = _validate(entry)
        if ok:
            valid.append(entry)
        else:
            failures[reason] = failures.get(reason, 0) + 1

    logger.info(
        f"Phase 3 — validation: {len(valid)}/{len(master)} entries passed"
    )
    if failures:
        for reason, count in sorted(failures.items(), key=lambda x: -x[1]):
            logger.info(f"  [{count}x] {reason}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(valid, fh, ensure_ascii=False, indent=2)

    per_word: dict[str, int] = defaultdict(int)
    for e in valid:
        per_word[e.get("word_ta", "?")] += 1

    print("\n" + "=" * 60)
    print("  DATASET BUILD COMPLETE")
    print("=" * 60)
    print(f"  Wikipedia sentences processed : {len(master)}")
    print(f"  Valid entries generated        : {len(valid)}")
    print(f"  Output file                   : {OUTPUT_PATH.name}")
    print("  Entries per word:")
    for wt, cnt in sorted(per_word.items()):
        print(f"    {wt}: {cnt}")
    print("=" * 60)
    print(f"\n  NOTE: curated lexifyd_dataset.json was NOT modified.")
    print(f"  Inspect {OUTPUT_PATH} to review the generated entries.\n")

    return valid


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        logger.error("GROQ_API_KEY not set — add it to backend/.env")
        sys.exit(1)

    try:
        from groq import Groq  # noqa: F401 — just check it's installed
    except ImportError:
        logger.error("groq package missing — run: pip install groq")
        sys.exit(1)

    logger.info("Starting Lexifyd dataset build pipeline")
    logger.info(f"  Wikipedia source: {RAW_FILES_DIR}")
    logger.info(f"  Output target   : {OUTPUT_PATH}")

    word_sentences = phase1_collect(max_per_word=8)
    master         = phase2_generate(word_sentences, api_key)
    phase3_save(master)


if __name__ == "__main__":
    main()
