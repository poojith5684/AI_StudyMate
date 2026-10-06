from fastapi import APIRouter, Depends
from typing import List, Dict
from collections import defaultdict
from datetime import datetime

from app.schemas import ProgressOut, TopicProgress, DifficultyLevel, Recommendation
from app.routes.auth import get_current_user
from app.routes.quiz import _attempts

router = APIRouter()


@router.get("/{course_id}", response_model=ProgressOut)
async def get_progress(course_id: str, user: dict = Depends(get_current_user)):
    """Get learning progress and adaptive recommendations for a course."""
    user_attempts = [
        a for a in _attempts
        if a["course_id"] == course_id and a["user_id"] == user["id"]
    ]
    
    if not user_attempts:
        return ProgressOut(
            course_id=course_id,
            overall_accuracy=0.0,
            questions_attempted=0,
            quiz_count=0,
            topics=[],
            strong_topics=[],
            weak_topics=[],
            recommendations=["Upload study materials and take your first quiz to get personalized recommendations."]
        )
    
    total_correct = sum(a["score"] for a in user_attempts)
    total_questions = sum(a["total"] for a in user_attempts)
    overall_acc = (total_correct / total_questions * 100) if total_questions else 0
    
    # Aggregate by topic
    topic_data: Dict[str, Dict] = defaultdict(lambda: {"correct": 0, "total": 0, "last": None})
    
    for a in user_attempts:
        for tb in a.get("topic_breakdown", []):
            t = tb["topic"]
            topic_data[t]["correct"] += tb["correct"]
            topic_data[t]["total"] += tb["total"]
            topic_data[t]["last"] = a["created_at"]
    
    topics = []
    for t, s in topic_data.items():
        acc = (s["correct"] / s["total"] * 100) if s["total"] else 0
        # Adaptive difficulty suggestion
        if acc >= 80:
            diff = DifficultyLevel.HARD
        elif acc >= 50:
            diff = DifficultyLevel.MEDIUM
        else:
            diff = DifficultyLevel.EASY
        
        topics.append(TopicProgress(
            topic=t,
            accuracy=round(acc, 1),
            questions_attempted=s["total"],
            last_attempted=datetime.fromisoformat(s["last"]) if s["last"] else None,
            difficulty_level=diff
        ))
    
    strong = [t.topic for t in topics if t.accuracy >= 80]
    weak = [t.topic for t in topics if t.accuracy < 50]
    
    # Recommendations
    recs = []
    if weak:
        for w in weak[:2]:
            recs.append(f"Your weakest topic is '{w}'. Review the material and try an Easy quiz on it.")
    if strong:
        recs.append(f"You are strong in: {', '.join(strong)}. Try harder questions to challenge yourself.")
    if not weak and not strong and topics:
        recs.append("Keep practicing! Aim for 80%+ accuracy on each topic.")
    
    if overall_acc < 50:
        recs.append("Overall accuracy is low. Focus on reviewing fundamentals before attempting harder quizzes.")
    elif overall_acc >= 80:
        recs.append("Great progress! Consider exploring advanced topics or helping peers.")
    
    return ProgressOut(
        course_id=course_id,
        overall_accuracy=round(overall_acc, 1),
        questions_attempted=total_questions,
        quiz_count=len(user_attempts),
        topics=topics,
        strong_topics=strong,
        weak_topics=weak,
        recommendations=recs or ["Take more quizzes to unlock personalized recommendations."]
    )


@router.get("/{course_id}/recommendations")
async def get_recommendations(course_id: str, user: dict = Depends(get_current_user)):
    """Get personalized recommendations."""
    progress = await get_progress(course_id, user)
    return {
        "course_id": course_id,
        "recommendations": progress.recommendations,
        "weak_topics": progress.weak_topics,
        "strong_topics": progress.strong_topics,
        "suggested_difficulty": "easy" if progress.weak_topics else "medium"
    }
