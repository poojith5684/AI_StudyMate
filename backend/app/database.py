from supabase import create_client, Client
from app.config import get_settings
from functools import lru_cache
from typing import Optional

settings = get_settings()


@lru_cache()
def get_supabase_client() -> Optional[Client]:
    """Get Supabase client using service role for backend operations."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )
        return client
    except Exception:
        print("[DB] Failed to create Supabase client")
        return None


@lru_cache()
def get_supabase_anon() -> Optional[Client]:
    """Get Supabase client using the public anon key for Auth verification."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        return None
    try:
        return create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_ANON_KEY
        )
    except Exception:
        print("[DB] Failed to create Supabase anon client")
        return None
