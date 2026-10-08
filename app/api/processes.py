"""
Running Processes API: list, stop individual, stop all.
"""

import os

from fastapi import APIRouter, HTTPException

from app.core import state
from app.models.schemas import StopToolBody

router = APIRouter(prefix="/api", tags=["processes"])


@router.get("/running-tools")
def api_running_tools():
    result = []
    for proc_id, info in state.running_processes.items():
        result.append({
            "id": proc_id,
            "pid": info.get("pid"),
            "command": info.get("command"),
            "startTime": info["start_time"].isoformat() + "Z",
        })
    return result


@router.post("/stop-tool")
def api_stop_tool(body: StopToolBody):
    proc_id = body.id
    info = state.running_processes.get(proc_id)
    if not info:
        raise HTTPException(status_code=404, detail="Process not found")
    ok = state.kill_process_entry(info)
    state.running_processes.pop(proc_id, None)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to kill process")
    return {"success": True}


@router.post("/stop-all")
def api_stop_all():
    results = []
    for proc_id in list(state.running_processes.keys()):
        info = state.running_processes.get(proc_id)
        if not info:
            continue
        ok = state.kill_process_entry(info)
        state.running_processes.pop(proc_id, None)
        results.append({"id": proc_id, "success": ok})
    return {"success": True, "count": len(results)}
