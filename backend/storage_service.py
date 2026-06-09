"""
Storage service — uploads images to Supabase Storage bucket.
Returns a public URL for each uploaded image.
"""
import io
import uuid
from database import get_admin_db
from config import Config


def upload_image(image_bytes: bytes, filename: str | None = None, content_type: str = "image/png") -> str:
    """Upload raw bytes to Supabase Storage and return the public URL."""
    db = get_admin_db()
    bucket = Config.SUPABASE_STORAGE_BUCKET

    if not filename:
        filename = f"{uuid.uuid4()}.png"

    db.storage.from_(bucket).upload(
        path=filename,
        file=image_bytes,
        file_options={"content-type": content_type, "upsert": "true"},
    )

    res = db.storage.from_(bucket).get_public_url(filename)
    return res
