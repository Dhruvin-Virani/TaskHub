"""
Image generation pipeline for TaskHub.

Pipeline overview per task (8 images total):
  white_bg      → BiRefNet bg removal → pure white canvas composite
  theme_1       → BiRefNet + Pexels bg (marble/luxury surface)
  theme_2       → BiRefNet + Pexels bg (velvet/dark luxury)
  creative_1    → BiRefNet + Pexels bg (beach/sunset lifestyle)
  creative_2    → BiRefNet + Pexels bg (modern interior lifestyle)
  model_front   → Gemini multimodal (bg-removed product + prompt, front angle)
  model_side    → Gemini multimodal (bg-removed product + prompt, 45° side)
  model_close   → Gemini multimodal (bg-removed product + prompt, close-up)
"""

import io
import uuid
import base64
import requests
from PIL import Image

from config import Config

# ── Constants ─────────────────────────────────────────────────────────────────
PEXELS_QUERIES: dict[str, str] = {
    "theme_1": "luxury marble surface product photography studio",
    "theme_2": "dark velvet fabric luxury jewelry background",
    "creative_1": "golden hour beach sunset lifestyle photography",
    "creative_2": "modern minimalist interior lifestyle photography",
}

MODEL_PROMPTS: dict[str, str] = {
    "model_front": (
        "Professional high-fashion jewelry editorial photograph. A realistic female model "
        "with natural skin tones wearing the EXACT jewelry piece from the reference image. "
        "Full front-facing view, clean neutral studio background, dramatic soft-box lighting. "
        "The jewelry must be IDENTICAL to the reference: same shape, color, reflections, "
        "gemstone placement, and fine surface details. Ultra photorealistic, 8K DSLR quality. "
        "Negative: cartoon, illustration, distorted jewelry, different jewelry, blurry, "
        "low quality, 3D render."
    ),
    "model_side": (
        "Professional high-fashion jewelry editorial photograph. A realistic female model "
        "with natural skin tones wearing the EXACT jewelry piece from the reference image. "
        "45-degree side profile angle showing the jewelry clearly, clean neutral studio background. "
        "The jewelry must be IDENTICAL to the reference: same shape, color, reflections, "
        "gemstone placement, and fine surface details. Ultra photorealistic, 8K DSLR quality. "
        "Negative: cartoon, illustration, distorted jewelry, different jewelry, blurry."
    ),
    "model_close": (
        "Extreme macro close-up editorial photograph of a realistic model wearing the EXACT "
        "jewelry piece from the reference image. Shallow depth-of-field bokeh, studio lighting, "
        "visible skin texture, ultra-sharp jewelry details. "
        "The jewelry must be IDENTICAL to the reference: same shape, color, reflections, "
        "gemstone placement, and every fine surface detail. Photorealistic, 8K resolution. "
        "Negative: cartoon, illustration, distorted jewelry, different jewelry, blurry."
    ),
}

GEMINI_MODEL_TYPES = {"model_front", "model_side", "model_close"}
PEXELS_TYPES = {"theme_1", "theme_2", "creative_1", "creative_2"}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _download_image(url: str) -> bytes:
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def remove_background(image_bytes: bytes) -> bytes:
    """
    Remove background using rembg default u2net.
    Returns RGBA PNG bytes with transparent background.
    """
    from rembg import remove
    from PIL import Image
    import io
    
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        result = remove(img)
        out = io.BytesIO()
        result.save(out, format="PNG")
        return out.getvalue()
    except Exception as e:
        # Graceful fallback: return original as RGBA (no bg removal)
        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        out = io.BytesIO()
        img.save(out, format="PNG")
        return out.getvalue()


def _fetch_pexels_background(query: str) -> bytes:
    url = "https://api.pexels.com/v1/search"
    headers = {"Authorization": Config.PEXELS_API_KEY}
    params = {"query": query, "per_page": 5, "orientation": "square"}

    resp = requests.get(url, headers=headers, params=params, timeout=20)
    resp.raise_for_status()
    photos = resp.json().get("photos", [])
    if not photos:
        raise ValueError(f"No Pexels results for query: {query!r}")

    photo_url = photos[0]["src"]["large"]
    img_resp = requests.get(photo_url, timeout=30)
    img_resp.raise_for_status()
    return img_resp.content


def _composite_on_background(
    product_png: bytes,
    background_bytes: bytes | None,
    bg_color: tuple[int, int, int] = (255, 255, 255),
) -> bytes:
    """Place product (transparent PNG) centered on a background image or solid color."""
    product = Image.open(io.BytesIO(product_png)).convert("RGBA")

    if background_bytes:
        bg = Image.open(io.BytesIO(background_bytes)).convert("RGBA")
    else:
        bg = Image.new("RGBA", (1024, 1024), (*bg_color, 255))

    bg = bg.resize((1024, 1024), Image.LANCZOS)

    # Scale product to 65% of canvas, centered
    max_size = int(min(bg.size) * 0.65)
    product.thumbnail((max_size, max_size), Image.LANCZOS)
    x = (bg.width - product.width) // 2
    y = (bg.height - product.height) // 2

    bg.paste(product, (x, y), product)

    out = io.BytesIO()
    bg.convert("RGB").save(out, format="JPEG", quality=95)
    return out.getvalue()


def _generate_with_gemini(bg_removed_bytes: bytes, image_type: str) -> bytes:
    """Send bg-removed product image + system prompt to Gemini for model-wearing images."""
    import google.generativeai as genai

    genai.configure(api_key=Config.GEMINI_API_KEY)
    system_prompt = MODEL_PROMPTS[image_type]
    img_b64 = base64.b64encode(bg_removed_bytes).decode("utf-8")

    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash-preview-image-generation",
        generation_config={"response_modalities": ["IMAGE", "TEXT"]},
    )

    response = model.generate_content([
        system_prompt,
        {"inline_data": {"mime_type": "image/png", "data": img_b64}},
    ])

    for part in response.candidates[0].content.parts:
        if part.inline_data and part.inline_data.mime_type.startswith("image"):
            return part.inline_data.data  # type: ignore[return-value]

    raise ValueError("Gemini did not return an image in the response.")


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────
def generate_image(image_type: str, original_image_url: str) -> bytes:
    """Full pipeline for one image type. Returns final JPEG bytes."""
    original_bytes = _download_image(original_image_url)
    bg_removed_bytes = remove_background(original_bytes)

    if image_type == "white_bg":
        return _composite_on_background(bg_removed_bytes, None, bg_color=(255, 255, 255))

    if image_type in PEXELS_TYPES:
        query = PEXELS_QUERIES[image_type]
        bg_bytes = _fetch_pexels_background(query)
        return _composite_on_background(bg_removed_bytes, bg_bytes)

    if image_type in GEMINI_MODEL_TYPES:
        return _generate_with_gemini(bg_removed_bytes, image_type)

    raise ValueError(f"Unknown image_type: {image_type!r}")
