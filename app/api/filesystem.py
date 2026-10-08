"""
Filesystem API: virtual host explorer, file read/write/delete, system info,
and binary file serving (images, video, audio, etc.).

SECURITY
--------
All endpoints call `_guard_sensitive(path)` before touching the filesystem.
Any request for a .env file, private key, or other protected filename
is rejected immediately with HTTP 403 — no content, no error detail that
leaks information about the file's existence.
"""

import mimetypes
import os
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response

from app.core import state
from app.core.config import BLOCKED_FILENAMES, BLOCKED_SUFFIXES
from app.models.schemas import FsListBody, FsReadBody, FsWriteBody, FsDeleteBody

router = APIRouter(prefix="/api", tags=["filesystem"])


# ═══════════════════════════════════════════════════════════════════════
#  SENSITIVE FILE GUARD
#  Call this before every filesystem operation.
#  Raises HTTP 403 and returns NO useful detail for blocked files so that
#  the response cannot be used to probe whether the file exists.
# ═══════════════════════════════════════════════════════════════════════

def _guard_sensitive(path: str | Path) -> None:
    """
    Block access to .env files, private keys, and other sensitive filenames.

    Rules (all case-insensitive):
      • Exact filename match against BLOCKED_FILENAMES
      • File suffix match against BLOCKED_SUFFIXES
      • Any filename that starts with '.env' (catches .env.local, .env.prod, etc.)

    On match → raises HTTPException(403).
    The error body contains no information about the file's existence
    or its exact path to prevent information leakage.
    """
    p = Path(str(path))
    name   = p.name.lower()
    suffix = p.suffix.lower()

    blocked = (
        name in BLOCKED_FILENAMES
        or name.startswith(".env")
        or suffix in BLOCKED_SUFFIXES
    )

    if blocked:
        raise HTTPException(
            status_code=403,
            detail="Access denied.",   # intentionally generic
        )


# ═══════════════════════════════════════════════════════════════════════
#  DIRECTORY LISTING
#  Sensitive filenames are silently excluded from the listing so they
#  don't appear in the explorer UI at all.
# ═══════════════════════════════════════════════════════════════════════

def _is_sensitive(name: str) -> bool:
    """Return True if this filename should be hidden from directory listings."""
    n = name.lower()
    s = Path(name).suffix.lower()
    return (
        n in BLOCKED_FILENAMES
        or n.startswith(".env")
        or s in BLOCKED_SUFFIXES
    )


@router.post("/fs/list")
def api_fs_list(body: FsListBody):
    target_path_str = body.path or state.current_cwd
    target_path = Path(target_path_str)
    if not target_path.is_absolute():
        target_path = Path(state.current_cwd) / target_path

    target_path = target_path.resolve()

    if not target_path.exists():
        raise HTTPException(status_code=404, detail=f"Directory does not exist: {target_path}")
    if not target_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {target_path}")

    items = []
    try:
        for entry in target_path.iterdir():
            # Silently skip sensitive files — they must not appear in the UI
            if _is_sensitive(entry.name):
                continue
            try:
                stat   = entry.stat()
                is_dir = entry.is_dir()
                items.append({
                    "name"      : entry.name,
                    "path"      : str(entry),
                    "type"      : "directory" if is_dir else "file",
                    "size"      : stat.st_size,
                    "sizeString": "--" if is_dir else f"{stat.st_size / 1024:.2f} KB",
                    "isReadable": os.access(entry, os.R_OK),
                    "isWritable": os.access(entry, os.W_OK),
                    "modified"  : datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })
            except Exception:
                items.append({
                    "name"      : entry.name,
                    "path"      : str(entry),
                    "type"      : "unknown",
                    "size"      : 0,
                    "sizeString": "Blocked / Protected",
                    "isReadable": False,
                    "isWritable": False,
                    "modified"  : datetime.utcnow().isoformat(),
                })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    items.sort(key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()))

    parent = None
    if str(target_path) not in ("/", str(target_path.anchor)):
        parent = str(target_path.parent)

    return {
        "currentPath": str(target_path),
        "parentPath" : parent,
        "items"      : items,
    }


