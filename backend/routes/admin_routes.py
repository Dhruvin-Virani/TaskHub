"""
Admin utility routes:
  GET /api/admin/users       — List all users
  GET /api/admin/analytics   — Platform analytics summary
"""
from flask import Blueprint, jsonify
from database import get_admin_db
from auth_middleware import require_admin

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.get("/users")
@require_admin
def list_users():
    db = get_admin_db()
    res = db.table("users").select("id, display_name, email, role, avatar_url, created_at").order("created_at").execute()
    return jsonify({"users": res.data}), 200


@admin_bp.get("/analytics")
@require_admin
def analytics():
    db = get_admin_db()

    tasks = db.table("tasks").select("status").execute().data or []
    users = db.table("users").select("id").execute().data or []
    images = db.table("generated_images").select("id").execute().data or []
    jobs = db.table("generation_jobs").select("status").execute().data or []

    status_counts: dict[str, int] = {}
    for t in tasks:
        status_counts[t["status"]] = status_counts.get(t["status"], 0) + 1

    job_counts: dict[str, int] = {}
    for j in jobs:
        job_counts[j["status"]] = job_counts.get(j["status"], 0) + 1

    return jsonify({
        "total_tasks": len(tasks),
        "total_users": len(users),
        "total_images_generated": len(images),
        "tasks_by_status": status_counts,
        "jobs_by_status": job_counts,
    }), 200
