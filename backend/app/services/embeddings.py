"""Embedding generation service."""

from typing import List
import logging

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# Local embedding model
# Produces 384-dimensional vectors
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

_model = None


def get_openai_client():
    """
    Compatibility function.

    Some existing services still import this function.
    Embeddings are now generated locally, so no OpenAI/Groq
    client is required here.
    """
    return None


def get_embedding_model():
    """Load the local embedding model only once."""

    global _model

    if _model is None:
        try:
            logger.info(
                f"Loading embedding model: {EMBEDDING_MODEL_NAME}"
            )

            _model = SentenceTransformer(
                EMBEDDING_MODEL_NAME
            )

            logger.info(
                "Embedding model loaded successfully."
            )

        except Exception as e:
            logger.error(
                f"Failed to load embedding model: {e}"
            )
            raise

    return _model


async def generate_embeddings(
    texts: List[str],
) -> List[List[float]]:
    """
    Generate embeddings locally.

    Model:
        all-MiniLM-L6-v2

    Vector dimension:
        384
    """

    if not texts:
        return []

    try:
        model = get_embedding_model()

        embeddings = model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        return embeddings.tolist()

    except Exception as e:
        logger.error(
            f"Embedding generation failed: {e}"
        )

        raise ValueError(
            f"Failed to generate embeddings: {str(e)}"
        )


async def generate_query_embedding(
    query: str,
) -> List[float]:
    """Generate embedding for a single query."""

    results = await generate_embeddings([query])

    if not results:
        return []

    return results[0]