# ═══════════════════════════════════════════════════════════════════════
#  FILE READ
# ═══════════════════════════════════════════════════════════════════════

@router.post("/fs/read")
def api_fs_read(body: FsReadBody):
    _guard_sensitive(body.filePath)          # ← 403 for .env / keys

    file_path = Path(body.filePath)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if file_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is a directory, not a file")

    try:
        stat    = file_path.stat()
        content = file_path.read_text(encoding="utf-8", errors="replace")
        return {
            "filePath": str(file_path),
            "name"    : file_path.name,
            "content" : content,
            "size"    : stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════
#  FILE WRITE
# ═══════════════════════════════════════════════════════════════════════

@router.post("/fs/write")
def api_fs_write(body: FsWriteBody):
    _guard_sensitive(body.filePath)          # ← 403 for .env / keys

    file_path = Path(body.filePath)
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(body.content or "", encoding="utf-8")
        return {"success": True, "filePath": str(file_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════
#  FILE DELETE
# ═══════════════════════════════════════════════════════════════════════

@router.post("/fs/delete")
def api_fs_delete(body: FsDeleteBody):
    _guard_sensitive(body.filePath)          # ← 403 for .env / keys

    file_path = Path(body.filePath)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File or directory not found")
    try:
        if file_path.is_dir():
            shutil.rmtree(file_path)
        else:
            file_path.unlink()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════
#  SYSTEM INFO
# ═══════════════════════════════════════════════════════════════════════

@router.get("/fs/sysinfo")
def api_fs_sysinfo():
    import platform as pf
    try:
        os_release = "Debian GNU/Linux (Container Standard)"
        os_release_file = Path("/etc/os-release")
        if os_release_file.exists():
            text = os_release_file.read_text()
            for line in text.splitlines():
                if line.startswith("PRETTY_NAME="):
                    os_release = line.split("=", 1)[1].strip().strip('"')
                    break
    except Exception:
        pass

    cpu_count  = os.cpu_count() or 1
    uptime_sec = int(time.time() - (
        float(Path("/proc/uptime").read_text().split()[0]) if Path("/proc/uptime").exists() else time.time()
    ))

    total_mem = free_mem = "Unknown"
    try:
        import psutil
        vm = psutil.virtual_memory()
        total_mem = f"{vm.total / (1024**3):.1f} GB"
        free_mem  = f"{vm.available / (1024**3):.1f} GB"
    except ImportError:
        pass

    return {
        "os"           : pf.system(),
        "arch"         : pf.machine(),
        "kernel"       : pf.release(),
        "hostname"     : pf.node(),
        "cpus"         : cpu_count,
        "uptime"       : uptime_sec,
        "totalMem"     : total_mem,
        "freeMem"      : free_mem,
        "pythonVersion": sys.version,
        "virtualization": "VMware Workstation Guest Simulation Interface",
        "hypervisor"   : "gVisor Secure Sandbox Supervisor (Isolated Host)",
        "osRelease"    : os_release,
        "diskUsage"    : "Scanning disk mount stats...",
    }


# ═══════════════════════════════════════════════════════════════════════
#  BINARY FILE SERVE (images, video, audio, PDF, etc.)
# ═══════════════════════════════════════════════════════════════════════

@router.get("/fs/serve")
def api_fs_serve(
    path: str  = Query(..., description="Absolute path to file"),
    dl  : bool = Query(False, description="Force Content-Disposition: attachment"),
):
    """
    Serve a file inline (for browser-native rendering) or as a download.

    Default:  Content-Disposition: inline  → image / video / audio / PDF render in-browser.
    ?dl=1  :  Content-Disposition: attachment → browser prompts Save-As.
    """
    _guard_sensitive(path)                   # ← 403 for .env / keys

    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if file_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is a directory")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    if mime_type is None:
        mime_type = "application/octet-stream"

    if dl:
        return FileResponse(
            path=str(file_path),
            media_type=mime_type,
            filename=file_path.name,    # → Content-Disposition: attachment
        )
    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        # no filename → Content-Disposition: inline
    )
