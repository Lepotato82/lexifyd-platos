import json
import os
import logging
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_db
from dataset import get_entries_for_word
from models import (
    GameSession, GameAnswer,
    StartGameRequest, StartGameResponse, QuestionOut,
    AnswerRequest, AnswerResponse,
    ResultsResponse, ResultAnswer,
)

log = logging.getLogger(__name__)

router = APIRouter()


def _stars(correct: int, total: int) -> int:
    if total == 0:
        return 0
    pct = correct / total
    if pct == 1.0:
        return 3
    elif pct >= 0.6:
        return 2
    return 1


DIFFICULTY_BASE_SCORE = {"easy": 10, "medium": 12, "hard": 15}

# 10 questions: 6 morphological (fill-blank) + 4 semantic (identify-meaning)
MORPH_TARGETS  = [("easy", 2), ("medium", 2), ("hard", 2)]   # 6 total
SEMANTIC_TARGETS = [("easy", 2), ("medium", 1), ("hard", 1)]  # 4 total
MAX_QUESTIONS = 10

# Speed bonus thresholds (rapid fire mode only)
SPEED_BONUS = [(10_000, 5), (20_000, 3)]  # (ms_threshold, bonus_pts)


def _pick_sense_diverse(pool: list, n: int) -> list:
    """Pick up to n entries from pool, prioritising one per unique sense."""
    random.shuffle(pool)
    seen: set[str] = set()
    first, rest = [], []
    for e in pool:
        s = e.get("sense", "")
        if s not in seen:
            seen.add(s)
            first.append(e)
        else:
            rest.append(e)
    random.shuffle(rest)
    return (first + rest)[:n]


def _select_entries(entries: list, targets: list[tuple[str, int]],
                    used_ids: set[int]) -> list:
    """Pick sense-diverse entries by difficulty tier, avoiding already-used entries."""
    buckets: dict[str, list] = {"easy": [], "medium": [], "hard": []}
    for e in entries:
        if id(e) in used_ids:
            continue
        d = e.get("difficulty", "easy")
        buckets.setdefault(d, []).append(e)

    selected = []
    for diff, target in targets:
        picked = _pick_sense_diverse(buckets.get(diff, []), target)
        for e in picked:
            used_ids.add(id(e))
        selected.extend(picked)
    return selected


# ── Morphological question builder ────────────────────────────────────────────

def _build_morph_question(
    index: int, entry: dict, entries: list, all_root_forms: set[str],
    use_dynamic: bool, word_ta: str,
) -> dict:
    """Build a fill-in-the-blank morphological question."""
    correct = entry["correct_answer"]
    difficulty = entry.get("difficulty", "easy")
    blank_count = entry.get("game_sentence", "").count("______")
    dataset_distractors = entry.get("distractors", [])[:3]

    if use_dynamic:
        try:
            from services.llm_distractors import generate_distractors
            distractors = generate_distractors(
                sentence=entry["game_sentence"],
                correct_answer=correct,
                word_ta=word_ta,
                sense=entry.get("sense", ""),
                pos=entry.get("pos", ""),
                fallback_distractors=dataset_distractors,
            )
        except Exception as e:
            log.warning("Dynamic distractor generation failed: %s", e)
            distractors = dataset_distractors
    else:
        distractors = dataset_distractors

    def _morph_distractors(exclude: set[str], n: int = 3, fallback=None):
        pool = list(all_root_forms - exclude)
        random.shuffle(pool)
        result = pool[:n]
        if fallback:
            for d in fallback:
                if len(result) >= n:
                    break
                if d not in result and d not in exclude:
                    result.append(d)
        return result

    blank1_correct = ""
    blank2_correct = ""
    options_blank1 = []
    options_blank2 = []

    if blank_count >= 2:
        blank1_correct = entry.get("correct_answer_blank1", correct)
        blank2_correct = entry.get("correct_answer_blank2", correct)
        b1d = _morph_distractors({blank1_correct, blank2_correct}, fallback=distractors)
        b2d = _morph_distractors({blank1_correct, blank2_correct}, fallback=distractors)
        opts1 = [blank1_correct] + b1d[:3]
        opts2 = [blank2_correct] + b2d[:3]
        random.shuffle(opts1)
        random.shuffle(opts2)
        options_blank1 = opts1
        options_blank2 = opts2
        options = opts1
    else:
        morph = _morph_distractors({correct}, fallback=distractors)
        options = [correct] + morph[:3]
        random.shuffle(options)

    return {
        "index": index,
        "game_sentence": entry["game_sentence"],
        "sense": entry.get("sense", ""),
        "sense_ta": entry.get("sense_ta", ""),
        "pos": entry.get("pos", ""),
        "correct_answer": correct,
        "options": options,
        "difficulty": difficulty,
        "blank_count": blank_count,
        "question_type": "morphological",
        "original_sentence": entry.get("original_sentence", ""),
        "highlighted_word": "",
        "sense_blank1": "",
        "sense_blank2": "",
        "correct_answer_blank1": blank1_correct,
        "correct_answer_blank2": blank2_correct,
        "options_blank1": options_blank1,
        "options_blank2": options_blank2,
    }


