"""
Task routes (Admin + User):

Admin:
  POST   /api/tasks                      — Create task
  GET    /api/tasks                      — List all tasks
  POST   /api/tasks/<id>/assign          — Assign to user
  PUT    /api/tasks/<id>/accept          — Accept submitted task
  PUT    /api/tasks/<id>/request-revision — Request revision
  DELETE /api/tasks/<id>                 — Delete task

User:
  GET  /api/my-tasks                     — My assigned tasks
  GET  /api/tasks/<id>                   — Get task detail
  PUT  /api/tasks/<id>/start             — Mark in_progress
  POST /api/tasks/<id>/submit            — Submit completed task
"""
import uuid
import threading
from flask import Blueprint, request, jsonify, g
from database import get_admin_db
from auth_middleware import require_auth, require_admin
from email_service import (
    send_task_assigned,
    send_task_submitted,
    send_task_accepted,
    send_revision_requested,
)
from config import Config

tasks_bp = Blueprint("tasks", __name__, url_prefix="/api")


def _audit(user_id: str, action: str, resource_type: str, resource_id: str, meta: dict | None = None) -> None:
    db = get_admin_db()
    db.table("audit_logs").insert({
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "metadata": meta or {},
    }).execute()


def _send_async(fn, *args, **kwargs) -> None:
    """Fire-and-forget email in a daemon thread so it doesn't block the request."""
    t = threading.Thread(target=fn, args=args, kwargs=kwargs, daemon=True)
    t.start()


from storage_service import upload_image

# ── Upload Route ──────────────────────────────────────────────────────────────

@tasks_bp.post("/upload")
@require_auth
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty file"}), 400
        
    try:
        url = upload_image(file.read(), file.filename, file.content_type or "application/octet-stream")
        return jsonify({"url": url}), 200
    except Exception as e:
        return jsonify({"error": "Upload failed", "detail": str(e)}), 500


# ── Admin Routes ──────────────────────────────────────────────────────────────

@tasks_bp.post("/tasks")
@require_admin
def create_task():
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    product_image_url = data.get("product_image_url", "").strip()

    if not all([title, description, product_image_url]):
        return jsonify({"error": "title, description, and product_image_url are required"}), 422

    assigned_to = data.get("assigned_to")

    db = get_admin_db()
    task = {
        "id": str(uuid.uuid4()),
        "title": title,
        "description": description,
        "product_image_url": product_image_url,
        "status": "assigned" if assigned_to else "pending",
        "created_by": g.user["id"],
        "assigned_to": assigned_to,
    }
    res = db.table("tasks").insert(task).execute()
    created = res.data[0]
    _audit(g.user["id"], "create_task", "tasks", created["id"], {"assigned_to": assigned_to})

    if assigned_to:
        user_res = db.table("users").select("*").eq("id", assigned_to).single().execute()
        if user_res.data:
            assignee = user_res.data
            _send_async(
                send_task_assigned,
                to=assignee["email"],
                user_name=assignee["display_name"],
                task_title=task["title"],
                task_description=task["description"],
                task_id=task["id"],
                frontend_url=Config.FRONTEND_URL,
            )

    return jsonify({"task": created}), 201


@tasks_bp.get("/tasks")
@require_admin
def list_all_tasks():
    db = get_admin_db()
    res = db.table("tasks").select("*, users!tasks_assigned_to_fkey(display_name, email, avatar_url)").order("created_at", desc=True).execute()
    return jsonify({"tasks": res.data}), 200


@tasks_bp.post("/tasks/<task_id>/assign")
@require_admin
def assign_task(task_id: str):
    data = request.get_json(silent=True) or {}
    assignee_id = data.get("user_id", "").strip()
    if not assignee_id:
        return jsonify({"error": "user_id is required"}), 422

    db = get_admin_db()

    # Fetch assignee
    user_res = db.table("users").select("*").eq("id", assignee_id).single().execute()
    if not user_res.data:
        return jsonify({"error": "Assignee not found"}), 404

    task_res = db.table("tasks").update({
        "assigned_to": assignee_id,
        "status": "assigned",
    }).eq("id", task_id).execute()

    if not task_res.data:
        return jsonify({"error": "Task not found"}), 404

    task = task_res.data[0]
    assignee = user_res.data

    _audit(g.user["id"], "assign_task", "tasks", task_id, {"assignee_id": assignee_id})

    # Email the user
    _send_async(
        send_task_assigned,
        to=assignee["email"],
        user_name=assignee["display_name"],
        task_title=task["title"],
        task_description=task["description"],
        task_id=task_id,
        frontend_url=Config.FRONTEND_URL,
    )

    return jsonify({"task": task}), 200


