"""
Automated dataset builder — reads Tamil Wikipedia, generates game entries via
Groq LLM, validates them, and writes to a NEW file (does NOT overwrite the
curated lexifyd_dataset.json).

Pipeline:
  Tamil Wikipedia raw text
    → Phase 1: sentence extraction
    → Phase 2: LLM question generation (Groq llama-3.3-70b-versatile) + retries
    → Phase 3: NFC normalization, deterministic blanks, distractor rules,
               optional IndicBERT gate, dedupe, failed-entry log
    → data/lexifyd_dataset_generated.json (+ optional checkpoint / failures)

Run from the backend/ directory:
    python scripts/build_dataset.py
    python scripts/build_dataset.py --fresh
    python scripts/build_dataset.py --relaxed-distractors
    python scripts/build_dataset.py --indicbert

Env:
    GROQ_API_KEY           — required
    GROQ_SLEEP_SECONDS     — pause between words (default 90)
    DATASET_BUILD_USE_INDICBERT — set to 1 to enable IndicBERT gate (slow; large model)
    DATASET_BUILD_RELAXED_DISTRACTORS — 1 = allow non-inflection distractors if Tamil
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
import unicodedata
from collections import defaultdict
from pathlib import Path

# ── Path / env setup ──────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")

from services.llm_distractors import filter_inflection_distractors

OUTPUT_PATH = BACKEND_DIR / "data" / "lexifyd_dataset_generated.json"
FAILED_PATH = BACKEND_DIR / "data" / "lexifyd_dataset_generated_failed.json"
CHECKPOINT_PATH = BACKEND_DIR / "data" / ".dataset_build_checkpoint.json"
RAW_FILES_DIR = BACKEND_DIR / "data" / "tamil_wiki" / "raw_text_files"

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Regex helpers ─────────────────────────────────────────────────────────────
TAMIL_RE = re.compile(r"[\u0B80-\u0BFF]")
SKIP_START_RE = re.compile(r"^\s*(<doc|</doc|\{\{|==|\*|#|\[|:|;)")
HTML_ENTITY_RE = re.compile(r"&lt;|&gt;|&quot;|&amp;|&#160;")
BRACKET_RE = re.compile(r"\[\[.*?\]\]|\{\{.*?\}\}|<[^>]+>")

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
        "search_forms": ["விழி", "விழியில்", "விழியை", "விழிகள்"],
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
- All distractors must derive from {word_ta} only (must start with the characters of {word_ta})
- Return at most 4 entries total
- original_sentence must be copied verbatim from the list above (no invention)

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


# ── Unicode / text ────────────────────────────────────────────────────────────

def _nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s) if s else s


def _canonical_game_sentence(original: str, correct: str) -> str | None:
    """Replace first occurrence of correct with ______ (single blank)."""
    if not original or not correct:
        return None
    o, c = _nfc(original), _nfc(correct)
    idx = o.find(c)
    if idx < 0:
        return None
    return o[:idx] + "______" + o[idx + len(c) :]


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
    english = sum(1 for ch in line if ch.isascii() and ch.isalpha())
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
    if not RAW_FILES_DIR.is_dir():
        logger.warning("Wikipedia directory missing: %s — Phase 1 will return empty.", RAW_FILES_DIR)
        return {wd["word_ta"]: [] for wd in POLYSEMOUS_WORDS}

    txt_files = list(RAW_FILES_DIR.rglob("*.txt"))
    logger.info("Phase 1 — scanning %s Wikipedia files …", len(txt_files))

    word_sentences: dict[str, list[str]] = defaultdict(list)

    for path in txt_files:
        if all(len(word_sentences[wd["word_ta"]]) >= max_per_word for wd in POLYSEMOUS_WORDS):
            break
        try:
            raw = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        cleaned = " ".join(ln for ln in (_clean_line(l) for l in raw.splitlines()) if ln)
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
        logger.info("  %s (%s): %s sentences", wt, wd["romanized"], len(word_sentences[wt]))

    return dict(word_sentences)


# ── Phase 2: Groq + JSON ─────────────────────────────────────────────────────

def _parse_llm_json_array(raw: str) -> list:
    """Parse JSON array from model output; tolerate fences and trailing junk."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```\s*$", "", text)

    try:
        data = json.loads(text)
        if isinstance(data, dict):
            for key in ("entries", "items", "data", "questions"):
                if key in data and isinstance(data[key], list):
                    return data[key]
            return [data]
        if isinstance(data, list):
            return data
        raise ValueError("root must be array or object with list")
    except json.JSONDecodeError:
        pass

    start, end = text.find("["), text.rfind("]")
    if start != -1 and end > start:
        chunk = text[start : end + 1]
        try:
            data = json.loads(chunk)
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass

    raise ValueError("LLM returned invalid JSON (could not parse array)")


