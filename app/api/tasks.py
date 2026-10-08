"""
Task Execution API: run tool commands against targets.
"""

import asyncio
import os
import platform
import sys
from datetime import datetime

from fastapi import APIRouter

from app.core import state
from app.core.sse import broadcast_log
from app.core.banner import ORANGE, ORANGE2, GREY, R, BOLD
from app.models.schemas import ExecuteTaskBody

router = APIRouter(prefix="/api", tags=["tasks"])


@router.post("/execute-task")
async def api_execute_task(body: ExecuteTaskBody):
    final_command = body.rawCommand.replace("$target", body.target)
    safe_target = "".join(c if c.isalnum() else "_" for c in body.target)
    file_name = f"{body.toolName.lower()}_{safe_target}.txt"

    is_win = platform.system() == "Windows"
    shell_bin = state.detect_best_shell()
    extra_paths = ["/usr/local/sbin", "/usr/local/bin", "/usr/sbin", "/usr/bin", "/sbin", "/bin"]
    sep = ";" if is_win else ":"
    system_path = sep.join(filter(None, [os.environ.get("PATH", "")] + extra_paths))
    env = {**os.environ, "PATH": system_path}

    if is_win:
        shell_args = [shell_bin, "/c", final_command]
    else:
        shell_args = [shell_bin, "-c", final_command]

    proc_id = state.next_process_id
    state.next_process_id += 1

    state.running_processes[proc_id] = {
        "pid": None,
        "command": final_command,
        "start_time": datetime.utcnow(),
        "process": None,
    }

    # On Unix, start a new session so the tool (and any children it forks) live
    # in their own process group — lets us reliably terminate the WHOLE tree.
    extra = {} if is_win else {"start_new_session": True}

    try:
        proc = await asyncio.create_subprocess_exec(
            *shell_args,
            stdin=sys.stdin, # Inherit stdin so user can type in server console
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT, # Merge stderr into stdout so they interleave perfectly
            cwd=state.current_cwd,
            env=env,
            **extra,
        )
    except Exception as e:
        state.running_processes.pop(proc_id, None)
        broadcast_log(f"Process startup error: {e}", "error", final_command)
        return {"output": str(e), "fileName": file_name, "error": True}

    state.running_processes[proc_id]["pid"] = proc.pid
    state.running_processes[proc_id]["process"] = proc

    # Read output line by line in real-time
    output_lines = []
    print(f"\n  {ORANGE}▸{R} {ORANGE2}{BOLD}{final_command}{R}", flush=True)

    while True:
        line = await proc.stdout.readline()
        if not line:
            break
        decoded = line.decode(errors="replace")
        output_lines.append(decoded)
        # Print directly to the server console in real-time, with a rail prefix
        sys.stdout.write(f"    {GREY}│{R} " + decoded)
        sys.stdout.flush()

    await proc.wait()
    exit_code = proc.returncode
    state.running_processes.pop(proc_id, None)

    # Join the captured lines for the UI broadcast
    result_output = "".join(output_lines).strip()
    has_error = exit_code != 0

    # Broadcast to SSE clients (UI), but skip console printing since we already did it live
    if result_output:
        broadcast_log(result_output, "stdout", final_command, skip_console=True)
    if has_error and not result_output:
        broadcast_log(f"Command exited with code {exit_code}", "error", final_command, skip_console=True)

    return {
        "output": result_output,
        "fileName": file_name,
        "error": has_error,
    }
