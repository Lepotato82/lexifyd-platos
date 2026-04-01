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
    rapid_fire: bool = False
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
    correct_answer: str          # morphological: word form; semantic: sense string
    options: list[str]           # shuffled [correct + 3 distractors]
    difficulty: str = "easy"     # "easy" | "medium" | "hard"
    blank_count: int = 1         # 1 for easy/medium, 2 for hard
    question_type: str = "morphological"  # "morphological" | "semantic"
    # Semantic question fields
    original_sentence: str = ""           # full sentence (no blanks) for semantic display
    highlighted_word: str = ""            # word to underline in the sentence
    sense_blank1: str = ""                # sense label for first underlined word (hard semantic)
    sense_blank2: str = ""                # sense label for second underlined word (hard semantic)
    # Hard-question two-blank support (blank_count >= 2)
    correct_answer_blank1: str = ""
    correct_answer_blank2: str = ""
    options_blank1: list[str] = []   # chips for blank 1 phase
    options_blank2: list[str] = []   # chips for blank 2 phase


class StartGameRequest(BaseModel):
    word_ta: str
    rapid_fire: bool = False


class StartGameResponse(BaseModel):
    session_id: str
    word_ta: str
    word_romanized: str
    total_questions: int
    questions: list[QuestionOut]
    rapid_fire: bool = False
    timer_easy: int = 45
    timer_hard: int = 60


class AnswerRequest(BaseModel):
    question_index: int
    answer: str = ""          # easy/medium single answer
    answer_blank1: str = ""   # hard question blank 1
    answer_blank2: str = ""   # hard question blank 2
    answer_time_ms: int = 0   # milliseconds taken (for speed bonus in rapid fire)


class AnswerResponse(BaseModel):
    is_correct: bool
    correct_answer: str
    score_delta: int
    total_score: int
    streak: int
    completed: bool
    speed_bonus: int = 0
    # Per-blank correctness (populated for blank_count >= 2)
    blank1_correct: bool = True
    blank2_correct: bool = True
    correct_answer_blank1: str = ""
    correct_answer_blank2: str = ""


class ResultAnswer(BaseModel):
    question_index: int
    game_sentence: str
    sense: str
    sense_ta: str
    submitted_answer: str
    correct_answer: str
    is_correct: bool
    score_delta: int
    difficulty: str = "easy"
    blank_count: int = 1
    question_type: str = "morphological"
    # Hard-question per-blank data
    correct_answer_blank1: str = ""
    correct_answer_blank2: str = ""
    submitted_answer_blank1: str = ""
    submitted_answer_blank2: str = ""


class ResultsResponse(BaseModel):
    session_id: str
    word_ta: str
    word_romanized: str
    score: int
    correct_count: int
    total_questions: int
    stars: int               # 1 = completed, 2 = ≥60% correct, 3 = 100%
    answers: list[ResultAnswer]


# ── Flashcard schemas ──────────────────────────────────────────────────────────

class FlashcardSense(BaseModel):
    sense: str
    sense_ta: str
    pos: str
    example_sentence: str


class FlashcardOut(BaseModel):
    word_ta: str
    word_romanized: str
    senses: list[FlashcardSense]