def _call_groq_once(prompt: str, api_key: str) -> str:
    from groq import Groq

    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=2048,
    )
    return response.choices[0].message.content.strip()


def _is_rate_limit_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "429" in msg or "rate limit" in msg or "too many requests" in msg


def call_groq_for_word(prompt: str, api_key: str, max_retries: int = 8) -> list:
    """Call Groq with exponential backoff on rate limits; return parsed list of dicts."""
    last: BaseException | None = None
    for attempt in range(max_retries):
        try:
            raw = _call_groq_once(prompt, api_key)
            return _parse_llm_json_array(raw)
        except Exception as exc:
            last = exc
            if _is_rate_limit_error(exc):
                wait = min(180, int(10 * (2**attempt)))
                logger.warning("Groq rate limit / transient error (attempt %s/%s), sleeping %ss: %s",
                               attempt + 1, max_retries, wait, exc)
                time.sleep(wait)
            else:
                logger.error("Groq / JSON error (attempt %s/%s): %s", attempt + 1, max_retries, exc)
                if attempt < max_retries - 1:
                    time.sleep(min(60, 5 * (attempt + 1)))
                else:
                    raise
    assert last is not None
    raise last


def load_checkpoint() -> dict:
    if not CHECKPOINT_PATH.is_file():
        return {}
    try:
        return json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_checkpoint(data: dict) -> None:
    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def phase2_generate(
    word_sentences: dict[str, list[str]],
    api_key: str,
    *,
    fresh: bool,
    sleep_seconds: float,
) -> list[dict]:
    """For each word with collected sentences, call the LLM (or resume checkpoint)."""
    master: list[dict] = []
    words_with_data = [wd for wd in POLYSEMOUS_WORDS if word_sentences.get(wd["word_ta"])]

    cp = {} if fresh else load_checkpoint()
    by_word: dict[str, list] = dict(cp.get("by_word") or {})

    logger.info("Phase 2 — generating entries for %s words via Groq …", len(words_with_data))

    for idx, word_def in enumerate(words_with_data):
        wt = word_def["word_ta"]
        sentences = word_sentences[wt]

        if wt in by_word and not fresh:
            master.extend(by_word[wt])
            logger.info("  [%s/%s] %s — using checkpoint (%s entries)", idx + 1, len(words_with_data), wt, len(by_word[wt]))
            continue

        sentences_block = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(sentences))
        prompt = GENERATION_PROMPT.format(
            word_ta=wt,
            romanized=word_def["romanized"],
            senses=", ".join(word_def["senses"]),
            sentences_list=sentences_block,
        )

        logger.info("  [%s/%s] %s — calling LLM …", idx + 1, len(words_with_data), wt)
        try:
            entries = call_groq_for_word(prompt, api_key)
            if not isinstance(entries, list):
                logger.warning("    → unexpected response type: %s", type(entries))
                entries = []
            dict_entries = [e for e in entries if isinstance(e, dict)]
            by_word[wt] = dict_entries
            save_checkpoint({"by_word": by_word})
            master.extend(dict_entries)
            logger.info("    → %s entries returned", len(dict_entries))
        except Exception as exc:
            logger.error("    → LLM failed for %s: %s", wt, exc)

        if idx < len(words_with_data) - 1 and sleep_seconds > 0:
            logger.info("    (pausing %s s for Groq rate limit…)", sleep_seconds)
            time.sleep(sleep_seconds)

    return master


# ── Phase 3: validate, optional IndicBERT, save ─────────────────────────────

