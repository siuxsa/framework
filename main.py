"""
CSHUNTER Bug Bounty Orchestrator — Entry Point

Run with:  python main.py
"""

import os
import signal
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse as StarletteJSONResponse

from app.core.config import PORT, HOST, DEBUG, CORS_ORIGINS
from app.core.banner import print_banner, print_shutdown
from app.core.database import init_db
from app.core.state import restore_env_state
from app.api import logs, tools, pipes, filesystem, app_state, environment, processes, terminal, tasks, auth, maintenance, folders
from app.api.auth import init_auth_db, validate_token


# ── Application lifespan ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_auth_db()
    restore_env_state()
    yield


app = FastAPI(
    title="CSHUNTER Orchestrator",
    lifespan=lifespan,
    # Disable auto-generated docs in production
    docs_url="/api/docs" if DEBUG else None,
    redoc_url="/api/redoc" if DEBUG else None,
)


# ── CORS — origins driven entirely by .env / CORS_ORIGINS ────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Register API routers ──────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(logs.router)
app.include_router(tools.router)
app.include_router(pipes.router)
app.include_router(filesystem.router)
app.include_router(app_state.router)
app.include_router(environment.router)
app.include_router(processes.router)
app.include_router(terminal.router)
app.include_router(tasks.router)
app.include_router(maintenance.router)
app.include_router(folders.router)


# ── Auth middleware ───────────────────────────────────────────────────
class AuthMiddleware(BaseHTTPMiddleware):
    """
    Protect every /api/* route except /api/auth/*.
    Accepts a Bearer token in the Authorization header OR a ?token= query
    parameter (needed for EventSource / SSE which cannot send headers).
    """
    async def dispatch(self, request, call_next):
        path = request.url.path

        # Public paths — no token required
        if (
            path.startswith("/static")
            or path == "/"
            or path.startswith("/api/auth")
        ):
            return await call_next(request)

        # All other /api paths require a valid bearer token
        if path.startswith("/api"):
            token = None
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:].strip()
            if not token:
                token = request.query_params.get("token", "").strip()
            if not validate_token(token):
                return StarletteJSONResponse(
                    {"detail": "Not authenticated"},
                    status_code=401,
                )

        return await call_next(request)


app.add_middleware(AuthMiddleware)


# ── Static frontend ───────────────────────────────────────────────────
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/")
def serve_root():
    html_file = static_dir / "index.html"
    if html_file.exists():
        return FileResponse(str(html_file), media_type="text/html")
    return JSONResponse(status_code=503, content={"message": "static/index.html not found."})


@app.get("/login")
def serve_login():
    """Dedicated login page — separate HTML from the dashboard."""
    html_file = static_dir / "login.html"
    if html_file.exists():
        return FileResponse(str(html_file), media_type="text/html")
    return JSONResponse(status_code=503, content={"message": "static/login.html not found."})


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    # API paths are handled by routers — don't serve index.html for them
    if full_path.startswith("api"):
        raise HTTPException(status_code=404, detail="Not found")
    html_file = static_dir / "index.html"
    if html_file.exists():
        return FileResponse(str(html_file), media_type="text/html")
    raise HTTPException(status_code=404, detail="Not found")


# ── Graceful shutdown ─────────────────────────────────────────────────
def _handle_exit(sig, frame):
    print_shutdown()
    os._exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, _handle_exit)
    signal.signal(signal.SIGTERM, _handle_exit)

    print_banner(HOST, PORT, DEBUG, CORS_ORIGINS)

    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=DEBUG,
        log_level="debug" if DEBUG else "warning",
        access_log=DEBUG,
    )
