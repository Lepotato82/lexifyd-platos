"""
One-time dataset builder. Reads Tamil Wikipedia files, extracts polysemous
word examples, generates game questions via LLM, saves lexifyd_dataset.json,
and clears lexifyd.db so the app re-ingests from the clean dataset.

Run from backend/ directory:
    python scripts/build_dataset.py
"""

import asyncio
import json
import logging
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Load env before importing models (so DATABASE_URL and GROQ_API_KEY are set)
from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

# Force absolute DB path regardless of CWD
os.environ["DATABASE_URL"] = f"sqlite:///{BACKEND_DIR / 'lexifyd.db'}"

from services.llm_service import LLMClient  # noqa: E402
from models.db import engine  # noqa: E402  (imports register SQLModel metadata)
import models.db  # noqa: F401 — ensures all Table classes are registered
from sqlmodel import SQLModel  # noqa: E402

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ERROR_LOG = BACKEND_DIR / "logs" / "dataset_build_errors.log"
DATASET_PATH = BACKEND_DIR / "data" / "lexifyd_dataset.json"
RAW_FILES_DIR = BACKEND_DIR / "data" / "tamil_wiki" / "raw_text_files"

TAMIL_RE = re.compile(r"[\u0B80-\u0BFF]")
MARKUP_RE = re.compile(r"<doc|</doc|^\{\{|^==|^\*|^#|^\[|^:|^;", re.MULTILINE)
SKIP_START_RE = re.compile(r"^\s*(<doc|</doc|\{\{|==|\*|#|\[|:|;)")
HTML_ENTITY_RE = re.compile(r"&lt;|&gt;|&quot;|&amp;|&#160;")
BRACKET_RE = re.compile(r"\[\[.*?\]\]|\{\{.*?\}\}|<[^>]+>")

# ── Polysemous word definitions ───────────────────────────────────────────────
POLYSEMOUS_WORDS = [
    {"word_ta": "ஆறு", "romanized": "Aaru",
     "search_forms": ["ஆறு", "ஆற்றில்", "ஆற்றை", "ஆற்றின்", "ஆறாக", "ஆற்று"],
     "senses": ["river", "six", "to cool down"]},

    {"word_ta": "படி", "romanized": "Padi",
     "search_forms": ["படி", "படித்", "படிக்", "படிகள்", "படியில்", "படியை"],
     "senses": ["to read/study", "staircase/step", "a unit of measure"]},

    {"word_ta": "கல்", "romanized": "Kal",
     "search_forms": ["கல்", "கல்லை", "கல்லில்", "கற்க", "கற்று", "கல்வி"],
     "senses": ["stone/rock", "to learn"]},

    {"word_ta": "திங்கள்", "romanized": "Thingal",
     "search_forms": ["திங்கள்", "திங்களில்", "திங்களன்று"],
     "senses": ["Monday", "moon", "month"]},

    {"word_ta": "முகம்", "romanized": "Mugam",
     "search_forms": ["முகம்", "முகத்தை", "முகத்தில்", "முகமாக"],
     "senses": ["face", "entrance/front"]},

    {"word_ta": "தலை", "romanized": "Thalai",
     "search_forms": ["தலை", "தலையில்", "தலையை", "தலைவர்", "தலைமை"],
     "senses": ["head", "chief/leader", "beginning"]},

    {"word_ta": "விழி", "romanized": "Vizhi",
     "search_forms": ["விழி", "விழியில்", "விழியை", "விழுந்த", "விழுந்து"],
     "senses": ["eye", "to fall"]},

    {"word_ta": "காலம்", "romanized": "Kaalam",
     "search_forms": ["காலம்", "காலத்தில்", "காலத்தை", "காலமாக"],
     "senses": ["time/era", "death/end"]},

    {"word_ta": "நிலம்", "romanized": "Nilam",
     "search_forms": ["நிலம்", "நிலத்தில்", "நிலத்தை", "நிலமாக"],
     "senses": ["land/earth", "floor/ground", "colour blue"]},

    {"word_ta": "வாய்", "romanized": "Vaai",
     "search_forms": ["வாய்", "வாயில்", "வாயை", "வாயால்"],
     "senses": ["mouth", "opening/entrance", "opportunity"]},
]

