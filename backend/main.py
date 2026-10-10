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
from coding_catalog import extended_problem_bank

from typing import Optional
from uuid import uuid4
from datetime import datetime, timezone

import os
import json
import random
import re
import zipfile
import xml.etree.ElementTree as ET
import shutil
import httpx


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

# ---------------- AI ----------------

AI_API_KEY = os.getenv("AI_API_KEY")

AI_BASE_URL = os.getenv(
    "AI_BASE_URL",
    "https://api.groq.com/openai/v1",
)

AI_MODEL = os.getenv(
    "AI_MODEL",
    "openai/gpt-oss-120b",
)

# ---------------- SUPABASE ----------------

SUPABASE_URL = os.getenv(
    "SUPABASE_URL"
)

# New Supabase server key:
# SUPABASE_SECRET_KEY=sb_secret_...
#
# Backward compatibility:
# SUPABASE_SERVICE_ROLE_KEY=...
#
SUPABASE_SECRET_KEY = (
    os.getenv("SUPABASE_SECRET_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

SUPABASE_PUBLISHABLE_KEY = (
    os.getenv("SUPABASE_PUBLISHABLE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
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

        print(
            "AI client initialized successfully."
        )

    except Exception as e:

        print(
            "AI client initialization failed:",
            repr(e),
        )

else:

    print(
        "WARNING: AI_API_KEY is not configured."
    )


# ============================================================
# SUPABASE CLIENTS
# ============================================================
#
# db_client:
#     Used ONLY for server/database operations.
#
# auth_client:
#     Used ONLY to validate the user's access token.
#
# This separation prevents the user's JWT from replacing
# the server-side secret context used for database writes.
# ============================================================

db_client: Optional[Client] = None

auth_client: Optional[Client] = None


if SUPABASE_URL and SUPABASE_SECRET_KEY:

    try:

        clean_supabase_url = (
            SUPABASE_URL.strip().rstrip("/")
        )

        clean_supabase_key = (
            SUPABASE_SECRET_KEY.strip()
        )

        db_client = create_client(
            clean_supabase_url,
            clean_supabase_key,
        )

        auth_client = create_client(
            clean_supabase_url,
            clean_supabase_key,
        )

        print(
            "Supabase database client initialized successfully."
        )

        print(
            "Supabase auth client initialized successfully."
        )

    except Exception as e:

        print(
            "Supabase initialization failed:",
            repr(e),
        )

else:

    print(
        "WARNING: Supabase is not configured."
    )


# ============================================================
# FASTAPI APP
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
# UPLOAD STORAGE
# ============================================================

UPLOAD_DIR = "uploads"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True,
)

app.mount(
    "/uploads",
    StaticFiles(
        directory=UPLOAD_DIR
    ),
    name="uploads",
)


# ============================================================
# MEMORY DATA
# ============================================================
#
# Courses:
#     Supabase persistent storage.
#
# Materials / Tutor history / quizzes:
#     Current application memory storage.
#
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
# GENERAL HELPERS
# ============================================================

def now_iso():
    return datetime.now(
        timezone.utc
    ).isoformat()


# ============================================================
# SUPABASE CHECK
# ============================================================

def require_supabase():

    if not db_client:

        raise HTTPException(
            status_code=503,
            detail=(
                "Supabase is not configured "
                "on the backend."
            ),
        )


# ============================================================
# AUTH TOKEN
# ============================================================

def extract_bearer_token(
    authorization: Optional[str],
):
    if not authorization:

        raise HTTPException(
            status_code=401,
            detail=(
                "Authorization token is required."
            ),
        )

    if not authorization.lower().startswith(
        "bearer "
    ):

        raise HTTPException(
            status_code=401,
            detail=(
                "Invalid authorization format."
            ),
        )

    token = authorization.split(
        " ",
        1,
    )[1].strip()

    if not token:

        raise HTTPException(
            status_code=401,
            detail=(
                "Authorization token is empty."
            ),
        )

    return token


# ============================================================
# CURRENT USER
# ============================================================

def get_current_user(
    authorization: Optional[str],
):
    """
    Validate the Supabase access token.

    IMPORTANT:
    A separate auth client is used here.
    The database client remains untouched and
    continues using the server secret key.
    """

    require_supabase()

    token = extract_bearer_token(
        authorization
    )

    if not auth_client:

        raise HTTPException(
            status_code=503,
            detail=(
                "Supabase authentication "
                "is not configured."
            ),
        )

    try:

        response = auth_client.auth.get_user(
            token
        )

        user = response.user

        if not user:

            raise HTTPException(
                status_code=401,
                detail=(
                    "Invalid or expired session."
                ),
            )

        return user

    except HTTPException:
        raise

    except Exception as e:

        print(
            "Supabase authentication error:",
            repr(e),
        )

        raise HTTPException(
            status_code=401,
            detail=(
                "Invalid or expired session."
            ),
        )


# ============================================================
# COURSE NORMALIZATION
# ============================================================

def normalize_course(
    course: dict,
):
    """
    Convert a Supabase row into the exact shape
    expected by the frontend.
    """

    course_id = str(
        course.get("id")
    )

    # --------------------------------------------------------
    # MATERIAL COUNT
    # --------------------------------------------------------

    memory_material_count = len(
        [
            material
            for material in materials
            if str(
                material.get("course_id")
            ) == course_id
        ]
    )

    database_material_count = course.get(
        "material_count"
    )

    if database_material_count is None:

        material_count = (
            memory_material_count
        )

    else:

        try:

            material_count = int(
                database_material_count
            )

        except Exception:

            material_count = (
                memory_material_count
            )

    # --------------------------------------------------------
    # PROGRESS
    # --------------------------------------------------------

    database_progress = course.get(
        "progress",
        0,
    )

    if database_progress is None:

        database_progress = 0

    memory_progress = (
        progress_data
        .get(course_id, {})
        .get(
            "progress",
            database_progress,
        )
    )

    try:

        progress = int(
            memory_progress
        )

    except Exception:

        progress = 0

    progress = max(
        0,
        min(
            progress,
            100,
        ),
    )

    # --------------------------------------------------------
    # COMPLETED
    # --------------------------------------------------------

    completed_value = course.get(
        "completed"
    )

    if completed_value is None:

        completed = (
            progress >= 100
        )

    else:

        completed = bool(
            completed_value
        )

    # --------------------------------------------------------
    # DATES
    # --------------------------------------------------------

    created_at = (
        course.get(
            "created_at"
        )
        or now_iso()
    )

    updated_at = (
        course.get(
            "updated_at"
        )
        or created_at
    )

    # --------------------------------------------------------
    # FINAL OBJECT
    # --------------------------------------------------------

    return {

        "id": course_id,

        "user_id": str(
            course.get(
                "user_id",
                "",
            )
        ),

        "title": course.get(
            "title",
            "",
        ),

        "description": course.get(
            "description",
            "",
        ),

        "subject": course.get(
            "subject",
            "General",
        ),

        "material_count": (
            material_count
        ),

        "progress": progress,

        "completed": completed,

        "created_at": created_at,

        "updated_at": updated_at,
    }


# ============================================================
# GET USER COURSES
# ============================================================

def get_user_courses(
    user_id: str,
    access_token: str,
):
    require_supabase()

    if not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Supabase publishable key is not configured.",
        )

    try:
        response = httpx.get(
            SUPABASE_URL.strip().rstrip("/") + "/rest/v1/courses",
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY.strip(),
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            params={
                "select": "*",
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
            },
            timeout=20.0,
        )

        if response.status_code >= 400:
            print(
                "Get courses REST error:",
                response.status_code,
                response.text[:1000],
            )
            raise HTTPException(
                status_code=502,
                detail="Failed to load courses from Supabase.",
            )

        return [
            normalize_course(row)
            for row in (response.json() or [])
        ]

    except HTTPException:
        raise

    except Exception as e:
        print("Get courses error:", repr(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to load courses.",
        )

# ============================================================
# GET ONE USER COURSE
# ============================================================

def get_user_course(
    course_id: str,
    user_id: str,
    access_token: str,
):
    require_supabase()

    if not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Supabase publishable key is not configured.",
        )

    try:
        response = httpx.get(
            SUPABASE_URL.strip().rstrip("/") + "/rest/v1/courses",
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY.strip(),
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            params={
                "select": "*",
                "id": f"eq.{course_id}",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
            timeout=20.0,
        )

        if response.status_code >= 400:
            print(
                "Get course REST error:",
                response.status_code,
                response.text[:1000],
            )
            raise HTTPException(
                status_code=502,
                detail="Failed to load course from Supabase.",
            )

        rows = response.json() or []

        if not rows:
            raise HTTPException(
                status_code=404,
                detail="Course not found.",
            )

        return normalize_course(rows[0])

    except HTTPException:
        raise

    except Exception as e:
        print("Get course error:", repr(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to load course.",
        )

# ============================================================
# PERSIST PROGRESS
# ============================================================

def persist_progress(
    course_id: str,
    user_id: str,
    progress: int,
    completed: bool,
    access_token: str,
):
    """Persist quiz/course progress using the authenticated user's token."""

    if not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Supabase publishable key is not configured.",
        )

    update_data = {
        "progress": progress,
        "completed": completed,
        "updated_at": now_iso(),
    }

    try:
        response = httpx.patch(
            SUPABASE_URL.strip().rstrip("/") + "/rest/v1/courses",
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY.strip(),
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Prefer": "return=representation",
            },
            params={
                "id": f"eq.{course_id}",
                "user_id": f"eq.{user_id}",
            },
            json=update_data,
            timeout=20.0,
        )

        if response.status_code >= 400:
            print(
                "Progress save failed:",
                response.status_code,
                response.text[:1000],
            )
            raise HTTPException(
                status_code=502,
                detail="Could not save course progress.",
            )

        rows = response.json() if response.content else []

        if not rows:
            raise HTTPException(
                status_code=404,
                detail="Progress was not saved: course not found.",
            )

        progress_data[course_id] = {
            "progress": progress,
            "updated_at": now_iso(),
        }

        print("Progress saved:", course_id, progress)

    except HTTPException:
        raise

    except Exception as e:
        print("Progress save error:", repr(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to save course progress.",
        )

# ============================================================
# HOME
# ============================================================

@app.get("/")
def root():

    return {

        "message": (
            "Welcome to AI StudyMate API"
        ),

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
            db_client
        ),
    }


# ============================================================
# AUTH STATUS
# ============================================================

@app.get(
    "/api/auth/status"
)
def auth_status(
    authorization: Optional[str] = Header(
        default=None
    ),
):

    user = get_current_user(
        authorization
    )

    metadata = (
        user.user_metadata
        or {}
    )

    full_name = metadata.get(
        "full_name"
    )

    if (
        isinstance(
            full_name,
            str,
        )
        and full_name.strip()
    ):

        name = full_name.strip()

    else:

        name = (
            user.email
            or "Student"
        )

    return {

        "authenticated": True,

        "user": {

            "id": str(
                user.id
            ),

            "name": name,
        },
    }


# ============================================================
# AUTH ME
# ============================================================

@app.get(
    "/api/auth/me"
)
def auth_me(
    authorization: Optional[str] = Header(
        default=None
    ),
):

    user = get_current_user(
        authorization
    )

    metadata = (
        user.user_metadata
        or {}
    )

    full_name = metadata.get(
        "full_name"
    )

    if (
        isinstance(
            full_name,
            str,
        )
        and full_name.strip()
    ):

        name = full_name.strip()

    else:

        name = (
            user.email
            or "Student"
        )

    return {

        "id": str(
            user.id
        ),

        "name": name,

        "email": user.email,
    }


# ============================================================
# COURSES - LIST
# ============================================================

@app.get(
    "/api/courses"
)
def get_courses(
    authorization: Optional[str] = Header(
        default=None
    ),
):

    user = get_current_user(
        authorization
    )

    return get_user_courses(
        str(user.id),
        extract_bearer_token(authorization),
    )


# ============================================================
# COURSES - CREATE
# ============================================================

@app.post(
    "/api/courses"
)
def create_course(
    data: CourseCreate,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    # Authenticate the user and obtain their access token.
    user = get_current_user(authorization)
    token = extract_bearer_token(authorization)

    title = data.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Course title is required.",
        )

    if not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Supabase publishable key is not configured.",
        )

    course_data = {
        "user_id": str(user.id),
        "title": title,
        "description": (data.description or "").strip(),
        "subject": (data.subject or "General").strip() or "General",
    }

    require_supabase()

    try:
        rest_url = (
            SUPABASE_URL.strip().rstrip("/")
            + "/rest/v1/courses"
        )

        # Use publishable key + authenticated user's token.
        # Supabase RLS checks that auth.uid() matches user_id.
        response = httpx.post(
            rest_url,
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY.strip(),
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Prefer": "return=representation",
            },
            json=course_data,
            timeout=20.0,
        )

        if response.status_code >= 400:
            print(
                "Supabase course insert failed:",
                response.status_code,
                response.text[:1000],
            )
            raise HTTPException(
                status_code=502,
                detail=(
                    "Supabase rejected course creation. "
                    f"HTTP {response.status_code}"
                ),
            )

        rows = response.json()

        if not rows:
            raise HTTPException(
                status_code=500,
                detail="Course was not created.",
            )

        created_course = normalize_course(rows[0])

        print(
            "Course created successfully:",
            created_course["id"],
        )

        return created_course

    except HTTPException:
        raise

    except Exception as e:
        print("Create course error:", repr(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to create course.",
        )

# ============================================================
# COURSE - GET
# ============================================================

@app.get(
    "/api/courses/{course_id}"
)
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
            extract_bearer_token(authorization),
        )


# ============================================================
# COURSE - DELETE
# ============================================================

