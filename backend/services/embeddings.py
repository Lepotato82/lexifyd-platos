"""Sentence-transformer embeddings for semantic similarity.

Lazy-loads the multilingual MiniLM model on first call.
Used by the graph router to compute sense-to-sense similarity
with real vector cosine distance instead of keyword Jaccard overlap.
"""

import numpy as np

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    return _model


def encode(texts: list[str]) -> np.ndarray:
    """Encode a list of texts into normalised embedding vectors."""
    model = _get_model()
    return model.encode(texts, normalize_embeddings=True)


def cosine_similarity(text_a: str, text_b: str) -> float:
    """Compute cosine similarity between two texts using MiniLM embeddings."""
    vecs = encode([text_a, text_b])
    return float(np.dot(vecs[0], vecs[1]))


def pairwise_similarities(texts: list[str]) -> np.ndarray:
    """Return an NxN cosine similarity matrix for a list of texts."""
    vecs = encode(texts)
    return np.dot(vecs, vecs.T)
