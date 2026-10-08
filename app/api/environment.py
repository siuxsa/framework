"""
Environment API: current working directory, shell, platform info.

Reports the REAL logged-in user, hostname and home directory of the machine
running the server — no simulated identity.
"""

import getpass
import os
import platform
import sys

from fastapi import APIRouter

from app.core import state

router = APIRouter(prefix="/api", tags=["environment"])


def _real_user() -> str:
    try:
        return getpass.getuser()
    except Exception:
        return os.environ.get("USER") or os.environ.get("USERNAME") or "user"


@router.get("/env")
def api_env():
    return {
        "cwd": state.current_cwd,
        "baseCwd": state.initial_cwd,
        "user": _real_user(),
        "host": platform.node() or "localhost",
        "home": os.path.expanduser("~"),
        "platform": sys.platform,
        "shell": state.detect_best_shell(),
    }