@app.delete(
    "/api/courses/{course_id}"
)
def delete_course(
    course_id: str,
    authorization: Optional[str] = Header(
        default=None
    ),
):
    user = get_current_user(authorization)
    token = extract_bearer_token(authorization)
    user_id = str(user.id)

    if not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Supabase publishable key is not configured.",
        )

    # Verify the course belongs to the logged-in user.
    get_user_course(
        course_id,
        user_id,
        token,
    )

    try:
        response = httpx.delete(
            SUPABASE_URL.strip().rstrip("/") + "/rest/v1/courses",
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY.strip(),
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Prefer": "return=representation",
            },
            params={
                "id": f"eq.{course_id}",
                "user_id": f"eq.{user_id}",
                "select": "id",
            },
            timeout=20.0,
        )

        if response.status_code >= 400:
            print(
                "Supabase course delete failed:",
                response.status_code,
                response.text[:1000],
            )
            raise HTTPException(
                status_code=502,
                detail="Supabase rejected course deletion.",
            )

        deleted_rows = response.json() if response.content else []

        if not deleted_rows:
            raise HTTPException(
                status_code=404,
                detail="Course was not deleted or does not belong to this user.",
            )

        global materials
        materials = [
            material
            for material in materials
            if str(material.get("course_id")) != course_id
        ]

        progress_data.pop(course_id, None)

        print("Course deleted successfully:", course_id)

        return {
            "success": True,
            "message": "Course deleted successfully.",
        }

    except HTTPException:
        raise

    except Exception as e:
        print("Delete course error:", repr(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to delete course.",
        )

# ============================================================
# COURSE PROGRESS - UPDATE
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

    user_id = str(
        user.id
    )

    course = get_user_course(
            course_id,
            user_id,
            extract_bearer_token(authorization),
        )

    progress = max(
        0,
        min(
            int(
                data.progress
            ),
            100,
        ),
    )

    completed = (
        progress >= 100
    )

    persist_progress(
        course_id,
        user_id,
        progress,
        completed,
        extract_bearer_token(authorization),
    )

    course["progress"] = (
        progress
    )

    course["completed"] = (
        completed
    )

    course["updated_at"] = (
        now_iso()
    )

    return course


# ============================================================
# PROGRESS
# ============================================================

@app.get(
    "/api/progress"
)
def get_progress(
    authorization: Optional[str] = Header(
        default=None
    ),
):

    user = get_current_user(
        authorization
    )

    courses = get_user_courses(
        str(user.id),
        extract_bearer_token(authorization),
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


# ============================================================
# COURSE PROGRESS - GET
# ============================================================

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
            extract_bearer_token(authorization),
        )

    course_materials = [
        material
        for material in materials
        if str(
            material.get(
                "course_id"
            )
        ) == course_id
    ]

    return {

        "course_id": course_id,

        "progress": course[
            "progress"
        ],

        "completed": course[
            "completed"
        ],

        "material_count": len(
            course_materials
        ),
    }


# ============================================================
# RECOMMENDATIONS
# ============================================================

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
            extract_bearer_token(authorization),
        )

    progress = course[
        "progress"
    ]

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

@app.get(
    "/api/materials"
)
def get_materials(
    authorization: Optional[str] = Header(
        default=None
    ),
):

    get_current_user(
        authorization
    )

    return materials


# ============================================================
# MATERIALS BY COURSE
# ============================================================

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
            extract_bearer_token(authorization),
        )

    return [

        material

        for material in materials

        if str(
            material.get(
                "course_id"
            )
        ) == course_id

    ]


# ============================================================
# CREATE MATERIAL
# ============================================================

@app.post(
    "/api/materials"
)
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
            extract_bearer_token(authorization),
        )

    material = {

        "id": str(
            uuid4()
        ),

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
# GENERIC FILE UPLOAD
# ============================================================

@app.post(
    "/upload"
)
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
            detail=(
                "No file selected."
            ),
        )

    file_id = str(
        uuid4()
    )

    safe_name = (
        file.filename
        .replace(
            "\\",
            "_",
        )
        .replace(
            "/",
            "_",
        )
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

        "url": (
            f"/uploads/{filename}"
        ),

        "created_at": now_iso(),
    }

    materials.append(
        material
    )

    return {

        "success": True,

        "message": (
            "File uploaded successfully."
        ),

        "material": material,
    }


# ============================================================
# COURSE FILE UPLOAD
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
            extract_bearer_token(authorization),
        )

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail=(
                "No file selected."
            ),
        )

    file_id = str(
        uuid4()
    )

    safe_name = (
        file.filename
        .replace(
            "\\",
            "_",
        )
        .replace(
            "/",
            "_",
        )
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

        "url": (
            f"/uploads/{filename}"
        ),

        "created_at": now_iso(),
    }

    materials.append(
        material
    )

    return material


# ============================================================
# MATERIAL STATUS
# ============================================================

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

        if material[
            "id"
        ] == material_id:

            return {

                "id": material_id,

                "status": "completed",

                "message": (
                    "Material is ready."
                ),
            }

    raise HTTPException(
        status_code=404,
        detail=(
            "Material not found."
        ),
    )


# ============================================================
# AI TUTOR
# ============================================================

@app.post(
    "/api/tutor/ask"
)
def ask_tutor(
    data: AskRequest,
    authorization: Optional[str] = Header(
        default=None
    ),
):

    user = get_current_user(
        authorization
    )

    question = (
        data.question.strip()
    )

    if not question:

        return {

            "answer": (
                "Please enter a question."
            ),

            "session_id": (
                data.session_id
                or str(
                    uuid4()
                )
            ),
        }

    session_id = (
        data.session_id
        or str(
            uuid4()
        )
    )

    course = None

    if data.course_id:

        course = get_user_course(
            data.course_id,
            str(user.id),
            extract_bearer_token(authorization),
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

        tutor_history[
            session_id
        ] = []

    tutor_history[
        session_id
    ].append(
        {
            "role": "user",
            "content": question,
            "created_at": now_iso(),
        }
    )

    # --------------------------------------------------------
    # AI NOT CONFIGURED
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # SYSTEM PROMPT
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # CONVERSATION MEMORY
    # --------------------------------------------------------

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

        content = message.get(
            "content",
            "",
        )

        if role in [
            "user",
            "assistant",
        ]:

            messages.append(
                {
                    "role": role,
                    "content": content,
                }
            )

    # --------------------------------------------------------
    # AI CALL
    # --------------------------------------------------------

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
            "Please try again in a moment."
        )

    # --------------------------------------------------------
    # SAVE RESPONSE
    # --------------------------------------------------------

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

@app.post(
    "/ask"
)
def ask(
    authorization: Optional[str] = Header(
        default=None
    ),
):

    get_current_user(
        authorization
    )

    return {

        "answer": (
            "AI StudyMate Tutor is ready."
        ),
    }


# ============================================================
# BASIC QUIZ
# ============================================================

@app.get(
    "/api/quiz"
)
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
# COURSE-AWARE QUIZ HELPERS
# ============================================================

def _quiz_material_context(course_id: str):
    """Extract readable course upload text when files are available on this server."""
    excerpts = []
    titles = []
    text_extensions = {".txt", ".md", ".csv", ".json", ".py", ".c", ".h", ".cpp", ".java", ".sql", ".html", ".xml", ".yaml", ".yml"}

    for material in materials:
        if str(material.get("course_id") or "") != str(course_id):
            continue
        title = str(material.get("title") or material.get("filename") or "Study material")
        if title not in titles:
            titles.append(title)
        content = material.get("extracted_text") or material.get("text") or material.get("content") or ""
        filename = os.path.basename(str(material.get("filename") or ""))
        path = os.path.join(UPLOAD_DIR, filename) if filename else ""

        if not content and path and os.path.isfile(path):
            extension = os.path.splitext(filename)[1].lower()
            try:
                if extension == ".pdf":
                    from pypdf import PdfReader
                    reader = PdfReader(path)
                    content = "\n".join((page.extract_text() or "") for page in reader.pages[:25])
                elif extension == ".pptx":
                    from pptx import Presentation
                    deck = Presentation(path)
                    slide_text = []
                    for slide in deck.slides[:30]:
                        for shape in slide.shapes:
                            if hasattr(shape, "text") and shape.text.strip():
                                slide_text.append(shape.text.strip())
                    content = "\n".join(slide_text)
                elif extension == ".docx":
                    with zipfile.ZipFile(path) as archive:
                        root = ET.fromstring(archive.read("word/document.xml"))
                    content = " ".join(node.text or "" for node in root.iter() if node.tag.endswith("}t"))
                elif extension in text_extensions:
                    with open(path, "r", encoding="utf-8", errors="replace") as handle:
                        content = handle.read()
            except Exception as exc:
                print("Quiz material extraction failed:", title, repr(exc))

        if isinstance(content, str) and content.strip():
            excerpts.append(f"Material: {title}\n{content.strip()[:5500]}")

    return "\n\n".join(excerpts)[:16000], titles