def _relaxed_distractors_ok(distractors: list[str], correct: str) -> tuple[bool, str]:
    if len(distractors) != 3:
        return False, f"{len(distractors)} distractors (expected 3)"
    seen = set()
    for d in distractors:
        d = _nfc((d or "").strip())
        if not d:
            return False, "empty distractor"
        if not TAMIL_RE.search(d):
            return False, f"distractor has no Tamil script: {d!r}"
        if len(d) > 48:
            return False, "distractor too long"
        if d == _nfc(correct.strip()):
            return False, "distractor equals correct_answer"
        if d in seen:
            return False, "duplicate distractor"
        seen.add(d)
    return True, ""


def _indicbert_gate(entry: dict) -> tuple[bool, str]:
    """When the blank scores are meaningful, require correct > distractors."""
    try:
        from services.indic_bert import score_distractors as bert_score
    except Exception as exc:
        logger.debug("IndicBERT skip (import): %s", exc)
        return True, ""

    try:
        rows = bert_score(
            entry["game_sentence"],
            entry["correct_answer"],
            entry["distractors"],
        )
        correct_row = bert_score(
            entry["game_sentence"],
            entry["correct_answer"],
            [entry["correct_answer"]],
        )
    except Exception as exc:
        logger.warning("IndicBERT scoring failed (entry kept): %s", exc)
        return True, ""

    cs = correct_row[0].get("score", 0.0) if correct_row else 0.0
    max_d = max((r.get("score", 0.0) for r in rows), default=0.0)

    # If the MLM didn't surface the gold token, scores are unreliable — do not reject.
    if cs <= 0:
        return True, ""

    if max_d >= cs:
        return False, "IndicBERT: a distractor scores >= correct answer at blank"

    good = sum(1 for r in rows if r.get("is_good_distractor"))
    if good < 1:
        return False, "IndicBERT: no distractor flagged as weaker fit than correct"

    return True, ""


def validate_and_normalize_entry(
    entry: dict,
    *,
    relaxed_distractors: bool,
    use_indicbert: bool,
) -> tuple[bool, str, dict | None]:
    """
    Returns (ok, reason, normalized_entry_or_none).
    On success, normalized_entry has canonical game_sentence and NFC text fields.
    """
    word_ta = _nfc((entry.get("word_ta") or "").strip())
    original = _nfc((entry.get("original_sentence") or "").strip())
    correct = _nfc((entry.get("correct_answer") or "").strip())
    dists_raw = entry.get("distractors") or []

    if not isinstance(dists_raw, list):
        return False, "distractors must be a list", None
    dists = [_nfc(str(d).strip()) for d in dists_raw if str(d).strip()]

    if not word_ta:
        return False, "missing word_ta", None
    if not correct:
        return False, "empty correct_answer", None
    if correct not in original:
        return False, f"{correct!r} not found in original_sentence", None

    canonical = _canonical_game_sentence(original, correct)
    if canonical is None or canonical.count("______") != 1:
        return False, "could not build single-blank game_sentence", None

    if len(dists) != 3:
        return False, f"{len(dists)} distractors (expected 3)", None
    if correct in dists:
        return False, "correct_answer duplicated in distractors", None

    if relaxed_distractors:
        ok_r, reason_r = _relaxed_distractors_ok(dists, correct)
        if not ok_r:
            return False, reason_r, None
    else:
        filtered = filter_inflection_distractors(dists, correct, word_ta)
        if len(filtered) != 3:
            return False, "distractors must be 3 distinct inflected forms of root (prefix match)", None

    out = dict(entry)
    out["word_ta"] = word_ta
    out["original_sentence"] = original
    out["correct_answer"] = correct
    out["distractors"] = dists
    out["game_sentence"] = canonical

    if use_indicbert:
        ok_b, reason_b = _indicbert_gate(out)
        if not ok_b:
            return False, reason_b, None

    return True, "", out


