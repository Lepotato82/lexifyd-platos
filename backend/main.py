import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel

from database import engine
from dataset import load_dataset
from routers import words, game, graph, nlp


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    count = load_dataset()
    print(f"Loaded {count} dataset entries")
    yield


app = FastAPI(title="Lexifyd API", version="2.0.0", lifespan=lifespan)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(words.router, prefix="/api/words", tags=["words"])
app.include_router(game.router, prefix="/api/game", tags=["game"])
app.include_router(graph.router, prefix="/api/words", tags=["graph"])
app.include_router(nlp.router, prefix="/api/nlp", tags=["nlp"])


@app.get("/health")
def health():
    from dataset import _dataset
    return {"status": "ok", "dataset_entries": len(_dataset)}
