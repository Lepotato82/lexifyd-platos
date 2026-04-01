"""Dynamic distractor generation via Groq LLM.

Generates morphologically-aware Tamil distractors in real-time.
Strategy: all 4 options (correct + 3 distractors) are different
inflected forms of the SAME root word, so the player must identify
the correct grammatical case/suffix for the sentence context.
This directly tests Tamil morphological awareness.
"""

import json
import os
import logging

log = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        try:
            from groq import Groq
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                log.warning("GROQ_API_KEY not set — dynamic distractors disabled")
                return None
            _client = Groq(api_key=api_key)
        except ImportError:
            log.warning("groq package not installed — dynamic distractors disabled")
            return None
    return _client


DISTRACTOR_PROMPT = """You are a Tamil morphology expert creating a fill-in-the-blank vocabulary game.

The root word being tested: {word_ta}
Sense being tested: {sense} ({pos})
The correct answer for this sentence: {correct_answer}

Sentence (______ is the blank):
{sentence}

Task: Generate exactly 3 WRONG inflected forms of the root word "{word_ta}".

Rules:
1. Every distractor MUST be a different grammatical form of "{word_ta}" itself — NOT a different word
2. Each must use a different case suffix or postposition than "{correct_answer}"
3. Each must be a real, grammatically valid Tamil form of "{word_ta}"
4. None of them should make sense in the sentence above
5. All 4 options (your 3 + the correct answer) should look convincingly similar to a learner

Tamil case suffixes to draw from (pick those different from the correct answer's suffix):
- Nominative: {word_ta} (bare form)
- Accusative: {word_ta}ஐ / {word_ta}யை / {word_ta}க்கு
- Dative: {word_ta}க்கு / {word_ta}உக்கு
- Locative: {word_ta}இல் / {word_ta}யில்
- Ablative: {word_ta}இலிருந்து / {word_ta}யிலிருந்து
- Instrumental/Adverbial: {word_ta}ஆக / {word_ta}யாக
- Comitative: {word_ta}உடன் / {word_ta}யுடன்
- Genitive: {word_ta}இன் / {word_ta}யின்
- Postpositional: {word_ta}மூலம், {word_ta}பற்றி, {word_ta}க்காக

Example: if root is "மாலை" and correct answer is "மாலையில்" (locative),
good distractors: ["மாலையை", "மாலையாக", "மாலையுடன்"]
BAD distractors: ["காலையில்", "சோலை", "வேலை"] — these are different words, not allowed.

Return ONLY a JSON array of exactly 3 Tamil strings. No explanation, no markdown.
["form1", "form2", "form3"]
"""


def _validate_distractors(
    candidates: list[str],
    correct_answer: str,
    word_ta: str,
) -> list[str]:
    """Keep only candidates that are inflected forms of word_ta
    and differ from the correct answer."""
    valid = []
    for d in candidates:
        d = d.strip()
        if not d:
            continue
        if d == correct_answer:
            continue
        if not d.startswith(word_ta):
            log.debug(
                "Distractor '%s' rejected — does not start with root '%s'",
                d, word_ta,
            )
            continue
        valid.append(d)
    return valid


def filter_inflection_distractors(
    distractors: list[str],
    correct_answer: str,
    word_ta: str,
) -> list[str]:
    """Public wrapper — same rules as dynamic gameplay distractors (root-prefix forms)."""
    return _validate_distractors(list(distractors), correct_answer, word_ta)


def generate_distractors(
    sentence: str,
    correct_answer: str,
    word_ta: str,
    sense: str,
    pos: str,
    fallback_distractors: list[str],
) -> list[str]:
    """Generate 3 wrong inflected forms of the same root word via Groq LLM.

    All 4 options (correct + 3 distractors) will be grammatical forms of
    word_ta, forcing the player to identify the correct case/suffix.
    Falls back to dataset distractors if LLM is unavailable or fails validation.
    """
    client = _get_client()
    if client is None:
        return fallback_distractors

    prompt = DISTRACTOR_PROMPT.format(
        sentence=sentence,
        correct_answer=correct_answer,
        word_ta=word_ta,
        sense=sense,
        pos=pos,
    )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a Tamil morphology expert. Generate only inflected forms "
                        "of the given root word. Respond ONLY with a valid JSON array of "
                        "exactly 3 Tamil strings."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.6,
            max_tokens=120,
        )
        text = response.choices[0].message.content.strip()

        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            text = text.rsplit("```", 1)[0]

        candidates = json.loads(text)
        if not isinstance(candidates, list):
            raise ValueError("LLM did not return a list")

        valid = _validate_distractors(candidates, correct_answer, word_ta)

        if len(valid) >= 3:
            log.debug("LLM inflected distractors accepted: %s", valid[:3])
            return valid[:3]

        # Partial: blend valid LLM forms with dataset fallback
        if valid:
            needed = 3 - len(valid)
            extra = [d for d in fallback_distractors if d not in valid and d != correct_answer]
            combined = valid + extra[:needed]
            if len(combined) >= 3:
                log.debug("Blended distractors (LLM + dataset): %s", combined[:3])
                return combined[:3]

        log.warning(
            "LLM inflected distractors failed validation. Got: %s. "
            "Falling back to dataset.", candidates,
        )

    except Exception as e:
        log.warning("LLM distractor generation failed: %s", e)

    return fallback_distractors
