from datetime import datetime, timezone
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_supabase_client
from app.routes.auth import get_current_user
from app.routes.materials import get_course_material_count
from app.schemas import CourseCreate, CourseOut

router = APIRouter()


def require_course_database():
    client = get_supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase database is not configured")
    return client


@router.post("", response_model=CourseOut)
async def create_course(
    data: CourseCreate,
    user: dict = Depends(get_current_user),
):
    """Persist a course for the authenticated Supabase user."""
    supabase = require_course_database()
    now = datetime.now(timezone.utc).isoformat()
    course_data = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": data.title,
        "description": data.description,
        "subject": data.subject,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = supabase.table("courses").insert(course_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Supabase did not return the inserted course")
        course = result.data[0]
        return CourseOut(
            id=course["id"],
            user_id=course["user_id"],
            title=course["title"],
            description=course.get("description"),
            subject=course.get("subject"),
            material_count=0,
            created_at=course["created_at"],
            updated_at=course.get("updated_at"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create course in Supabase: {exc}") from exc


@router.get("", response_model=List[CourseOut])
async def list_courses(user: dict = Depends(get_current_user)):
    """Load persisted courses belonging to the authenticated user."""
    supabase = require_course_database()

    try:
        result = (
            supabase.table("courses")
            .select("*")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
            .execute()
        )
        courses = []
        for course in result.data or []:
            courses.append(CourseOut(
                id=course["id"],
                user_id=course["user_id"],
                title=course["title"],
                description=course.get("description"),
                subject=course.get("subject"),
                material_count=get_course_material_count(course["id"], user["id"]),
                created_at=course["created_at"],
                updated_at=course.get("updated_at"),
            ))
        return courses
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load courses from Supabase: {exc}") from exc


@router.get("/{course_id}", response_model=CourseOut)
async def get_course(course_id: str, user: dict = Depends(get_current_user)):
    """Load one persisted course owned by the authenticated user."""
    supabase = require_course_database()

    try:
        result = (
            supabase.table("courses")
            .select("*")
            .eq("id", course_id)
            .eq("user_id", user["id"])
            .maybe_single()
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Course not found")

        course = result.data
        return CourseOut(
            id=course["id"],
            user_id=course["user_id"],
            title=course["title"],
            description=course.get("description"),
            subject=course.get("subject"),
            material_count=get_course_material_count(course["id"], user["id"]),
            created_at=course["created_at"],
            updated_at=course.get("updated_at"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load course from Supabase: {exc}") from exc


@router.delete("/{course_id}")
async def delete_course(course_id: str, user: dict = Depends(get_current_user)):
    """Delete a course and its materials after checking ownership."""
    supabase = require_course_database()

    try:
        result = (
            supabase.table("courses")
            .select("id")
            .eq("id", course_id)
            .eq("user_id", user["id"])
            .maybe_single()
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Course not found")

        supabase.table("materials").delete().eq("course_id", course_id).execute()
        supabase.table("courses").delete().eq("id", course_id).eq("user_id", user["id"]).execute()
        return {"message": "Course deleted successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete course from Supabase: {exc}") from exc
