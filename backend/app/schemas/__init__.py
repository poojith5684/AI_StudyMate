from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


# Auth
class UserProfile(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


# Courses
class CourseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    subject: Optional[str] = None


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None


class CourseOut(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    material_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


# Materials
class MaterialStatus(str, Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    INDEXING = "indexing"
    READY = "ready"
    ERROR = "error"


class MaterialOut(BaseModel):
    id: str
    course_id: str
    filename: str
    file_type: str
    status: MaterialStatus
    page_count: Optional[int] = None
    chunk_count: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# Tutor
class TutorAskRequest(BaseModel):
    course_id: str
    question: str = Field(..., min_length=3, max_length=2000)
    session_id: Optional[str] = None
    mode: str = "detailed"  # simple, detailed, summary, examples


class Citation(BaseModel):
    source: str
    page_or_slide: Optional[str] = None
    chunk_text: Optional[str] = None


class TutorResponse(BaseModel):
    answer: str
    citations: List[Citation] = []
    session_id: str
    message_id: str


# Quiz
class QuizGenerateRequest(BaseModel):
    course_id: str
    topic: Optional[str] = None
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    question_count: int = Field(default=5, ge=1, le=20)


class QuizQuestion(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_answer: int  # index
    explanation: str
    topic: Optional[str] = None
    difficulty: DifficultyLevel
    source: Optional[str] = None


class QuizGenerateResponse(BaseModel):
    quiz_id: str
    questions: List[QuizQuestion]
    topic: Optional[str] = None
    difficulty: DifficultyLevel


class QuizSubmitRequest(BaseModel):
    quiz_id: str
    course_id: str
    answers: Dict[str, int]  # question_id -> selected option index


class TopicScore(BaseModel):
    topic: str
    correct: int
    total: int
    accuracy: float


class QuizResult(BaseModel):
    quiz_id: str
    score: int
    total: int
    accuracy: float
    topic_breakdown: List[TopicScore]
    results: List[Dict[str, Any]]
    weak_topics: List[str] = []
    strong_topics: List[str] = []


# Progress
class TopicProgress(BaseModel):
    topic: str
    accuracy: float
    questions_attempted: int
    last_attempted: Optional[datetime] = None
    difficulty_level: DifficultyLevel = DifficultyLevel.MEDIUM


class ProgressOut(BaseModel):
    course_id: str
    overall_accuracy: float
    questions_attempted: int
    quiz_count: int
    topics: List[TopicProgress]
    strong_topics: List[str]
    weak_topics: List[str]
    recommendations: List[str]


class Recommendation(BaseModel):
    type: str
    message: str
    action: Optional[str] = None
    topic: Optional[str] = None
