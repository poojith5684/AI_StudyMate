from openai import OpenAI
from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    HTTPException,
    UploadFile,
    File,
    Form,
    Header,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from supabase import create_client, Client

from typing import Optional
from uuid import uuid4
from datetime import datetime, timezone

import os
import shutil


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

AI_API_KEY = os.getenv("AI_API_KEY")

AI_BASE_URL = os.getenv(
    "AI_BASE_URL",
    "https://api.groq.com/openai/v1"
)

AI_MODEL = os.getenv(
    "AI_MODEL",
    "openai/gpt-oss-120b"
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY"
)


# ============================================================
# AI CLIENT
# ============================================================

ai_client = None

if AI_API_KEY:
    try:
        ai_client = OpenAI(
            api_key=AI_API_KEY,
            base_url=AI_BASE_URL,
        )
        print("AI client initialized successfully.")
    except Exception as e:
        print("AI client initialization failed:", e)
else:
    print("WARNING: AI_API_KEY is not configured.")


# ============================================================
# SUPABASE CLIENT
# ============================================================

supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase = create_client(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
        )
        print("Supabase client initialized successfully.")
    except Exception as e:
        print("Supabase initialization failed:", repr(e))
else:
    print("WARNING: Supabase is not configured.")


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="AI StudyMate API",
    description="AI-powered personalized study companion",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# LOCAL STORAGE
# ============================================================

UPLOAD_DIR = "uploads"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True,
)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads",
)


# ============================================================
# TEMPORARY MEMORY DATA
# ============================================================

materials = []
progress_data = {}
tutor_history = {}
quizzes = {}


# ============================================================
# SCHEMAS
# ============================================================

class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    subject: Optional[str] = ""


class CourseProgress(BaseModel):
    progress: int


class AskRequest(BaseModel):
    question: str
    course_id: Optional[str] = None
    session_id: Optional[str] = None
    mode: Optional[str] = "normal"


class QuizSubmit(BaseModel):
    answers: dict
    quiz_id: Optional[str] = None
    course_id: Optional[str] = None


class QuizGenerate(BaseModel):
    course_id: str
    topic: Optional[str] = ""
    difficulty: Optional[str] = "medium"
    question_count: Optional[int] = 5


# ============================================================
# HELPERS
# ============================================================

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def require_supabase():
    if not supabase:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured on the backend.",
        )


def extract_bearer_token(
    authorization: Optional[str],
):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization token is required.",
        )

    if not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization format.",
        )

    token = authorization.split(" ", 1)[1].strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authorization token is empty.",
        )

    return token


def get_current_user(
    authorization: Optional[str],
):
    require_supabase()

    token = extract_bearer_token(
        authorization
    )

    try:
        response = supabase.auth.get_user(token)

        user = response.user

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired session.",
            )

        return user

    except HTTPException:
        raise

    except Exception as e:
        print("Supabase auth error:", repr(e))

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session.",
        )


def normalize_course(course: dict):
    course_id = str(course.get("id"))

    course_material_count = len(
        [
            material
            for material in materials
            if material.get("course_id") == course_id
        ]
    )

    memory_progress = progress_data.get(
        course_id,
        {},
    ).get(
        "progress",
        course.get("progress", 0) or 0,
    )

    completed = bool(
        course.get(
            "completed",
            int(memory_progress) >= 100,
        )
    )

    created_at = course.get(
        "created_at",
        now_iso(),
    )

    updated_at = course.get(
        "updated_at",
        created_at,
    )

    return {
        "id": course_id,
        "user_id": str(course.get("user_id", "")),
        "title": course.get("title", ""),
        "description": course.get(
            "description",
            "",
        ),
        "subject": course.get(
            "subject",
            "General",
        ),
        "material_count": course_material_count,
        "progress": int(memory_progress),
        "completed": completed,
        "created_at": created_at,
        "updated_at": updated_at,
    }