def _quiz_fallback_bank(course_title: str, subject: str = "", description: str = ""):
    """Real subject questions used only if AI generation cannot be reached."""
    text = f"{course_title} {subject} {description}".lower()
    banks = {
        "python": [
            {"question": "Which Python collection is mutable?", "options": ["tuple", "list", "str", "frozenset"], "correct_answer": 1, "topic": "Python data types", "explanation": "Lists are mutable; tuples, strings and frozensets are immutable."},
            {"question": "What does len([4, 8, 12]) return?", "options": ["2", "3", "4", "12"], "correct_answer": 1, "topic": "Built-in functions", "explanation": "The list contains three elements, so len returns 3."},
            {"question": "Which keyword defines a function in Python?", "options": ["func", "function", "def", "lambda-only"], "correct_answer": 2, "topic": "Functions", "explanation": "The def keyword starts a named function definition."},
            {"question": "What values are produced by range(3)?", "options": ["1, 2, 3", "0, 1, 2", "0, 1, 2, 3", "3 only"], "correct_answer": 1, "topic": "Loops", "explanation": "range(3) starts at zero and stops before three."},
            {"question": "Which literal represents no value in Python?", "options": ["NULL", "undefined", "None", "void"], "correct_answer": 2, "topic": "Python basics", "explanation": "Python uses the singleton None to represent the absence of a value."},
        ],
        "java": [
            {"question": "Which method signature is the usual Java application entry point?", "options": ["public static void main(String[] args)", "public void start()", "static int main()", "private static run()"], "correct_answer": 0, "topic": "Java basics", "explanation": "The JVM looks for public static void main(String[] args) as the standard entry point."},
            {"question": "Which keyword is used to inherit a class in Java?", "options": ["implements", "extends", "inherits", "superclass"], "correct_answer": 1, "topic": "Inheritance", "explanation": "A Java class extends another class to inherit its accessible members."},
            {"question": "Which Java type is immutable?", "options": ["String", "StringBuilder", "ArrayList", "int[]"], "correct_answer": 0, "topic": "Strings", "explanation": "String objects cannot be changed after creation; operations create new strings."},
            {"question": "What does the JVM do?", "options": ["Compiles SQL queries", "Executes Java bytecode", "Designs classes", "Stores source files"], "correct_answer": 1, "topic": "Java platform", "explanation": "The Java Virtual Machine executes bytecode and provides the runtime environment."},
            {"question": "Which access modifier limits access to the declaring class?", "options": ["public", "protected", "private", "default-public"], "correct_answer": 2, "topic": "Encapsulation", "explanation": "private members are accessible directly only within their declaring class."},
        ],
        "sql": [
            {"question": "Which SQL statement retrieves rows from a table?", "options": ["SELECT", "FETCHTABLE", "READ ROW", "OPEN"], "correct_answer": 0, "topic": "SELECT queries", "explanation": "SELECT retrieves columns and rows from one or more tables."},
            {"question": "What is the main purpose of a primary key?", "options": ["Allow duplicate row IDs", "Uniquely identify each row", "Sort every column", "Encrypt table values"], "correct_answer": 1, "topic": "Keys and constraints", "explanation": "A primary key uniquely identifies each record and cannot be NULL."},
            {"question": "Which clause filters rows before grouping?", "options": ["ORDER BY", "WHERE", "LIMIT only", "AS"], "correct_answer": 1, "topic": "Filtering", "explanation": "WHERE applies row-level filtering before GROUP BY aggregation."},
            {"question": "Which aggregate function counts rows?", "options": ["SUM()", "TOTALTEXT()", "COUNT()", "ROWS()"], "correct_answer": 2, "topic": "Aggregate functions", "explanation": "COUNT(*) counts rows; COUNT(column) counts non-NULL values in that column."},
            {"question": "How should SQL test whether a value is NULL?", "options": ["= NULL", "== NULL", "IS NULL", "EQUALS NULL"], "correct_answer": 2, "topic": "NULL handling", "explanation": "SQL uses IS NULL because NULL is not an ordinary comparable value."},
        ],
        "dsa": [
            {"question": "Which principle describes a stack?", "options": ["FIFO", "LIFO", "Random access only", "Shortest-job-first"], "correct_answer": 1, "topic": "Stacks", "explanation": "A stack removes the most recently inserted item first: last in, first out."},
            {"question": "What condition does binary search require?", "options": ["The data must be sorted", "Every value must be unique", "The list must be linked", "The size must be odd"], "correct_answer": 0, "topic": "Searching", "explanation": "Binary search halves the search interval and requires sorted data."},
            {"question": "Which data structure is typically used by breadth-first search?", "options": ["Stack", "Queue", "Heap only", "Hash set only"], "correct_answer": 1, "topic": "Graph traversal", "explanation": "BFS processes discovered vertices in first-in, first-out order using a queue."},
            {"question": "What is the expected lookup time of a well-sized hash table?", "options": ["O(1)", "O(log n)", "O(n log n)", "O(n²)"], "correct_answer": 0, "topic": "Hashing", "explanation": "A well-distributed hash table provides expected constant-time lookup."},
            {"question": "Which item is at the root of a min-heap?", "options": ["The smallest key", "The largest key always", "The median key", "The most recent key"], "correct_answer": 0, "topic": "Heaps", "explanation": "A min-heap maintains the smallest key at its root."},
        ],
        "c": [
            {"question": "Which format specifier prints an int using printf in C?", "options": ["%d", "%f", "%s", "%p only"], "correct_answer": 0, "topic": "Input and output", "explanation": "%d is used for an int in printf; %f is for floating-point output and %s for a string."},
            {"question": "In C, what does sizeof return?", "options": ["The number of elements in every array", "The size in bytes of a type or object", "A memory address", "The number of characters printed"], "correct_answer": 1, "topic": "Operators", "explanation": "sizeof evaluates to the size in bytes of its operand's type or object."},
            {"question": "Which operator dereferences a pointer in C?", "options": ["&", "*", "%", "-> only"], "correct_answer": 1, "topic": "Pointers", "explanation": "The unary * operator accesses the object pointed to by a pointer."},
            {"question": "What is the index of the first element in a C array?", "options": ["-1", "1", "0", "Depends on the compiler"], "correct_answer": 2, "topic": "Arrays", "explanation": "C arrays use zero-based indexing, so the first element is at index 0."},
            {"question": "Which operator compares two values for equality in C?", "options": ["=", "==", "!=", "=>"], "correct_answer": 1, "topic": "Operators", "explanation": "== compares values; = assigns a value."},
        ],
        "math": [
            {"question": "What is the derivative of x² with respect to x?", "options": ["x", "2x", "x³/3", "2"], "correct_answer": 1, "topic": "Differentiation", "explanation": "By the power rule, d(x²)/dx = 2x."},
            {"question": "What is an antiderivative of x?", "options": ["x²/2 + C", "2x + C", "1/x + C", "x + C"], "correct_answer": 0, "topic": "Integration", "explanation": "The power rule for integration gives ∫x dx = x²/2 + C."},
            {"question": "What is the determinant of the 2×2 identity matrix?", "options": ["0", "1", "2", "−1"], "correct_answer": 1, "topic": "Matrices", "explanation": "The identity matrix has diagonal entries 1 and determinant 1."},
            {"question": "For a non-zero real vector v, what is v·v?", "options": ["Always negative", "Always zero", "The square of its magnitude", "A vector perpendicular to v"], "correct_answer": 2, "topic": "Vectors", "explanation": "v·v = ||v||², which is positive for a non-zero real vector."},
            {"question": "What does a solution to a differential equation represent?", "options": ["A function satisfying the equation", "Only a constant", "A matrix inverse", "A graph with no variables"], "correct_answer": 0, "topic": "Differential equations", "explanation": "A solution is a function whose derivatives satisfy the given differential equation."},
        ],
        "ai": [
            {"question": "In supervised learning, what does a training example usually contain?", "options": ["Only unlabeled input", "Input features and a target label/value", "Only model weights", "Only a test score"], "correct_answer": 1, "topic": "Supervised learning", "explanation": "Supervised learning uses examples paired with target labels or values."},
            {"question": "What is overfitting?", "options": ["A model performs well on training data but poorly on unseen data", "A model cannot fit training data at all", "A dataset has no columns", "The learning rate is always zero"], "correct_answer": 0, "topic": "Model generalization", "explanation": "Overfitting means a model has learned training-specific patterns that do not generalize."},
            {"question": "What is the main purpose of a held-out test set?", "options": ["Tune every training step", "Estimate performance on unseen data", "Store model code", "Increase the number of labels"], "correct_answer": 1, "topic": "Model evaluation", "explanation": "A test set estimates performance on data not used for fitting."},
            {"question": "Which method is commonly used to reduce a differentiable loss function?", "options": ["Gradient descent", "Binary search only", "Breadth-first search", "Database normalization"], "correct_answer": 0, "topic": "Optimization", "explanation": "Gradient descent updates parameters in a direction that locally reduces loss."},
            {"question": "Which task predicts a continuous numerical value?", "options": ["Classification", "Regression", "Clustering", "Tokenization"], "correct_answer": 1, "topic": "Machine learning tasks", "explanation": "Regression predicts numerical quantities such as price or temperature."},
        ],
        "networks": [
            {"question": "What does DNS primarily do?", "options": ["Map domain names to IP addresses", "Encrypt every file on a computer", "Route electricity", "Compile web pages"], "correct_answer": 0, "topic": "DNS", "explanation": "DNS resolves domain names to records such as IP addresses."},
            {"question": "Which transport protocol is connection-oriented?", "options": ["UDP", "TCP", "IP", "ARP"], "correct_answer": 1, "topic": "Transport layer", "explanation": "TCP establishes a connection and provides reliable, ordered delivery."},
            {"question": "What is the main role of an IP router?", "options": ["Forward packets between networks", "Render HTML", "Store passwords for every app", "Assign variable types"], "correct_answer": 0, "topic": "Routing", "explanation": "Routers forward packets between networks based on routing information."},
            {"question": "Which protocol is commonly used to load secure websites?", "options": ["HTTPS", "FTP only", "SMTP", "DHCP"], "correct_answer": 0, "topic": "Web protocols", "explanation": "HTTPS is HTTP protected by TLS."},
            {"question": "What does a subnet mask help identify?", "options": ["Network and host portions of an IPv4 address", "The CPU instruction set", "The file type", "The web page title"], "correct_answer": 0, "topic": "IP addressing", "explanation": "A subnet mask identifies which address bits belong to the network prefix."},
        ],
        "semiconductor": [
            {"question": "What is the majority carrier in an n-type semiconductor?", "options": ["Electrons", "Holes", "Protons", "Neutrons"], "correct_answer": 0, "topic": "Semiconductors", "explanation": "Donor impurities provide extra electrons, making electrons the majority carriers in n-type material."},
            {"question": "What happens to the depletion region of a PN junction under forward bias?", "options": ["It generally narrows", "It becomes infinitely wide", "It is replaced by a metal layer", "It never changes"], "correct_answer": 0, "topic": "PN junction", "explanation": "Forward bias reduces the potential barrier and narrows the depletion region."},
            {"question": "Which quantity is measured in ohms?", "options": ["Resistance", "Capacitance", "Current", "Power"], "correct_answer": 0, "topic": "Electrical properties", "explanation": "Resistance is measured in ohms (Ω)."},
            {"question": "What is the SI unit of electric current?", "options": ["Ampere", "Volt", "Watt", "Farad"], "correct_answer": 0, "topic": "Electrical quantities", "explanation": "Electric current is measured in amperes (A)."},
            {"question": "A p-type semiconductor has which majority carrier?", "options": ["Holes", "Electrons", "Photons", "Neutrons"], "correct_answer": 0, "topic": "Semiconductors", "explanation": "Acceptor dopants create holes, which are majority carriers in p-type material."},
        ],
    }

    if any(term in text for term in ("data structure", "algorithm", "algorithms", "dsa")):
        return banks["dsa"]
    if any(term in text for term in ("sql", "dbms", "database", "mysql", "postgres", "sqlite")):
        return banks["sql"]
    if "java" in text:
        return banks["java"]
    if "python" in text:
        return banks["python"]
    if any(term in text for term in ("semiconductor", "pn junction", "diode", "transistor", "solid state physics")):
        return banks["semiconductor"]
    if any(term in text for term in ("computer network", "networking", "tcp/ip", "dns")):
        return banks["networks"]
    if any(term in text for term in ("artificial intelligence", "machine learning", "deep learning", "ai/ml")):
        return banks["ai"]
    if any(term in text for term in ("mathematics", "calculus", "differential equation", "linear algebra")):
        return banks["math"]
    if "c programming" in text or "language c" in text or course_title.strip().lower() == "c":
        return banks["c"]
    return []


def _normalise_quiz_question(raw_question: dict, index: int, default_topic: str, default_difficulty: str, source_label: str):
    question_text = str(raw_question.get("question") or "").strip()
    options = raw_question.get("options")
    if not question_text or not isinstance(options, list) or len(options) != 4:
        return None
    options = [str(option).strip() for option in options]
    if any(not option for option in options) or len({option.casefold() for option in options}) != 4:
        return None

    answer = raw_question.get("correct_answer", raw_question.get("answer_index", raw_question.get("answer", 0)))
    if isinstance(answer, str):
        answer_text = answer.strip()
        if len(answer_text) == 1 and answer_text.upper() in {"A", "B", "C", "D"}:
            answer_index = ord(answer_text.upper()) - ord("A")
        elif answer_text in options:
            answer_index = options.index(answer_text)
        else:
            try:
                answer_index = int(answer_text)
            except ValueError:
                return None
    else:
        try:
            answer_index = int(answer)
        except (TypeError, ValueError):
            return None
    if answer_index < 0 or answer_index > 3:
        return None

    indexed_options = list(enumerate(options))
    random.shuffle(indexed_options)
    correct_index = next(new_index for new_index, (old_index, _) in enumerate(indexed_options) if old_index == answer_index)
    level = str(raw_question.get("difficulty") or default_difficulty).lower()
    if level not in {"easy", "medium", "hard"}:
        level = default_difficulty

    return {
        "id": str(index + 1),
        "question": question_text,
        "options": [option for _, option in indexed_options],
        "correct_answer": correct_index,
        "explanation": str(raw_question.get("explanation") or "Review the concept and why this option is correct."),
        "topic": str(raw_question.get("topic") or default_topic).strip() or default_topic,
        "difficulty": level,
        "source": str(raw_question.get("source") or source_label),
    }


