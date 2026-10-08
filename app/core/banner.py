"""
Professional startup banner for the CSHUNTER server console.

Renders an ANSI-coloured ASCII logo + a clean info panel when stdout is a TTY,
and falls back to plain text when piped / colour is disabled (NO_COLOR).
"""

import os
import platform
import sys
from datetime import datetime

# ── Colour support ───────────────────────────────────────────────────────
_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None and os.environ.get("TERM") != "dumb"


def _c(code: str) -> str:
    return code if _COLOR else ""


R      = _c("\x1b[0m")
BOLD   = _c("\x1b[1m")
DIM    = _c("\x1b[2m")
UND    = _c("\x1b[4m")
ORANGE = _c("\x1b[38;2;255;106;42m")   # #FF6A2A — brand accent
ORANGE2= _c("\x1b[38;2;255;133;81m")   # lighter orange
GREY   = _c("\x1b[38;2;110;119;129m")  # #6E7781
SLATE  = _c("\x1b[38;2;180;184;189m")
WHITE  = _c("\x1b[38;2;242;242;240m")  # #F2F2F0
GREEN  = _c("\x1b[38;2;74;222;128m")

# ── ANSI-Shadow block letters ────────────────────────────────────────────
_LETTERS = {
    'C': [" ██████╗", "██╔════╝", "██║     ", "██║     ", "╚██████╗", " ╚═════╝"],
    'S': ["███████╗", "██╔════╝", "███████╗", "╚════██║", "███████║", "╚══════╝"],
    'H': ["██╗  ██╗", "██║  ██║", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"],
    'U': ["██╗   ██╗", "██║   ██║", "██║   ██║", "██║   ██║", "╚██████╔╝", " ╚═════╝ "],
    'N': ["███╗   ██╗", "████╗  ██║", "██╔██╗ ██║", "██║╚██╗██║", "██║ ╚████║", "╚═╝  ╚═══╝"],
    'T': ["████████╗", "╚══██╔══╝", "   ██║   ", "   ██║   ", "   ██║   ", "   ╚═╝   "],
    'E': ["███████╗", "██╔════╝", "█████╗  ", "██╔══╝  ", "███████╗", "╚══════╝"],
    'R': ["██████╗ ", "██╔══██╗", "██████╔╝", "██╔══██╗", "██║  ██║", "╚═╝  ╚═╝"],
}


def _figlet(word: str) -> list[str]:
    rows = ["", "", "", "", "", ""]
    for ch in word:
        g = _LETTERS.get(ch.upper())
        if not g:
            continue
        for i in range(6):
            rows[i] += g[i]
    return rows


def print_banner(host: str, port: int, debug: bool, cors: list[str]) -> None:
    url_host = "localhost" if host in ("0.0.0.0", "::", "") else host
    base = f"http://{url_host}:{port}"

    print()
    # Logo (two-tone: bright top rows, dimmer bottom rows)
    art = _figlet("CSHUNTER")
    for i, line in enumerate(art):
        shade = ORANGE if i < 3 else ORANGE2
        print(f"  {shade}{BOLD}{line}{R}")

    print(f"  {GREY}Bug Bounty Orchestration Console  {ORANGE}·{R}  {GREY}Advanced Operations Center{R}")
    print()

    bar = f"{GREY}{'─' * 60}{R}"
    print(f"  {bar}")

    def row(label: str, value: str, vcol: str = WHITE) -> None:
        print(f"   {ORANGE}▸{R}  {GREY}{label:<11}{R}{vcol}{value}{R}")

    row("Console", f"{UND}{ORANGE}{base}{R}", "")
    row("Login", f"{UND}{ORANGE}{base}/login{R}", "")
    row("Binding", f"{host}:{port}")
    row("Debug", f"{GREEN if not debug else ORANGE2}{debug}{R}", "")
    row("Runtime", f"Python {platform.python_version()}  {GREY}·{R} PID {os.getpid()}")
    row("Started", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    if cors:
        row("CORS", f"{GREY}{', '.join(cors)}{R}", "")
    print(f"  {bar}")
    print(f"   {DIM}{GREY}Press {R}{SLATE}Ctrl+C{R}{DIM}{GREY} to stop the server.{R}")
    print()


def print_shutdown() -> None:
    print(f"\n  {ORANGE}■{R}  {WHITE}CSHUNTER Orchestrator stopped.{R}  {GREY}Goodbye.{R}\n", flush=True)