# ── Semantic question builder ─────────────────────────────────────────────────

def _build_semantic_question(
    index: int, entry: dict, all_senses: list[str],
    all_senses_global: list[str],
) -> dict:
    """Build an identify-the-meaning semantic question."""
    difficulty = entry.get("difficulty", "easy")
    blank_count = entry.get("game_sentence", "").count("______")
    correct_sense = entry.get("sense", "")
    original = entry.get("original_sentence", "")
    # The highlighted word is the inflected form that appears in the sentence
    highlighted = entry.get("correct_answer", "")

    # Collect wrong senses (from this word's other senses)
    wrong = [s for s in all_senses if s != correct_sense]
    random.shuffle(wrong)
    wrong = wrong[:3]

    # Fill from global senses if not enough
    if len(wrong) < 3:
        for s in all_senses_global:
            if len(wrong) >= 3:
                break
            if s != correct_sense and s not in wrong:
                wrong.append(s)

    options = [correct_sense] + wrong[:3]
    random.shuffle(options)

    # ── Hard semantic: two highlighted words with different senses ──
    sense_b1 = ""
    sense_b2 = ""
    options_blank1 = []
    options_blank2 = []
    correct_b1 = ""
    correct_b2 = ""

    if blank_count >= 2:
        sense_b1 = entry.get("sense_blank1", correct_sense)
        sense_b2 = entry.get("sense_blank2", correct_sense)
        highlighted = entry.get("correct_answer_blank1", highlighted)

        # Build separate sense option pools per blank
        wrong1 = [s for s in all_senses if s != sense_b1]
        random.shuffle(wrong1)
        for s in all_senses_global:
            if len(wrong1) >= 3:
                break
            if s != sense_b1 and s not in wrong1:
                wrong1.append(s)
        opts1 = [sense_b1] + wrong1[:3]
        random.shuffle(opts1)

        wrong2 = [s for s in all_senses if s != sense_b2]
        random.shuffle(wrong2)
        for s in all_senses_global:
            if len(wrong2) >= 3:
                break
            if s != sense_b2 and s not in wrong2:
                wrong2.append(s)
        opts2 = [sense_b2] + wrong2[:3]
        random.shuffle(opts2)

        options_blank1 = opts1
        options_blank2 = opts2
        options = opts1
        correct_b1 = sense_b1
        correct_b2 = sense_b2

    return {
        "index": index,
        "game_sentence": entry.get("game_sentence", ""),
        "sense": entry.get("sense", ""),
        "sense_ta": entry.get("sense_ta", ""),
        "pos": entry.get("pos", ""),
        "correct_answer": correct_sense if blank_count < 2 else correct_b1,
        "options": options,
        "difficulty": difficulty,
        "blank_count": blank_count if blank_count >= 2 else 1,
        "question_type": "semantic",
        "original_sentence": original,
        "highlighted_word": highlighted,
        "sense_blank1": sense_b1,
        "sense_blank2": sense_b2,
        "correct_answer_blank1": correct_b1,
        "correct_answer_blank2": correct_b2,
        "options_blank1": options_blank1,
        "options_blank2": options_blank2,
    }


# ── Start game endpoint ──────────────────────────────────────────────────────

