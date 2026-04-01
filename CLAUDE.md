# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Project Is

**Lexifyd** is a Tamil polysemy word game built for the Lexifyd Polysemy Challenge hackathon. Players select a Tamil word (e.g. ஆறு), are presented with context-specific sentences containing blanks, and must drag or tap the correct inflected Tamil word-form into each blank. The game tests morphological and semantic awareness of Tamil polysemy.

A D3.js force-directed **Semantic Web** knowledge graph visualises the relationships between a word's meanings, with edge weights computed using sentence-transformer embeddings (paraphrase-multilingual-MiniLM-L12-v2).

---

## Hybrid Generation Architecture

Lexifyd uses a **multi-layered RAG (Retrieval-Augmented Generation) architecture** that balances the hackathon's "Automation is Key" requirement against the "Hallucination Metric":

### Three-Tier Anti-Hallucination Strategy

| Tier | Source | What it produces | Hallucination risk |
|---|---|---|---|
| **1. Verified Dataset** | `lexifyd_dataset.json` (curated, human-verified) | Sentences with blanks, correct answers | **Zero** — no LLM involved |
| **2. Dynamic Distractors** | Groq LLM (`llama-3.3-70b-versatile`) | 3 morphologically-aware wrong answers per question | **Very low** — single words, not sentences |
| **3. Fallback Pipeline** | Full LLM generation + validator.py | Sentences for unknown words (not in dataset) | **Caught** — verification loop, up to 3 retries |

### Why This Approach

The curated JSON dataset contains ~200 verified sentence entries across 10+ Tamil polysemous words. During gameplay, sentences are **retrieved** from this cache (zero hallucination), while the LLM **generates only single-word distractors** that share the same morphological suffix as the correct answer but make no sense in context. This proves live LLM usage during gameplay while keeping hallucination risk near zero.

---

## Tech Stack

### Backend
- **FastAPI** — REST API framework
- **SQLite + SQLModel** — game session persistence
- **Groq Cloud** (`llama-3.3-70b-versatile`) — dynamic distractor generation
- **sentence-transformers** (`paraphrase-multilingual-MiniLM-L12-v2`) — semantic similarity for knowledge graph edges
- **IndicBERT** (`ai4bharat/indic-bert`) — fill-mask distractor quality scoring
- **IndicNLP** — Tamil morphological analysis (graceful fallback if unavailable)

### Frontend
- **React 18** + **Vite** — SPA with HMR
- **Zustand** — centralised game state with localStorage persistence
- **dnd-kit** — drag-and-drop for answer chips
- **D3.js** — force-directed semantic web graph
- **Tailwind CSS** — utility-first styling with custom design tokens
- **vite-plugin-pwa** — offline-capable Progressive Web App

---

## Running the Project

### Backend (FastAPI, port 8001)

```bash
cd backend
pip install -r requirements.txt
cp ../.env .env          # or edit backend/.env directly
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Health check: `curl http://localhost:8001/health`
Interactive API docs: `http://localhost:8001/docs`

> **Port note:** Port 8000 may be occupied by stale Windows socket entries. Use `netstat -ano | findstr ":8001"` to check. Kill zombie Python processes with `taskkill /PID <pid> /F` before restarting. The Vite proxy in `frontend/vite.config.js` must match the backend port.

> **First graph request:** The sentence-transformer model (~420MB) downloads on first use. Subsequent requests are instant (model cached in `~/.cache/huggingface/`).

### Frontend (Vite, port 5173)

```bash
cd frontend
npm install
npm run dev        # dev server with HMR
npm run build      # production build (also validates PWA config)
npm run preview    # serve the production build
```

### Docker Compose (both services)

```bash
docker compose up --build
```

---

## Environment Variables

All config lives in the root `.env` (copied to `backend/.env` on deploy). Key variables:

| Variable | Effect |
|---|---|
| `LLM_PROVIDER` | `groq` or `ollama` — enables dynamic distractor generation; **must restart** backend after changing |
| `GROQ_API_KEY` | Required when `LLM_PROVIDER=groq` |
| `OLLAMA_BASE_URL` | Default `http://localhost:11434`; pull `llama3.2` first |
| `DATABASE_URL` | SQLite path, default `sqlite:///./lexifyd.db` |
| `CORS_ORIGINS` | Comma-separated allowed origins; must include the Vite dev URL |

> **Important:** `load_dotenv()` runs at import time in `main.py`. Changing `.env` always requires a full backend restart — `--reload` does NOT re-read env vars.

---

## Folder Structure

```
backend/
├── main.py                    # FastAPI app, lifespan, CORS, router registration
├── database.py                # SQLite engine + get_db dependency
├── dataset.py                 # In-memory dataset loader from lexifyd_dataset.json
├── models.py                  # SQLModel tables + Pydantic request/response schemas
├── requirements.txt           # Python dependencies
├── data/
│   └── lexifyd_dataset.json   # Curated dataset (~200 entries, 10+ words)
├── routers/
│   ├── words.py               # GET /api/words, /flashcards, /{word_ta}
│   ├── game.py                # POST /api/game/start, /session/{id}/answer, GET /results
│   ├── graph.py               # GET /api/words/{word_ta}/graph — semantic web builder
│   └── nlp.py                 # POST /api/nlp/similarity, /distractor-score — NLP demo endpoints
├── services/
│   ├── embeddings.py          # Sentence-transformer singleton (MiniLM, lazy-loaded)
│   ├── indic_bert.py          # IndicBERT fill-mask pipeline (lazy-loaded)
│   └── llm_distractors.py    # Groq-powered dynamic distractor generation
└── logs/
    └── flagged_generations.jsonl

frontend/
├── src/
│   ├── App.jsx                # React Router: /, /game, /results, /semantic-web/:wordTa, /flashcards, /progress
│   ├── index.css              # Tailwind base + custom animations + design tokens
│   ├── store/
│   │   └── gameStore.js       # Zustand store — single source of truth for game state
│   ├── hooks/
│   │   └── useGameEngine.js   # API calls → store mutations (startGame, submitAnswer, fetchGraph)
│   ├── pages/
│   │   ├── Home.jsx           # Word list with search, play history, XP badge
│   │   ├── Game.jsx           # Duolingo-style one-at-a-time questions, hearts, progress dots
│   │   ├── Results.jsx        # Score, stars, confetti, CTAs for Semantic Web + Flashcards
│   │   ├── SemanticWeb.jsx    # D3 graph viewer with algorithm badge and POS legend
│   │   ├── Flashcards.jsx     # 3D flip cards with Know It / Still Learning tracking
│   │   └── Progress.jsx       # XP, games played, mastery bar, word-level stats
│   └── components/
│       ├── GraphCanvas.jsx    # D3 force simulation: root/sense/morph nodes, glow filter, tooltips
│       ├── MeaningChip.jsx    # Draggable + tappable answer chip (dnd-kit)
│       ├── SentenceSlot.jsx   # Drop target with correct/wrong/empty states
│       ├── FeedbackBanner.jsx # Fixed bottom banner gating progression (green/red)
│       ├── HeartsDisplay.jsx  # 3 hearts/lives with heartLost animation
│       ├── ProgressDots.jsx   # Per-question dots (green/red/grey)
│       ├── ConfettiOverlay.jsx# 40-div confetti animation on 3 stars
│       ├── BottomNav.jsx      # 3-tab nav: Home / Flashcards / Progress
│       ├── ScoreBar.jsx       # Score display component
│       └── WordBadge.jsx      # Word display badge
├── tailwind.config.js         # Custom colors (brand, success, danger), animations
└── vite.config.js             # Proxy /api → backend, PWA config
```

---

## API Endpoints

### Words
| Method | Path | Description |
|---|---|---|
| GET | `/api/words` | List all words with senses |
| GET | `/api/words/flashcards` | All words formatted for flashcard view |
| GET | `/api/words/{word_ta}` | Single word detail |