def _parse_ai_quiz(content: str, count: int, default_topic: str, difficulty: str, source_label: str):
    fence = chr(96) * 3
    cleaned = re.sub(r"^\s*" + fence + r"(?:json)?\s*", "", content or "", flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*" + fence + r"\s*$", "", cleaned)
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first < 0 or last <= first:
        raise ValueError("The AI response was not a JSON object.")
    payload = json.loads(cleaned[first:last + 1])
    raw_questions = payload.get("questions", []) if isinstance(payload, dict) else []
    if not isinstance(raw_questions, list):
        raise ValueError("The AI did not return a questions array.")

    questions = []
    for raw in raw_questions:
        if not isinstance(raw, dict):
            continue
        item = _normalise_quiz_question(raw, len(questions), default_topic, difficulty, source_label)
        if item:
            questions.append(item)
        if len(questions) >= count:
            break
    if len(questions) < count:
        raise ValueError(f"The AI returned {len(questions)} valid questions; {count} were requested.")
    return questions


# ============================================================
# COURSE-AWARE QUIZ HELPERS
# ============================================================

def _quiz_material_context(course_id: str):
    """Extract readable course upload text when files are available on this server."""
    excerpts = []
    titles = []
    text_extensions = {".txt", ".md", ".csv", ".json", ".py", ".c", ".h", ".cpp", ".java", ".sql", ".html", ".xml", ".yaml", ".yml"}

    for material in materials:
        if str(material.get("course_id") or "") != str(course_id):
            continue
        title = str(material.get("title") or material.get("filename") or "Study material")
        if title not in titles:
            titles.append(title)
        content = material.get("extracted_text") or material.get("text") or material.get("content") or ""
        filename = os.path.basename(str(material.get("filename") or ""))
        path = os.path.join(UPLOAD_DIR, filename) if filename else ""

        if not content and path and os.path.isfile(path):
            extension = os.path.splitext(filename)[1].lower()
            try:
                if extension == ".pdf":
                    from pypdf import PdfReader
                    reader = PdfReader(path)
                    content = "\n".join((page.extract_text() or "") for page in reader.pages[:25])
                elif extension == ".pptx":
                    from pptx import Presentation
                    deck = Presentation(path)
                    slide_text = []
                    for slide in deck.slides[:30]:
                        for shape in slide.shapes:
                            if hasattr(shape, "text") and shape.text.strip():
                                slide_text.append(shape.text.strip())
                    content = "\n".join(slide_text)
                elif extension == ".docx":
                    with zipfile.ZipFile(path) as archive:
                        root = ET.fromstring(archive.read("word/document.xml"))
                    content = " ".join(node.text or "" for node in root.iter() if node.tag.endswith("}t"))
                elif extension in text_extensions:
                    with open(path, "r", encoding="utf-8", errors="replace") as handle:
                        content = handle.read()
            except Exception as exc:
                print("Quiz material extraction failed:", title, repr(exc))

        if isinstance(content, str) and content.strip():
            excerpts.append(f"Material: {title}\n{content.strip()[:5500]}")

    return "\n\n".join(excerpts)[:16000], titles


def _quiz_fallback_bank(course_title: str, subject: str = "", description: str = ""):
    """Real subject questions used only if AI generation cannot be reached."""
    text = f"{course_title} {subject} {description}".lower()
    banks = {
        "python": [
            {"question": "Which Python collection is mutable?", "options": ["tuple", "list", "str", "frozenset"], "correct_answer": 1, "topic": "Python data types", "explanation": "Lists are mutable; tuples, strings and frozensets are immutable."},
            {"question": "What does len([4, 8, 12]) return?", "options": ["2", "3", "4", "12"], "correct_answer": 1, "topic": "Built-in functions", "explanation": "The list contains three elements, so len returns 3."},
            {"question": "Which keyword defines a function in Python?", "options": ["func", "function", "def", "lambda-only"], "correct_answer": 2, "topic": "Functions", "explanation": "The def keyword starts a named function definition."},
            {"question": "What values are produced by range(3)?", "options": ["1, 2, 3", "0, 1, 2", "0, 1, 2, 3", "3 only"], "correct_answer": 1, "topic": "Loops", "explanation": "range(3) starts at zero and stops before three."},
            {"question": "Which literal represents no value in Python?", "options": ["NULL", "undefined", "None", "void"], "correct_answer": 2, "topic": "Python basics", "explanation": "Python uses the singleton None to represent the absence of a value."},
        ],
        "java": [
            {"question": "Which method signature is the usual Java application entry point?", "options": ["public static void main(String[] args)", "public void start()", "static int main()", "private static run()"], "correct_answer": 0, "topic": "Java basics", "explanation": "The JVM looks for public static void main(String[] args) as the standard entry point."},
            {"question": "Which keyword is used to inherit a class in Java?", "options": ["implements", "extends", "inherits", "superclass"], "correct_answer": 1, "topic": "Inheritance", "explanation": "A Java class extends another class to inherit its accessible members."},
            {"question": "Which Java type is immutable?", "options": ["String", "StringBuilder", "ArrayList", "int[]"], "correct_answer": 0, "topic": "Strings", "explanation": "String objects cannot be changed after creation; operations create new strings."},
            {"question": "What does the JVM do?", "options": ["Compiles SQL queries", "Executes Java bytecode", "Designs classes", "Stores source files"], "correct_answer": 1, "topic": "Java platform", "explanation": "The Java Virtual Machine executes bytecode and provides the runtime environment."},
            {"question": "Which access modifier limits access to the declaring class?", "options": ["public", "protected", "private", "default-public"], "correct_answer": 2, "topic": "Encapsulation", "explanation": "private members are accessible directly only within their declaring class."},
        ],
        "sql": [
            {"question": "Which SQL statement retrieves rows from a table?", "options": ["SELECT", "FETCHTABLE", "READ ROW", "OPEN"], "correct_answer": 0, "topic": "SELECT queries", "explanation": "SELECT retrieves columns and rows from one or more tables."},
            {"question": "What is the main purpose of a primary key?", "options": ["Allow duplicate row IDs", "Uniquely identify each row", "Sort every column", "Encrypt table values"], "correct_answer": 1, "topic": "Keys and constraints", "explanation": "A primary key uniquely identifies each record and cannot be NULL."},
            {"question": "Which clause filters rows before grouping?", "options": ["ORDER BY", "WHERE", "LIMIT only", "AS"], "correct_answer": 1, "topic": "Filtering", "explanation": "WHERE applies row-level filtering before GROUP BY aggregation."},
            {"question": "Which aggregate function counts rows?", "options": ["SUM()", "TOTALTEXT()", "COUNT()", "ROWS()"], "correct_answer": 2, "topic": "Aggregate functions", "explanation": "COUNT(*) counts rows; COUNT(column) counts non-NULL values in that column."},
            {"question": "How should SQL test whether a value is NULL?", "options": ["= NULL", "== NULL", "IS NULL", "EQUALS NULL"], "correct_answer": 2, "topic": "NULL handling", "explanation": "SQL uses IS NULL because NULL is not an ordinary comparable value."},
        ],
        "dsa": [
            {"question": "Which principle describes a stack?", "options": ["FIFO", "LIFO", "Random access only", "Shortest-job-first"], "correct_answer": 1, "topic": "Stacks", "explanation": "A stack removes the most recently inserted item first: last in, first out."},
            {"question": "What condition does binary search require?", "options": ["The data must be sorted", "Every value must be unique", "The list must be linked", "The size must be odd"], "correct_answer": 0, "topic": "Searching", "explanation": "Binary search halves the search interval and requires sorted data."},
            {"question": "Which data structure is typically used by breadth-first search?", "options": ["Stack", "Queue", "Heap only", "Hash set only"], "correct_answer": 1, "topic": "Graph traversal", "explanation": "BFS processes discovered vertices in first-in, first-out order using a queue."},
            {"question": "What is the expected lookup time of a well-sized hash table?", "options": ["O(1)", "O(log n)", "O(n log n)", "O(n²)"], "correct_answer": 0, "topic": "Hashing", "explanation": "A well-distributed hash table provides expected constant-time lookup."},
            {"question": "Which item is at the root of a min-heap?", "options": ["The smallest key", "The largest key always", "The median key", "The most recent key"], "correct_answer": 0, "topic": "Heaps", "explanation": "A min-heap maintains the smallest key at its root."},
        ],
        "c": [
            {"question": "Which format specifier prints an int using printf in C?", "options": ["%d", "%f", "%s", "%p only"], "correct_answer": 0, "topic": "Input and output", "explanation": "%d is used for an int in printf; %f is for floating-point output and %s for a string."},
            {"question": "In C, what does sizeof return?", "options": ["The number of elements in every array", "The size in bytes of a type or object", "A memory address", "The number of characters printed"], "correct_answer": 1, "topic": "Operators", "explanation": "sizeof evaluates to the size in bytes of its operand's type or object."},
            {"question": "Which operator dereferences a pointer in C?", "options": ["&", "*", "%", "-> only"], "correct_answer": 1, "topic": "Pointers", "explanation": "The unary * operator accesses the object pointed to by a pointer."},
            {"question": "What is the index of the first element in a C array?", "options": ["-1", "1", "0", "Depends on the compiler"], "correct_answer": 2, "topic": "Arrays", "explanation": "C arrays use zero-based indexing, so the first element is at index 0."},
            {"question": "Which operator compares two values for equality in C?", "options": ["=", "==", "!=", "=>"], "correct_answer": 1, "topic": "Operators", "explanation": "== compares values; = assigns a value."},
        ],
        "math": [
            {"question": "What is the derivative of x² with respect to x?", "options": ["x", "2x", "x³/3", "2"], "correct_answer": 1, "topic": "Differentiation", "explanation": "By the power rule, d(x²)/dx = 2x."},
            {"question": "What is an antiderivative of x?", "options": ["x²/2 + C", "2x + C", "1/x + C", "x + C"], "correct_answer": 0, "topic": "Integration", "explanation": "The power rule for integration gives ∫x dx = x²/2 + C."},
            {"question": "What is the determinant of the 2×2 identity matrix?", "options": ["0", "1", "2", "−1"], "correct_answer": 1, "topic": "Matrices", "explanation": "The identity matrix has diagonal entries 1 and determinant 1."},
            {"question": "For a non-zero real vector v, what is v·v?", "options": ["Always negative", "Always zero", "The square of its magnitude", "A vector perpendicular to v"], "correct_answer": 2, "topic": "Vectors", "explanation": "v·v = ||v||², which is positive for a non-zero real vector."},
            {"question": "What does a solution to a differential equation represent?", "options": ["A function satisfying the equation", "Only a constant", "A matrix inverse", "A graph with no variables"], "correct_answer": 0, "topic": "Differential equations", "explanation": "A solution is a function whose derivatives satisfy the given differential equation."},
        ],
        "ai": [
            {"question": "In supervised learning, what does a training example usually contain?", "options": ["Only unlabeled input", "Input features and a target label/value", "Only model weights", "Only a test score"], "correct_answer": 1, "topic": "Supervised learning", "explanation": "Supervised learning uses examples paired with target labels or values."},
            {"question": "What is overfitting?", "options": ["A model performs well on training data but poorly on unseen data", "A model cannot fit training data at all", "A dataset has no columns", "The learning rate is always zero"], "correct_answer": 0, "topic": "Model generalization", "explanation": "Overfitting means a model has learned training-specific patterns that do not generalize."},
            {"question": "What is the main purpose of a held-out test set?", "options": ["Tune every training step", "Estimate performance on unseen data", "Store model code", "Increase the number of labels"], "correct_answer": 1, "topic": "Model evaluation", "explanation": "A test set estimates performance on data not used for fitting."},
            {"question": "Which method is commonly used to reduce a differentiable loss function?", "options": ["Gradient descent", "Binary search only", "Breadth-first search", "Database normalization"], "correct_answer": 0, "topic": "Optimization", "explanation": "Gradient descent updates parameters in a direction that locally reduces loss."},
            {"question": "Which task predicts a continuous numerical value?", "options": ["Classification", "Regression", "Clustering", "Tokenization"], "correct_answer": 1, "topic": "Machine learning tasks", "explanation": "Regression predicts numerical quantities such as price or temperature."},
        ],
        "networks": [
            {"question": "What does DNS primarily do?", "options": ["Map domain names to IP addresses", "Encrypt every file on a computer", "Route electricity", "Compile web pages"], "correct_answer": 0, "topic": "DNS", "explanation": "DNS resolves domain names to records such as IP addresses."},
            {"question": "Which transport protocol is connection-oriented?", "options": ["UDP", "TCP", "IP", "ARP"], "correct_answer": 1, "topic": "Transport layer", "explanation": "TCP establishes a connection and provides reliable, ordered delivery."},
            {"question": "What is the main role of an IP router?", "options": ["Forward packets between networks", "Render HTML", "Store passwords for every app", "Assign variable types"], "correct_answer": 0, "topic": "Routing", "explanation": "Routers forward packets between networks based on routing information."},
            {"question": "Which protocol is commonly used to load secure websites?", "options": ["HTTPS", "FTP only", "SMTP", "DHCP"], "correct_answer": 0, "topic": "Web protocols", "explanation": "HTTPS is HTTP protected by TLS."},
            {"question": "What does a subnet mask help identify?", "options": ["Network and host portions of an IPv4 address", "The CPU instruction set", "The file type", "The web page title"], "correct_answer": 0, "topic": "IP addressing", "explanation": "A subnet mask identifies which address bits belong to the network prefix."},
        ],
        "semiconductor": [
            {"question": "What is the majority carrier in an n-type semiconductor?", "options": ["Electrons", "Holes", "Protons", "Neutrons"], "correct_answer": 0, "topic": "Semiconductors", "explanation": "Donor impurities provide extra electrons, making electrons the majority carriers in n-type material."},
            {"question": "What happens to the depletion region of a PN junction under forward bias?", "options": ["It generally narrows", "It becomes infinitely wide", "It is replaced by a metal layer", "It never changes"], "correct_answer": 0, "topic": "PN junction", "explanation": "Forward bias reduces the potential barrier and narrows the depletion region."},
            {"question": "Which quantity is measured in ohms?", "options": ["Resistance", "Capacitance", "Current", "Power"], "correct_answer": 0, "topic": "Electrical properties", "explanation": "Resistance is measured in ohms (Ω)."},
            {"question": "What is the SI unit of electric current?", "options": ["Ampere", "Volt", "Watt", "Farad"], "correct_answer": 0, "topic": "Electrical quantities", "explanation": "Electric current is measured in amperes (A)."},
            {"question": "A p-type semiconductor has which majority carrier?", "options": ["Holes", "Electrons", "Photons", "Neutrons"], "correct_answer": 0, "topic": "Semiconductors", "explanation": "Acceptor dopants create holes, which are majority carriers in p-type material."},
        ],
    }

    if any(term in text for term in ("data structure", "algorithm", "algorithms", "dsa")):
        return banks["dsa"]
    if any(term in text for term in ("sql", "dbms", "database", "mysql", "postgres", "sqlite")):
        return banks["sql"]
    if "java" in text:
        return banks["java"]
    if "python" in text:
        return banks["python"]
    if any(term in text for term in ("semiconductor", "pn junction", "diode", "transistor", "solid state physics")):
        return banks["semiconductor"]
    if any(term in text for term in ("computer network", "networking", "tcp/ip", "dns")):
        return banks["networks"]
    if any(term in text for term in ("artificial intelligence", "machine learning", "deep learning", "ai/ml")):
        return banks["ai"]
    if any(term in text for term in ("mathematics", "calculus", "differential equation", "linear algebra")):
        return banks["math"]
    if "c programming" in text or "language c" in text or course_title.strip().lower() == "c":
        return banks["c"]
    return []


def _normalise_quiz_question(raw_question: dict, index: int, default_topic: str, default_difficulty: str, source_label: str):
    question_text = str(raw_question.get("question") or "").strip()
    options = raw_question.get("options")
    if not question_text or not isinstance(options, list) or len(options) != 4:
        return None
    options = [str(option).strip() for option in options]
    if any(not option for option in options) or len({option.casefold() for option in options}) != 4:
        return None

    answer = raw_question.get("correct_answer", raw_question.get("answer_index", raw_question.get("answer", 0)))
    if isinstance(answer, str):
        answer_text = answer.strip()
        if len(answer_text) == 1 and answer_text.upper() in {"A", "B", "C", "D"}:
            answer_index = ord(answer_text.upper()) - ord("A")
        elif answer_text in options:
            answer_index = options.index(answer_text)
        else:
            try:
                answer_index = int(answer_text)
            except ValueError:
                return None
    else:
        try:
            answer_index = int(answer)
        except (TypeError, ValueError):
            return None
    if answer_index < 0 or answer_index > 3:
        return None

    indexed_options = list(enumerate(options))
    random.shuffle(indexed_options)
    correct_index = next(new_index for new_index, (old_index, _) in enumerate(indexed_options) if old_index == answer_index)
    level = str(raw_question.get("difficulty") or default_difficulty).lower()
    if level not in {"easy", "medium", "hard"}:
        level = default_difficulty

    return {
        "id": str(index + 1),
        "question": question_text,
        "options": [option for _, option in indexed_options],
        "correct_answer": correct_index,
        "explanation": str(raw_question.get("explanation") or "Review the concept and why this option is correct."),
        "topic": str(raw_question.get("topic") or default_topic).strip() or default_topic,
        "difficulty": level,
        "source": str(raw_question.get("source") or source_label),
    }


def _parse_ai_quiz(content: str, count: int, default_topic: str, difficulty: str, source_label: str):
    fence = chr(96) * 3
    cleaned = re.sub(r"^\s*" + fence + r"(?:json)?\s*", "", content or "", flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*" + fence + r"\s*$", "", cleaned)
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first < 0 or last <= first:
        raise ValueError("The AI response was not a JSON object.")
    payload = json.loads(cleaned[first:last + 1])
    raw_questions = payload.get("questions", []) if isinstance(payload, dict) else []
    if not isinstance(raw_questions, list):
        raise ValueError("The AI did not return a questions array.")

    questions = []
    for raw in raw_questions:
        if not isinstance(raw, dict):
            continue
        item = _normalise_quiz_question(raw, len(questions), default_topic, difficulty, source_label)
        if item:
            questions.append(item)
        if len(questions) >= count:
            break
    if len(questions) < count:
        raise ValueError(f"The AI returned {len(questions)} valid questions; {count} were requested.")
    return questions


# ============================================================
# QUIZ GENERATION
# ============================================================

@app.post("/api/quiz/generate")
def generate_quiz(
    data: QuizGenerate,
    authorization: Optional[str] = Header(default=None),
):
    user = get_current_user(authorization)
    token = extract_bearer_token(authorization)
    course = get_user_course(data.course_id, str(user.id), token)
    count = max(3, min(int(data.question_count or 5), 20))
    difficulty = str(data.difficulty or "medium").lower()
    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = "medium"

    requested_topic = (data.topic or "").strip()
    focus_topic = requested_topic or str(course.get("title") or "General study")
    material_context, material_titles = _quiz_material_context(data.course_id)
    source_label = "Uploaded study materials" if material_context else "Course curriculum"
    questions = None
    ai_error = None
    used_fallback = False

    if ai_client:
        try:
            system_prompt = """
You are an expert college-level assessment writer. Write high-quality multiple-choice questions that test actual subject knowledge.
Return ONLY valid JSON with this exact shape:
{"questions":[{"question":"...","options":["A","B","C","D"],"correct_answer":0,"explanation":"...","topic":"...","difficulty":"easy|medium|hard"}]}
Rules:
- Test real facts, concepts, calculations, code tracing, or problem-solving in the requested course/topic.
- Never write generic study-habit, motivation, or meta-learning questions.
- Distractors must be plausible and specific to the subject; never use silly options such as "skip practice".
- Exactly four unique options per question. correct_answer is the zero-based index of the one correct option.
- Include a clear explanation and a meaningful topic for each answer.
- Avoid repeated questions and match the requested difficulty and college-student level.
- If source excerpts are supplied, base questions and correct answers on them; do not invent facts beyond them.
- If no readable excerpts are supplied, use accurate domain knowledge for the course and requested topic.
- Return exactly the requested number of questions, with no Markdown or text outside JSON.
""".strip()
            user_prompt = (
                f"COURSE TITLE: {course.get('title', 'Untitled course')}\n"
                f"SUBJECT: {course.get('subject') or 'Not specified'}\n"
                f"COURSE DESCRIPTION: {course.get('description') or 'Not specified'}\n"
                f"FOCUS TOPIC: {focus_topic}\nDIFFICULTY: {difficulty}\nQUESTION COUNT: {count}\n\n"
                f"READABLE UPLOADED MATERIAL EXCERPTS:\n"
                f"{material_context or 'No readable text was found in uploaded files. Use accurate subject knowledge for the course and focus topic.'}\n\n"
                f"Generate questions specifically about {focus_topic}. Avoid generic questions about how to study."
            )
            response = ai_client.chat.completions.create(
                model=AI_MODEL,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                temperature=0.2,
                max_tokens=min(7000, 500 + count * 320),
                timeout=45,
            )
            questions = _parse_ai_quiz(
                response.choices[0].message.content or "",
                count,
                focus_topic,
                difficulty,
                source_label,
            )
        except Exception as exc:
            ai_error = str(exc)
            print("AI quiz generation failed:", repr(exc))

    if not questions:
        fallback = _quiz_fallback_bank(
            str(course.get("title") or ""),
            str(course.get("subject") or ""),
            str(course.get("description") or ""),
        )
        if not fallback:
            if ai_error:
                print("No course-specific fallback available; AI error:", ai_error[:500])
            raise HTTPException(
                status_code=503,
                detail="AI quiz generation is temporarily unavailable for this course. Please retry, or configure AI_API_KEY on the backend.",
            )
        questions = []
        for raw in fallback[:count]:
            item = _normalise_quiz_question(
                raw,
                len(questions),
                focus_topic,
                difficulty,
                "Course fundamentals (AI fallback)",
            )
            if item:
                questions.append(item)
        used_fallback = True

    if not questions:
        raise HTTPException(status_code=503, detail="Could not create valid questions. Please try again.")
    if used_fallback:
        source_label = "Course fundamentals (AI fallback)"

    quiz_id = str(uuid4())
    quizzes[quiz_id] = {
        "course_id": data.course_id,
        "user_id": str(user.id),
        "questions": questions,
        "topic": focus_topic,
        "difficulty": difficulty,
        "created_at": now_iso(),
    }

    return {
        "quiz_id": quiz_id,
        "course_id": data.course_id,
        "topic": focus_topic,
        "difficulty": difficulty,
        "source_label": source_label,
        "questions": [
            {"id": item["id"], "question": item["question"], "options": item["options"], "topic": item["topic"], "difficulty": item["difficulty"], "source": item["source"]}
            for item in questions
        ],
    }


# ============================================================
# QUIZ SUBMISSION
# ============================================================

@app.post("/api/quiz/submit")
def submit_quiz(
    data: QuizSubmit,
    authorization: Optional[str] = Header(default=None),
):
    user = get_current_user(authorization)
    token = extract_bearer_token(authorization)
    user_id = str(user.id)
    quiz_id = str(data.quiz_id or "")
    quiz = quizzes.get(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="This quiz has expired or the server restarted. Please generate a new quiz and submit it again.")
    if quiz.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Quiz does not belong to this user.")

    course_id = str(quiz.get("course_id") or "")
    if data.course_id and str(data.course_id) != course_id:
        raise HTTPException(status_code=403, detail="This quiz belongs to a different course.")
    course = get_user_course(course_id, user_id, token)
    questions = quiz.get("questions") or []
    if not questions:
        raise HTTPException(status_code=400, detail="This quiz has no questions. Please generate a new quiz.")

    score = 0
    topic_stats = {}
    results = []
    for question in questions:
        question_id = str(question["id"])
        raw_answer = data.answers.get(question_id)
        try:
            selected_index = int(raw_answer) if raw_answer is not None else None
        except (TypeError, ValueError):
            selected_index = None
        correct_index = int(question["correct_answer"])
        options = question["options"]
        is_correct = selected_index == correct_index and selected_index is not None
        if is_correct:
            score += 1
        topic_name = str(question.get("topic") or quiz.get("topic") or "General")
        if topic_name not in topic_stats:
            topic_stats[topic_name] = {"topic": topic_name, "correct": 0, "total": 0}
        topic_stats[topic_name]["total"] += 1
        if is_correct:
            topic_stats[topic_name]["correct"] += 1
        selected_text = options[selected_index] if selected_index is not None and 0 <= selected_index < len(options) else "Not answered"
        correct_text = options[correct_index]
        results.append({
            "question_id": question_id,
            "question": question["question"],
            "options": options,
            "selected_answer": selected_index,
            "correct_answer": correct_index,
            "selected_option": selected_text,
            "correct_option": correct_text,
            "is_correct": is_correct,
            "explanation": question.get("explanation") or "",
            "topic": topic_name,
            "difficulty": question.get("difficulty") or quiz.get("difficulty") or "medium",
            "source": question.get("source") or "Course curriculum",
        })

    total = len(questions)
    accuracy = round((score / total) * 100) if total else 0
    topic_breakdown = []
    for stat in topic_stats.values():
        topic_accuracy = round((stat["correct"] / stat["total"]) * 100) if stat["total"] else 0
        topic_breakdown.append({"topic": stat["topic"], "correct": stat["correct"], "total": stat["total"], "accuracy": topic_accuracy})
    weak_topics = [item["topic"] for item in topic_breakdown if item["accuracy"] < 60]
    strong_topics = [item["topic"] for item in topic_breakdown if item["accuracy"] >= 80]

    old_progress = int(course.get("progress") or 0)
    if accuracy >= 80:
        new_progress = min(100, old_progress + 10)
    elif accuracy >= 50:
        new_progress = min(100, old_progress + 5)
    else:
        new_progress = old_progress
    persist_progress(course_id, user_id, new_progress, new_progress >= 100, token)
    quizzes.pop(quiz_id, None)

    return {
        "quiz_id": quiz_id,
        "score": score,
        "total": total,
        "accuracy": accuracy,
        "percentage": accuracy,
        "topic_breakdown": topic_breakdown,
        "results": results,
        "weak_topics": weak_topics,
        "strong_topics": strong_topics,
        "message": "Quiz submitted successfully.",
        "course_progress": new_progress,
    }

# ============================================================
# DASHBOARD
# ============================================================

@app.get(
    "/api/dashboard"
)
def dashboard(
    authorization: Optional[str] = Header(
        default=None
    ),
):

    user = get_current_user(
        authorization
    )

    courses = get_user_courses(
        str(user.id),
        extract_bearer_token(authorization),
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

        "completed_courses": (
            completed_courses
        ),

        "total_courses": (
            total_courses
        ),

        "learning_progress": (
            average_progress
        ),

        "study_streak": 0,
    }


# ============================================================
# TEST
# ============================================================

@app.get(
    "/api/test"
)
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
            db_client
        ),
    }

