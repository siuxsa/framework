"""
Authentication API — strong single-session model.

Design
------
• Login verifies the username/password, then mints a NEW cryptographically
  random session token (secrets.token_urlsafe → 384 bits of entropy). The token
  itself is never stored; only its SHA-256 hash is kept, so a database leak
  cannot reveal a working token.
• Exactly ONE session is active at a time. Each login overwrites the stored
  session, so any previously-issued token stops working immediately — logging in
  from a new place instantly kicks every other session out. Only one session
  works.
• The session (hash + expiry) is persisted so it survives a server restart, and
  cached in memory so the auth middleware never hits SQLite on the hot path.
• Tokens expire after SESSION_TTL_MIN minutes and are validated with a
  constant-time compare.
"""

import hashlib
import hmac
import secrets
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel

from app.core.database import get_db
from app.core.config import SESSION_TTL_MIN

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEFAULT_USERNAME = "cshunter"
DEFAULT_PASSWORD = "cshunter"

# ── In-memory cache of the single active session ─────────────────────────
# { "token_hash": str, "expires_at": float, "user": str }  or  None
_session: Optional[dict] = None


# ── Hashing helpers ──────────────────────────────────────────────────────
def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ── Session management ───────────────────────────────────────────────────
def _load_session() -> None:
    """Load the persisted session into the in-memory cache on startup."""
    global _session
    conn = get_db()
    row = conn.execute(
        "SELECT token_hash, expires_at, user FROM session WHERE id = 1"
    ).fetchone()
    conn.close()
    if row and row["token_hash"]:
        _session = {
            "token_hash": row["token_hash"],
            "expires_at": row["expires_at"],
            "user": row["user"],
        }
    else:
        _session = None


def _start_session(username: str) -> str:
    """
    Mint a brand-new random token, persist its hash as the ONLY active session
    (invalidating every previous token), and return the raw token to the client.
    """
    global _session
    token = secrets.token_urlsafe(48)                 # ~384 bits of entropy
    token_hash = _hash_token(token)
    now = time.time()
    expires_at = now + SESSION_TTL_MIN * 60

    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO session (id, token_hash, created_at, expires_at, user) "
        "VALUES (1, ?, ?, ?, ?)",
        (token_hash, now, expires_at, username),
    )
    conn.commit()
    conn.close()

    _session = {"token_hash": token_hash, "expires_at": expires_at, "user": username}
    return token


def _clear_session() -> None:
    """Invalidate the active session (logout / credential change)."""
    global _session
    _session = None
    conn = get_db()
    conn.execute("DELETE FROM session WHERE id = 1")
    conn.commit()
    conn.close()


def validate_token(token: str) -> bool:
    """Constant-time validation of a bearer/query token against the live session."""
    if not token or not _session:
        return False
    if _session.get("expires_at") and time.time() > _session["expires_at"]:
        _clear_session()
        return False
    return hmac.compare_digest(_hash_token(token), _session["token_hash"])


def current_user() -> str:
    return _session["user"] if _session else ""


# ── DB init ──────────────────────────────────────────────────────────────
def init_auth_db() -> None:
    """Create auth + session tables, seed default credentials, warm the cache."""
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS auth (
            id       INTEGER PRIMARY KEY,
            username TEXT NOT NULL,
            password TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS session (
            id         INTEGER PRIMARY KEY CHECK (id = 1),
            token_hash TEXT,
            created_at REAL,
            expires_at REAL,
            user       TEXT
        )
    """)
    count = conn.execute("SELECT COUNT(*) FROM auth").fetchone()[0]
    if count == 0:
        conn.execute(
            "INSERT INTO auth (id, username, password) VALUES (1, ?, ?)",
            (DEFAULT_USERNAME, _hash_password(DEFAULT_PASSWORD)),
        )
    conn.commit()
    conn.close()
    _load_session()


# ── Dependency ───────────────────────────────────────────────────────────
def get_current_user(request: Request) -> str:
    """Validate the session token from the Authorization header (or ?token=)."""
    token = ""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.query_params.get("token", "").strip()
    if not validate_token(token):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return current_user()


# ── Request bodies ───────────────────────────────────────────────────────
class LoginBody(BaseModel):
    username: str
    password: str


class ChangeCredentialsBody(BaseModel):
    currentPassword: str
    newUsername: Optional[str] = None
    newPassword: Optional[str] = None


# ── Routes ───────────────────────────────────────────────────────────────
@router.post("/login")
def api_login(body: LoginBody):
    conn = get_db()
    row = conn.execute("SELECT username, password FROM auth WHERE id = 1").fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=500, detail="No auth credentials configured")
    # Constant-time credential check
    user_ok = hmac.compare_digest(body.username, row["username"])
    pass_ok = hmac.compare_digest(_hash_password(body.password), row["password"])
    if not (user_ok and pass_ok):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Mint a fresh token — this invalidates every prior session.
    token = _start_session(row["username"])
    return {"token": token, "username": row["username"]}


@router.post("/logout")
def api_logout(request: Request):
    # Only the holder of the live token may end the session.
    token = ""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    if validate_token(token):
        _clear_session()
    return {"success": True}


@router.get("/check")
def api_check_auth(user: str = Depends(get_current_user)):
    return {"authenticated": True, "username": user}


@router.post("/change-credentials")
def api_change_credentials(body: ChangeCredentialsBody, user: str = Depends(get_current_user)):
    conn = get_db()
    row = conn.execute("SELECT password FROM auth WHERE id = 1").fetchone()
    if not row or not hmac.compare_digest(_hash_password(body.currentPassword), row["password"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    updates, values = [], []
    if body.newUsername:
        updates.append("username = ?")
        values.append(body.newUsername)
    if body.newPassword:
        updates.append("password = ?")
        values.append(_hash_password(body.newPassword))

    if updates:
        values.append(1)
        conn.execute(f"UPDATE auth SET {', '.join(updates)} WHERE id = ?", values)
        conn.commit()
    conn.close()

    # Changing credentials kills the active session — force a fresh login.
    _clear_session()
    return {"success": True, "message": "Credentials updated. Please login again."}