### Game
| Method | Path | Description |
|---|---|---|
| POST | `/api/game/start` | Start a new game session (up to 5 questions, sense-diverse) |
| POST | `/api/game/session/{id}/answer` | Submit an answer (+10 correct with streak bonus, -2 wrong) |
| GET | `/api/game/session/{id}/results` | Get final results with stars (1/2/3) |

### Graph (Semantic Web)
| Method | Path | Description |
|---|---|---|
| GET | `/api/words/{word_ta}/graph` | Build polysemy knowledge graph with similarity edges |

### NLP (Demo / Judge Inspection)
| Method | Path | Description |
|---|---|---|
| POST | `/api/nlp/similarity` | Compute cosine similarity between two texts (MiniLM) |
| POST | `/api/nlp/distractor-score` | Score distractors using IndicBERT fill-mask |

### System
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check with dataset entry count |

---

## Architecture Deep Dive

### Request Flow: Starting a Game

```
POST /api/game/start { word_ta: "ஆறு" }
  → routers/game.py
      → dataset.get_entries_for_word("ஆறு") → retrieve verified entries
      → Select up to 5 questions (one per sense first, then fill)
      → For each question:
          → Retrieve correct_answer + dataset distractors from JSON
          → If LLM_PROVIDER is set:
              → services/llm_distractors.generate_distractors()
                  → Groq prompt: "Generate 3 Tamil words with same morphological
                    suffix as '{correct_answer}' that make no sense in this sentence"
                  → Falls back to dataset distractors on failure
          → Shuffle [correct + 3 distractors] → options[]
      → Persist GameSession to SQLite
      → Return session_id + questions[]
```

### Request Flow: Semantic Web Graph

```
GET /api/words/{word_ta}/graph
  → routers/graph.py
      → dataset.get_entries_for_word() → collect unique senses
      → Build nodes: root → sense nodes (by POS) → morph variant nodes
      → Compute cross-sense edge weights:
          → If sentence-transformers available:
              sim = 0.3 × POS_similarity + 0.7 × cosine(MiniLM(sense1), MiniLM(sense2))
          → Fallback:
              sim = 0.4 × POS_similarity + 0.6 × Jaccard(content_words)
      → Return { root, nodes[], edges[], example_words[], algorithm }
```

### Frontend Data Flow

```
Home page → click word card
  → useGameEngine.startGame(word_ta)
      → POST /api/game/start → questions[]
      → gameStore.initGame() → gamePhase: 'playing'
      → navigate('/game')

Game page (Duolingo-style, one question at a time)
  → Current question's 4 options shown as 2×2 chip grid
  → Drag or tap chip → useGameEngine.submitAnswer()
      → POST /api/game/session/{id}/answer
      → FeedbackBanner: green (correct) or red (wrong + show answer)
      → Continue button → advanceQuestion() or navigateToResults()
  → 3 hearts (lives) — game ends early if all lost

Results page
  → Stars (1/2/3), score, XP earned
  → CTAs: "Explore Semantic Web" + "Review Flashcards"

SemanticWeb page
  → fetchGraph(wordTa) → D3 force simulation
  → Node types: root (glow), sense (POS-colored), morph (satellite)
  → Click sense node → tooltip with example sentence
  → Algorithm badge shows MiniLM or Jaccard method
```

---

## NLP Services (Lazy-Loaded Singletons)

All ML models load on first use, not at startup, so the backend starts fast.

### Sentence-Transformer Embeddings (`services/embeddings.py`)
- Model: `paraphrase-multilingual-MiniLM-L12-v2` (~420MB, cached in `~/.cache/huggingface/`)
- Supports Tamil natively (trained on 50+ languages)
- Used for: semantic graph edge weights (cosine similarity between sense definitions)
- API: `cosine_similarity(text_a, text_b) → float`, `pairwise_similarities(texts) → NxN matrix`

### IndicBERT Fill-Mask (`services/indic_bert.py`)
- Model: `ai4bharat/indic-bert` (IIT Madras, trained on Indian languages)
- Used for: scoring distractor quality — how likely a word fills a sentence blank
- Lower fill-mask probability = better distractor (morphologically plausible but semantically wrong)
- API: `score_distractors(sentence, correct_answer, distractors) → [{word, score, is_good_distractor}]`