# ============================================================
# COURSE-AWARE CODING PRACTICE (C / Python / DSA)
# All user code runs in Judge0's sandbox, not inside this API process.
# ============================================================

import time as _coding_time
import re as _coding_re
from concurrent.futures import ThreadPoolExecutor as _CodingPool


class CodingRunRequest(BaseModel):
    source_code: str
    stdin: str = ""
    course_id: Optional[str] = None
    language: Optional[str] = None
    problem_id: Optional[str] = None


class CodingSubmitRequest(BaseModel):
    problem_id: str
    source_code: str
    course_id: Optional[str] = None
    language: Optional[str] = None


class CodingProgressSave(BaseModel):
    problem_id: str
    course_id: Optional[str] = None
    language: str = "c"
    difficulty: str = "Easy"
    code: str = ""
    solved: bool = False
    attempted: bool = False


# Keep the existing C fundamentals problem bank exactly as it is.
_C_BASIC_PROBLEMS = [
    {
        "id": "sum-two-numbers",
        "title": "Sum of Two Numbers",
        "difficulty": "Easy",
        "description": "Read two integers and print their sum. Your program should read the values from standard input and print only the answer.",
        "examples": [{"input": "3 5", "output": "8"}, {"input": "-2 7", "output": "5"}],
        "constraints": ["-1,000,000,000 <= a, b <= 1,000,000,000", "Print the sum followed by a newline."],
        "starter_code": "#include <stdio.h>\n\nint main(void) {\n    long long a, b;\n    if (scanf(\"%lld %lld\", &a, &b) != 2) return 0;\n\n    // Write your solution here\n\n    return 0;\n}\n",
        "tags": ["Basics", "Arithmetic"],
        "tests": [{"stdin": "3 5\n", "expected": "8"}, {"stdin": "-2 7\n", "expected": "5"}, {"stdin": "100 250\n", "expected": "350"}],
    },
    {
        "id": "even-or-odd",
        "title": "Even or Odd",
        "difficulty": "Easy",
        "description": "Given an integer N, print Even if it is divisible by 2; otherwise print Odd. Match the output spelling exactly.",
        "examples": [{"input": "4", "output": "Even"}, {"input": "7", "output": "Odd"}],
        "constraints": ["-1,000,000,000 <= N <= 1,000,000,000", "Output exactly Even or Odd."],
        "starter_code": "#include <stdio.h>\n\nint main(void) {\n    long long n;\n    if (scanf(\"%lld\", &n) != 1) return 0;\n\n    // Write your solution here\n\n    return 0;\n}\n",
        "tags": ["Conditions", "Modulo"],
        "tests": [{"stdin": "4\n", "expected": "Even"}, {"stdin": "7\n", "expected": "Odd"}, {"stdin": "0\n", "expected": "Even"}],
    },
    {
        "id": "largest-of-three",
        "title": "Largest of Three Numbers",
        "difficulty": "Easy",
        "description": "Read three integers and print the largest value. The numbers are not necessarily distinct and may be negative.",
        "examples": [{"input": "3 9 5", "output": "9"}],
        "constraints": ["Each value fits in a signed 32-bit integer.", "Print only the largest value."],
        "starter_code": "#include <stdio.h>\n\nint main(void) {\n    int a, b, c;\n    if (scanf(\"%d %d %d\", &a, &b, &c) != 3) return 0;\n\n    // Write your solution here\n\n    return 0;\n}\n",
        "tags": ["Conditions", "Comparisons"],
        "tests": [{"stdin": "3 9 5\n", "expected": "9"}, {"stdin": "-2 -7 -4\n", "expected": "-2"}, {"stdin": "8 8 2\n", "expected": "8"}],
    },
    {
        "id": "factorial",
        "title": "Factorial",
        "difficulty": "Easy",
        "description": "Given a non-negative integer N, print N! (the product of all integers from 1 through N). By definition, 0! = 1.",
        "examples": [{"input": "5", "output": "120"}, {"input": "0", "output": "1"}],
        "constraints": ["0 <= N <= 12", "Print the result as an integer."],
        "starter_code": "#include <stdio.h>\n\nint main(void) {\n    int n;\n    if (scanf(\"%d\", &n) != 1) return 0;\n\n    // Write your solution here\n\n    return 0;\n}\n",
        "tags": ["Loops", "Math"],
        "tests": [{"stdin": "5\n", "expected": "120"}, {"stdin": "0\n", "expected": "1"}, {"stdin": "1\n", "expected": "1"}],
    },
    {
        "id": "prime-number",
        "title": "Prime Number Check",
        "difficulty": "Medium",
        "description": "Given an integer N, print Prime if N is a prime number; otherwise print Not Prime. Numbers less than 2 are not prime.",
        "examples": [{"input": "7", "output": "Prime"}, {"input": "12", "output": "Not Prime"}],
        "constraints": ["0 <= N <= 1,000,000,000", "Output exactly Prime or Not Prime."],
        "starter_code": "#include <stdio.h>\n\nint main(void) {\n    int n;\n    if (scanf(\"%d\", &n) != 1) return 0;\n\n    // Write your solution here\n\n    return 0;\n}\n",
        "tags": ["Loops", "Number Theory"],
        "tests": [{"stdin": "7\n", "expected": "Prime"}, {"stdin": "1\n", "expected": "Not Prime"}, {"stdin": "12\n", "expected": "Not Prime"}, {"stdin": "2\n", "expected": "Prime"}],
    },
    {
        "id": "reverse-number",
        "title": "Reverse a Number",
        "difficulty": "Easy",
        "description": "Read a non-negative integer and print its digits in reverse order. Any leading zeroes in the reversed result are naturally omitted.",
        "examples": [{"input": "1234", "output": "4321"}, {"input": "500", "output": "5"}],
        "constraints": ["0 <= N <= 2,147,483,647", "Print only the reversed number."],
        "starter_code": "#include <stdio.h>\n\nint main(void) {\n    long long n;\n    if (scanf(\"%lld\", &n) != 1) return 0;\n\n    // Write your solution here\n\n    return 0;\n}\n",
        "tags": ["Loops", "Digits"],
        "tests": [{"stdin": "1234\n", "expected": "4321"}, {"stdin": "500\n", "expected": "5"}, {"stdin": "0\n", "expected": "0"}],
    },
    {
        "id": "palindrome-number",
        "title": "Palindrome Number",
        "difficulty": "Easy",
        "description": "A number is a palindrome if it reads the same forwards and backwards. Read a non-negative integer and print Yes or No.",
        "examples": [{"input": "121", "output": "Yes"}, {"input": "123", "output": "No"}],
        "constraints": ["0 <= N <= 2,147,483,647", "Output exactly Yes or No."],
        "starter_code": "#include <stdio.h>\n\nint main(void) {\n    long long n;\n    if (scanf(\"%lld\", &n) != 1) return 0;\n\n    // Write your solution here\n\n    return 0;\n}\n",
        "tags": ["Loops", "Digits"],
        "tests": [{"stdin": "121\n", "expected": "Yes"}, {"stdin": "123\n", "expected": "No"}, {"stdin": "7\n", "expected": "Yes"}],
    },
    {
        "id": "fibonacci-nth",
        "title": "Nth Fibonacci Number",
        "difficulty": "Medium",
        "description": "Fibonacci numbers are defined as F(0)=0, F(1)=1, and F(n)=F(n-1)+F(n-2). Given N, print F(N).",
        "examples": [{"input": "7", "output": "13"}, {"input": "0", "output": "0"}],
        "constraints": ["0 <= N <= 45", "Use the zero-based index described above."],
        "starter_code": "#include <stdio.h>\n\nint main(void) {\n    int n;\n    if (scanf(\"%d\", &n) != 1) return 0;\n\n    // Write your solution here\n\n    return 0;\n}\n",
        "tags": ["Loops", "Dynamic Programming"],
        "tests": [{"stdin": "7\n", "expected": "13"}, {"stdin": "0\n", "expected": "0"}, {"stdin": "10\n", "expected": "55"}],
    },
    {
        "id": "array-sum",
        "title": "Sum of Array Elements",
        "difficulty": "Medium",
        "description": "The first input value is N, followed by N integers. Print the sum of the N array elements. Input may be separated by spaces or newlines.",
        "examples": [{"input": "5\n1 2 3 4 5", "output": "15"}],
        "constraints": ["1 <= N <= 1000", "Each element is between -1,000,000 and 1,000,000."],
        "starter_code": "#include <stdio.h>\n\nint main(void) {\n    int n;\n    if (scanf(\"%d\", &n) != 1) return 0;\n\n    // Read the array and calculate the sum\n\n    return 0;\n}\n",
        "tags": ["Arrays", "Loops"],
        "tests": [{"stdin": "5\n1 2 3 4 5\n", "expected": "15"}, {"stdin": "4\n-1 2 -3 4\n", "expected": "2"}, {"stdin": "1\n42\n", "expected": "42"}],
    },
    {
        "id": "count-vowels",
        "title": "Count Vowels",
        "difficulty": "Easy",
        "description": "Read a line of text and count the English vowels (a, e, i, o, u). Both uppercase and lowercase vowels count. Do not count y as a vowel.",
        "examples": [{"input": "StudyMate", "output": "3"}, {"input": "AEIOU", "output": "5"}],
        "constraints": ["The input line contains at most 1000 characters.", "Print only the vowel count."],
        "starter_code": "#include <stdio.h>\n\nint main(void) {\n    int ch;\n    int count = 0;\n\n    // Read characters until newline or end-of-file\n\n    printf(\"%d\\n\", count);\n    return 0;\n}\n",
        "tags": ["Strings", "Characters"],
        "tests": [{"stdin": "StudyMate\n", "expected": "3"}, {"stdin": "AEIOU\n", "expected": "5"}, {"stdin": "rhythm\n", "expected": "0"}],
    },
]