DATASET_GENERATION_PROMPT = """You are a Tamil linguistics expert building a verified game dataset.

Root word: {word_ta} ({romanized})
Known senses: {senses}

Here are real sentences from Tamil Wikipedia containing this word:
{sentences_list}

For each sentence:
1. Identify which sense of {word_ta} is being used
2. Find the exact inflected form of {word_ta} in the sentence
3. Create a game question by replacing that form with ______
4. Generate 3 smart distractors:
   - Must be real Tamil inflected forms
   - Grammatically plausible but semantically WRONG for this sentence
   - Prefer other inflected forms of {word_ta} in wrong case/tense
   - NEVER use forms of a different root word

CRITICAL RULES:
- Only include sentences where the sense is 100% clear from context
- Skip sentences where the word's sense is ambiguous
- Skip sentences that sound unnatural or encyclopedic
- correct_answer must be the EXACT form as it appears in the sentence
- All inflected forms must derive from {word_ta} only

Return a JSON array. For each valid sentence include:
{{
  "word_ta": "{word_ta}",
  "word_romanized": "{romanized}",
  "sense": "English sense label",
  "sense_ta": "Tamil sense label",
  "pos": "Noun or Verb or Adjective",
  "original_sentence": "full original sentence",
  "game_sentence": "sentence with ______ replacing the word",
  "correct_answer": "exact inflected form",
  "distractors": ["wrong1", "wrong2", "wrong3"],
  "corpus_grounded": true,
  "source": "Tamil Wikipedia"
}}

Skip sentences that don't pass the rules — only return valid entries.
Return at most 4 entries total.
Return ONLY the JSON array, no markdown, no explanation."""


# ── Phase 1: Clean and collect sentences ─────────────────────────────────────

def clean_line(line: str) -> str:
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


def extract_sentences(text: str) -> list[str]:
    sentences = []
    for part in re.split(r"[।]|\.\s+", text):
        part = part.strip()
        words = part.split()
        if 6 <= len(words) <= 20 and TAMIL_RE.search(part):
            sentences.append(part)
    return sentences


def phase1_collect() -> tuple[list[str], dict[str, list[str]]]:
    """Walk all wiki files, clean lines, collect sentences per polysemous word."""
    txt_files = list(RAW_FILES_DIR.rglob("*.txt"))
    logger.info(f"Phase 1: walking {len(txt_files)} files…")

    all_sentences: list[str] = []
    word_sentences: dict[str, list[str]] = defaultdict(list)
    MAX_PER_WORD = 6

    for path in txt_files:
        try:
            raw = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        cleaned_lines = [clean_line(ln) for ln in raw.splitlines()]
        cleaned_text = " ".join(l for l in cleaned_lines if l)
        sentences = extract_sentences(cleaned_text)
        all_sentences.extend(sentences)

        for word_def in POLYSEMOUS_WORDS:
            wt = word_def["word_ta"]
            if len(word_sentences[wt]) >= MAX_PER_WORD:
                continue
            for form in word_def["search_forms"]:
                if len(word_sentences[wt]) >= MAX_PER_WORD:
                    break
                for s in sentences:
                    if form in s and s not in word_sentences[wt]:
                        word_sentences[wt].append(s)
                    if len(word_sentences[wt]) >= MAX_PER_WORD:
                        break

    logger.info(f"Phase 1 done: {len(all_sentences):,} total sentences")
    for wd in POLYSEMOUS_WORDS:
        wt = wd["word_ta"]
        logger.info(f"  {wt}: {len(word_sentences[wt])} sentences collected")

    return all_sentences, dict(word_sentences)


# ── Phase 2: Generate questions via LLM ──────────────────────────────────────

