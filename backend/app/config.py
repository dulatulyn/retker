import os

SECRET_KEY = os.environ.get("RETKER_SECRET", "dev-secret-change-me-please-32bytes-minimum!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MIN = 60 * 24 * 7

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
]
