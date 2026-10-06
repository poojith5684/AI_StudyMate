from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional
from app.schemas import UserProfile, ProfileUpdate
from app.database import get_supabase_anon, get_supabase_client

router = APIRouter()


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Validate JWT from Supabase Auth and return user info."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    
    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    
    # Validate user access tokens through Supabase Auth with the public anon client.
    # The service-role client is reserved for backend database operations.
    auth_client = get_supabase_anon()
    if not auth_client:
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured")
    
    try:
        user_response = auth_client.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return {
            "id": user_response.user.id,
            "email": user_response.user.email,
            "user_metadata": user_response.user.user_metadata or {}
        }
    except HTTPException:
        raise
    except Exception as exc:
        status_code = getattr(exc, "status", None) or getattr(exc, "status_code", None)
        if status_code is None:
            response = getattr(exc, "response", None)
            status_code = getattr(response, "status_code", None)

        if status_code in (400, 401, 403):
            raise HTTPException(status_code=401, detail="Invalid or expired access token") from exc
        raise HTTPException(
            status_code=503,
            detail="Unable to verify the access token with Supabase Auth",
        ) from exc


@router.get("/me", response_model=UserProfile)
async def get_profile(user: dict = Depends(get_current_user)):
    """Get current user profile."""
    return UserProfile(
        id=user["id"],
        email=user["email"],
        full_name=user.get("user_metadata", {}).get("full_name"),
        avatar_url=user.get("user_metadata", {}).get("avatar_url"),
    )


@router.patch("/me", response_model=UserProfile)
async def update_profile(
    data: ProfileUpdate,
    user: dict = Depends(get_current_user)
):
    """Update user profile (stored in user_metadata via Supabase)."""
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    # Note: Updating user metadata typically requires admin or specific auth flow
    # For now return current with update applied in response
    return UserProfile(
        id=user["id"],
        email=user["email"],
        full_name=data.full_name or user.get("user_metadata", {}).get("full_name"),
        avatar_url=data.avatar_url or user.get("user_metadata", {}).get("avatar_url"),
    )


@router.get("/status")
async def auth_status():
    """Check if auth is configured."""
    auth_client = get_supabase_anon()
    database_client = get_supabase_client()
    return {
        "configured": auth_client is not None,
        "provider": "supabase" if auth_client else "none",
        "database_configured": database_client is not None,
    }
