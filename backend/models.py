"""DB tables (SQLModel) + Pydantic request/response schemas."""
import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from pydantic import BaseModel


# ── DB tables ─────────────────────────────────────────────────────────────────

class GameSession(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    word_ta: str
    word_romanized: str
    questions_json: str          # JSON array stored as string
    score: int = 0
    correct_count: int = 0
    current_streak: int = 0
    completed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GameAnswer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(foreign_key="gamesession.id")
    question_index: int
    submitted_answer: str
    is_correct: bool
    score_delta: int


# ── Schemas ───────────────────────────────────────────────────────────────────

class WordInfo(BaseModel):
    word_ta: str
    word_romanized: str
    sense_count: int
    senses: list[str]


class QuestionOut(BaseModel):
    index: int
    game_sentence: str
    sense: str
    sense_ta: str
    pos: str
    correct_answer: str          # sent to client; challenge is in the language, not hiding data
    options: list[str]           # shuffled [correct + 3 distractors]


class StartGameRequest(BaseModel):
    word_ta: str


class StartGameResponse(BaseModel):
    session_id: str
    word_ta: str
    word_romanized: str
    total_questions: int
    questions: list[QuestionOut]


class AnswerRequest(BaseModel):
    question_index: int
    answer: str


class AnswerResponse(BaseModel):
    is_correct: bool
    correct_answer: str
    score_delta: int
    total_score: int
    streak: int
    completed: bool


class ResultAnswer(BaseModel):
    question_index: int
    game_sentence: str
    sense: str
    sense_ta: str
    submitted_answer: str
    correct_answer: str
    is_correct: bool
    score_delta: int


class ResultsResponse(BaseModel):
    session_id: str
    word_ta: str
    word_romanized: str
    score: int
    correct_count: int
    total_questions: int
    stars: int               # 1 = completed, 2 = ≥60% correct, 3 = 100%
    answers: list[ResultAnswer]