def phase3_save(
    master: list[dict],
    *,
    relaxed_distractors: bool,
    use_indicbert: bool,
) -> list[dict]:
    valid: list[dict] = []
    failed: list[dict] = []
    failures: dict[str, int] = {}
    seen_keys: set[tuple[str, str]] = set()

    for entry in master:
        if not isinstance(entry, dict):
            failures["not_a_dict"] = failures.get("not_a_dict", 0) + 1
            failed.append({"entry": entry, "reason": "not_a_dict"})
            continue

        ok, reason, normalized = validate_and_normalize_entry(
            entry,
            relaxed_distractors=relaxed_distractors,
            use_indicbert=use_indicbert,
        )
        if not ok:
            failures[reason] = failures.get(reason, 0) + 1
            failed.append({"entry": entry, "reason": reason})
            continue

        assert normalized is not None
        key = (normalized["original_sentence"], normalized["correct_answer"])
        if key in seen_keys:
            failures["duplicate_sentence+answer"] = failures.get("duplicate_sentence+answer", 0) + 1
            failed.append({"entry": entry, "reason": "duplicate_sentence+answer"})
            continue
        seen_keys.add(key)
        valid.append(normalized)

    logger.info("Phase 3 — validation: %s/%s entries passed", len(valid), len(master))
    if failures:
        for reason, count in sorted(failures.items(), key=lambda x: -x[1]):
            logger.info("  [%sx] %s", count, reason)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(valid, ensure_ascii=False, indent=2), encoding="utf-8")

    FAILED_PATH.write_text(json.dumps(failed, ensure_ascii=False, indent=2), encoding="utf-8")

    per_word: dict[str, int] = defaultdict(int)
    for e in valid:
        per_word[e.get("word_ta", "?")] += 1

    print("\n" + "=" * 60)
    print("  DATASET BUILD COMPLETE")
    print("=" * 60)
    print(f"  Raw LLM rows processed     : {len(master)}")
    print(f"  Valid entries written      : {len(valid)}")
    print(f"  Failed (with reasons)      : {len(failed)} → {FAILED_PATH.name}")
    print(f"  Output file                : {OUTPUT_PATH.name}")
    print("  Entries per word:")
    for wt, cnt in sorted(per_word.items()):
        print(f"    {wt}: {cnt}")
    print("=" * 60)
    print("\n  NOTE: curated lexifyd_dataset.json was NOT modified.")
    print(f"  Inspect {OUTPUT_PATH} and triage {FAILED_PATH.name} as needed.\n")

    return valid


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Build lexifyd_dataset_generated.json from Tamil Wikipedia + Groq")
    parser.add_argument("--fresh", action="store_true", help="Ignore checkpoint and re-call LLM for every word")
    parser.add_argument(
        "--relaxed-distractors",
        action="store_true",
        help="Allow any Tamil distractors (matches some curated JSON styles; weaker for morphology)",
    )
    parser.add_argument("--indicbert", action="store_true", help="Run IndicBERT fill-mask gate (slow, downloads ~1GB model on first use)")
    args = parser.parse_args()

    relaxed = args.relaxed_distractors or os.getenv("DATASET_BUILD_RELAXED_DISTRACTORS", "").strip() in ("1", "true", "yes")
    use_indicbert = args.indicbert or os.getenv("DATASET_BUILD_USE_INDICBERT", "").strip() in ("1", "true", "yes")

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        logger.error("GROQ_API_KEY not set — add it to backend/.env")
        sys.exit(1)

    try:
        from groq import Groq  # noqa: F401
    except ImportError:
        logger.error("groq package missing — run: pip install groq")
        sys.exit(1)

    sleep_seconds = float(os.getenv("GROQ_SLEEP_SECONDS", "90"))

    logger.info("Starting Lexifyd dataset build pipeline")
    logger.info("  Wikipedia source : %s", RAW_FILES_DIR)
    logger.info("  Output target    : %s", OUTPUT_PATH)
    logger.info("  Checkpoint       : %s (--fresh to reset)", CHECKPOINT_PATH)
    logger.info("  Relaxed distractors: %s", relaxed)
    logger.info("  IndicBERT gate   : %s", use_indicbert)

    word_sentences = phase1_collect(max_per_word=8)
    master = phase2_generate(
        word_sentences,
        api_key,
        fresh=args.fresh,
        sleep_seconds=sleep_seconds,
    )
    phase3_save(master, relaxed_distractors=relaxed, use_indicbert=use_indicbert)


if __name__ == "__main__":
    main()