def _cp_problem(problem_id, title, difficulty, description, starter_code, tags, test_cases, constraints=None):
    """Build a problem record from (stdin, expected-output) pairs."""
    tests = [{"stdin": str(stdin), "expected": str(expected)} for stdin, expected in test_cases]
    examples = [
        {"input": str(stdin).rstrip("\n"), "output": str(expected)}
        for stdin, expected in test_cases[:2]
    ]
    return {
        "id": problem_id,
        "title": title,
        "difficulty": difficulty,
        "description": description,
        "examples": examples,
        "constraints": constraints or ["Read input from standard input.", "Print only the requested result."],
        "starter_code": starter_code,
        "tags": tags,
        "tests": tests,
    }


_C_DSA_PROBLEMS = [
    _cp_problem("c-dsa-linear-search", "Linear Search", "Easy", "Read N, then N integers, then a target. Print the zero-based index of its first occurrence, or -1 if missing.",
        '#include <stdio.h>\nint main(void) {\n    int n, a[1000], target;\n    if (scanf("%d", &n) != 1) return 0;\n    for (int i=0; i<n; i++) scanf("%d", &a[i]);\n    scanf("%d", &target);\n    // Find the first matching index and print it, or -1.\n    return 0;\n}\n', ["Arrays", "Searching"], [("5\n2 4 6 8 10\n6\n", "2"), ("4\n1 3 5 7\n2\n", "-1"), ("1\n9\n9\n", "0")]),
    _cp_problem("c-dsa-binary-search", "Binary Search", "Medium", "The N integers are sorted in ascending order. Read N, the array, and a target. Print its zero-based index, or -1 if absent.",
        '#include <stdio.h>\nint main(void) {\n    int n, a[1000], target;\n    if (scanf("%d", &n) != 1) return 0;\n    for (int i=0; i<n; i++) scanf("%d", &a[i]);\n    scanf("%d", &target);\n    // Implement binary search and print the result.\n    return 0;\n}\n', ["Arrays", "Binary Search"], [("5\n1 3 5 7 9\n7\n", "3"), ("5\n1 3 5 7 9\n2\n", "-1"), ("1\n4\n4\n", "0")]),
    _cp_problem("c-dsa-reverse-array", "Reverse an Array", "Easy", "Read N followed by N integers. Print the elements in reverse order, separated by one space.",
        '#include <stdio.h>\nint main(void) {\n    int n, a[1000];\n    if (scanf("%d", &n) != 1) return 0;\n    for (int i=0; i<n; i++) scanf("%d", &a[i]);\n    // Print the array from the last element to the first.\n    return 0;\n}\n', ["Arrays", "Two Pointers"], [("5\n1 2 3 4 5\n", "5 4 3 2 1"), ("3\n9 -1 2\n", "2 -1 9"), ("1\n42\n", "42")]),
    _cp_problem("c-dsa-bubble-sort", "Bubble Sort", "Medium", "Read N and N integers. Sort them in ascending order using the bubble-sort idea and print them separated by spaces.",
        '#include <stdio.h>\nint main(void) {\n    int n, a[1000];\n    if (scanf("%d", &n) != 1) return 0;\n    for (int i=0; i<n; i++) scanf("%d", &a[i]);\n    // Implement bubble sort, then print the sorted array.\n    return 0;\n}\n', ["Sorting", "Arrays"], [("5\n5 1 4 2 8\n", "1 2 4 5 8"), ("4\n-1 3 0 3\n", "-1 0 3 3"), ("1\n7\n", "7")]),
    _cp_problem("c-dsa-second-largest", "Second Largest Distinct Element", "Medium", "Read N integers and print the second-largest distinct value. If it does not exist, print -1.",
        '#include <stdio.h>\nint main(void) {\n    int n, a[1000];\n    if (scanf("%d", &n) != 1) return 0;\n    for (int i=0; i<n; i++) scanf("%d", &a[i]);\n    // Find the second-largest DISTINCT value; otherwise print -1.\n    return 0;\n}\n', ["Arrays", "Sorting"], [("5\n4 1 7 7 3\n", "4"), ("3\n5 5 5\n", "-1"), ("4\n-2 -1 -5 -3\n", "-2")]),
    _cp_problem("c-dsa-frequency", "Count Target Frequency", "Easy", "Read N, N integers, and a target X. Print how many times X occurs in the array.",
        '#include <stdio.h>\nint main(void) {\n    int n, a[1000], x, count=0;\n    if (scanf("%d", &n) != 1) return 0;\n    for (int i=0; i<n; i++) scanf("%d", &a[i]);\n    scanf("%d", &x);\n    // Count and print occurrences of x.\n    return 0;\n}\n', ["Arrays", "Counting"], [("6\n1 2 2 3 2 4\n2\n", "3"), ("4\n1 3 5 7\n4\n", "0"), ("1\n9\n9\n", "1")]),
    _cp_problem("c-dsa-max-subarray", "Maximum Subarray Sum", "Hard", "Read N and N integers. Print the maximum sum of any non-empty contiguous subarray.",
        '#include <stdio.h>\nint main(void) {\n    int n, a[1000];\n    if (scanf("%d", &n) != 1) return 0;\n    for (int i=0; i<n; i++) scanf("%d", &a[i]);\n    // Use Kadane\'s algorithm or an equivalent linear-time method.\n    return 0;\n}\n', ["Arrays", "Kadane's Algorithm"], [("5\n-2 1 -3 4 -1\n", "4"), ("3\n-5 -2 -8\n", "-2"), ("5\n1 2 3 -2 5\n", "9")]),
    _cp_problem("c-dsa-remove-duplicates", "Remove Duplicates from Sorted Array", "Medium", "Read N sorted integers. Print each distinct value once, preserving ascending order.",
        '#include <stdio.h>\nint main(void) {\n    int n, a[1000];\n    if (scanf("%d", &n) != 1) return 0;\n    for (int i=0; i<n; i++) scanf("%d", &a[i]);\n    // Print each value only if it differs from the previous value.\n    return 0;\n}\n', ["Arrays", "Two Pointers"], [("7\n1 1 2 2 2 4 5\n", "1 2 4 5"), ("4\n-1 -1 0 2\n", "-1 0 2"), ("1\n3\n", "3")]),
]

_PYTHON_BASIC_PROBLEMS = [
    _cp_problem("py-sum-two-numbers", "Sum of Two Numbers", "Easy", "Read two integers and print their sum.",
        "a, b = map(int, input().split())\n# Print the sum of a and b\n", ["Basics", "Arithmetic"], [("3 5\n", "8"), ("-2 7\n", "5"), ("100 250\n", "350")]),
    _cp_problem("py-even-or-odd", "Even or Odd", "Easy", "Read an integer. Print Even if divisible by 2, otherwise print Odd.",
        "n = int(input())\n# Print Even or Odd\n", ["Conditions", "Modulo"], [("4\n", "Even"), ("7\n", "Odd"), ("0\n", "Even")]),
    _cp_problem("py-largest-three", "Largest of Three Numbers", "Easy", "Read three integers and print the largest.",
        "a, b, c = map(int, input().split())\n# Print the largest number\n", ["Conditions", "Comparisons"], [("3 9 5\n", "9"), ("-2 -7 -4\n", "-2"), ("8 8 2\n", "8")]),
    _cp_problem("py-factorial", "Factorial", "Easy", "Read a non-negative integer N and print N!. By definition, 0! is 1.",
        "n = int(input())\n# Calculate and print n factorial\n", ["Loops", "Math"], [("5\n", "120"), ("0\n", "1"), ("1\n", "1")]),
    _cp_problem("py-prime-number", "Prime Number Check", "Medium", "Read N. Print Prime if N is prime, otherwise print Not Prime. Numbers below 2 are not prime.",
        "n = int(input())\n# Check primality and print the required label\n", ["Loops", "Number Theory"], [("7\n", "Prime"), ("1\n", "Not Prime"), ("12\n", "Not Prime"), ("2\n", "Prime")]),
    _cp_problem("py-reverse-number", "Reverse a Number", "Easy", "Read a non-negative integer and print its digits in reverse order.",
        "n = int(input())\n# Reverse the digits and print the result\n", ["Loops", "Digits"], [("1234\n", "4321"), ("500\n", "5"), ("0\n", "0")]),
    _cp_problem("py-palindrome-number", "Palindrome Number", "Easy", "Read a non-negative integer and print Yes if it reads the same backwards, otherwise No.",
        "n = input().strip()\n# Check whether n is a palindrome\n", ["Strings", "Digits"], [("121\n", "Yes"), ("123\n", "No"), ("7\n", "Yes")]),
    _cp_problem("py-fibonacci-nth", "Nth Fibonacci Number", "Medium", "Read N and print F(N), where F(0)=0 and F(1)=1.",
        "n = int(input())\n# Compute F(n) iteratively and print it\n", ["Loops", "Dynamic Programming"], [("7\n", "13"), ("0\n", "0"), ("10\n", "55")]),
    _cp_problem("py-array-sum", "Sum of List Elements", "Medium", "Read N, then N integers. Print their sum.",
        "n = int(input())\nvalues = list(map(int, input().split()))\n# Print the sum of the first n values\n", ["Lists", "Loops"], [("5\n1 2 3 4 5\n", "15"), ("4\n-1 2 -3 4\n", "2"), ("1\n42\n", "42")]),
    _cp_problem("py-count-vowels", "Count Vowels", "Easy", "Read one line and count English vowels (a, e, i, o, u), case-insensitively.",
        "text = input()\n# Count and print the vowels in text\n", ["Strings", "Characters"], [("StudyMate\n", "3"), ("AEIOU\n", "5"), ("rhythm\n", "0")]),
]

_PYTHON_DSA_PROBLEMS = [
    _cp_problem("py-dsa-linear-search", "Linear Search", "Easy", "Read N, a list of N integers, and a target. Print the first zero-based index of the target, or -1.",
        "n = int(input())\narr = list(map(int, input().split()))\ntarget = int(input())\n# Find and print the target's first index, or -1\n", ["Lists", "Searching"], [("5\n2 4 6 8 10\n6\n", "2"), ("4\n1 3 5 7\n2\n", "-1"), ("1\n9\n9\n", "0")]),
    _cp_problem("py-dsa-binary-search", "Binary Search", "Medium", "The list is sorted ascending. Read N, its values, and a target. Print its zero-based index, or -1.",
        "n = int(input())\narr = list(map(int, input().split()))\ntarget = int(input())\n# Implement binary search and print the result\n", ["Binary Search", "Lists"], [("5\n1 3 5 7 9\n7\n", "3"), ("5\n1 3 5 7 9\n2\n", "-1"), ("1\n4\n4\n", "0")]),
    _cp_problem("py-dsa-reverse-array", "Reverse an Array", "Easy", "Read N followed by N integers. Print them in reverse order, separated by spaces.",
        "n = int(input())\narr = list(map(int, input().split()))\n# Print the reversed array\n", ["Lists", "Two Pointers"], [("5\n1 2 3 4 5\n", "5 4 3 2 1"), ("3\n9 -1 2\n", "2 -1 9"), ("1\n42\n", "42")]),
    _cp_problem("py-dsa-bubble-sort", "Bubble Sort", "Medium", "Read N integers and print the values sorted in ascending order. Implement bubble sort rather than calling sort().",
        "n = int(input())\narr = list(map(int, input().split()))\n# Implement bubble sort, then print the array\n", ["Sorting", "Lists"], [("5\n5 1 4 2 8\n", "1 2 4 5 8"), ("4\n-1 3 0 3\n", "-1 0 3 3"), ("1\n7\n", "7")]),
    _cp_problem("py-dsa-second-largest", "Second Largest Distinct Element", "Medium", "Read N integers and print the second-largest distinct value. If there is no second distinct value, print -1.",
        "n = int(input())\narr = list(map(int, input().split()))\n# Find and print the second-largest distinct value, or -1\n", ["Lists", "Sorting"], [("5\n4 1 7 7 3\n", "4"), ("3\n5 5 5\n", "-1"), ("4\n-2 -1 -5 -3\n", "-2")]),
    _cp_problem("py-dsa-frequency", "Count Target Frequency", "Easy", "Read N, N integers, and a target X. Print the number of occurrences of X.",
        "n = int(input())\narr = list(map(int, input().split()))\nx = int(input())\n# Count and print occurrences of x\n", ["Lists", "Hashing"], [("6\n1 2 2 3 2 4\n2\n", "3"), ("4\n1 3 5 7\n4\n", "0"), ("1\n9\n9\n", "1")]),
    _cp_problem("py-dsa-max-subarray", "Maximum Subarray Sum", "Hard", "Read N integers and print the maximum sum of any non-empty contiguous subarray.",
        "n = int(input())\narr = list(map(int, input().split()))\n# Use Kadane's algorithm and print the maximum sum\n", ["Arrays", "Kadane's Algorithm"], [("5\n-2 1 -3 4 -1\n", "4"), ("3\n-5 -2 -8\n", "-2"), ("5\n1 2 3 -2 5\n", "9")]),
    _cp_problem("py-dsa-remove-duplicates", "Remove Duplicates from Sorted List", "Medium", "Read N sorted integers. Print each distinct value once, preserving ascending order.",
        "n = int(input())\narr = list(map(int, input().split()))\n# Remove adjacent duplicates and print each distinct value\n", ["Lists", "Two Pointers"], [("7\n1 1 2 2 2 4 5\n", "1 2 4 5"), ("4\n-1 -1 0 2\n", "-1 0 2"), ("1\n3\n", "3")]),
]


