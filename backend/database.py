from supabase import create_client, Client
from config import Config

_supabase_client: Client | None = None
_supabase_admin_client: Client | None = None


def get_db() -> Client:
    """Standard client (respects RLS with anon key)."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)
    return _supabase_client


def get_admin_db() -> Client:
    """Admin client (service-role key, bypasses RLS for server-side ops)."""
    global _supabase_admin_client
    if _supabase_admin_client is None:
        _supabase_admin_client = create_client(
            Config.SUPABASE_URL, Config.SUPABASE_SERVICE_ROLE_KEY
        )
    return _supabase_admin_client
