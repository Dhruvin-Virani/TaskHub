# This file is intentionally minimal.
# Job processing logic lives in routes/generation_routes.py (_run_generation_job).
# Keeping this file for future extensibility or CLI job re-runs.

from database import get_admin_db
from image_generator import generate_image
from storage_service import upload_image
import uuid


def rerun_job(job_id: str) -> None:
    """Manually re-run a failed job by its ID (for admin tooling)."""
    db = get_admin_db()
    job_res = db.table("generation_jobs").select("*").eq("id", job_id).single().execute()
    if not job_res.data:
        raise ValueError(f"Job {job_id!r} not found")

    job = job_res.data
    from routes.generation_routes import _run_generation_job

    task_res = db.table("tasks").select("product_image_url").eq("id", job["task_id"]).single().execute()
    original_url = task_res.data["product_image_url"]

    import threading
    t = threading.Thread(
        target=_run_generation_job,
        args=(job_id, job["task_id"], job["image_type"], original_url),
        daemon=True,
    )
    t.start()
