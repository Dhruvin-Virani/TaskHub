from functools import wraps
from typing import Callable, Any
from flask import request, jsonify, g
from firebase_client import verify_firebase_token
from database import get_admin_db


def _extract_token() -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return request.cookies.get("firebase_token")


def require_auth(f: Callable) -> Callable:
    """Verify Firebase ID token and attach user to Flask g."""
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        token = _extract_token()
        if not token:
            return jsonify({"error": "Missing authentication token"}), 401

        try:
            claims = verify_firebase_token(token)
        except Exception as e:
            return jsonify({"error": "Invalid or expired token", "detail": str(e)}), 401

        uid = claims.get("uid")
        db = get_admin_db()
        res = db.table("users").select("*").eq("firebase_uid", uid).single().execute()
        if not res.data:
            return jsonify({"error": "User not found in database"}), 404

        g.user = res.data
        g.firebase_claims = claims
        return f(*args, **kwargs)

    return decorated


def require_admin(f: Callable) -> Callable:
    """Require authenticated user with admin role."""
    @wraps(f)
    @require_auth
    def decorated(*args: Any, **kwargs: Any) -> Any:
        if g.user.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)

    return decorated
