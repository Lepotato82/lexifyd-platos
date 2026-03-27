import json
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


@router.post("/start", response_model=StartGameResponse)
def start_game(req: StartGameRequest, db: Session = Depends(get_db)):
    entries = get_entries_for_word(req.word_ta)
    if not entries:
        raise HTTPException(404, f"'{req.word_ta}' is not in the dataset yet")

    MAX_QUESTIONS = 5

    # Prioritise sense diversity: one random entry per sense first,
    # then fill up to MAX_QUESTIONS with more random entries
    shuffled = entries.copy()
    random.shuffle(shuffled)

    seen_senses: set[str] = set()
    selected = []
    remainder = []
    for e in shuffled:
        sense = e.get("sense", "")
        if sense not in seen_senses:
            seen_senses.add(sense)
            selected.append(e)
        else:
            remainder.append(e)

    # Fill up to MAX_QUESTIONS with extras (different entries, may repeat senses)
    if len(selected) < MAX_QUESTIONS:
        random.shuffle(remainder)
        selected += remainder[: MAX_QUESTIONS - len(selected)]

    # Cap and re-shuffle so question order is random every game
    selected = selected[:MAX_QUESTIONS]
    random.shuffle(selected)

    # Build question objects
    questions_data = []
    for i, entry in enumerate(selected):
        correct = entry["correct_answer"]
        distractors = entry.get("distractors", [])[:3]
        options = [correct] + distractors
        random.shuffle(options)
        questions_data.append({
            "index": i,
            "game_sentence": entry["game_sentence"],
            "sense": entry.get("sense", ""),
            "sense_ta": entry.get("sense_ta", ""),
            "pos": entry.get("pos", ""),
            "correct_answer": correct,
            "options": options,
        })

    session = GameSession(
        word_ta=req.word_ta,
        word_romanized=entries[0].get("word_romanized", ""),
        questions_json=json.dumps(questions_data, ensure_ascii=False),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return StartGameResponse(
        session_id=session.id,
        word_ta=session.word_ta,
        word_romanized=session.word_romanized,
        total_questions=len(questions_data),
        questions=[QuestionOut(**q) for q in questions_data],
    )


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

    correct_answer = questions[req.question_index]["correct_answer"]
    is_correct = req.answer.strip() == correct_answer.strip()

    if is_correct:
        session.current_streak += 1
        score_delta = 10 + (session.current_streak - 1) * 2  # streak bonus
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

    answer = GameAnswer(
        session_id=session_id,
        question_index=req.question_index,
        submitted_answer=req.answer,
        is_correct=is_correct,
        score_delta=score_delta,
    )
    db.add(answer)
    db.add(session)
    db.commit()

    return AnswerResponse(
        is_correct=is_correct,
        correct_answer=correct_answer,
        score_delta=score_delta,
        total_score=session.score,
        streak=session.current_streak if is_correct else 0,
        completed=session.completed,
    )


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
        result_answers.append(ResultAnswer(
            question_index=idx,
            game_sentence=q["game_sentence"],
            sense=q["sense"],
            sense_ta=q["sense_ta"],
            submitted_answer=ans.submitted_answer if ans else "",
            correct_answer=q["correct_answer"],
            is_correct=ans.is_correct if ans else False,
            score_delta=ans.score_delta if ans else 0,
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
