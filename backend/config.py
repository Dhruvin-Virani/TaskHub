import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Flask
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    # Supabase
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.environ.get("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_STORAGE_BUCKET: str = os.environ.get("SUPABASE_STORAGE_BUCKET", "taskhub-images")

    # Firebase Admin
    FIREBASE_SERVICE_ACCOUNT_PATH: str = os.environ.get(
        "FIREBASE_SERVICE_ACCOUNT_PATH", "./firebase-service-account.json"
    )
    FIREBASE_CREDENTIALS_JSON: str = os.environ.get("FIREBASE_CREDENTIALS_JSON", "")

    # AI / External APIs
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
    PEXELS_API_KEY: str = os.environ.get("PEXELS_API_KEY", "")

    # SMTP Email
    SMTP_HOST: str = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.environ.get("SMTP_PORT", "587"))
    SMTP_USER: str = os.environ.get("SMTP_USER", "")
    SMTP_APP_PASSWORD: str = os.environ.get("SMTP_APP_PASSWORD", "")

    # Rate limiting (in-memory, no Redis)
    RATELIMIT_DEFAULT: str = "100 per minute"
