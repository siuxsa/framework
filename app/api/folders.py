"""
Folders API: organise the tool registry into named folders.

A folder groups tools. Tools with no folder_id are "unfiled" and appear only
under "All Tools". Deleting a folder does NOT delete its tools — they are simply
moved back to unfiled.
"""

import random
import string

from fastapi import APIRouter, HTTPException

from app.core.database import get_db
from app.models.schemas import FolderBody

router = APIRouter(prefix="/api", tags=["folders"])


def _new_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=7))


@router.get("/folders")
def api_get_folders():
    conn = get_db()
    rows = conn.execute("SELECT * FROM folders ORDER BY sort_order ASC, name ASC").fetchall()
    counts = {
        r["folder_id"]: r["n"]
        for r in conn.execute(
            "SELECT folder_id, COUNT(*) AS n FROM tools WHERE folder_id IS NOT NULL GROUP BY folder_id"
        ).fetchall()
    }
    conn.close()
    return [{**dict(r), "toolCount": counts.get(r["id"], 0)} for r in rows]


@router.post("/folders")
def api_create_folder(body: FolderBody):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Folder name is required")
    folder_id = _new_id()
    conn = get_db()
    max_order = conn.execute("SELECT MAX(sort_order) AS m FROM folders").fetchone()["m"] or 0
    conn.execute(
        "INSERT INTO folders (id, name, sort_order) VALUES (?, ?, ?)",
        (folder_id, name, max_order + 1),
    )
    conn.commit()
    conn.close()
    return {"id": folder_id, "name": name, "sort_order": max_order + 1, "toolCount": 0}


@router.patch("/folders/{folder_id}")
def api_rename_folder(folder_id: str, body: FolderBody):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Folder name is required")
    conn = get_db()
    conn.execute("UPDATE folders SET name = ? WHERE id = ?", (name, folder_id))
    conn.commit()
    row = conn.execute("SELECT * FROM folders WHERE id = ?", (folder_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Folder not found")
    return dict(row)


@router.delete("/folders/{folder_id}")
def api_delete_folder(folder_id: str):
    conn = get_db()
    # Unfile the tools in this folder, then remove the folder itself.
    conn.execute("UPDATE tools SET folder_id = NULL WHERE folder_id = ?", (folder_id,))
    conn.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
    conn.commit()
    conn.close()
    return {"success": True}
