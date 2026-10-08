"""
SQLite database connection and initialization.
"""

import json
import random
import sqlite3
import string
from typing import Any

from app.core.config import DB_PATH
from app.core.seed_data import FOLDERS, TOOLS, PIPES

_TOOL_MAP = {t[0]: t for t in TOOLS}


def _rid() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=7))


def _build_pipe_tasks(items: list) -> list:
    """Turn a pipe spec into task objects; a nested list becomes a parallel group."""
    tasks = []
    for it in items:
        ids = it if isinstance(it, list) else [it]
        gid = ("g" + _rid()) if (isinstance(it, list) and len(ids) > 1) else None
        for tid in ids:
            t = _TOOL_MAP.get(tid)
            if not t:
                continue
            tasks.append({
                "id": _rid(), "toolId": tid, "toolName": t[1],
                "command": t[3], "status": "idle", "output": "", "groupId": gid,
            })
    return tasks


def _seed_bughunt_toolkit(conn: sqlite3.Connection) -> None:
    """Add the folder-organised bug-bounty toolkit + sequences once (idempotent)."""
    if conn.execute("SELECT 1 FROM app_state WHERE key = 'toolkit_seeded'").fetchone():
        return

    conn.executemany(
        "INSERT OR IGNORE INTO folders (id, name, sort_order) VALUES (?, ?, ?)",
        FOLDERS,
    )
    base = conn.execute("SELECT COALESCE(MAX(sort_order), 0) FROM tools").fetchone()[0]
    tool_rows = [
        (t[0], t[1], t[2], t[3], base + i, t[4])
        for i, t in enumerate(TOOLS, start=1)
    ]
    conn.executemany(
        "INSERT OR IGNORE INTO tools (id, name, description, command, sort_order, folder_id) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        tool_rows,
    )
    for pipe_id, pipe_name, items in PIPES:
        conn.execute(
            "INSERT OR IGNORE INTO saved_pipes (id, name, tools) VALUES (?, ?, ?)",
            (pipe_id, pipe_name, json.dumps(_build_pipe_tasks(items))),
        )
    conn.execute(
        "INSERT OR REPLACE INTO app_state (key, value) VALUES ('toolkit_seeded', ?)",
        (json.dumps(True),),
    )


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # WAL lets readers and the writer work concurrently (SSE log streaming
    # overlaps with task-output inserts); NORMAL sync keeps writes cheap.
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def init_db() -> None:
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS tools (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT,
            command     TEXT,
            sort_order  INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS app_state (
            key   TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS logs (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            content   TEXT,
            type      TEXT,
            command   TEXT
        );

        CREATE TABLE IF NOT EXISTS saved_pipes (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            tools      TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Folders for organising the tool registry
        CREATE TABLE IF NOT EXISTS folders (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );

        -- Speeds up the "recent logs" query (ORDER BY timestamp DESC LIMIT 100)
        CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_tools_sort     ON tools (sort_order ASC);
    """)

    # Migration: add folder_id to existing tools tables that predate folders.
    tool_cols = [r[1] for r in conn.execute("PRAGMA table_info(tools)").fetchall()]
    if "folder_id" not in tool_cols:
        conn.execute("ALTER TABLE tools ADD COLUMN folder_id TEXT")

    # Seed the folder-organised bug-bounty toolkit + sequences (once).
    _seed_bughunt_toolkit(conn)

    conn.commit()
    conn.close()


def save_state(key: str, value: Any) -> None:
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)",
        (key, json.dumps(value))
    )
    conn.commit()
    conn.close()


def load_state(key: str) -> Any:
    conn = get_db()
    row = conn.execute("SELECT value FROM app_state WHERE key = ?", (key,)).fetchone()
    conn.close()
    if row:
        try:
            return json.loads(row[0])
        except Exception:
            return row[0]
    return None
