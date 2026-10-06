"""
Simple in-memory vector store for development / demo.
In production this would use Supabase pgvector.
"""
from typing import List, Dict, Any, Optional
import numpy as np
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

# Global in-memory store: course_id -> list of {chunk, embedding}
_store: Dict[str, List[Dict[str, Any]]] = defaultdict(list)


def add_chunks(course_id: str, chunks: List[Dict[str, Any]], embeddings: List[List[float]]):
    """Add chunks with their embeddings to the store."""
    if len(chunks) != len(embeddings):
        raise ValueError("Chunks and embeddings length mismatch")
    
    for chunk, emb in zip(chunks, embeddings):
        if not emb:  # skip empty embeddings
            continue
        _store[course_id].append({
            "chunk": chunk,
            "embedding": np.array(emb, dtype=np.float32)
        })
    logger.info(f"Added {len(chunks)} chunks to course {course_id}. Total: {len(_store[course_id])}")


def search(course_id: str, query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
    """Cosine similarity search."""
    if course_id not in _store or not _store[course_id]:
        return []
    
    if not query_embedding:
        return []
    
    q = np.array(query_embedding, dtype=np.float32)
    q_norm = np.linalg.norm(q)
    if q_norm == 0:
        return []
    
    scored = []
    for item in _store[course_id]:
        emb = item["embedding"]
        emb_norm = np.linalg.norm(emb)
        if emb_norm == 0:
            continue
        sim = float(np.dot(q, emb) / (q_norm * emb_norm))
        scored.append((sim, item["chunk"]))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    return [chunk for _, chunk in scored[:top_k]]


def get_chunk_count(course_id: str) -> int:
    return len(_store.get(course_id, []))


def clear_course(course_id: str):
    if course_id in _store:
        del _store[course_id]
