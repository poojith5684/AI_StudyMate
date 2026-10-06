from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import uuid

from app.schemas import TutorAskRequest, TutorResponse, Citation
from app.routes.auth import get_current_user
from app.services.rag import answer_question

router = APIRouter()

# Simple in-memory chat history
_sessions: dict = {}


@router.post("/ask", response_model=TutorResponse)
async def ask_tutor(
    data: TutorAskRequest,
    user: dict = Depends(get_current_user)
):
    """Ask the AI tutor a question grounded in course materials."""
    session_id = data.session_id or str(uuid.uuid4())
    message_id = str(uuid.uuid4())
    
    answer, citations = await answer_question(
        course_id=data.course_id,
        question=data.question,
        mode=data.mode
    )
    
    # Store history
    if session_id not in _sessions:
        _sessions[session_id] = []
    
    _sessions[session_id].append({
        "role": "user",
        "content": data.question,
        "timestamp": datetime.utcnow().isoformat()
    })
    _sessions[session_id].append({
        "role": "assistant",
        "content": answer,
        "citations": [c.model_dump() for c in citations],
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return TutorResponse(
        answer=answer,
        citations=citations,
        session_id=session_id,
        message_id=message_id
    )


@router.get("/history/{session_id}")
async def get_history(session_id: str, user: dict = Depends(get_current_user)):
    """Get chat history for a session."""
    return {
        "session_id": session_id,
        "messages": _sessions.get(session_id, [])
    }