@router.post("/start", response_model=StartGameResponse)
def start_game(req: StartGameRequest, db: Session = Depends(get_db)):
    entries = get_entries_for_word(req.word_ta)
    if not entries:
        raise HTTPException(404, f"'{req.word_ta}' is not in the dataset yet")

    # Pre-compute morphological root forms
    all_root_forms: set[str] = set()
    for e in entries:
        for key in ("correct_answer", "correct_answer_blank1", "correct_answer_blank2"):
            val = e.get(key, "")
            if val:
                all_root_forms.add(val)

    # Collect all unique base senses for this word (for semantic options)
    all_senses = sorted({e.get("sense", "") for e in entries if e.get("sense")})

    # Global senses (from all entries) for fallback when a word has < 4 senses
    from dataset import get_all_senses
    all_senses_global = get_all_senses()

    use_dynamic = os.getenv("LLM_PROVIDER") in ("groq", "ollama")
    used_ids: set[int] = set()

    # ── Pick morphological entries ─────────────────────────────────────────
    morph_entries = _select_entries(entries, MORPH_TARGETS, used_ids)

    # ── Pick semantic entries (can reuse same underlying entries) ───────────
    sem_used: set[int] = set()
    sem_entries = _select_entries(entries, SEMANTIC_TARGETS, sem_used)

    # ── Build questions ────────────────────────────────────────────────────
    questions_data = []
    qi = 0

    # Morphological questions first (easy → medium → hard)
    for entry in morph_entries:
        questions_data.append(_build_morph_question(
            qi, entry, entries, all_root_forms, use_dynamic, req.word_ta,
        ))
        qi += 1

    # Semantic questions second (easy → medium → hard)
    for entry in sem_entries:
        questions_data.append(_build_semantic_question(
            qi, entry, all_senses, all_senses_global,
        ))
        qi += 1

    # Cap to MAX_QUESTIONS
    questions_data = questions_data[:MAX_QUESTIONS]

    session = GameSession(
        word_ta=req.word_ta,
        word_romanized=entries[0].get("word_romanized", ""),
        questions_json=json.dumps(questions_data, ensure_ascii=False),
        rapid_fire=req.rapid_fire,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return StartGameResponse(
        session_id=session.id,
        word_ta=session.word_ta,
        word_romanized=session.word_romanized,
        total_questions=len(questions_data),
        questions=[QuestionOut(**{k: v for k, v in q.items()
                                  if k in QuestionOut.model_fields})
                   for q in questions_data],
        rapid_fire=session.rapid_fire,
        timer_easy=45,
        timer_hard=60,
    )


# ── Submit answer endpoint ────────────────────────────────────────────────────

@router.post("/session/{session_id}/answer", response_model=AnswerResponse)
def submit_answer(
    session_id: str,
    req: AnswerRequest,
    db: Session = Depends(get_db),
):
    session = db.get(GameSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.completed:
        raise HTTPException(400, "Session already completed")

    questions = json.loads(session.questions_json)
    if req.question_index < 0 or req.question_index >= len(questions):
        raise HTTPException(400, "Invalid question index")

    # Prevent re-answering already answered questions
    existing = db.exec(
        select(GameAnswer).where(
            GameAnswer.session_id == session_id,
            GameAnswer.question_index == req.question_index,
        )
    ).first()
    if existing:
        raise HTTPException(400, "Question already answered")

    question = questions[req.question_index]
    correct_answer = question["correct_answer"]
    blank_count = question.get("blank_count", 1)
    question_type = question.get("question_type", "morphological")

    # ── Two-blank question scoring (morphological or semantic) ─────────────
    blank1_correct_val = True
    blank2_correct_val = True
    if blank_count >= 2:
        if question_type == "semantic":
            ca_b1 = question.get("sense_blank1", correct_answer)
            ca_b2 = question.get("sense_blank2", correct_answer)
        else:
            ca_b1 = question.get("correct_answer_blank1", correct_answer)
            ca_b2 = question.get("correct_answer_blank2", correct_answer)
        blank1_correct_val = req.answer_blank1.strip() == ca_b1.strip()
        blank2_correct_val = req.answer_blank2.strip() == ca_b2.strip()
        is_correct = blank1_correct_val and blank2_correct_val
    else:
        is_correct = req.answer.strip() == correct_answer.strip()

    difficulty = question.get("difficulty", "easy")
    base_score = DIFFICULTY_BASE_SCORE.get(difficulty, 10)

    # Speed bonus (rapid fire only)
    speed_bonus = 0
    if session.rapid_fire and is_correct and req.answer_time_ms > 0:
        for threshold, bonus in SPEED_BONUS:
            if req.answer_time_ms <= threshold:
                speed_bonus = bonus
                break

    if is_correct:
        session.current_streak += 1
        score_delta = base_score + (session.current_streak - 1) * 2 + speed_bonus
        session.correct_count += 1
    else:
        session.current_streak = 0
        score_delta = -2

    session.score = max(0, session.score + score_delta)

    answered_count = db.exec(
        select(GameAnswer).where(GameAnswer.session_id == session_id)
    ).all()
    if len(answered_count) + 1 >= len(questions):
        session.completed = True

    # For two-blank questions, encode both answers
    if blank_count >= 2:
        stored_answer = f"{req.answer_blank1}|||{req.answer_blank2}"
    else:
        stored_answer = req.answer

    answer = GameAnswer(
        session_id=session_id,
        question_index=req.question_index,
        submitted_answer=stored_answer,
        is_correct=is_correct,
        score_delta=score_delta,
    )
    db.add(answer)
    db.add(session)
    db.commit()

    # For semantic hard questions, return sense labels as correct_answer_blank fields
    if question_type == "semantic" and blank_count >= 2:
        resp_ca_b1 = question.get("sense_blank1", "")
        resp_ca_b2 = question.get("sense_blank2", "")
    elif blank_count >= 2:
        resp_ca_b1 = question.get("correct_answer_blank1", "")
        resp_ca_b2 = question.get("correct_answer_blank2", "")
    else:
        resp_ca_b1 = ""
        resp_ca_b2 = ""

    return AnswerResponse(
        is_correct=is_correct,
        correct_answer=correct_answer,
        score_delta=score_delta,
        total_score=session.score,
        streak=session.current_streak if is_correct else 0,
        completed=session.completed,
        speed_bonus=speed_bonus,
        blank1_correct=blank1_correct_val,
        blank2_correct=blank2_correct_val,
        correct_answer_blank1=resp_ca_b1,
        correct_answer_blank2=resp_ca_b2,
    )


# ── Results endpoint ──────────────────────────────────────────────────────────

@router.get("/session/{session_id}/results", response_model=ResultsResponse)
def get_results(session_id: str, db: Session = Depends(get_db)):
    session = db.get(GameSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    questions = json.loads(session.questions_json)
    answers = db.exec(
        select(GameAnswer)
        .where(GameAnswer.session_id == session_id)
        .order_by(GameAnswer.question_index)
    ).all()
    answers_map = {a.question_index: a for a in answers}

    result_answers = []
    for q in questions:
        idx = q["index"]
        ans = answers_map.get(idx)
        q_blank_count = q.get("blank_count", 1)

        # Parse encoded hard-question answers ("blank1|||blank2")
        submitted_raw = ans.submitted_answer if ans else ""
        sub_b1 = ""
        sub_b2 = ""
        if q_blank_count >= 2 and "|||" in submitted_raw:
            parts = submitted_raw.split("|||", 1)
            sub_b1 = parts[0]
            sub_b2 = parts[1] if len(parts) > 1 else ""
            display_answer = sub_b1
        else:
            display_answer = submitted_raw

        result_answers.append(ResultAnswer(
            question_index=idx,
            game_sentence=q["game_sentence"],
            sense=q["sense"],
            sense_ta=q["sense_ta"],
            submitted_answer=display_answer,
            correct_answer=q["correct_answer"],
            is_correct=ans.is_correct if ans else False,
            score_delta=ans.score_delta if ans else 0,
            difficulty=q.get("difficulty", "easy"),
            blank_count=q_blank_count,
            question_type=q.get("question_type", "morphological"),
            correct_answer_blank1=q.get("correct_answer_blank1", ""),
            correct_answer_blank2=q.get("correct_answer_blank2", ""),
            submitted_answer_blank1=sub_b1,
            submitted_answer_blank2=sub_b2,
        ))

    return ResultsResponse(
        session_id=session_id,
        word_ta=session.word_ta,
        word_romanized=session.word_romanized,
        score=session.score,
        correct_count=session.correct_count,
        total_questions=len(questions),
        stars=_stars(session.correct_count, len(questions)),
        answers=result_answers,
    )
