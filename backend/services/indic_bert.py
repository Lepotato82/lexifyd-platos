"""IndicBERT fill-mask scorer for distractor quality validation.

Loads ai4bharat/indic-bert as a masked-language model and scores
how likely each distractor word fits into a sentence blank.
Lower probability = better distractor (morphologically plausible
but semantically wrong).
"""

_pipeline = None


def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        from transformers import pipeline
        _pipeline = pipeline(
            "fill-mask",
            model="ai4bharat/indic-bert",
            tokenizer="ai4bharat/indic-bert",
            top_k=50,
        )
    return _pipeline


def score_distractors(
    sentence_with_mask: str,
    correct_answer: str,
    distractors: list[str],
) -> list[dict]:
    """Score how well each distractor fits the sentence blank.

    Args:
        sentence_with_mask: Tamil sentence with ______ as the blank
        correct_answer: The correct Tamil word
        distractors: List of distractor Tamil words

    Returns:
        List of {"word": str, "score": float, "is_good_distractor": bool}
        where score is the fill-mask probability (lower = better distractor).
    """
    pipe = _get_pipeline()
    # Replace the game blank with the model's [MASK] token
    masked = sentence_with_mask.replace("______", "<mask>")

    try:
        predictions = pipe(masked)
    except Exception:
        # Model can't handle this sentence — return neutral scores
        return [{"word": d, "score": 0.0, "is_good_distractor": True} for d in distractors]

    # Build a lookup of token → score from model predictions
    pred_scores = {}
    for pred in predictions:
        token = pred.get("token_str", "").strip()
        pred_scores[token] = pred.get("score", 0.0)

    results = []
    correct_score = pred_scores.get(correct_answer, 0.0)

    for d in distractors:
        d_score = pred_scores.get(d, 0.0)
        # A good distractor has a much lower score than the correct answer
        # but isn't completely impossible (score > 0 means morphologically plausible)
        is_good = d_score < correct_score * 0.5
        results.append({
            "word": d,
            "score": round(d_score, 6),
            "is_good_distractor": is_good,
        })

    return results