def get_user_courses(
    user_id: str,
):
    require_supabase()

    try:
        response = (
            supabase
            .table("courses")
            .select("*")
            .eq("user_id", user_id)
            .order(
                "created_at",
                desc=True,
            )
            .execute()
        )

        rows = response.data or []

        return [
            normalize_course(row)
            for row in rows
        ]

    except Exception as e:
        print("Get courses error:", repr(e))

        raise HTTPException(
            status_code=500,
            detail="Failed to load courses.",
        )


def get_user_course(
    course_id: str,
    user_id: str,
):
    require_supabase()

    try:
        response = (
            supabase
            .table("courses")
            .select("*")
            .eq("id", course_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        rows = response.data or []

        if not rows:
            raise HTTPException(
                status_code=404,
                detail="Course not found.",
            )

        return normalize_course(
            rows[0]
        )

    except HTTPException:
        raise

    except Exception as e:
        print("Get course error:", repr(e))

        raise HTTPException(
            status_code=500,
            detail="Failed to load course.",
        )


def try_persist_progress(
    course_id: str,
    user_id: str,
    progress: int,
    completed: bool,
):
    if not supabase:
        return

    try:
        # Only update columns that may exist.
        # If a deployment/table doesn't contain them,
        # the exception is safely ignored.
        supabase.table("courses").update(
            {
                "progress": progress,
                "completed": completed,
                "updated_at": now_iso(),
            }
        ).eq(
            "id",
            course_id,
        ).eq(
            "user_id",
            user_id,
        ).execute()

    except Exception as e:
        print(
            "Progress persistence skipped:",
            repr(e),
        )


def get_course_for_internal_use(
    course_id: str,
    user_id: Optional[str] = None,
):
    if supabase and user_id:
        return get_user_course(
            course_id,
            user_id,
        )

    return None


# ============================================================
# HOME
# ============================================================

@app.get("/")
def root():
    return {
        "message": "Welcome to AI StudyMate API",
        "docs": "/docs",
        "health": "/health",
        "status": "running",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "app": "AI StudyMate",
        "version": "1.0.0",
        "ai_configured": bool(
            ai_client
        ),
        "ai_model": AI_MODEL,
        "supabase_configured": bool(
            supabase
        ),
    }


# ============================================================
# AUTH
# ============================================================

@app.get("/api/auth/status")
def auth_status(
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    full_name = user.user_metadata.get(
        "full_name"
    )

    return {
        "authenticated": True,
        "user": {
            "id": str(user.id),
            "name": (
                full_name
                if full_name
                else (
                    user.email
                    or "Student"
                )
            ),
        },
    }


@app.get("/api/auth/me")
def auth_me(
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    full_name = user.user_metadata.get(
        "full_name"
    )

    return {
        "id": str(user.id),
        "name": (
            full_name
            if full_name
            else (
                user.email
                or "Student"
            )
        ),
        "email": user.email,
    }


# ============================================================
# COURSES
# ============================================================

@app.get("/api/courses")
def get_courses(
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    return get_user_courses(
        str(user.id)
    )


@app.post("/api/courses")
def create_course(
    data: CourseCreate,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    title = data.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Course title is required.",
        )

    course_data = {
        "user_id": str(user.id),
        "title": title,
        "description": (
            data.description or ""
        ).strip(),
        "subject": (
            data.subject or "General"
        ).strip()
        or "General",
    }

    require_supabase()

    try:
        response = (
            supabase
            .table("courses")
            .insert(course_data)
            .execute()
        )

        rows = response.data or []

        if not rows:
            raise HTTPException(
                status_code=500,
                detail="Course was not created.",
            )

        return normalize_course(
            rows[0]
        )

    except HTTPException:
        raise

    except Exception as e:
        print(
            "Create course error:",
            repr(e),
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to create course.",
        )


@app.get("/api/courses/{course_id}")
def get_course(
    course_id: str,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    return get_user_course(
        course_id,
        str(user.id),
    )


@app.delete("/api/courses/{course_id}")
def delete_course(
    course_id: str,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    user_id = str(user.id)

    course = get_user_course(
        course_id,
        user_id,
    )

    try:
        (
            supabase
            .table("courses")
            .delete()
            .eq("id", course["id"])
            .eq("user_id", user_id)
            .execute()
        )

        global materials

        materials = [
            material
            for material in materials
            if material.get("course_id")
            != course_id
        ]

        progress_data.pop(
            course_id,
            None,
        )

        return {
            "success": True,
            "message": "Course deleted successfully.",
        }

    except Exception as e:
        print(
            "Delete course error:",
            repr(e),
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to delete course.",
        )


# ============================================================
# COURSE PROGRESS
# ============================================================

@app.put(
    "/api/courses/{course_id}/progress"
)
def update_course_progress(
    course_id: str,
    data: CourseProgress,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    user_id = str(user.id)

    course = get_user_course(
        course_id,
        user_id,
    )

    progress = max(
        0,
        min(
            int(data.progress),
            100,
        ),
    )

    completed = progress >= 100

    progress_data[course_id] = {
        "progress": progress,
        "updated_at": now_iso(),
    }

    try_persist_progress(
        course_id,
        user_id,
        progress,
        completed,
    )

    course["progress"] = progress
    course["completed"] = completed
    course["updated_at"] = now_iso()

    return course


# ============================================================
# PROGRESS API
# ============================================================

@app.get("/api/progress")
def get_progress(
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    courses = get_user_courses(
        str(user.id)
    )

    total_courses = len(
        courses
    )

    completed_courses = len(
        [
            course
            for course in courses
            if course["completed"]
        ]
    )

    average_progress = (
        sum(
            course["progress"]
            for course in courses
        )
        // total_courses
        if total_courses
        else 0
    )

    return {
        "total_courses": total_courses,
        "completed_courses": completed_courses,
        "average_progress": average_progress,
    }


@app.get(
    "/api/progress/{course_id}"
)
def get_course_progress(
    course_id: str,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    course = get_user_course(
        course_id,
        str(user.id),
    )

    course_materials = [
        material
        for material in materials
        if material.get("course_id")
        == course_id
    ]

    return {
        "course_id": course_id,
        "progress": course["progress"],
        "completed": course["completed"],
        "material_count": len(
            course_materials
        ),
    }


@app.get(
    "/api/progress/{course_id}/recommendations"
)
def progress_recommendations(
    course_id: str,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    course = get_user_course(
        course_id,
        str(user.id),
    )

    progress = course["progress"]

    if progress < 25:

        recommendations = [
            "Start with the basic concepts.",
            "Study for at least 30 minutes today.",
            "Complete your first learning material.",
        ]

    elif progress < 50:

        recommendations = [
            "Continue studying the current topic.",
            "Try a practice quiz.",
            "Review your notes.",
        ]

    elif progress < 75:

        recommendations = [
            "Practice more questions.",
            "Revise difficult concepts.",
            "Try the AI Tutor.",
        ]

    elif progress < 100:

        recommendations = [
            "You are almost finished!",
            "Complete the remaining topics.",
            "Take the final quiz.",
        ]

    else:

        recommendations = [
            "Course completed!",
            "Review important concepts.",
            "Start another course.",
        ]

    return {
        "course_id": course_id,
        "recommendations": recommendations,
    }


# ============================================================
# MATERIALS
# ============================================================

@app.get("/api/materials")
def get_materials(
    authorization: Optional[str] = Header(
        default=None
    ),
):
    get_current_user(
        authorization
    )

    return materials


@app.get(
    "/api/materials/course/{course_id}"
)
def get_course_materials(
    course_id: str,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    get_user_course(
        course_id,
        str(user.id),
    )

    return [
        material
        for material in materials
        if material.get("course_id")
        == course_id
    ]


@app.post("/api/materials")
def create_material(
    data: dict,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    course_id = data.get(
        "course_id"
    )

    if course_id:
        get_user_course(
            course_id,
            str(user.id),
        )

    material = {
        "id": str(uuid4()),
        "title": data.get(
            "title",
            "Untitled Material",
        ),
        "type": data.get(
            "type",
            "note",
        ),
        "course_id": course_id,
        "url": data.get(
            "url",
            "",
        ),
        "created_at": now_iso(),
    }

    materials.append(
        material
    )

    return material


# ============================================================
# FILE UPLOAD
# ============================================================

@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(
        default=None
    ),
):
    get_current_user(
        authorization
    )

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    file_id = str(uuid4())

    safe_name = (
        file.filename
        .replace("\\", "_")
        .replace("/", "_")
    )

    filename = (
        f"{file_id}_{safe_name}"
    )

    file_path = os.path.join(
        UPLOAD_DIR,
        filename,
    )

    with open(
        file_path,
        "wb",
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer,
        )

    material = {
        "id": file_id,
        "title": file.filename,
        "filename": filename,
        "type": "file",
        "url": f"/uploads/{filename}",
        "created_at": now_iso(),
    }

    materials.append(
        material
    )

    return {
        "success": True,
        "message": "File uploaded successfully.",
        "material": material,
    }


# ============================================================
# MATERIAL UPLOAD COMPATIBILITY
# ============================================================

@app.post(
    "/api/materials/upload"
)
async def upload_material(
    course_id: str = Form(...),
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    get_user_course(
        course_id,
        str(user.id),
    )

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    file_id = str(uuid4())

    safe_name = (
        file.filename
        .replace("\\", "_")
        .replace("/", "_")
    )

    filename = (
        f"{file_id}_{safe_name}"
    )

    file_path = os.path.join(
        UPLOAD_DIR,
        filename,
    )

    with open(
        file_path,
        "wb",
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer,
        )

    material = {
        "id": file_id,
        "title": file.filename,
        "filename": filename,
        "type": "file",
        "course_id": course_id,
        "url": f"/uploads/{filename}",
        "created_at": now_iso(),
    }

    materials.append(
        material
    )

    return material


@app.get(
    "/api/materials/{material_id}/status"
)
def material_status(
    material_id: str,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    get_current_user(
        authorization
    )

    for material in materials:

        if material["id"] == material_id:

            return {
                "id": material_id,
                "status": "completed",
                "message": "Material is ready.",
            }

    raise HTTPException(
        status_code=404,
        detail="Material not found.",
    )


# ============================================================
# AI TUTOR - REAL AI
# ============================================================

@app.post("/api/tutor/ask")
def ask_tutor(
    data: AskRequest,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    question = data.question.strip()

    if not question:

        return {
            "answer": "Please enter a question.",
            "session_id": (
                data.session_id
                or str(uuid4())
            ),
        }

    session_id = (
        data.session_id
        or str(uuid4())
    )

    user_id = str(user.id)

    course = None

    if data.course_id:
        course = get_user_course(
            data.course_id,
            user_id,
        )

    course_title = (
        course["title"]
        if course
        else "General Study"
    )

    course_subject = (
        course["subject"]
        if course
        else "General"
    )

    if session_id not in tutor_history:
        tutor_history[session_id] = []

    tutor_history[session_id].append(
        {
            "role": "user",
            "content": question,
            "created_at": now_iso(),
        }
    )

    if not ai_client:

        answer = (
            "AI Tutor is not configured correctly.\n\n"
            "Please check AI_API_KEY in the backend environment."
        )

        tutor_history[
            session_id
        ].append(
            {
                "role": "assistant",
                "content": answer,
                "created_at": now_iso(),
            }
        )

        return {
            "answer": answer,
            "session_id": session_id,
        }

    system_prompt = f"""
You are AI StudyMate, an intelligent personal AI tutor.

You are helping a college student study.

Current course:
{course_title}

Subject:
{course_subject}

Learning mode:
{data.mode or "normal"}

Your responsibilities:

1. Answer the student's exact question.
2. Explain concepts clearly and simply.
3. Adapt the explanation to a college student.
4. Give examples whenever useful.
5. For programming questions:
   - provide working code
   - explain the code
   - mention important concepts
6. For mathematics:
   - show the solution step by step
   - explain formulas
7. For engineering subjects:
   - provide definitions
   - explain working/principle
   - give applications
   - include important exam points
8. If the student asks for an exam answer, structure it clearly.
9. Use Markdown formatting.
10. Use code blocks for programming code.
11. Never give a generic template response.
12. Always answer the actual question.
13. If the question is ambiguous, make a reasonable interpretation
    and explain it.
14. Be helpful, accurate and concise unless the student asks for detail.
"""

    previous_messages = (
        tutor_history.get(
            session_id,
            [],
        )
    )

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    recent_messages = (
        previous_messages[-10:]
    )

    for message in recent_messages:

        role = message.get(
            "role"
        )

        if role in [
            "user",
            "assistant",
        ]:

            messages.append(
                {
                    "role": role,
                    "content": message.get(
                        "content",
                        "",
                    ),
                }
            )

    try:

        response = (
            ai_client
            .chat
            .completions
            .create(
                model=AI_MODEL,
                messages=messages,
                temperature=0.4,
                max_tokens=2000,
            )
        )

        answer = (
            response
            .choices[0]
            .message
            .content
            if response.choices
            else None
        )

        if not answer:

            answer = (
                "Sorry, I could not generate an answer. "
                "Please try again."
            )

    except Exception as e:

        print(
            "AI Tutor Error:",
            repr(e),
        )

        answer = (
            "I couldn't connect to the AI service right now.\n\n"
            f"Error: {str(e)}"
        )

    tutor_history[
        session_id
    ].append(
        {
            "role": "assistant",
            "content": answer,
            "created_at": now_iso(),
        }
    )

    return {
        "answer": answer,
        "response": answer,
        "session_id": session_id,
        "course_id": data.course_id,
        "mode": data.mode or "normal",
    }


# ============================================================
# AI TUTOR HISTORY
# ============================================================

@app.get(
    "/api/tutor/history/{session_id}"
)
def get_tutor_history(
    session_id: str,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    get_current_user(
        authorization
    )

    return {
        "session_id": session_id,
        "messages": tutor_history.get(
            session_id,
            [],
        ),
    }


# ============================================================
# OLD ASK ENDPOINT
# ============================================================

@app.post("/ask")
def ask(
    authorization: Optional[str] = Header(
        default=None
    ),
):
    get_current_user(
        authorization
    )

    return {
        "answer": "AI StudyMate Tutor is ready.",
    }


# ============================================================
# QUIZ
# ============================================================

@app.get("/api/quiz")
def get_quiz(
    authorization: Optional[str] = Header(
        default=None
    ),
):
    get_current_user(
        authorization
    )

    return {
        "questions": [
            {
                "id": 1,
                "question": (
                    "What is the main topic "
                    "you want to study?"
                ),
                "options": [
                    "Option A",
                    "Option B",
                    "Option C",
                    "Option D",
                ],
                "answer": "Option A",
            },
            {
                "id": 2,
                "question": (
                    "Which option is correct?"
                ),
                "options": [
                    "Option A",
                    "Option B",
                    "Option C",
                    "Option D",
                ],
                "answer": "Option B",
            },
            {
                "id": 3,
                "question": (
                    "Choose the correct answer."
                ),
                "options": [
                    "Option A",
                    "Option B",
                    "Option C",
                    "Option D",
                ],
                "answer": "Option C",
            },
        ]
    }


# ============================================================
# QUIZ GENERATION
# ============================================================

@app.post(
    "/api/quiz/generate"
)
def generate_quiz(
    data: QuizGenerate,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    course = get_user_course(
        data.course_id,
        str(user.id),
    )

    count = max(
        1,
        min(
            data.question_count or 5,
            20,
        ),
    )

    base_questions = [

        {
            "id": 1,
            "question": (
                f"What is an important concept in "
                f"{data.topic or course['title']}?"
            ),
            "options": [
                "Understanding the fundamentals",
                "Ignoring the fundamentals",
                "Skipping practice",
                "Avoiding revision",
            ],
            "answer": 0,
        },

        {
            "id": 2,
            "question": (
                "Which approach is generally useful "
                "when learning a new topic?"
            ),
            "options": [
                "Practice and revision",
                "Never practicing",
                "Only memorizing the title",
                "Skipping examples",
            ],
            "answer": 0,
        },

        {
            "id": 3,
            "question": (
                "What helps improve understanding?"
            ),
            "options": [
                "Examples and practice",
                "Avoiding questions",
                "Skipping notes",
                "Not reviewing mistakes",
            ],
            "answer": 0,
        },

        {
            "id": 4,
            "question": (
                "What should you do after making a mistake?"
            ),
            "options": [
                "Review and understand it",
                "Ignore it",
                "Delete your notes",
                "Stop practicing",
            ],
            "answer": 0,
        },

        {
            "id": 5,
            "question": (
                "Which habit is useful for exam preparation?"
            ),
            "options": [
                "Regular revision",
                "No revision",
                "Only studying at the last minute",
                "Avoiding practice tests",
            ],
            "answer": 0,
        },
    ]

    questions = base_questions[:count]

    quiz_id = str(uuid4())

    quizzes[quiz_id] = {
        "course_id": data.course_id,
        "user_id": str(user.id),
        "questions": questions,
    }

    return {
        "quiz_id": quiz_id,
        "course_id": data.course_id,
        "topic": data.topic,
        "difficulty": data.difficulty,
        "questions": [
            {
                "id": question["id"],
                "question": question["question"],
                "options": question["options"],
            }
            for question in questions
        ],
    }


# ============================================================
# QUIZ SUBMISSION
# ============================================================

@app.post(
    "/api/quiz/submit"
)
def submit_quiz(
    data: QuizSubmit,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    user_id = str(user.id)

    if (
        data.quiz_id
        and data.quiz_id in quizzes
    ):

        quiz = quizzes[
            data.quiz_id
        ]

        if quiz.get("user_id") != user_id:
            raise HTTPException(
                status_code=403,
                detail="Quiz does not belong to this user.",
            )

        score = 0

        questions = quiz[
            "questions"
        ]

        for question in questions:

            question_id = str(
                question["id"]
            )

            submitted = data.answers.get(
                question_id
            )

            if submitted == question["answer"]:
                score += 1

        total = len(
            questions
        )

    else:

        correct_answers = {
            "1": "Option A",
            "2": "Option B",
            "3": "Option C",
        }

        score = 0

        for question_id, answer in data.answers.items():

            if (
                question_id
                in correct_answers
                and answer
                == correct_answers[
                    question_id
                ]
            ):
                score += 1

        total = len(
            correct_answers
        )

    percentage = (
        int(
            (score / total) * 100
        )
        if total
        else 0
    )

    if data.course_id:

        course = get_user_course(
            data.course_id,
            user_id,
        )

        old_progress = course[
            "progress"
        ]

        if percentage >= 80:

            new_progress = min(
                100,
                old_progress + 10,
            )

        elif percentage >= 50:

            new_progress = min(
                100,
                old_progress + 5,
            )

        else:

            new_progress = old_progress

        completed = (
            new_progress >= 100
        )

        progress_data[
            data.course_id
        ] = {
            "progress": new_progress,
            "updated_at": now_iso(),
        }

        try_persist_progress(
            data.course_id,
            user_id,
            new_progress,
            completed,
        )

    return {
        "score": score,
        "total": total,
        "percentage": percentage,
        "message": "Quiz submitted successfully",
    }


# ============================================================
# DASHBOARD
# ============================================================

@app.get("/api/dashboard")
def dashboard(
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(
        authorization
    )

    courses = get_user_courses(
        str(user.id)
    )

    total_courses = len(
        courses
    )

    completed_courses = len(
        [
            course
            for course in courses
            if course["completed"]
        ]
    )

    average_progress = (
        sum(
            course["progress"]
            for course in courses
        )
        // total_courses
        if total_courses > 0
        else 0
    )

    return {
        "active_courses": (
            total_courses
            - completed_courses
        ),
        "completed_courses": completed_courses,
        "total_courses": total_courses,
        "learning_progress": average_progress,
        "study_streak": 0,
    }


# ============================================================
# SERVER TEST
# ============================================================

@app.get("/api/test")
def test(
    authorization: Optional[str] = Header(
        default=None
    ),
):
    get_current_user(
        authorization
    )

    return {
        "status": "ok",
        "message": (
            "AI StudyMate backend is working!"
        ),
        "ai_configured": bool(
            ai_client
        ),
        "ai_model": AI_MODEL,
        "supabase_configured": bool(
            supabase
        ),
    }