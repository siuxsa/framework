"""
Saved Pipes API: save, load, delete workflow pipelines.
"""

import json
import random
import string

from fastapi import APIRouter

from app.core.database import get_db
from app.models.schemas import PipeBody

router = APIRouter(prefix="/api", tags=["pipes"])


@router.get("/pipes")
def api_get_pipes():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM saved_pipes ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [{**dict(r), "tools": json.loads(r["tools"])} for r in rows]


@router.post("/pipes")
def api_create_pipe(body: PipeBody):
    pipe_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=7))
    conn = get_db()
    conn.execute(
        "INSERT INTO saved_pipes (id, name, tools) VALUES (?, ?, ?)",
        (pipe_id, body.name, json.dumps(body.tools))
    )
    conn.commit()
    conn.close()
    return {"id": pipe_id, "name": body.name, "tools": body.tools}


@router.delete("/pipes/{pipe_id}")
def api_delete_pipe(pipe_id: str):
    conn = get_db()
    conn.execute("DELETE FROM saved_pipes WHERE id = ?", (pipe_id,))
    conn.commit()
    conn.close()
    return {"success": True}
