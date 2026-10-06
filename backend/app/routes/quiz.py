from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from datetime import datetime
import uuid

from app.schemas import (
    QuizGenerateRequest, QuizGenerateResponse, QuizQuestion,
    QuizSubmitRequest, QuizResult, TopicScore, DifficultyLevel
)
from app.routes.auth import get_current_user
from app.services.vector_store import search, get_chunk_count
from app.services.embeddings import generate_query_embedding
from app.services.ai_service import generate_quiz_questions
from app.config import get_settings

router = APIRouter()
settings = get_settings()

_quizzes: Dict[str, Any] = {}
_attempts: List[Dict] = []


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(
    data: QuizGenerateRequest,
    user: dict = Depends(get_current_user)
):
    """Generate a quiz from the course knowledge base."""
    if get_chunk_count(data.course_id) == 0:
        raise HTTPException(
            status_code=400,
            detail="No study materials indexed for this course. Please upload and process materials first."
        )
    
    # Retrieve relevant context
    query = data.topic or "important concepts definitions explanations"
    query_emb = await generate_query_embedding(query)
    chunks = search(data.course_id, query_emb, top_k=8)
    
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not retrieve relevant material for quiz generation.")
    
    context = "\n\n".join([c["text"] for c in chunks])
    
    raw_questions = await generate_quiz_questions(
        context=context,
        topic=data.topic,
        difficulty=data.difficulty.value,
        count=data.question_count
    )
    
    if not raw_questions:
        raise HTTPException(
            status_code=503,
            detail="Quiz generation failed. Ensure AI_API_KEY is configured correctly."
        )
    
    quiz_id = str(uuid.uuid4())
    questions = []
    
    for i, q in enumerate(raw_questions[:data.question_count]):
        qid = str(uuid.uuid4())
        questions.append(QuizQuestion(
            id=qid,
            question=q.get("question", f"Question {i+1}"),
            options=q.get("options", ["A", "B", "C", "D"])[:4],
            correct_answer=int(q.get("correct_answer", 0)),
            explanation=q.get("explanation", ""),
            topic=q.get("topic") or data.topic or "General",
            difficulty=data.difficulty,
            source=chunks[0].get("citation") if chunks else None
        ))
    
    _quizzes[quiz_id] = {
        "id": quiz_id,
        "course_id": data.course_id,
        "user_id": user["id"],
        "questions": [q.model_dump() for q in questions],
        "difficulty": data.difficulty.value,
        "topic": data.topic,
        "created_at": datetime.utcnow().isoformat()
    }
    
    return QuizGenerateResponse(
        quiz_id=quiz_id,
        questions=questions,
        topic=data.topic,
        difficulty=data.difficulty
    )


@router.post("/submit", response_model=QuizResult)
async def submit_quiz(
    data: QuizSubmitRequest,
    user: dict = Depends(get_current_user)
):
    """Submit quiz answers and get scored results + adaptive analysis."""
    quiz = _quizzes.get(data.quiz_id)
    if not quiz or quiz["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    questions = quiz["questions"]
    results = []
    topic_stats: Dict[str, Dict] = {}
    
    correct_count = 0
    
    for q in questions:
        qid = q["id"]
        selected = data.answers.get(qid, -1)
        is_correct = selected == q["correct_answer"]
        if is_correct:
            correct_count += 1
        
        topic = q.get("topic") or "General"
        if topic not in topic_stats:
            topic_stats[topic] = {"correct": 0, "total": 0}
        topic_stats[topic]["total"] += 1
        if is_correct:
            topic_stats[topic]["correct"] += 1
        
        results.append({
            "question_id": qid,
            "question": q["question"],
            "selected": selected,
            "correct_answer": q["correct_answer"],
            "is_correct": is_correct,
            "explanation": q.get("explanation", ""),
            "topic": topic
        })
    
    total = len(questions)
    accuracy = (correct_count / total * 100) if total > 0 else 0
    
    topic_breakdown = [
        TopicScore(
            topic=t,
            correct=s["correct"],
            total=s["total"],
            accuracy=round(s["correct"] / s["total"] * 100, 1) if s["total"] else 0
        )
        for t, s in topic_stats.items()
    ]
    
    weak = [t.topic for t in topic_breakdown if t.accuracy < 50]
    strong = [t.topic for t in topic_breakdown if t.accuracy >= 80]
    
    # Save attempt
    attempt = {
        "id": str(uuid.uuid4()),
        "quiz_id": data.quiz_id,
        "course_id": data.course_id,
        "user_id": user["id"],
        "score": correct_count,
        "total": total,
        "accuracy": accuracy,
        "topic_breakdown": [t.model_dump() for t in topic_breakdown],
        "created_at": datetime.utcnow().isoformat()
    }
    _attempts.append(attempt)
    
    return QuizResult(
        quiz_id=data.quiz_id,
        score=correct_count,
        total=total,
        accuracy=round(accuracy, 1),
        topic_breakdown=topic_breakdown,
        results=results,
        weak_topics=weak,
        strong_topics=strong
    )
