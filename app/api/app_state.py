"""
App State API: persist/retrieve UI state (target, tasks, etc.).
"""

import json
from typing import Any, Dict

from fastapi import APIRouter

from app.core.database import get_db, save_state
from app.models.schemas import StateBody

router = APIRouter(prefix="/api", tags=["state"])


@router.get("/state")
def api_get_state():
    conn = get_db()
    rows = conn.execute("SELECT * FROM app_state").fetchall()
    conn.close()
    result: Dict[str, Any] = {}
    for row in rows:
        try:
            result[row["key"]] = json.loads(row["value"])
        except Exception:
            result[row["key"]] = row["value"]
    return result


@router.post("/state")
def api_set_state(body: StateBody):
    save_state(body.key, body.value)
    return {"success": True}
