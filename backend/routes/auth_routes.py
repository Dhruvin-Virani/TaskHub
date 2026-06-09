"""
Auth routes:
  POST /api/auth/oauth/callback  — Exchange Firebase ID token, upsert user
  GET  /api/auth/me              — Return current user profile
  POST /api/auth/logout          — Clear session cookie
"""
import uuid
from flask import Blueprint, request, jsonify, g
from firebase_client import verify_firebase_token
from database import get_admin_db
from auth_middleware import require_auth

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/oauth/callback")
def oauth_callback():
    """
    Called by the frontend after a successful Firebase Auth sign-in.
    Verifies the Firebase ID token and upserts a row in the `users` table.
    Returns the user record with their role (set in Supabase).
    """
    data = request.get_json(silent=True) or {}
    id_token = data.get("id_token") or request.headers.get("Authorization", "").replace("Bearer ", "")

    if not id_token:
        return jsonify({"error": "id_token is required"}), 400

    try:
        claims = verify_firebase_token(id_token)
    except Exception as e:
        print("Firebase token verification failed:", str(e))
        return jsonify({"error": "Invalid Firebase token", "detail": str(e)}), 401

    uid = claims["uid"]
    email = claims.get("email", "")
    name = claims.get("name", email.split("@")[0])
    picture = claims.get("picture", "")

    db = get_admin_db()

    # Check if user already exists
    existing = db.table("users").select("*").eq("firebase_uid", uid).execute()

    if existing.data:
        # Update last login
        db.table("users").update({
            "display_name": name,
            "avatar_url": picture,
        }).eq("firebase_uid", uid).execute()
        user = existing.data[0]
    else:
        # New user — default role is "user"
        new_user = {
            "id": str(uuid.uuid4()),
            "firebase_uid": uid,
            "email": email,
            "display_name": name,
            "avatar_url": picture,
            "role": "user",
        }
        res = db.table("users").insert(new_user).execute()
        user = res.data[0]

    # Audit
    db.table("audit_logs").insert({
        "user_id": user["id"],
        "action": "oauth_login",
        "resource_type": "users",
        "resource_id": user["id"],
    }).execute()

    return jsonify({"user": user}), 200


@auth_bp.get("/me")
@require_auth
def get_me():
    return jsonify({"user": g.user}), 200


@auth_bp.post("/logout")
@require_auth
def logout():
    db = get_admin_db()
    db.table("audit_logs").insert({
        "user_id": g.user["id"],
        "action": "logout",
        "resource_type": "users",
        "resource_id": g.user["id"],
    }).execute()
    return jsonify({"message": "Logged out"}), 200