# JAVA_SQL_CODING_EXTENSIONS_V1

_JAVA_BASIC_PROBLEMS = [
    _cp_problem("java-sum-two", "Sum of Two Numbers", "Easy", "Read two integers and print their sum.",
        "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    long a = sc.nextLong();\n    long b = sc.nextLong();\n    // Print the sum of a and b\n  }\n}\n", ["Basics", "Arithmetic"], [("3 5\n", "8"), ("-2 7\n", "5"), ("100 250\n", "350")]),
    _cp_problem("java-even-odd", "Even or Odd", "Easy", "Read an integer and print Even if divisible by 2; otherwise print Odd.",
        "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt();\n    // Print Even or Odd\n  }\n}\n", ["Conditions", "Modulo"], [("4\n", "Even"), ("7\n", "Odd"), ("0\n", "Even")]),
    _cp_problem("java-largest-three", "Largest of Three Numbers", "Easy", "Read three integers and print the largest.",
        "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int a = sc.nextInt(), b = sc.nextInt(), c = sc.nextInt();\n    // Print the largest value\n  }\n}\n", ["Conditions", "Comparisons"], [("3 9 5\n", "9"), ("-2 -7 -4\n", "-2"), ("8 8 2\n", "8")]),
    _cp_problem("java-factorial", "Factorial", "Easy", "Read a non-negative integer N and print N factorial. 0 factorial is 1.",
        "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt();\n    long answer = 1;\n    // Calculate factorial and print answer\n  }\n}\n", ["Loops", "Math"], [("5\n", "120"), ("0\n", "1"), ("1\n", "1")]),
    _cp_problem("java-prime", "Prime Number Check", "Medium", "Print Prime for a prime integer; otherwise print Not Prime. Values below 2 are not prime.",
        "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt();\n    // Check primality and print Prime or Not Prime\n  }\n}\n", ["Loops", "Number Theory"], [("7\n", "Prime"), ("1\n", "Not Prime"), ("12\n", "Not Prime"), ("2\n", "Prime")]),
    _cp_problem("java-reverse-number", "Reverse a Number", "Easy", "Read a non-negative integer and print its digits reversed.",
        "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    long n = sc.nextLong();\n    long reversed = 0;\n    // Reverse the digits and print reversed\n  }\n}\n", ["Loops", "Digits"], [("1234\n", "4321"), ("500\n", "5"), ("0\n", "0")]),
    _cp_problem("java-array-sum", "Sum of Array Elements", "Medium", "Read N followed by N integers and print their sum.",
        "import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt();\n    long sum = 0;\n    // Read n elements, add them to sum, and print sum\n  }\n}\n", ["Arrays", "Loops"], [("5\n1 2 3 4 5\n", "15"), ("4\n-1 2 -3 4\n", "2"), ("1\n42\n", "42")]),
]

_JAVA_DSA_PROBLEMS = [
    _cp_problem("java-dsa-linear-search", "Linear Search", "Easy", "Read N, N integers and a target. Print the first zero-based index or -1.",
        "import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt(); int[] a = new int[n];\n    for (int i=0; i<n; i++) a[i] = sc.nextInt();\n    int target = sc.nextInt();\n    // Find and print the first matching index or -1\n  }\n}\n", ["Arrays", "Searching"], [("5\n2 4 6 8 10\n6\n", "2"), ("4\n1 3 5 7\n2\n", "-1"), ("1\n9\n9\n", "0")]),
    _cp_problem("java-dsa-binary-search", "Binary Search", "Medium", "The input array is sorted. Print the target's zero-based index or -1.",
        "import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt(); int[] a = new int[n];\n    for (int i=0; i<n; i++) a[i] = sc.nextInt();\n    int target = sc.nextInt();\n    // Implement binary search\n  }\n}\n", ["Arrays", "Binary Search"], [("5\n1 3 5 7 9\n7\n", "3"), ("5\n1 3 5 7 9\n2\n", "-1"), ("1\n4\n4\n", "0")]),
    _cp_problem("java-dsa-bubble-sort", "Bubble Sort", "Medium", "Read N integers, sort ascending using bubble sort, and print values separated by spaces.",
        "import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt(); int[] a = new int[n];\n    for (int i=0; i<n; i++) a[i] = sc.nextInt();\n    // Implement bubble sort and print the array\n  }\n}\n", ["Sorting", "Arrays"], [("5\n5 1 4 2 8\n", "1 2 4 5 8"), ("4\n-1 3 0 3\n", "-1 0 3 3"), ("1\n7\n", "7")]),
    _cp_problem("java-dsa-second-largest", "Second Largest Distinct Element", "Medium", "Print the second-largest distinct array value, or -1 if none exists.",
        "import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt(); int[] a = new int[n];\n    for (int i=0; i<n; i++) a[i] = sc.nextInt();\n    // Find the second-largest distinct element or -1\n  }\n}\n", ["Arrays", "Sorting"], [("5\n4 1 7 7 3\n", "4"), ("3\n5 5 5\n", "-1"), ("4\n-2 -1 -5 -3\n", "-2")]),
    _cp_problem("java-dsa-max-subarray", "Maximum Subarray Sum", "Hard", "Print the maximum sum of any non-empty contiguous subarray.",
        "import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt(); int[] a = new int[n];\n    for (int i=0; i<n; i++) a[i] = sc.nextInt();\n    // Use Kadane's algorithm and print the maximum sum\n  }\n}\n", ["Arrays", "Kadane's Algorithm"], [("5\n-2 1 -3 4 -1\n", "4"), ("3\n-5 -2 -8\n", "-2"), ("5\n1 2 3 -2 5\n", "9")]),
]

_SQL_BASIC_PROBLEMS = [
    {
        "id": "sql-list-employees", "title": "List Employee Names", "difficulty": "Easy",
        "description": "Return employee names in alphabetical order. The employees table has columns id, name, department and salary.",
        "examples": [{"input": "employees(id, name, department, salary)", "output": "Asha\nBala\nCharan\nDivya"}],
        "constraints": ["Use a SELECT query.", "Sort names alphabetically."],
        "starter_code": "SELECT name\nFROM employees\n-- Add sorting here; finish the query\n;",
        "tags": ["SELECT", "ORDER BY"],
        "tests": [{"stdin": "CREATE TABLE employees(id INTEGER, name TEXT, department TEXT, salary INTEGER); INSERT INTO employees VALUES (1,'Asha','IT',65000),(2,'Bala','HR',45000),(3,'Charan','IT',80000),(4,'Divya','Sales',55000);", "expected": "Asha\nBala\nCharan\nDivya"}],
    },
    {
        "id": "sql-filter-salary", "title": "Employees Above a Salary", "difficulty": "Easy",
        "description": "Select names of employees whose salary is greater than 55000. Return names in alphabetical order.",
        "examples": [{"input": "employees(id, name, department, salary)", "output": "Asha\nCharan"}],
        "constraints": ["Salary must be strictly greater than 55000.", "Sort names alphabetically."],
        "starter_code": "SELECT name\nFROM employees\n-- Add the WHERE condition and sorting\n;",
        "tags": ["WHERE", "ORDER BY"],
        "tests": [{"stdin": "CREATE TABLE employees(id INTEGER, name TEXT, department TEXT, salary INTEGER); INSERT INTO employees VALUES (1,'Asha','IT',65000),(2,'Bala','HR',45000),(3,'Charan','IT',80000),(4,'Divya','Sales',55000);", "expected": "Asha\nCharan"}],
    },
    {
        "id": "sql-count-by-department", "title": "Count Employees by Department", "difficulty": "Medium",
        "description": "For every department, show the department name and employee count, ordered alphabetically by department.",
        "examples": [{"input": "employees(id, name, department, salary)", "output": "HR | 1\nIT | 2\nSales | 1"}],
        "constraints": ["Return department and count columns.", "Group by department."],
        "starter_code": "SELECT department, COUNT(*) AS employee_count\nFROM employees\n-- Group and order the results\n;",
        "tags": ["GROUP BY", "COUNT"],
        "tests": [{"stdin": "CREATE TABLE employees(id INTEGER, name TEXT, department TEXT, salary INTEGER); INSERT INTO employees VALUES (1,'Asha','IT',65000),(2,'Bala','HR',45000),(3,'Charan','IT',80000),(4,'Divya','Sales',55000);", "expected": "HR | 1\nIT | 2\nSales | 1"}],
    },
    {
        "id": "sql-second-highest-salary", "title": "Second Highest Salary", "difficulty": "Medium",
        "description": "Return the second-highest DISTINCT salary from the employees table. The result should be one integer.",
        "examples": [{"input": "employees(id, name, department, salary)", "output": "65000"}],
        "constraints": ["Do not simply return the maximum salary.", "Use a query that handles duplicate salaries."],
        "starter_code": "-- Return the second-highest distinct salary\nSELECT ...;",
        "tags": ["Subquery", "MAX"],
        "tests": [{"stdin": "CREATE TABLE employees(id INTEGER, name TEXT, department TEXT, salary INTEGER); INSERT INTO employees VALUES (1,'Asha','IT',65000),(2,'Bala','HR',45000),(3,'Charan','IT',80000),(4,'Divya','Sales',55000),(5,'Esha','IT',65000);", "expected": "65000"}],
    },
    {
        "id": "sql-customer-orders-join", "title": "Customer Orders Join", "difficulty": "Medium",
        "description": "List customer names and order amounts by joining customers and orders. Keep the order order_id ascending.",
        "examples": [{"input": "customers(id, name) and orders(id, customer_id, amount)", "output": "Asha | 250\nBala | 400\nAsha | 100"}],
        "constraints": ["Join orders.customer_id to customers.id.", "Sort by orders.id ascending."],
        "starter_code": "SELECT customers.name, orders.amount\nFROM customers\n-- Add the JOIN and ordering\n;",
        "tags": ["JOIN", "ORDER BY"],
        "tests": [{"stdin": "CREATE TABLE customers(id INTEGER, name TEXT); CREATE TABLE orders(id INTEGER, customer_id INTEGER, amount INTEGER); INSERT INTO customers VALUES (1,'Asha'),(2,'Bala'); INSERT INTO orders VALUES (1,1,250),(2,2,400),(3,1,100);", "expected": "Asha | 250\nBala | 400\nAsha | 100"}],
    },
    {
        "id": "sql-department-max-salary", "title": "Highest Salary by Department", "difficulty": "Medium",
        "description": "Show each department and its highest salary, ordered by department name.",
        "examples": [{"input": "employees(id, name, department, salary)", "output": "HR | 45000\nIT | 80000\nSales | 55000"}],
        "constraints": ["Return department and maximum salary.", "Use GROUP BY."],
        "starter_code": "SELECT department, MAX(salary) AS max_salary\nFROM employees\n-- Group and order the results\n;",
        "tags": ["GROUP BY", "MAX"],
        "tests": [{"stdin": "CREATE TABLE employees(id INTEGER, name TEXT, department TEXT, salary INTEGER); INSERT INTO employees VALUES (1,'Asha','IT',65000),(2,'Bala','HR',45000),(3,'Charan','IT',80000),(4,'Divya','Sales',55000);", "expected": "HR | 45000\nIT | 80000\nSales | 55000"}],
    },
]


def _coding_public_problem(problem, language, track):
    return {
        key: problem[key]
        for key in ("id", "title", "difficulty", "description", "examples", "constraints", "starter_code", "tags")
    } | {"language": language, "track": problem.get("track", track)}


def _coding_profile(authorization, course_id, language_hint=None):
    # Course metadata is authoritative for routes opened from a specific course.
    user = get_current_user(authorization)
    course = {}
    if course_id:
        course = get_user_course(course_id, str(user.id), extract_bearer_token(authorization))

    text = " ".join(str(course.get(key) or "") for key in ("title", "subject", "description")).lower()
    is_sql = bool(_coding_re.search(r"\bsql\b|\bdatabase\b|\bdbms\b|\bmysql\b|\bpostgres(?:ql)?\b|\bsqlite\b|structured query language", text))
    is_java = bool(_coding_re.search(r"\bjava\b|core java|object[- ]oriented programming", text))
    is_python = bool(_coding_re.search(r"\bpython\b|\bpy programming\b", text))
    is_dsa = any(term in text for term in ("dsa", "data structure", "data structures", "algorithm", "algorithms"))

    if course_id:
        if is_sql:
            language = "sql"
        elif is_java:
            language = "java"
        elif is_python:
            language = "python"
        else:
            language = "c"
    else:
        language = str(language_hint or "c").lower()
        if language not in ("c", "python", "java", "sql"):
            language = "c"

    track = "dsa" if is_dsa else "basics"
    return {"language": language, "track": track, "course_title": str(course.get("title") or "Coding Practice")}


