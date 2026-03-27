# Lexifyd — Tamil Polysemy Word Game

Discover the many meanings of Tamil polysemous words through context-aware, drag-and-drop gameplay, backed by an LLM and visualised as a semantic knowledge graph.

---

## Quick Start

### Prerequisites
- **Backend**: Python 3.11+, `pip`
- **Frontend**: Node.js 20+, `npm`
- **LLM**: Either [Ollama](https://ollama.ai) (local, free) or a [Groq](https://console.groq.com) API key

---

### 1. Configure environment

```bash
cp .env .env.local   # edit as needed
```

Key variables:

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | `ollama` or `groq` |
| `GROQ_API_KEY` | *(empty)* | Required if `LLM_PROVIDER=groq` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `DATABASE_URL` | `sqlite:///./lexifyd.db` | SQLite DB path |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origins |

---

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env .env
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

---

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

### 4. Using Docker Compose

```bash
docker compose up --build
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, dnd-kit, D3.js, Zustand |
| Backend | FastAPI, SQLModel (SQLite), Pydantic v2 |
| LLM | Groq (`llama-3.3-70b-versatile`) / Ollama (`llama3.2`) |
| NLP | IndicNLP (Tamil morphology + POS) |
| PWA | vite-plugin-pwa (installable, offline-ready) |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/words/analyze` | Extract senses, generate game data |
| `GET`  | `/api/words/{word_id}/graph` | Semantic graph for D3 |
| `POST` | `/api/game/session` | Create game session |
| `POST` | `/api/game/session/{id}/answer` | Submit an answer |
| `GET`  | `/api/game/session/{id}/results` | Get session results |

---

## Example Words to Test

| Tamil | Romanized | Meanings |
|---|---|---|
| ஆறு | Aaru | six · river · to cool down |
| படி | Padi | to read · steps/staircase · to study |
| கல் | Kal | stone · to learn |
| திங்கள் | Thingal | Monday · the Moon |

---

## Dataset Setup

The app ships with a one-time dataset builder that pre-generates verified game
questions from Tamil Wikipedia, eliminating LLM calls for the 10 core polysemous
words during gameplay.

**When to run:** once, after cloning the repo (or after adding new words to
`POLYSEMOUS_WORDS` in `backend/scripts/build_dataset.py`).

```bash
# 1. Place Tamil Wikipedia files in:
#    backend/data/tamil_wiki/raw_text_files/
#    (subdirectories AA/, AB/, ... each with wiki_XX.txt files)

# 2. Configure LLM credentials in backend/.env
#    LLM_PROVIDER=groq
#    GROQ_API_KEY=your_key_here

# 3. Run the builder (~5–10 min depending on corpus size)
cd backend
python scripts/build_dataset.py

# 4. Start the backend normally — dataset loads automatically at startup
python -m uvicorn main:app --port 8001 --reload
```

The builder produces `backend/data/lexifyd_dataset.json` and clears any stale
`lexifyd.db` cache so the app ingests from the fresh dataset on next start.

Check dataset status at runtime:
```bash
curl http://localhost:8001/api/dataset/info
```

**Priority order for `POST /api/words/analyze`:**
1. SQLite cache (instant — word was already played)
2. Pre-built dataset (fast — verified Wikipedia-grounded questions)
3. Full LLM pipeline (slower — for words not in the dataset)

---

## Capacitor (Mobile)

To wrap as a native Android/iOS app:

```bash
cd frontend
npm run build
npx cap add android   # or ios
npx cap sync
npx cap open android
```

Update `VITE_API_URL` to your backend's public/local-network URL.
