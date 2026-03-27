"""
One-time script to index Tamil Wikipedia articles into corpus.db for FTS5 search.

Run from the backend/ directory:
    python scripts/build_corpus_index.py

Or from the project root:
    python -m backend.scripts.build_corpus_index
"""

import re
import sqlite3
import sys
from pathlib import Path

# Resolve paths relative to this script's location (backend/scripts/)
BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data" / "tamil_wiki" / "raw_text_files"
CORPUS_DB = BACKEND_DIR / "data" / "corpus.db"

TAMIL_RANGE = re.compile(r'[\u0B80-\u0BFF]')
MARKUP_PATTERNS = re.compile(r'http|www|==|\[\[|\]\]|\{\{|\}\}')


def is_valid_sentence(sentence: str) -> bool:
    words = sentence.split()
    if not (6 <= len(words) <= 20):
        return False
    if not TAMIL_RANGE.search(sentence):
        return False
    total_chars = len(sentence.replace(" ", ""))
    if total_chars == 0:
        return False
    english_chars = sum(1 for c in sentence if c.isascii() and c.isalpha())
    if english_chars / total_chars >= 0.30:
        return False
    if MARKUP_PATTERNS.search(sentence):
        return False
    return True


def build_index():
    if not DATA_DIR.exists():
        print(f"ERROR: Data directory not found: {DATA_DIR}", file=sys.stderr)
        sys.exit(1)

    CORPUS_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(CORPUS_DB)
    conn.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS corpus USING fts5(
            sentence_ta,
            source_file,
            tokenize='unicode61'
        )
    """)
    conn.commit()

    txt_files = list(DATA_DIR.rglob("*.txt"))
    print(f"Found {len(txt_files)} .txt files under {DATA_DIR}")

    total_sentences = 0
    batch = []
    BATCH_SIZE = 1000

    for file_idx, path in enumerate(txt_files):
        if file_idx > 0 and file_idx % 5000 == 0:
            print(f"  Processed {file_idx} files, {total_sentences} sentences indexed so far…")

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        sentences = re.split(r'(?<=[.।\n])\s+', text)
        source_str = str(path)

        for sentence in sentences:
            sentence = sentence.strip()
            if is_valid_sentence(sentence):
                batch.append((sentence, source_str))
                total_sentences += 1

                if len(batch) >= BATCH_SIZE:
                    conn.executemany(
                        "INSERT INTO corpus(sentence_ta, source_file) VALUES (?, ?)", batch
                    )
                    conn.commit()
                    batch.clear()

    if batch:
        conn.executemany(
            "INSERT INTO corpus(sentence_ta, source_file) VALUES (?, ?)", batch
        )
        conn.commit()

    conn.close()
    print(f"\nDone. {total_sentences} sentences indexed into {CORPUS_DB}")


if __name__ == "__main__":
    build_index()
