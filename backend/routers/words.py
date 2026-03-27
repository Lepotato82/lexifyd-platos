from fastapi import APIRouter, HTTPException
from models import WordInfo
from dataset import get_all_words, get_entries_for_word

router = APIRouter()


@router.get("", response_model=list[WordInfo])
def list_words():
    return [
        WordInfo(
            word_ta=w["word_ta"],
            word_romanized=w["word_romanized"],
            sense_count=len(w["senses"]),
            senses=w["senses"],
        )
        for w in get_all_words()
    ]


@router.get("/{word_ta}", response_model=WordInfo)
def get_word(word_ta: str):
    entries = get_entries_for_word(word_ta)
    if not entries:
        raise HTTPException(404, f"'{word_ta}' is not in the dataset yet")
    senses = list(dict.fromkeys(e["sense"] for e in entries))
    return WordInfo(
        word_ta=word_ta,
        word_romanized=entries[0].get("word_romanized", ""),
        sense_count=len(senses),
        senses=senses,
    )
