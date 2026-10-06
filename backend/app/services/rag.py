"""Retrieval-Augmented Generation service."""
from typing import List, Dict, Any, Tuple
import logging
from app.services.embeddings import generate_query_embedding
from app.services.vector_store import search
from app.services.ai_service import generate_completion
from app.config import get_settings
from app.schemas import Citation

logger = logging.getLogger(__name__)
settings = get_settings()


async def answer_question(
    course_id: str,
    question: str,
    mode: str = "detailed"
) -> Tuple[str, List[Citation]]:
    """
    Full RAG pipeline:
    1. Embed question
    2. Retrieve relevant chunks
    3. Build context
    4. Generate grounded answer
    5. Return answer + citations
    """
    # 1. Query embedding
    query_emb = await generate_query_embedding(question)
    
    if not query_emb:
        return (
            "AI service is not configured. Please set AI_API_KEY in the backend .env file to enable the tutor.",
            []
        )
    
    # 2. Retrieve
    chunks = search(course_id, query_emb, top_k=settings.TOP_K)
    
    if not chunks:
        return (
            "I couldn't find enough information about this in your uploaded study materials. "
            "Please make sure you have uploaded and processed relevant PDFs or PowerPoint files for this course.",
            []
        )
    
    # 3. Build context
    context_parts = []
    citations = []
    seen_sources = set()
    
    for i, chunk in enumerate(chunks):
        citation_text = chunk.get("citation", chunk.get("filename", "Source"))
        context_parts.append(f"[{i+1}] {chunk['text']}")
        
        if citation_text not in seen_sources:
            seen_sources.add(citation_text)
            citations.append(Citation(
                source=chunk.get("filename", "Unknown"),
                page_or_slide=str(chunk.get("page_number") or chunk.get("slide_number") or ""),
                chunk_text=chunk["text"][:200] + "..." if len(chunk["text"]) > 200 else chunk["text"]
            ))
    
    context = "\n\n".join(context_parts)
    
    # 4. Prompt based on mode
    system_prompts = {
        "simple": "You are a friendly tutor. Explain concepts in simple language suitable for beginners. Use short sentences and everyday examples.",
        "detailed": "You are an expert tutor. Provide clear, accurate, and thorough explanations. Structure your answer well.",
        "summary": "You are a tutor. Provide a concise summary of the key points.",
        "examples": "You are a tutor. Explain the concept and then give 2-3 concrete examples to illustrate it."
    }
    
    system = system_prompts.get(mode, system_prompts["detailed"])
    
    user_prompt = f"""Answer the student's question using ONLY the following study material excerpts. 
If the material does not contain enough information, say so clearly.
Do not make up information that is not in the provided context.
At the end of your answer, do not list sources (they will be shown separately).

STUDY MATERIAL:
{context}

STUDENT QUESTION:
{question}

ANSWER:"""
    
    # 5. Generate
    answer = await generate_completion(system, user_prompt)
    
    return answer, citations