def _coding_problem_bank(profile):
    """Return 100 course-language problems spanning basics and DSA topics."""
    language = profile["language"]
    if language == "sql":
        base = list(_SQL_BASIC_PROBLEMS)
    elif language == "python":
        base = list(_PYTHON_BASIC_PROBLEMS) + list(_PYTHON_DSA_PROBLEMS)
    elif language == "java":
        base = list(_JAVA_BASIC_PROBLEMS) + list(_JAVA_DSA_PROBLEMS)
    else:
        base = list(_C_BASIC_PROBLEMS) + list(_C_DSA_PROBLEMS)
    return extended_problem_bank(language, base, target=100)


def _coding_judge_headers():
    headers = {"Content-Type": "application/json"}
    auth_token = os.getenv("JUDGE0_AUTH_TOKEN")
    if auth_token:
        headers["X-Auth-Token"] = auth_token
    return headers


def _coding_execute(source_code: str, stdin: str, language: str = "c"):
    if not source_code or not source_code.strip():
        raise HTTPException(status_code=400, detail="Source code is required.")
    if len(source_code) > 25000:
        raise HTTPException(status_code=413, detail="Source code is too large (maximum 25 KB).")
    if len(stdin or "") > 5000:
        raise HTTPException(status_code=413, detail="Input is too large (maximum 5 KB).")

    judge_url = os.getenv("JUDGE0_BASE_URL", "https://ce.judge0.com").rstrip("/")
    headers = _coding_judge_headers()
    env_name = {"c": "JUDGE0_C_LANGUAGE_ID", "python": "JUDGE0_PYTHON_LANGUAGE_ID", "java": "JUDGE0_JAVA_LANGUAGE_ID"}.get(language)
    default_id = {"c": "103", "python": "71", "java": "62"}.get(language)
    if not env_name or not default_id:
        raise HTTPException(status_code=400, detail="Unsupported code language for this runner.")
    try:
        language_id = int(os.getenv(env_name, default_id))
    except ValueError:
        raise HTTPException(status_code=500, detail=f"{env_name} must be a numeric Judge0 language ID.")

    submission_payload = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin or "",
        "cpu_time_limit": 2,
        "cpu_extra_time": 0.5,
        "wall_time_limit": 5,
        "memory_limit": 128000,
    }
    try:
        created = httpx.post(
            f"{judge_url}/submissions/?base64_encoded=false&wait=false",
            json=submission_payload,
            headers=headers,
            timeout=15.0,
        )
        if created.status_code in (401, 403):
            raise HTTPException(status_code=502, detail="The code execution service requires authorization. Configure JUDGE0_AUTH_TOKEN in the backend environment.")
        created.raise_for_status()
        token = (created.json() or {}).get("token")
        if not token:
            raise HTTPException(status_code=502, detail="The code execution service did not return a submission token.")

        fields = "stdout,stderr,compile_output,message,status,status_id,time,memory"
        for _ in range(24):
            _coding_time.sleep(0.4)
            result_response = httpx.get(
                f"{judge_url}/submissions/{token}",
                params={"base64_encoded": "false", "fields": fields},
                headers=headers,
                timeout=10.0,
            )
            if result_response.status_code in (401, 403):
                raise HTTPException(status_code=502, detail="The code execution service rejected authorization. Check JUDGE0_AUTH_TOKEN.")
            result_response.raise_for_status()
            result = result_response.json() or {}
            status = result.get("status") or {}
            status_id = result.get("status_id") or status.get("id")
            if status_id not in (1, 2):
                return {
                    "status": status.get("description") or "Unknown",
                    "stdout": result.get("stdout") or "",
                    "stderr": result.get("stderr") or "",
                    "compile_output": result.get("compile_output") or "",
                    "message": result.get("message") or "",
                    "time": result.get("time"),
                    "memory": result.get("memory"),
                }
        return {"status": "Processing Time Limit", "stdout": "", "stderr": "", "compile_output": "", "message": "The code runner did not finish in time. Please try again."}
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="The code execution service timed out. Please try again.")
    except httpx.HTTPStatusError as exc:
        print("Judge0 HTTP error:", exc.response.status_code, exc.response.text[:500])
        raise HTTPException(status_code=502, detail=f"Code execution service returned HTTP {exc.response.status_code}.")
    except Exception as exc:
        print("Code execution error:", repr(exc))
        raise HTTPException(status_code=502, detail="Could not reach the code execution service. Please try again later.")


def _coding_execute_sql(source_code: str, setup_sql: str):
    """Run one read-only SQL query over a server-provided in-memory SQLite fixture."""
    import sqlite3
    from time import monotonic

    query = (source_code or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Enter an SQL query first.")
    if len(query) > 10000:
        raise HTTPException(status_code=413, detail="SQL query is too large (maximum 10 KB).")
    if not _coding_re.match(r"^(select|with)\b", query, _coding_re.IGNORECASE):
        return {"status": "Rejected", "stdout": "", "stderr": "Only read-only SELECT queries (including WITH queries) are allowed.", "compile_output": "", "message": "Start the query with SELECT or WITH.", "time": None, "memory": None}

    db = sqlite3.connect(":memory:")
    steps = [0]
    started = monotonic()
    try:
        db.executescript(setup_sql)
        db.execute("PRAGMA query_only = ON")

        def authorize(action, arg1, arg2, database_name, trigger_name):
            allowed = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION}
            recursive_action = getattr(sqlite3, "SQLITE_RECURSIVE", None)
            if recursive_action is not None:
                allowed.add(recursive_action)
            return sqlite3.SQLITE_OK if action in allowed else sqlite3.SQLITE_DENY

        def time_guard():
            steps[0] += 1
            return 1 if steps[0] > 2000 else 0

        db.set_authorizer(authorize)
        db.set_progress_handler(time_guard, 1000)
        cursor = db.execute(query)
        rows = cursor.fetchmany(1001)
        if len(rows) > 1000:
            return {"status": "Output Limit Exceeded", "stdout": "", "stderr": "Query returned more than 1000 rows.", "compile_output": "", "message": "Limit the result set to 1000 rows.", "time": round(monotonic() - started, 3), "memory": None}
        output = "\n".join(" | ".join("NULL" if value is None else str(value) for value in row) for row in rows)
        return {"status": "Accepted", "stdout": output, "stderr": "", "compile_output": "", "message": "Query executed against the sample database.", "time": round(monotonic() - started, 3), "memory": None}
    except sqlite3.Error as exc:
        message = str(exc)
        return {"status": "Runtime Error", "stdout": "", "stderr": message, "compile_output": "", "message": "Check SQL syntax, table names and columns.", "time": round(monotonic() - started, 3), "memory": None}
    finally:
        db.close()


@app.get("/api/coding/problems")
def coding_list_problems(
    course_id: Optional[str] = None,
    language: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    profile = _coding_profile(authorization, course_id, language)
    bank = _coding_problem_bank(profile)
    return [_coding_public_problem(problem, profile["language"], profile["track"]) for problem in bank]


@app.post("/api/coding/run")
def coding_run_code(data: CodingRunRequest, authorization: Optional[str] = Header(default=None)):
    profile = _coding_profile(authorization, data.course_id, data.language)
    if profile["language"] == "sql":
        bank = _coding_problem_bank(profile)
        problem = next((item for item in bank if item["id"] == data.problem_id), None)
        if problem is None:
            raise HTTPException(status_code=400, detail="Choose a valid SQL problem before running your query.")
        return _coding_execute_sql(data.source_code, problem["tests"][0]["stdin"])
    return _coding_execute(data.source_code, data.stdin or "", profile["language"])


@app.post("/api/coding/submit")
def coding_submit_code(data: CodingSubmitRequest, authorization: Optional[str] = Header(default=None)):
    profile = _coding_profile(authorization, data.course_id, data.language)
    if not data.source_code or not data.source_code.strip():
        raise HTTPException(status_code=400, detail="Source code is required.")
    if len(data.source_code) > 25000:
        raise HTTPException(status_code=413, detail="Source code is too large (maximum 25 KB).")

    bank = _coding_problem_bank(profile)
    problem = next((item for item in bank if item["id"] == data.problem_id), None)
    if problem is None:
        raise HTTPException(status_code=404, detail="Coding problem is not part of this course's practice set.")

    def run_one(test):
        try:
            if profile["language"] == "sql":
                result = _coding_execute_sql(data.source_code, test["stdin"])
            else:
                result = _coding_execute(data.source_code, test["stdin"], profile["language"])
            expected = str(test["expected"]).strip()
            actual = str(result.get("stdout") or "").strip()
            passed = result.get("status") == "Accepted" and actual == expected
            return {
                "passed": passed,
                "expected": expected,
                "actual": actual,
                "status": "Passed" if passed else (result.get("status") or "Wrong Answer"),
                "stderr": result.get("stderr") or "",
                "compile_output": result.get("compile_output") or "",
            }
        except HTTPException as exc:
            return {"passed": False, "expected": str(test["expected"]).strip(), "actual": "", "status": f"Runner Error ({exc.status_code})", "stderr": str(exc.detail), "compile_output": ""}

    with _CodingPool(max_workers=3) as pool:
        raw_results = list(pool.map(run_one, problem["tests"]))

    results = [dict(case_number=index + 1, **item) for index, item in enumerate(raw_results)]
    passed_count = sum(1 for item in results if item["passed"])
    accepted = passed_count == len(problem["tests"])
    try:
        user = get_current_user(authorization)
        _coding_progress_write_row(str(user.id), extract_bearer_token(authorization), {
            "course_id": str(data.course_id or ""),
            "problem_id": data.problem_id,
            "language": profile["language"],
            "difficulty": problem.get("difficulty", "Easy"),
            "code": data.source_code,
            "solved": accepted,
            "attempted": True,
        })
    except Exception as exc:
        # Do not turn a successful code validation into a failure if persistence is temporarily unavailable.
        print("Could not persist coding submission:", repr(exc))
    return {"accepted": accepted, "passed": passed_count, "total": len(problem["tests"]), "results": results}


# ============================================================
# PERSISTENT CODING PRACTICE PROGRESS
# ============================================================

def _coding_progress_headers(token: str, prefer: str = ""):
    if not SUPABASE_PUBLISHABLE_KEY or not SUPABASE_URL:
        raise HTTPException(status_code=503, detail="Supabase publishable key is not configured for coding progress.")
    headers = {
        "apikey": SUPABASE_PUBLISHABLE_KEY.strip(),
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _coding_progress_url():
    return SUPABASE_URL.strip().rstrip("/") + "/rest/v1/coding_progress"


def _coding_progress_write_row(user_id: str, token: str, payload: dict):
    """Upsert code/solved state without ever downgrading an already solved item."""
    course_key = str(payload.get("course_id") or "")
    problem_id = str(payload.get("problem_id") or "").strip()
    if not problem_id:
        return False

    headers = _coding_progress_headers(token)
    lookup = {
        "select": "solved,attempts,code",
        "user_id": f"eq.{user_id}",
        "course_id": f"eq.{course_key}",
        "problem_id": f"eq.{problem_id}",
        "limit": "1",
    }
    previous = {}
    try:
        existing = httpx.get(_coding_progress_url(), headers=headers, params=lookup, timeout=12.0)
        if existing.status_code < 400:
            rows = existing.json() or []
            if rows:
                previous = rows[0]
        else:
            print("Coding progress lookup failed:", existing.status_code, existing.text[:300])
    except Exception as exc:
        print("Coding progress lookup exception:", repr(exc))

    solved = bool(payload.get("solved", False) or previous.get("solved", False))
    attempts = int(previous.get("attempts") or 0) + (1 if payload.get("attempted") else 0)
    body = {
        "user_id": user_id,
        "course_id": course_key,
        "problem_id": problem_id,
        "language": str(payload.get("language") or "c").lower(),
        "difficulty": str(payload.get("difficulty") or "Easy").title(),
        "code": str(payload.get("code") or ""),
        "solved": solved,
        "attempts": attempts,
        "updated_at": now_iso(),
    }
    try:
        response = httpx.post(
            _coding_progress_url(),
            params={"on_conflict": "user_id,course_id,problem_id"},
            headers=_coding_progress_headers(token, "resolution=merge-duplicates,return=representation"),
            json=body,
            timeout=15.0,
        )
        if response.status_code >= 400:
            print("Coding progress save failed:", response.status_code, response.text[:600])
            return False
        return True
    except Exception as exc:
        print("Coding progress save exception:", repr(exc))
        return False


@app.get("/api/coding/progress")
def coding_get_progress(
    course_id: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    user = get_current_user(authorization)
    token = extract_bearer_token(authorization)
    course_key = str(course_id or "")
    if course_id:
        get_user_course(course_id, str(user.id), token)
    params = {
        "select": "problem_id,course_id,language,difficulty,code,solved,attempts,updated_at",
        "user_id": f"eq.{user.id}",
        "course_id": f"eq.{course_key}",
        "order": "updated_at.desc",
    }
    try:
        response = httpx.get(
            _coding_progress_url(),
            headers=_coding_progress_headers(token),
            params=params,
            timeout=15.0,
        )
        if response.status_code in (404, 400) and "coding_progress" in response.text.lower():
            raise HTTPException(status_code=503, detail="Coding progress table is not set up. Run backend/sql/coding_progress.sql in the Supabase SQL Editor.")
        if response.status_code >= 400:
            print("Coding progress read failed:", response.status_code, response.text[:600])
            raise HTTPException(status_code=502, detail="Could not load saved coding progress. Check the coding_progress Supabase table.")
        return response.json() or []
    except HTTPException:
        raise
    except Exception as exc:
        print("Coding progress read exception:", repr(exc))
        raise HTTPException(status_code=502, detail="Could not load saved coding progress.")


@app.post("/api/coding/progress")
def coding_save_progress(
    data: CodingProgressSave,
    authorization: Optional[str] = Header(default=None),
):
    user = get_current_user(authorization)
    token = extract_bearer_token(authorization)
    if data.course_id:
        get_user_course(data.course_id, str(user.id), token)
    if not data.problem_id.strip():
        raise HTTPException(status_code=400, detail="problem_id is required.")
    payload = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    payload["course_id"] = str(data.course_id or "")
    saved = _coding_progress_write_row(str(user.id), token, payload)
    if not saved:
        raise HTTPException(status_code=503, detail="Could not save coding progress. Make sure backend/sql/coding_progress.sql has been run in Supabase.")
    return {"success": True, "problem_id": data.problem_id, "solved": bool(data.solved), "message": "Coding progress saved."}
