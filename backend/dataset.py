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


def get_flashcard_data() -> list[dict]:
    """Return one flashcard per word, with one example entry per unique sense."""
    seen_words: dict[str, dict] = {}
    for entry in _dataset:
        wt = entry["word_ta"]
        if wt not in seen_words:
            seen_words[wt] = {
                "word_ta": wt,
                "word_romanized": entry.get("word_romanized", ""),
                "senses": [],
            }
        sense = entry.get("sense", "")
        already = [s["sense"] for s in seen_words[wt]["senses"]]
        if sense and sense not in already:
            # Use original_sentence if available, otherwise reconstruct from game_sentence
            example = entry.get("original_sentence") or entry["game_sentence"].replace(
                "______", entry["correct_answer"]
            )
            seen_words[wt]["senses"].append({
                "sense": sense,
                "sense_ta": entry.get("sense_ta", ""),
                "pos": entry.get("pos", ""),
                "example_sentence": example,
            })
    return list(seen_words.values())


def get_all_senses() -> list[str]:
    """Return a flat list of all unique sense strings across every word."""
    senses: set[str] = set()
    for entry in _dataset:
        s = entry.get("sense", "")
        if s:
            senses.add(s)
    return sorted(senses)


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