@tasks_bp.put("/tasks/<task_id>/accept")
@require_admin
def accept_task(task_id: str):
    data = request.get_json(silent=True) or {}
    feedback = data.get("feedback", "")

    db = get_admin_db()
    task_res = db.table("tasks").update({"status": "accepted"}).eq("id", task_id).execute()
    if not task_res.data:
        return jsonify({"error": "Task not found"}), 404

    task = task_res.data[0]

    if task.get("assigned_to"):
        user_res = db.table("users").select("*").eq("id", task["assigned_to"]).single().execute()
        if user_res.data:
            u = user_res.data
            _send_async(
                send_task_accepted,
                to=u["email"],
                user_name=u["display_name"],
                task_title=task["title"],
                feedback=feedback,
                frontend_url=Config.FRONTEND_URL,
            )

    _audit(g.user["id"], "accept_task", "tasks", task_id)
    return jsonify({"task": task}), 200


@tasks_bp.put("/tasks/<task_id>/request-revision")
@require_admin
def request_revision(task_id: str):
    data = request.get_json(silent=True) or {}
    revision_notes = data.get("revision_notes", "").strip()
    if not revision_notes:
        return jsonify({"error": "revision_notes is required"}), 422

    db = get_admin_db()
    task_res = db.table("tasks").update({"status": "revision_requested"}).eq("id", task_id).execute()
    if not task_res.data:
        return jsonify({"error": "Task not found"}), 404

    task = task_res.data[0]

    if task.get("assigned_to"):
        user_res = db.table("users").select("*").eq("id", task["assigned_to"]).single().execute()
        if user_res.data:
            u = user_res.data
            _send_async(
                send_revision_requested,
                to=u["email"],
                user_name=u["display_name"],
                task_title=task["title"],
                revision_notes=revision_notes,
                task_id=task_id,
                frontend_url=Config.FRONTEND_URL,
            )

    _audit(g.user["id"], "request_revision", "tasks", task_id, {"notes": revision_notes})
    return jsonify({"task": task}), 200


@tasks_bp.delete("/tasks/<task_id>")
@require_admin
def delete_task(task_id: str):
    db = get_admin_db()
    db.table("tasks").delete().eq("id", task_id).execute()
    _audit(g.user["id"], "delete_task", "tasks", task_id)
    return jsonify({"message": "Task deleted"}), 200


# ── User Routes ───────────────────────────────────────────────────────────────

@tasks_bp.get("/my-tasks")
@require_auth
def get_my_tasks():
    db = get_admin_db()
    res = db.table("tasks").select("*, generated_images(*)").eq("assigned_to", g.user["id"]).order("created_at", desc=True).execute()
    return jsonify({"tasks": res.data}), 200


@tasks_bp.get("/tasks/<task_id>")
@require_auth
def get_task(task_id: str):
    db = get_admin_db()
    res = db.table("tasks").select("*, generated_images(*)").eq("id", task_id).single().execute()
    if not res.data:
        return jsonify({"error": "Task not found"}), 404

    task = res.data
    # Users can only view their own tasks (admins can see all)
    if g.user["role"] != "admin" and task.get("assigned_to") != g.user["id"]:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"task": task}), 200


@tasks_bp.put("/tasks/<task_id>/start")
@require_auth
def start_task(task_id: str):
    db = get_admin_db()
    res = db.table("tasks").select("id, assigned_to").eq("id", task_id).single().execute()
    if not res.data:
        return jsonify({"error": "Task not found"}), 404
    if res.data["assigned_to"] != g.user["id"]:
        return jsonify({"error": "Forbidden"}), 403

    task_res = db.table("tasks").update({"status": "in_progress"}).eq("id", task_id).execute()
    _audit(g.user["id"], "start_task", "tasks", task_id)
    return jsonify({"task": task_res.data[0]}), 200


@tasks_bp.post("/tasks/<task_id>/submit")
@require_auth
def submit_task(task_id: str):
    db = get_admin_db()

    # Validate: all 8 images must exist
    imgs = db.table("generated_images").select("id, image_type").eq("task_id", task_id).execute()
    required = {
        "white_bg", "theme_1", "theme_2",
        "creative_1", "creative_2",
        "model_front", "model_side", "model_close",
    }
    submitted_types = {i["image_type"] for i in (imgs.data or [])}
    missing = required - submitted_types
    if missing:
        return jsonify({"error": f"Missing image types: {sorted(missing)}"}), 422

    task_res = db.table("tasks").update({"status": "submitted"}).eq("id", task_id).execute()
    if not task_res.data:
        return jsonify({"error": "Task not found"}), 404

    task = task_res.data[0]

    # Email the admin
    if task.get("created_by"):
        admin_res = db.table("users").select("*").eq("id", task["created_by"]).single().execute()
        if admin_res.data:
            a = admin_res.data
            _send_async(
                send_task_submitted,
                to=a["email"],
                admin_name=a["display_name"],
                task_title=task["title"],
                user_name=g.user["display_name"],
                task_id=task_id,
                frontend_url=Config.FRONTEND_URL,
            )

    _audit(g.user["id"], "submit_task", "tasks", task_id)
    return jsonify({"task": task}), 200