### Dynamic Distractor Generator (`services/llm_distractors.py`)
- Backend: Groq Cloud (`llama-3.3-70b-versatile`)
- Generates 3 Tamil words per question that share the same morphological suffix as the correct answer
- Falls back to dataset distractors if Groq is unavailable or the call fails
- API: `generate_distractors(sentence, correct_answer, word_ta, sense, pos, fallback) → [str, str, str]`

---

## Database (SQLite via SQLModel)

Tables are auto-created on startup (`SQLModel.metadata.create_all(engine)`). No migrations framework — schema changes require deleting `lexifyd.db`.

| Table | Key columns | Purpose |
|---|---|---|
| `gamesession` | `id` (UUID), `word_ta`, `score`, `correct_count`, `completed` | One row per play-through |
| `gameanswer` | `session_id` FK, `question_index`, `is_correct`, `score_delta` | One row per answer submission |

The curated dataset (`lexifyd_dataset.json`) is loaded into memory at startup — it is NOT stored in SQLite. Game sessions and answers are the only persistent DB data.

---

## Frontend State (Zustand)

All game state lives in `frontend/src/store/gameStore.js` (Zustand with `persist` middleware, storage key `lexifyd-v3`).

Persisted state (survives page refresh):
- `playedWords` — `{ [word_ta]: { bestScore, stars, timesPlayed } }`
- `totalXP` — cumulative experience points
- `flashcardState` — `{ [word_ta]: 'known' | 'learning' }`

Transient state (reset each game):
- `gamePhase` — `'idle' → 'loading' → 'playing' → 'results'`
- `questions[]`, `currentQuestionIndex`, `hearts`, `feedback`
- `slotStates{}`, `results`

---

## Game Mechanics

- **Questions per game:** Up to 5 (one per sense first for diversity, then fill with extras)
- **Scoring:** +10 correct + streak bonus (+2 per consecutive), -2 wrong
- **Lives:** 3 hearts — losing all ends the game early
- **Stars:** 1 = completed, 2 = ≥60% correct, 3 = 100%
- **XP:** Earned per game, tracked across sessions
- **Chip interaction:** Drag (dnd-kit with `distance: 6` activation) or tap

---

## Key Architectural Decisions

1. **Dataset as RAG cache, not hard-coded data:** The curated JSON is a verified semantic cache, not a static database. It was generated via LLM pipeline + human verification. During gameplay, the LLM generates fresh distractors against these verified sentences.

2. **Sentence-transformers over Jaccard for graph edges:** Real cosine similarity between multilingual embeddings produces semantically meaningful graph clustering. Jaccard keyword overlap is kept as a zero-dependency fallback.

3. **IndicBERT for distractor validation:** Using a Tamil-specific masked language model to score how "wrong" each distractor is in context. This directly addresses the hackathon's "Morphological & POS Awareness" rubric.

4. **Lazy model loading:** ML models (MiniLM, IndicBERT) load on first request, not at startup. This keeps the backend start time under 2 seconds while the first graph/NLP request takes ~10-15s.

5. **Duolingo-style UX:** One question at a time with immediate feedback, hearts/lives, progress dots, and streak bonuses. This is a deliberate UX choice to maximize engagement and learning.

6. **Frontend as PWA:** The app works offline for previously loaded games via service worker caching. Can be wrapped as a native Android app via Capacitor if needed.

---

## Hackathon Pitch Summary

> "To solve the trade-off between the 'Automation Constraint' and the 'Hallucination Metric', we built a multi-layered RAG engine. We use a generative LLM pipeline to build a highly verified semantic cache. During gameplay, we retrieve from this cache while our LLM dynamically generates morphologically-aware distractors in real-time. The Semantic Web uses sentence-transformer embeddings (MiniLM) for cosine similarity and IndicBERT for morphological analysis. If a user enters an unknown word, our autonomous agents fall back to live generation and validation."
