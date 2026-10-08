"""
Terminal API: execute shell commands, send stdin to running processes.
"""

import asyncio
import os
import platform
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.core import state
from app.core.database import save_state
from app.core.sse import broadcast_log
from app.core.banner import ORANGE, WHITE, R, BOLD
from app.models.schemas import TerminalBody, TerminalInputBody, TerminalCompleteBody

router = APIRouter(prefix="/api", tags=["terminal"])

_BUILTINS = ["cd", "clear", "su", "pwd", "ls", "bash", "zsh", "sh", "cmd", "powershell", "pwsh", "exit"]


def _log_cmd(cmd: str) -> None:
    """Log that a terminal command was run (command only — no output)."""
    print(f"  {ORANGE}{BOLD}❯{R} {WHITE}{BOLD}{cmd}{R}", flush=True)


@router.post("/terminal/complete")
def api_terminal_complete(body: TerminalCompleteBody):
    """
    Shell-style Tab completion.
      • First word (no slash) → executable names on PATH + builtins.
      • Otherwise             → filesystem paths relative to the current CWD.
    Returns fully-formed replacement tokens (directories get a trailing '/').
    """
    line = body.line or ""
    ends_space = line.endswith(" ")
    tokens = line.split(" ")
    token = "" if ends_space else (tokens[-1] if tokens else "")
    first_word = (not ends_space) and len([t for t in tokens if t]) <= 1

    # ── Command completion ────────────────────────────────────────────
    if first_word and "/" not in token and os.sep not in token:
        seen = set()
        matches = []
        for b in _BUILTINS:
            if b.startswith(token) and b not in seen:
                matches.append(b); seen.add(b)
        for d in os.environ.get("PATH", "").split(os.pathsep):
            if not d:
                continue
            try:
                for name in os.listdir(d):
                    if name.startswith(token) and name not in seen:
                        full = os.path.join(d, name)
                        if os.path.isfile(full) and os.access(full, os.X_OK):
                            matches.append(name); seen.add(name)
            except Exception:
                continue
        return {"matches": sorted(matches)[:400], "token": token, "type": "command"}

    # ── Path completion ───────────────────────────────────────────────
    slash = token.rfind("/")
    token_dir = token[:slash + 1] if slash >= 0 else ""   # keeps trailing '/'
    prefix = token[slash + 1:] if slash >= 0 else token

    search = os.path.expanduser(token_dir) if token_dir.startswith("~") else token_dir
    base_dir = search if os.path.isabs(search) else os.path.join(state.current_cwd, search or ".")

    matches = []
    try:
        for name in os.listdir(base_dir):
            if name.startswith(prefix):
                is_dir = os.path.isdir(os.path.join(base_dir, name))
                matches.append(token_dir + name + ("/" if is_dir else ""))
    except Exception:
        matches = []
    return {"matches": sorted(matches)[:400], "token": token, "type": "path"}


@router.post("/terminal")
async def api_terminal(body: TerminalBody):
    cmd_line = body.command.strip()

    # Log EVERY typed command to the server console (like a real shell log)
    if cmd_line:
        _log_cmd(cmd_line)

    # Built-in: clear
    if cmd_line == "clear":
        return {"output": "CLEAR_SIGNAL"}

    # Built-in: su (simulate root)
    if cmd_line == "su":
        state.is_root = True
        return {"output": "Session promoted to root privileges (Simulated)."}

    # Built-in: shell switching
    known_shells = {"bash", "zsh", "sh", "cmd", "powershell", "pwsh"}
    if cmd_line.lower() in known_shells:
        target_shell = cmd_line.lower()
        state.user_shell = "cmd.exe" if target_shell == "cmd" else target_shell
        save_state("shell", state.user_shell)
        return {"output": f"Shell context updated to: {state.user_shell}", "shell": state.user_shell, "cwd": state.current_cwd}

    # Built-in: cd
    if cmd_line.startswith("cd ") or cmd_line == "cd":
        target_dir = cmd_line[3:].strip() if cmd_line.startswith("cd ") else str(Path.home())
        resolved = Path(state.current_cwd) / target_dir
        resolved = resolved.resolve()
        if resolved.exists() and resolved.is_dir():
            state.update_cwd(str(resolved))
            return {"output": "", "cwd": state.current_cwd}
        else:
            return {"output": f"cd: {target_dir}: No such file or directory", "error": True}

    # Execute real shell command
    is_win = platform.system() == "Windows"
    shell_bin = state.detect_best_shell()
    extra_paths = ["/usr/local/sbin", "/usr/local/bin", "/usr/sbin", "/usr/bin", "/sbin", "/bin"]
    sep = ";" if is_win else ":"
    system_path = sep.join(filter(None, [os.environ.get("PATH", "")] + extra_paths))
    env = {**os.environ, "PATH": system_path}

    if is_win:
        shell_args = [shell_bin, "/c", cmd_line]
    else:
        shell_args = [shell_bin, "-c", cmd_line]

    try:
        proc = await asyncio.create_subprocess_exec(
            *shell_args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=state.current_cwd,
            env=env,
        )
    except Exception as e:
        return {"output": str(e), "error": True, "cwd": state.current_cwd}

    stdout_data, stderr_data = await proc.communicate()
    exit_code = proc.returncode

    stdout_str = stdout_data.decode(errors="replace").strip()
    stderr_str = stderr_data.decode(errors="replace").strip()
    full_output = stdout_str or stderr_str
    # Combine both if there's content in both streams
    if stdout_str and stderr_str:
        full_output = stdout_str + "\n" + stderr_str
    has_error = exit_code != 0

    return {
        "output": full_output,
        "error": has_error,
        "cwd": state.current_cwd,
    }


@router.post("/terminal/input")
async def api_terminal_input(body: TerminalInputBody):
    """Send stdin to the most recently started running process."""
    if not state.running_processes:
        raise HTTPException(status_code=404, detail="No active processes running to receive input")

    sorted_procs = sorted(state.running_processes.items(), key=lambda x: x[0], reverse=True)
    target_proc = None
    for proc_id, info in sorted_procs:
        proc = info.get("process")
        if proc and proc.stdin and not proc.stdin.is_closing():
            target_proc = (proc_id, info)
            break

    if not target_proc:
        raise HTTPException(status_code=404, detail="No active running processes have a writable standard input")

    proc_id, info = target_proc
    proc = info["process"]
    try:
        proc.stdin.write(body.input.encode())
        await proc.stdin.drain()

        sanitized = body.input.replace("\r", "").replace("\n", "").strip()
        is_short = sanitized.lower() in ("y", "n") or len(sanitized) <= 3
        display_phrase = sanitized if is_short else "********"
        broadcast_log(f"[Stdin Input]: {display_phrase}", "info", info["command"])

        return {"success": True, "processId": proc_id, "command": info["command"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write to stdin: {e}")