async def phase2_generate(
    word_sentences: dict[str, list[str]], llm: LLMClient
) -> list[dict]:
    ERROR_LOG.parent.mkdir(parents=True, exist_ok=True)
    master: list[dict] = []

    for word_def in POLYSEMOUS_WORDS:
        wt = word_def["word_ta"]
        sentences = word_sentences.get(wt, [])
        if not sentences:
            logger.warning(f"No sentences for {wt} — skipping")
            continue

        sentences_list = "\n".join(f"{i+1}. {s}" for i, s in enumerate(sentences))
        prompt = DATASET_GENERATION_PROMPT.format(
            word_ta=wt,
            romanized=word_def["romanized"],
            senses=", ".join(word_def["senses"]),
            sentences_list=sentences_list,
        )

        logger.info(f"Phase 2: generating questions for {wt} ({len(sentences)} sentences)...")
        try:
            result = await llm.complete_json(prompt)
            if isinstance(result, list):
                master.extend(result)
                logger.info(f"  {wt}: {len(result)} entries returned")
            else:
                raise ValueError(f"Expected list, got {type(result)}")
        except Exception as e:
            logger.error(f"LLM failed for {wt}: {e}")
            with open(ERROR_LOG, "a", encoding="utf-8") as f:
                f.write(f"{wt}: {e}\n")

        # Pause between words only for Groq (free-tier rate limits)
        # llama-3.3-70b-versatile: 6,000 TPM limit; each request ~3,000 tokens
        # 90s gap covers retries' token burn and gives full TPM budget recovery
        if llm.provider == "groq":
            logger.info("Waiting 90s before next word (Groq rate limit)...")
            await asyncio.sleep(90)

    return master


# ── Phase 3: Validate and save ────────────────────────────────────────────────

def validate_entry(entry: dict) -> tuple[bool, str]:
    """Returns (is_valid, reason_if_invalid)."""
    game = entry.get("game_sentence", "")
    original = entry.get("original_sentence", "")
    correct = entry.get("correct_answer", "")
    distractors = entry.get("distractors", [])

    if game.count("______") != 1:
        return False, f"game_sentence has {game.count('______')} blanks"
    if not correct:
        return False, "empty correct_answer"
    if correct not in original:
        return False, f"correct_answer {correct!r} not found in original_sentence"
    if len(distractors) != 3:
        return False, f"distractors has {len(distractors)} items (expected 3)"
    if correct in distractors:
        return False, "correct_answer duplicated in distractors"
    return True, ""


def phase3_save(master: list[dict]) -> list[dict]:
    valid = []
    fail_reasons: dict[str, int] = {}
    for entry in master:
        ok, reason = validate_entry(entry)
        if ok:
            valid.append(entry)
        else:
            fail_reasons[reason] = fail_reasons.get(reason, 0) + 1

    logger.info(f"Phase 3: {len(valid)}/{len(master)} entries passed validation")
    if fail_reasons:
        logger.info("Failure reasons:")
        for reason, count in sorted(fail_reasons.items(), key=lambda x: -x[1]):
            logger.info(f"  [{count}x] {reason}")

    DATASET_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(valid, f, ensure_ascii=False, indent=2)

    per_word: dict[str, int] = defaultdict(int)
    for e in valid:
        per_word[e.get("word_ta", "?")] += 1

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("\n--- Dataset build summary ---")
    print(f"Total sentences processed : {len(master)}")
    print(f"Valid entries generated   : {len(valid)}")
    print("Entries per word:")
    for wt, cnt in sorted(per_word.items()):
        print(f"  {wt}: {cnt}")
    print(f"Saved to {DATASET_PATH}")

    return valid


# ── Phase 4: Clear stale DB ───────────────────────────────────────────────────

def phase4_clear_db():
    logger.info("Phase 4: clearing lexifyd.db…")
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    logger.info("Cleared lexifyd.db — will rebuild from clean dataset on next run")


# ── Entry point ───────────────────────────────────────────────────────────────

async def main():
    llm = LLMClient()

    _, word_sentences = phase1_collect()
    master = await phase2_generate(word_sentences, llm)
    phase3_save(master)
    phase4_clear_db()


if __name__ == "__main__":
    asyncio.run(main())
