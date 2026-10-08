"""
Application configuration — reads from .env via python-dotenv.

Priority order (highest → lowest):
  1. Real environment variables (e.g. set in Docker / systemd)
  2. Values in the .env file in the project root
  3. Defaults defined below

Import this module everywhere; never hardcode ports or secrets.
"""

import os
import secrets
from pathlib import Path

# Load .env from the project root (two levels up from this file)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=_PROJECT_ROOT / ".env", override=False)
except ImportError:
    # python-dotenv not installed — fall back to OS environment only
    pass


def _get(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def _get_list(key: str, default: str = "") -> list[str]:
    raw = _get(key, default)
    return [o.strip() for o in raw.split(",") if o.strip()]


def _get_bool(key: str, default: bool = False) -> bool:
    return _get(key, str(default)).lower() in ("1", "true", "yes", "on")


def _get_int(key: str, default: int = 0) -> int:
    try:
        return int(_get(key, str(default)))
    except ValueError:
        return default


# ── Server ────────────────────────────────────────────────────────────
PORT: int  = _get_int("APP_PORT", 3000)
HOST: str  = _get("APP_HOST", "0.0.0.0")
DEBUG: bool = _get_bool("DEBUG", False)

# ── CORS ─────────────────────────────────────────────────────────────
CORS_ORIGINS: list[str] = _get_list(
    "CORS_ORIGINS",
    f"http://localhost:{PORT},http://127.0.0.1:{PORT},http://0.0.0.0:{PORT}",
)

# ── Database ──────────────────────────────────────────────────────────
DB_PATH: str = _get("DB_PATH", "siuxsa.db")

# ── Security ──────────────────────────────────────────────────────────
# Falls back to a random key per process start if not set.
# Set a stable SECRET_KEY in .env for production so tokens survive restarts.
SECRET_KEY: str = _get("SECRET_KEY") or secrets.token_hex(32)

# Session lifetime in minutes. A login rotates the single active session;
# after this idle-independent window the token expires and re-login is required.
SESSION_TTL_MIN: int = _get_int("SESSION_TTL_MIN", 720)  # 12 hours

# ── AI / External ─────────────────────────────────────────────────────
GEMINI_API_KEY: str = _get("GEMINI_API_KEY", "")
APP_URL: str        = _get("APP_URL", f"http://localhost:{PORT}")

# ── Sensitive file patterns — NEVER served by the filesystem API ──────
# Any file whose name matches one of these patterns returns 403 immediately.
BLOCKED_FILENAMES: frozenset[str] = frozenset({
    ".env", ".env.local", ".env.production", ".env.development",
    ".env.staging", ".env.test", ".env.example",
    "secrets.json", "secrets.yaml", "secrets.yml",
    "credentials", "credentials.json",
    ".htpasswd", ".netrc", ".pgpass",
    "id_rsa", "id_ed25519", "id_ecdsa", "id_dsa",      # SSH private keys
    "*.pem",   # handled separately via suffix check
})

BLOCKED_SUFFIXES: frozenset[str] = frozenset({
    ".pem", ".key", ".p12", ".pfx", ".pkcs12",
})
