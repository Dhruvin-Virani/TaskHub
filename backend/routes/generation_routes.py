"""
Generation routes — NO Redis/RQ.
Jobs run in a daemon thread; status is tracked directly in Supabase.

  POST   /api/tasks/<id>/generate         — Kick off a generation job
  GET    /api/jobs/<job_id>/status        — Poll job status
  GET    /api/tasks/<id>/generations      — List all generated images for a task
  DELETE /api/generations/<id>            — Delete a generated image record
"""
import uuid
import threading
from flask import Blueprint, request, jsonify, g

from database import get_admin_db
from auth_middleware import require_auth
from image_generator import generate_image
from storage_service import upload_image

generation_bp = Blueprint("generation", __name__, url_prefix="/api")

VALID_IMAGE_TYPES = {
    "white_bg", "theme_1", "theme_2",
    "creative_1", "creative_2",
    "model_front", "model_side", "model_close",
}


def _run_generation_job(job_id: str, task_id: str, image_type: str, original_image_url: str) -> None:
    """
    Runs in a daemon thread. Generates image, uploads to Supabase Storage,
    saves record, and updates job status — all inside Supabase (no Redis).
    """
    db = get_admin_db()

    # Mark running
    db.table("generation_jobs").update({"status": "running"}).eq("id", job_id).execute()

    try:
        image_bytes = generate_image(image_type, original_image_url)
        filename = f"tasks/{task_id}/{image_type}/{uuid.uuid4()}.jpg"
        public_url = upload_image(image_bytes, filename=filename)

        # Upsert generated_images record (one per type — replace old one)
        existing = (
            db.table("generated_images")
            .select("id")
            .eq("task_id", task_id)
            .eq("image_type", image_type)
            .execute()
        )
        if existing.data:
            db.table("generated_images").update({
                "image_url": public_url,
                "prompt_used": f"Pipeline: {image_type}",
                "metadata": {"job_id": job_id},
                "is_final": False,
            }).eq("id", existing.data[0]["id"]).execute()
        else:
            db.table("generated_images").insert({
                "task_id": task_id,
                "image_type": image_type,
                "image_url": public_url,
                "prompt_used": f"Pipeline: {image_type}",
                "metadata": {"job_id": job_id},
                "is_final": False,
            }).execute()

        db.table("generation_jobs").update({
            "status": "completed",
            "result_url": public_url,
        }).eq("id", job_id).execute()

    except Exception as exc:
        db.table("generation_jobs").update({
            "status": "failed",
            "error": str(exc),
        }).eq("id", job_id).execute()


@generation_bp.post("/tasks/<task_id>/generate")
@require_auth
def enqueue_generation(task_id: str):
    """
    Body: { "image_type": "white_bg" | "theme_1" | ... }
    Kicks off a background thread, returns { job_id }.
    """
    data = request.get_json(silent=True) or {}
    image_type = (data.get("image_type") or "").strip()

    if image_type not in VALID_IMAGE_TYPES:
        return jsonify({"error": f"image_type must be one of: {sorted(VALID_IMAGE_TYPES)}"}), 422

    db = get_admin_db()

    task_res = (
        db.table("tasks")
        .select("id, assigned_to, product_image_url")
        .eq("id", task_id)
        .single()
        .execute()
    )
    if not task_res.data:
        return jsonify({"error": "Task not found"}), 404

    task = task_res.data
    if g.user["role"] != "admin" and task["assigned_to"] != g.user["id"]:
        return jsonify({"error": "Forbidden"}), 403

    job_id = str(uuid.uuid4())
    db.table("generation_jobs").insert({
        "id": job_id,
        "task_id": task_id,
        "image_type": image_type,
        "status": "pending",
        "requested_by": g.user["id"],
    }).execute()

    # Fire-and-forget daemon thread — no Redis or Celery needed
    thread = threading.Thread(
        target=_run_generation_job,
        args=(job_id, task_id, image_type, task["product_image_url"]),
        daemon=True,
    )
    thread.start()

    return jsonify({"job_id": job_id, "status": "pending"}), 202


@generation_bp.get("/jobs/<job_id>/status")
@require_auth
def get_job_status(job_id: str):
    db = get_admin_db()
    res = db.table("generation_jobs").select("*").eq("id", job_id).single().execute()
    if not res.data:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({"job": res.data}), 200


@generation_bp.get("/tasks/<task_id>/generations")
@require_auth
def list_generations(task_id: str):
    db = get_admin_db()

    task_res = db.table("tasks").select("id, assigned_to").eq("id", task_id).single().execute()
    if not task_res.data:
        return jsonify({"error": "Task not found"}), 404
    if g.user["role"] != "admin" and task_res.data["assigned_to"] != g.user["id"]:
        return jsonify({"error": "Forbidden"}), 403

    imgs = (
        db.table("generated_images")
        .select("*")
        .eq("task_id", task_id)
        .order("created_at")
        .execute()
    )
    return jsonify({"images": imgs.data or []}), 200


@generation_bp.delete("/generations/<generation_id>")
@require_auth
def delete_generation(generation_id: str):
    db = get_admin_db()
    res = (
        db.table("generated_images")
        .select("id, task_id")
        .eq("id", generation_id)
        .single()
        .execute()
    )
    if not res.data:
        return jsonify({"error": "Generation not found"}), 404

    task_res = (
        db.table("tasks")
        .select("assigned_to")
        .eq("id", res.data["task_id"])
        .single()
        .execute()
    )
    if g.user["role"] != "admin" and (task_res.data or {}).get("assigned_to") != g.user["id"]:
        return jsonify({"error": "Forbidden"}), 403

    db.table("generated_images").delete().eq("id", generation_id).execute()
    return jsonify({"message": "Deleted"}), 200


@generation_bp.put("/generations/<generation_id>/mark-final")
@require_auth
def mark_final(generation_id: str):
    db = get_admin_db()
    res = (
        db.table("generated_images")
        .select("id, task_id")
        .eq("id", generation_id)
        .single()
        .execute()
    )
    if not res.data:
        return jsonify({"error": "Generation not found"}), 404

    db.table("generated_images").update({"is_final": True}).eq("id", generation_id).execute()
    return jsonify({"message": "Marked as final"}), 200
