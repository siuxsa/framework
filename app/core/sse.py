"""
Server-Sent Events broadcast and log persistence.
"""

import json
import random
import string
import time
from datetime import datetime

from app.core.database import get_db
from app.core import state
from app.core.banner import ORANGE, ORANGE2, GREY, WHITE, GREEN, R, BOLD


def broadcast_log(content: str, log_type: str, command: str, skip_console: bool = False) -> None:
    """Persist log to DB and push to all SSE client queues."""
    conn = get_db()
    conn.execute(
        "INSERT INTO logs (content, type, command) VALUES (?, ?, ?)",
        (content, log_type, command)
    )
    conn.commit()
    conn.close()

    # Print to server console — clean, colourised format
    if not skip_console:
        if log_type in ("stdout", "stderr"):
            print(f"\n  {ORANGE}▸{R} {ORANGE2}{BOLD}{command}{R}", flush=True)
            for line in content.split("\n"):
                if line.strip():
                    print(f"    {GREY}│{R} {line}", flush=True)
        elif log_type == "info":
            print(f"  {GREEN}●{R} {content}", flush=True)
        elif log_type == "warn":
            print(f"  {ORANGE2}▲{R} {content}", flush=True)
        elif log_type == "error":
            print(f"  {ORANGE}✖{R} {WHITE}{content}{R}", flush=True)

    rand_suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=7))
    log_entry = {
        "id": f"{int(time.time() * 1000)}{rand_suffix}",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "content": content,
        "type": log_type,
        "command": command,
    }
    data = json.dumps(log_entry)
    for queue in list(state.sse_clients):
        try:
            queue.put_nowait(data)
        except Exception:
            pass
