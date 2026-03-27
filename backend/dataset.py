"""In-memory dataset loaded once at startup from lexifyd_dataset.json."""
import json
from pathlib import Path
from collections import defaultdict

DATASET_PATH = Path(__file__).parent / "data" / "lexifyd_dataset.json"

_dataset: list[dict] = []


def load_dataset() -> int:
    global _dataset
    _dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    return len(_dataset)


def get_entries_for_word(word_ta: str) -> list[dict]:
    return [e for e in _dataset if e["word_ta"] == word_ta]


def get_all_words() -> list[dict]:
    """Return unique words with romanized name and list of unique senses."""
    seen: dict[str, dict] = {}
    for entry in _dataset:
        wt = entry["word_ta"]
        if wt not in seen:
            seen[wt] = {
                "word_ta": wt,
                "word_romanized": entry.get("word_romanized", ""),
                "senses": [],
            }
        sense = entry.get("sense", "")
        if sense and sense not in seen[wt]["senses"]:
            seen[wt]["senses"].append(sense)
    return list(seen.values())
