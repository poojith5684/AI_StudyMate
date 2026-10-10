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
            extract_bearer_token(authorization),
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

    questions = (
        base_questions[:count]
    )

    quiz_id = str(
        uuid4()
    )

    quizzes[
        quiz_id
    ] = {

        "course_id": data.course_id,

        "user_id": str(
            user.id
        ),

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

                "question": question[
                    "question"
                ],

                "options": question[
                    "options"
                ],
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

    user_id = str(
        user.id
    )

    # --------------------------------------------------------
    # GENERATED QUIZ
    # --------------------------------------------------------

    if (
        data.quiz_id
        and data.quiz_id in quizzes
    ):

        quiz = quizzes[
            data.quiz_id
        ]

        if quiz.get(
            "user_id"
        ) != user_id:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Quiz does not belong "
                    "to this user."
                ),
            )

        score = 0

        questions = quiz[
            "questions"
        ]

        for question in questions:

            question_id = str(
                question["id"]
            )

            submitted = (
                data.answers.get(
                    question_id
                )
            )

            if submitted == question[
                "answer"
            ]:

                score += 1

        total = len(
            questions
        )

    # --------------------------------------------------------
    # BASIC QUIZ FALLBACK
    # --------------------------------------------------------

    else:

        correct_answers = {

            "1": "Option A",

            "2": "Option B",

            "3": "Option C",
        }

        score = 0

        for (
            question_id,
            answer
        ) in data.answers.items():

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

    # --------------------------------------------------------
    # SCORE
    # --------------------------------------------------------

    percentage = (

        int(
            (
                score
                / total
            )
            * 100
        )

        if total

        else 0
    )

    # --------------------------------------------------------
    # UPDATE COURSE PROGRESS
    # --------------------------------------------------------

    if data.course_id:

        course = get_user_course(
            data.course_id,
            user_id,
            extract_bearer_token(authorization),
        )

        old_progress = (
            course["progress"]
        )

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

            new_progress = (
                old_progress
            )

        completed = (
            new_progress >= 100
        )

        persist_progress(
            data.course_id,
            user_id,
            new_progress,
            completed,
            extract_bearer_token(authorization),
        )

    return {

        "score": score,

        "total": total,

        "percentage": percentage,

        "message": (
            "Quiz submitted successfully"
        ),
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
# CODING PRACTICE (C / GCC)
# The compiler runs inside the external Judge0 sandbox; user code
# is never executed directly in the StudyMate API process.
# ============================================================

import time as _coding_time
from concurrent.futures import ThreadPoolExecutor as _CodingPool


class CodingRunRequest(BaseModel):
    source_code: str
    stdin: str = ""


class CodingSubmitRequest(BaseModel):
    problem_id: str
    source_code: str


_CODING_PROBLEMS = [
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


def _coding_public_problem(problem):
    return {key: problem[key] for key in (
        "id", "title", "difficulty", "description", "examples",
        "constraints", "starter_code", "tags"
    )}


def _coding_judge_headers():
    headers = {"Content-Type": "application/json"}
    auth_token = os.getenv("JUDGE0_AUTH_TOKEN")
    if auth_token:
        headers["X-Auth-Token"] = auth_token
    return headers


def _coding_execute_c(source_code: str, stdin: str):
    if not source_code or not source_code.strip():
        raise HTTPException(status_code=400, detail="Source code is required.")
    if len(source_code) > 25000:
        raise HTTPException(status_code=413, detail="Source code is too large (maximum 25 KB).")
    if len(stdin or "") > 5000:
        raise HTTPException(status_code=413, detail="Input is too large (maximum 5 KB).")

    judge_url = os.getenv("JUDGE0_BASE_URL", "https://ce.judge0.com").rstrip("/")
    headers = _coding_judge_headers()
    submission_payload = {
        "source_code": source_code,
        "language_id": 103,  # C (GCC 14.1.0) on the Judge0 CE language catalogue.
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
            raise HTTPException(
                status_code=502,
                detail="The C execution service requires authorization. Configure JUDGE0_AUTH_TOKEN in the backend environment."
            )
        created.raise_for_status()
        token = (created.json() or {}).get("token")
        if not token:
            raise HTTPException(status_code=502, detail="The C execution service did not return a submission token.")

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
                raise HTTPException(status_code=502, detail="The C execution service rejected authorization. Check JUDGE0_AUTH_TOKEN.")
            result_response.raise_for_status()
            result = result_response.json() or {}
            status = result.get("status") or {}
            status_id = result.get("status_id") or status.get("id")
            if status_id not in (1, 2):
                status_description = status.get("description") or "Unknown"
                return {
                    "status": status_description,
                    "stdout": result.get("stdout") or "",
                    "stderr": result.get("stderr") or "",
                    "compile_output": result.get("compile_output") or "",
                    "message": result.get("message") or "",
                    "time": result.get("time"),
                    "memory": result.get("memory"),
                }
        return {"status": "Processing Time Limit", "stdout": "", "stderr": "", "compile_output": "", "message": "The compiler did not finish in time. Please try again."}
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="The C execution service timed out. Please try again.")
    except httpx.HTTPStatusError as exc:
        print("Judge0 HTTP error:", exc.response.status_code, exc.response.text[:500])
        raise HTTPException(status_code=502, detail=f"C execution service returned HTTP {exc.response.status_code}.")
    except Exception as exc:
        print("Judge0 execution error:", repr(exc))
        raise HTTPException(status_code=502, detail="Could not reach the C execution service. Please try again later.")


@app.get("/api/coding/problems")
def coding_list_problems(authorization: Optional[str] = Header(default=None)):
    get_current_user(authorization)
    return [_coding_public_problem(problem) for problem in _CODING_PROBLEMS]


@app.post("/api/coding/run")
def coding_run_code(data: CodingRunRequest, authorization: Optional[str] = Header(default=None)):
    get_current_user(authorization)
    result = _coding_execute_c(data.source_code, data.stdin or "")
    return result


@app.post("/api/coding/submit")
def coding_submit_code(data: CodingSubmitRequest, authorization: Optional[str] = Header(default=None)):
    user = get_current_user(authorization)
    if not data.source_code or not data.source_code.strip():
        raise HTTPException(status_code=400, detail="Source code is required.")
    if len(data.source_code) > 25000:
        raise HTTPException(status_code=413, detail="Source code is too large (maximum 25 KB).")

    problem = next((item for item in _CODING_PROBLEMS if item["id"] == data.problem_id), None)
    if problem is None:
        raise HTTPException(status_code=404, detail="Coding problem not found.")

    # Expected outputs and test input are kept on the backend, not sent by the browser.
    tests = problem["tests"]
    def run_one(test):
        try:
            result = _coding_execute_c(data.source_code, test["stdin"])
            expected = str(test["expected"]).strip()
            actual = str(result.get("stdout") or "").strip()
            accepted_execution = result.get("status") == "Accepted"
            passed = accepted_execution and actual == expected
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
        raw_results = list(pool.map(run_one, tests))

    results = [dict(case_number=index + 1, **item) for index, item in enumerate(raw_results)]
    passed_count = sum(1 for item in results if item["passed"])
    accepted = passed_count == len(tests)

    return {
        "accepted": accepted,
        "passed": passed_count,
        "total": len(tests),
        "results": results,
    }
