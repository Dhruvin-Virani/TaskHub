import os
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from config import Config

_firebase_initialized = False


def init_firebase() -> None:
    global _firebase_initialized
    if _firebase_initialized:
        return
    # Try to load from JSON string in environment variable first (for production)
    if Config.FIREBASE_CREDENTIALS_JSON:
        import json
        try:
            cred_dict = json.loads(Config.FIREBASE_CREDENTIALS_JSON)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            return
        except Exception as e:
            print(f"Failed to load Firebase credentials from JSON string: {e}")

    # Fallback to local file path
    sa_path = Config.FIREBASE_SERVICE_ACCOUNT_PATH
    if not os.path.exists(sa_path):
        raise FileNotFoundError(
            f"Firebase service account file not found at '{sa_path}' and no valid FIREBASE_CREDENTIALS_JSON provided. "
            "Download it from Firebase Console → Project Settings → Service Accounts."
        )
    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred)
    _firebase_initialized = True


def verify_firebase_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return the decoded claims."""
    init_firebase()
    decoded = firebase_auth.verify_id_token(id_token, clock_skew_seconds=60)
    return decoded
