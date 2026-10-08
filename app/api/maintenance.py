"""
Maintenance API: clear generated cache data or perform a full factory reset.

Two modes:
  • "cache" — delete data the app GENERATES during use (logs, tool run/command
    output, and the transient pipeline/target state). Saved tools and pipes —
    the user's actual work — are kept.
  • "all"   — factory reset: wipe tools, pipes, logs and all saved state, then
    restore the default tool set. Login credentials are preserved.
"""

import os

from fastapi import APIRouter, HTTPException

from app.core import state
from app.core.database import get_db, init_db
from app.models.schemas import ResetBody

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])


def _kill_all_processes() -> None:
    """Terminate any running tool processes (and their children) before wiping data."""
    for proc_id in list(state.running_processes.keys()):
        state.kill_process_entry(state.running_processes.get(proc_id))
        state.running_processes.pop(proc_id, None)


@router.post("/reset")
def api_reset(body: ResetBody):
    mode = (body.mode or "").strip().lower()
    if mode not in ("cache", "all"):
        raise HTTPException(status_code=400, detail="Invalid mode (expected 'cache' or 'all')")

    _kill_all_processes()
    conn = get_db()
    try:
        if mode == "cache":
            # Generated data only — keep tools & saved pipes (working data).
            conn.execute("DELETE FROM logs")
            conn.execute("DELETE FROM app_state WHERE key IN ('target', 'tasks')")
            conn.commit()
            cleared = ["logs", "pipeline state"]
        else:  # all
            conn.execute("DELETE FROM tools")
            conn.execute("DELETE FROM folders")
            conn.execute("DELETE FROM saved_pipes")
            conn.execute("DELETE FROM logs")
            conn.execute("DELETE FROM app_state")
            conn.commit()
            cleared = ["tools", "folders", "pipes", "logs", "state"]
    finally:
        conn.close()

    if mode == "all":
        # Recreate tables (idempotent) and re-seed the default tool set,
        # leaving the app exactly as a fresh install.
        init_db()

    return {"success": True, "mode": mode, "cleared": cleared}
