"""
Tool Registry API: CRUD operations for security tools.
"""

import random
import string

from fastapi import APIRouter, HTTPException

from app.core.database import get_db
from app.models.schemas import ToolBody, ToolUpdateBody, ReorderBody, MoveToolBody

router = APIRouter(prefix="/api", tags=["tools"])


@router.get("/tools")
def api_get_tools():
    conn = get_db()
    rows = conn.execute("SELECT * FROM tools ORDER BY sort_order ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/tools")
def api_add_tool(body: ToolBody):
    tool_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=7))
    conn = get_db()
    max_order = conn.execute("SELECT MAX(sort_order) AS m FROM tools").fetchone()["m"] or 0
    sort_order = max_order + 1
    conn.execute(
        "INSERT INTO tools (id, name, description, command, sort_order, folder_id) VALUES (?,?,?,?,?,?)",
        (tool_id, body.name, body.description, body.command, sort_order, body.folder_id)
    )
    conn.commit()
    conn.close()
    return {"id": tool_id, "name": body.name, "description": body.description, "command": body.command, "sort_order": sort_order, "folder_id": body.folder_id}


@router.delete("/tools/{tool_id}")
def api_delete_tool(tool_id: str):
    conn = get_db()
    conn.execute("DELETE FROM tools WHERE id = ?", (tool_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@router.patch("/tools/{tool_id}")
def api_update_tool(tool_id: str, body: ToolUpdateBody):
    conn = get_db()
    updates = []
    values = []
    if body.name is not None:
        updates.append("name = ?")
        values.append(body.name)
    if body.description is not None:
        updates.append("description = ?")
        values.append(body.description)
    if body.command is not None:
        updates.append("command = ?")
        values.append(body.command)
    if updates:
        values.append(tool_id)
        conn.execute(f"UPDATE tools SET {', '.join(updates)} WHERE id = ?", values)
        conn.commit()
    row = conn.execute("SELECT * FROM tools WHERE id = ?", (tool_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Tool not found")
    return dict(row)


@router.post("/tools/{tool_id}/move")
def api_move_tool(tool_id: str, body: MoveToolBody):
    """Assign a tool to a folder, or pass folderId=null to unfile it."""
    conn = get_db()
    exists = conn.execute("SELECT 1 FROM tools WHERE id = ?", (tool_id,)).fetchone()
    if not exists:
        conn.close()
        raise HTTPException(status_code=404, detail="Tool not found")
    if body.folderId is not None:
        f = conn.execute("SELECT 1 FROM folders WHERE id = ?", (body.folderId,)).fetchone()
        if not f:
            conn.close()
            raise HTTPException(status_code=404, detail="Folder not found")
    conn.execute("UPDATE tools SET folder_id = ? WHERE id = ?", (body.folderId, tool_id))
    conn.commit()
    conn.close()
    return {"success": True, "id": tool_id, "folder_id": body.folderId}


@router.post("/tools/reorder")
def api_reorder_tools(body: ReorderBody):
    conn = get_db()
    for idx, tool_id in enumerate(body.order):
        conn.execute("UPDATE tools SET sort_order = ? WHERE id = ?", (idx + 1, tool_id))
    conn.commit()
    conn.close()
    return {"success": True}
