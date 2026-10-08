"""
Logs API: fetch logs, SSE stream, clear logs.
"""

import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.core.database import get_db
from app.core import state

router = APIRouter(prefix="/api", tags=["logs"])


@router.get("/logs")
def api_get_logs():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100"
    ).fetchall()
    conn.close()
    logs = [dict(r) for r in rows]
    logs.reverse()
    return logs


@router.get("/logs/stream")
async def api_logs_stream(request: Request):
    """Server-Sent Events endpoint for real-time log streaming."""
    queue: asyncio.Queue = asyncio.Queue()
    state.sse_clients.append(queue)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                except (asyncio.CancelledError, GeneratorExit):
                    break
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            if queue in state.sse_clients:
                state.sse_clients.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/logs")
def api_delete_logs():
    conn = get_db()
    conn.execute("DELETE FROM logs")
    conn.commit()
    conn.close()
    return {"success": True}
