# Lexifyd — Tamil polysemy word game

Tamil fill-in-the-blank and meaning questions, a semantic knowledge graph (D3), flashcards, and progress — FastAPI backend + React (Vite) frontend.

**Environment template:** copy [`backend/.env.example`](backend/.env.example) to `backend/.env`.

---

## Important: this is not production software

This repository targets **coursework, demos, and learning**. It is **not** hardened for public production:

- No formal security audit, rate limiting, or managed secrets (only `.gitignore` for `.env`)
- SQLite + in-memory dataset — fine for local / single-user demos
- ML stacks (sentence-transformers, optional IndicBERT) download large models on first use
- **Never commit `.env`** with real API keys

---

## Prerequisites

- **Python** 3.11+ and `pip`
- **Node.js** 20+ and `npm`

Optional:

- **Groq API key** — dynamic distractors at play time and for `build_dataset.py`
- **Disk / GPU** — first semantic-graph request may download sentence-transformers (~420MB)

---

## Bundled dataset

The repo includes **`backend/data/lexifyd_dataset.json`**. It is loaded **once at backend startup** ([`backend/dataset.py`](backend/dataset.py)). You can **play immediately** after install — **no LLM required** for core gameplay.

- Entries include fields such as `word_ta`, `game_sentence`, `correct_answer`, `distractors`, `sense`, `pos`, `difficulty`, and optional multi-blank / semantic fields.
- Words **not** in this file cannot start a game (API returns 404).

### Using your own dataset

1. Build a JSON **array** of objects in the **same general shape** as the bundled file.
2. Save as **`backend/data/lexifyd_dataset.json`**, or change `DATASET_PATH` in [`backend/dataset.py`](backend/dataset.py).
3. **Restart** the backend.

### Tamil Wikipedia for the dataset builder (Kaggle)

[`backend/scripts/build_dataset.py`](backend/scripts/build_dataset.py) expects raw text under:

`backend/data/tamil_wiki/raw_text_files/`  
(subfolders like `AA/`, `AB/`, … with `.txt` articles).

