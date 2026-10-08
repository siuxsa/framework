"""
Global mutable server state shared across all route modules.
"""

import asyncio
import os
import platform
import signal
from typing import Any, Dict, List, Optional

from app.core.database import load_state, save_state


def kill_process_entry(info: Optional[Dict[str, Any]]) -> bool:
    """
    Terminate a tracked process AND its children.

    Tools are launched via `bash -c "<tool>"`, so the tool runs as a child of
    the shell. Killing only the shell PID leaves the real tool orphaned and
    still running. Because each tool is started in its own session/process
    group (start_new_session=True), we kill the whole group here.
    """
    if not info:
        return False
    proc = info.get("process")
    pid = info.get("pid")
    done = False
    if pid is not None:
        # Kill the entire process group (Unix). Falls back to a single-pid kill.
        try:
            os.killpg(os.getpgid(pid), signal.SIGKILL)
            done = True
        except Exception:
            try:
                os.kill(pid, signal.SIGKILL)
                done = True
            except Exception:
                pass
    if not done and proc is not None:
        try:
            proc.kill()
            done = True
        except Exception:
            pass
    return done

# ── Environment ──────────────────────────────────────────────────────────
initial_cwd: str = os.getcwd()
current_cwd: str = initial_cwd
is_root: bool = False
user_shell: Optional[str] = None

# ── Running processes ────────────────────────────────────────────────────
# { process_id -> {"pid": int, "command": str, "start_time": datetime, "process": asyncio.subprocess} }
running_processes: Dict[int, Dict[str, Any]] = {}
next_process_id: int = 1

# ── SSE client queues ────────────────────────────────────────────────────
sse_clients: List[asyncio.Queue] = []


def restore_env_state() -> None:
    """Restore CWD and shell preference from database on startup."""
    global current_cwd, user_shell
    saved_cwd = load_state("cwd")
    if saved_cwd and os.path.isdir(saved_cwd):
        current_cwd = saved_cwd

    saved_shell = load_state("shell")
    if saved_shell:
        user_shell = saved_shell


def update_cwd(new_path: str) -> None:
    """Update current working directory and persist it."""
    global current_cwd
    current_cwd = new_path
    save_state("cwd", current_cwd)


def detect_best_shell() -> str:
    """Determine the best available shell for command execution."""
    if user_shell:
        return user_shell
    if platform.system() == "Windows":
        return "cmd.exe"
    if os.path.exists("/bin/bash"):
        return "/bin/bash"
    return "/bin/sh"
