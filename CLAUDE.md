# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Project Is

**Lexifyd** is a Tamil polysemy word game. A user enters a Tamil word (e.g. ஆறு), an LLM generates context-specific sentences with blanks and inflected-form answer choices, and the user drags the correct Tamil word-form into each sentence blank. The semantic relationships between a word's meanings are visualised as a D3.js force-directed knowledge graph.

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

> **Port note:** Port 8000 may be occupied by stale Windows socket entries from previous runs. Use `netstat -ano | grep ":8000"` to check; if entries exist but the PID is gone, use port 8001 instead. The Vite proxy in `frontend/vite.config.js` must match.

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
| `LLM_PROVIDER` | `groq` or `ollama` — **must restart** the backend after changing |
| `GROQ_API_KEY` | Required when `LLM_PROVIDER=groq` |
| `OLLAMA_BASE_URL` | Default `http://localhost:11434`; pull `llama3.2` first |
| `DATABASE_URL` | SQLite path, default `sqlite:///./lexifyd.db` |
| `CORS_ORIGINS` | Comma-separated allowed origins; must include the Vite dev URL |
| `DEMO_MODE` | `true` → bypass LLM entirely; serves fixture data for ஆறு, படி, கல், திங்கள் |

> **Important:** `load_dotenv()` runs at import time in `main.py`. The `LLMClient` singleton is created on the first request. Changing `.env` always requires a full backend restart — `--reload` does NOT re-read env vars.

---

## Architecture

### Request Flow for a New Game

```
POST /api/words/analyze
  → routers/words.py
      → SQLite cache check (WordEntry by word_ta)
      → if DEMO_MODE=true: demo_fixtures.py → persist to DB → return
      → LLM: SENSE_EXTRACTION_PROMPT → list[sense]
      → for each sense:
          → LLM: INFLECTION_PROMPT → inflected_form
          → LLM: SENTENCE_GENERATION_PROMPT → {sentence_ta, correct_answer}
          → validator.py: VERIFICATION_PROMPT → YES/NO (up to 3 retries)
          → LLM: DISTRACTOR_GENERATION_PROMPT → 3 distractors
          → shuffle [correct + 3 distractors] → store as JSON string in WordSense.options
      → persist WordEntry + WordSense rows
      → return AnalyzeWordResponse

POST /api/game/session
  → routers/game.py → creates GameSession row, returns shuffled questions

POST /api/game/session/{id}/answer
  → looks up WordSense.correct_answer, compares, updates GameSession score
  → +10 correct, -2 wrong

GET /api/words/{word_id}/graph
  → routers/viz.py → LLM: SEMANTIC_GRAPH_PROMPT → SemanticGraphResponse (for D3)
```

### Frontend Data Flow

```
Home page
  → useGameEngine.startGame()
      → POST /api/words/analyze   → wordData
      → POST /api/game/session    → sessionData
      → gameStore.initGame()      → gamePhase: 'playing'
      → navigate('/game')

Game page
  → reads senses[], slotStates{}, answers{} from gameStore
  → builds deduplicated chip pool (unique text values, correct answers first)
  → dnd-kit: onDragEnd → useGameEngine.submitAnswer(targetSenseId, chip.text)
      → POST /api/game/session/{id}/answer
      → gameStore.submitAnswer() → updates slotStates, score, scoreAnimations
      → when all slotStates === 'correct' → gamePhase: 'results' → navigate('/results')

Results page → useGameEngine.fetchResults() → GET /api/game/session/{id}/results
SemanticWeb page → useGameEngine.fetchGraph(wordId) → GET /api/words/{wordId}/graph
```

---

## Database (SQLite via SQLModel)

Tables are auto-created on startup (`SQLModel.metadata.create_all(engine)`). No migrations framework is used — schema changes require dropping and recreating the DB file.

| Table | Key columns | Purpose |
|---|---|---|
| `word_entries` | `id`, `word_ta` (indexed) | One row per unique Tamil word |
| `word_senses` | `word_id` FK, `sense_id`, `options` (JSON string), `needs_review` | One row per meaning; `options` stores the 4-item shuffled answer list as a JSON string |
| `game_sessions` | `word_id` FK, `score`, `correct_count`, `completed` | One row per play-through |
| `game_answers` | `session_id` FK, `sense_id`, `is_correct`, `score_delta` | One row per answer submission |

**Caching:** `POST /api/words/analyze` checks `word_entries` by `word_ta` first. If a cached entry exists with senses, it returns immediately without calling the LLM. To force regeneration, delete the row from `word_entries` (cascades are not set — also delete from `word_senses` manually).

---

## LLM Service

`backend/services/llm_service.py` exposes one `LLMClient` singleton (via `get_llm_client()` FastAPI dependency) with two methods:

- `complete(prompt, system="") → str` — raw text, 3-retry exponential backoff
- `complete_json(prompt, system="") → Any` — strips markdown fences, parses JSON, retries on `JSONDecodeError`

All five prompt templates are in `backend/prompts/templates.py` as module-level string constants. Edit prompts there; no code changes needed elsewhere.

**IndicNLP** (`backend/services/tamil_nlp.py`) is imported with a graceful fallback — if the library or its resources are unavailable, all functions return heuristic results. It is not on the critical path for the game to function.

---

## Hallucination Validation

After each sentence is generated, `backend/services/validator.py` runs a `VERIFICATION_PROMPT` through the LLM ("Does this sentence correctly use the word in this sense? YES or NO"). If the answer is NO, the sentence is regenerated up to 3 times. Items that fail all retries are stored with `needs_review=True` in `word_senses` and appended to `backend/logs/flagged_generations.jsonl`.

---

## Frontend State

All game state lives in `frontend/src/store/gameStore.js` (Zustand). The store is the single source of truth — pages read from it, `useGameEngine.js` writes to it after API calls. `gamePhase` drives navigation: `'idle'→'loading'→'playing'→'results'`.

The chip pool shown during gameplay is deduplicated: all unique `correct_answer` values appear first (with their English hint), then unique distractors. A chip disappears (`used=true`) once its text has been placed correctly in any slot.

---

## PWA / Mobile

`frontend/vite.config.js` configures `vite-plugin-pwa` with:
- `NetworkFirst` for `/api/*` routes (games work offline if already loaded)
- `CacheFirst` for Google Fonts

To wrap as a native app via Capacitor:
```bash
cd frontend && npm run build
npx cap add android && npx cap sync && npx cap open android
```
Set `VITE_API_URL` in the frontend env to the backend's LAN/public URL before building.

---

## Demo Mode

Set `DEMO_MODE=true` in `.env` to bypass the LLM entirely. `demo_fixtures.py` contains hardcoded game data for the four test words (ஆறு, படி, கல், திங்கள்). Fixture data is persisted to SQLite on first access so that game sessions work normally. Words not in the fixture list fall through to the real LLM pipeline.