Compatible corpus on Kaggle: **[Tamil / Tamizh Wikipedia articles](https://www.kaggle.com/datasets/younusmohamed/tamil-tamizh-wikipedia-articles)**  

After download, extract so paths match the layout above. The tree is large and may be gitignored.

Run the builder (requires **`GROQ_API_KEY`**):

```bash
cd backend
python scripts/build_dataset.py
```

Use `python scripts/build_dataset.py -h` for flags (`--fresh`, `--relaxed-distractors`, `--indicbert`). Output: **`lexifyd_dataset_generated.json`** — review and merge into `lexifyd_dataset.json` if you want those rows in the live game.

### Optional: corpus FTS index (not used by the app)

```bash
cd backend
python scripts/build_corpus_index.py
```

Creates `backend/data/corpus.db` for local experiments only.

---

## LLMs: cloud API vs local

### 1. Groq (API) — recommended for this codebase

| Use case | Implementation |
|----------|----------------|
| In-game dynamic distractors | [`backend/services/llm_distractors.py`](backend/services/llm_distractors.py) → Groq `llama-3.3-70b-versatile` when `LLM_PROVIDER=groq` and `GROQ_API_KEY` is set |
| Offline dataset generation | [`backend/scripts/build_dataset.py`](backend/scripts/build_dataset.py) requires `GROQ_API_KEY` |

1. Get a key at [Groq Console](https://console.groq.com/).
2. Set `LLM_PROVIDER=groq` and `GROQ_API_KEY=...` in `backend/.env`.
3. Restart the backend.

If Groq is missing or fails, the game uses **distractors from `lexifyd_dataset.json`**.

### 2. Ollama (e.g. Llama 3.2 7B) — not recommended for Tamil quality

You can run **Ollama** locally (`ollama pull llama3.2`, etc.). **Small 7B models** are generally **weaker** for Tamil morphology and sense choice than a strong cloud model.

**Limitation:** [`backend/routers/game.py`](backend/routers/game.py) accepts `LLM_PROVIDER=ollama`, but **`llm_distractors.py` only implements Groq** — there is **no Ollama HTTP client** yet. So with `ollama` you still get **JSON distractors** unless you add Ollama calls yourself. **`build_dataset.py` is Groq-only** as shipped.

---

## Quick start (localhost)

### Backend (port **8001** — matches Vite proxy)

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env — see table below
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

- [http://localhost:8001/docs](http://localhost:8001/docs)
- [http://localhost:8001/health](http://localhost:8001/health)

### Frontend (port **5173**)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Dev proxy: `/api` → **8001** ([`frontend/vite.config.js`](frontend/vite.config.js)).

### Docker Compose

```bash
docker compose up --build
```

Compose exposes the API on **8000** and sets `VITE_API_URL` for the frontend. Local runs without Docker use **8001**.

---

## Environment variables

Copy `backend/.env.example` → `backend/.env`. Restart the backend after changes (`load_dotenv` runs at import).

| Variable | Purpose |
|----------|---------|
| `LLM_PROVIDER` | `groq` → Groq distractors. `ollama` is recognized but **not** wired in `llm_distractors.py` yet. |
| `GROQ_API_KEY` | Groq key; needed for dynamic distractors and `build_dataset.py`. |
| `OLLAMA_BASE_URL` | Default `http://localhost:11434` — for a **future or custom** Ollama integration. |
| `DATABASE_URL` | SQLite (default `sqlite:///./lexifyd.db`). |
| `CORS_ORIGINS` | Comma-separated; include `http://localhost:5173` for Vite. |
| `LOG_LEVEL` | e.g. `INFO` |

Minimal example:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
DATABASE_URL=sqlite:///./lexifyd.db
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=INFO
```

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/words` | List words in the dataset |
| `GET` | `/api/words/flashcards` | Flashcard payload |
| `GET` | `/api/words/{word_ta}` | Word detail |
| `GET` | `/api/words/{word_ta}/graph` | Semantic graph JSON for D3 |
| `POST` | `/api/game/start` | Start a session (up to 10 questions) |
| `POST` | `/api/game/session/{id}/answer` | Submit an answer |
| `GET` | `/api/game/session/{id}/results` | Final results |
| `POST` | `/api/nlp/similarity` | Embedding similarity (demo) |
| `POST` | `/api/nlp/distractor-score` | IndicBERT fill-mask scoring (demo) |
| `GET` | `/health` | Health + dataset entry count |

---

## Architecture (overview)

**Game start:** `POST /api/game/start` → [`routers/game.py`](backend/routers/game.py) loads entries from `lexifyd_dataset.json`, builds morphological + semantic questions, optionally replaces distractors via Groq, persists a SQLite session.

**Semantic web:** `GET /api/words/{word_ta}/graph` → [`routers/graph.py`](backend/routers/graph.py) builds nodes/edges; MiniLM cosine similarity when available, else Jaccard fallback.

**Frontend:** React Router pages ([`frontend/src/App.jsx`](frontend/src/App.jsx)); state in Zustand ([`frontend/src/store/gameStore.js`](frontend/src/store/gameStore.js)) with persist key `lexifyd-v5`; API via `fetch` in [`frontend/src/hooks/useGameEngine.js`](frontend/src/hooks/useGameEngine.js).

**Layout:**

```
backend/     main.py, dataset.py, models.py, database.py, routers/, services/, data/lexifyd_dataset.json
frontend/src/  pages/ (Home, Game, Results, SemanticWeb, Flashcards, Progress)
               components/ (GraphCanvas, MeaningChip, SentenceSlot, …)
               store/gameStore.js, hooks/useGameEngine.js
```

---

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React 18, Vite, Tailwind, Zustand, dnd-kit, D3, PWA |
| Backend | FastAPI, SQLModel, Pydantic v2 |
| NLP | sentence-transformers (graph), IndicBERT (demo endpoints), Groq (optional distractors) |

---

## Quick reference

| Goal | Action |
|------|--------|
| Play with bundled questions | Install deps, run backend + frontend. |
| Better wrong answers at runtime | `LLM_PROVIDER=groq` + `GROQ_API_KEY`. |
| More questions from Wikipedia | Add Kaggle corpus under `tamil_wiki/…`, run `build_dataset.py`, merge JSON. |
| Fully local LLM distractors | Extend `llm_distractors.py` (and optionally `build_dataset.py`); 7B local models not recommended for Tamil. |

---

## License

See [LICENSE](LICENSE).
