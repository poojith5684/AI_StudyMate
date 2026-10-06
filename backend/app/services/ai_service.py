"""LLM completion service."""

from typing import Optional
import logging
import json
import re

from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

_client = None


def get_llm_client():
    """Create and cache the OpenAI-compatible LLM client."""

    global _client

    if _client is None:
        if not settings.AI_API_KEY:
            logger.warning("AI_API_KEY is not configured.")
            return None

        try:
            _client = OpenAI(
                api_key=settings.AI_API_KEY,
                base_url=settings.AI_BASE_URL,
            )

            logger.info(
                "LLM client initialized successfully."
            )

        except Exception as e:
            logger.error(
                f"Failed to initialize LLM client: {e}"
            )
            return None

    return _client


async def generate_completion(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
) -> str:
    """Generate a completion using the configured LLM."""

    client = get_llm_client()

    if not client:
        return (
            "AI is not configured. Please add your AI_API_KEY "
            "to the backend/.env file and restart the server."
        )

    try:
        response = client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            temperature=temperature,
            max_tokens=1200,
        )

        content = response.choices[0].message.content

        if not content:
            return "I couldn't generate an answer."

        return content.strip()

    except Exception as e:
        logger.error(
            f"LLM completion failed: {e}"
        )

        return (
            "Sorry, I encountered an error while "
            f"generating a response: {str(e)}"
        )


async def generate_quiz_questions(
    context: str,
    topic: Optional[str],
    difficulty: str,
    count: int,
) -> list:
    """Generate quiz questions from study material."""

    client = get_llm_client()

    if not client:
        return []

    difficulty_guide = {
        "easy": "basic recall and simple understanding questions",
        "medium": "application and intermediate understanding questions",
        "hard": "analysis, synthesis and challenging questions",
    }

    system = """
You are an expert exam question setter.

Generate multiple-choice questions based ONLY on the provided study material.

Return a valid JSON array only.
Do not use markdown.
Do not add any explanation outside the JSON.
"""

    user = f"""
Generate exactly {count} multiple-choice questions at
{difficulty} difficulty.

Difficulty description:
{difficulty_guide.get(difficulty, "appropriate difficulty")}

Topic focus:
{topic or "general from the material"}

Each question must have:

- question: string
- options: array of exactly 4 strings
- correct_answer: integer index from 0 to 3
- explanation: short explanation
- topic: short topic name

STUDY MATERIAL:

{context[:6000]}

Return ONLY a JSON array in this format:

[
  {{
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct_answer": 0,
    "explanation": "...",
    "topic": "..."
  }}
]
"""

    try:
        response = client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": system,
                },
                {
                    "role": "user",
                    "content": user,
                },
            ],
            temperature=0.5,
            max_tokens=2500,
        )

        content = response.choices[0].message.content

        if not content:
            return []

        content = content.strip()

        # Remove markdown code fences if the model adds them.
        content = re.sub(
            r"^```(?:json)?\s*",
            "",
            content,
            flags=re.IGNORECASE,
        )

        content = re.sub(
            r"\s*```$",
            "",
            content,
        )

        content = content.strip()

        # Extract JSON array if extra text was returned.
        match = re.search(
            r"\[[\s\S]*\]",
            content,
        )

        if match:
            content = match.group(0)

        questions = json.loads(content)

        # Some models may return:
        # {"questions": [...]}
        if isinstance(questions, dict):
            questions = questions.get(
                "questions",
                [],
            )

        if not isinstance(questions, list):
            return []

        return questions

    except Exception as e:
        logger.error(
            f"Quiz generation failed: {e}"
        )

        return []