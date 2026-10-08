# SIUXSA PRO — Full Application Architecture

> **Purpose of this document**: A single-file, fully self-contained reference that gives any AI agent or developer a complete mental model of the application. After reading this document you should be able to understand, modify, extend, or rebuild every part of the system without consulting the source files directly.
>
> **Last updated**: Session 2 — covers all features added after initial build: file viewer with media/code openers, `.env` config system, `.env` security guard, separate login/dashboard pages, Prev/Next file navigation, and editor mode layout fix.

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Technology Stack](#2-technology-stack)
3. [Directory Layout](#3-directory-layout)
4. [High-Level Architecture Diagram](#4-high-level-architecture-diagram)
5. [Backend — Entry Point (main.py)](#5-backend--entry-point-mainpy)
6. [Backend — Core Layer (app/core/)](#6-backend--core-layer-appcore)
7. [Backend — API Layer (app/api/)](#7-backend--api-layer-appapi)
8. [Backend — Models Layer (app/models/)](#8-backend--models-layer-appmodels)
9. [Database Schema](#9-database-schema)
10. [Authentication System](#10-authentication-system)
11. [Server-Sent Events (SSE) Pipeline](#11-server-sent-events-sse-pipeline)
12. [Process Execution Model](#12-process-execution-model)
13. [Frontend — Overview](#13-frontend--overview)
14. [Frontend — Global State (state.js)](#14-frontend--global-state-statejs)
15. [Frontend — API Client (api.js)](#15-frontend--api-client-apijs)
16. [Frontend — App Bootstrap (app.js)](#16-frontend--app-bootstrap-appjs)
17. [Frontend — UI Modules (static/js/ui/)](#17-frontend--ui-modules-staticjsui)
18. [Frontend — File Viewer System (explorer.js)](#18-frontend--file-viewer-system-explorerjs)
19. [Frontend — Auth Flow (login vs dashboard)](#19-frontend--auth-flow-login-vs-dashboard)
20. [Frontend — CSS Design System](#20-frontend--css-design-system)
21. [Complete API Reference](#21-complete-api-reference)
22. [Data Flow — Workflow Execution](#22-data-flow--workflow-execution)
23. [Data Flow — Real-Time Logging](#23-data-flow--real-time-logging)
24. [Environment Configuration (.env)](#24-environment-configuration-env)
25. [Security — Sensitive File Guard](#25-security--sensitive-file-guard)
26. [Key Design Decisions and Constraints](#26-key-design-decisions-and-constraints)
27. [Extension Points and How to Add Features](#27-extension-points-and-how-to-add-features)

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Name** | SIUXSA PRO |
| **Description** | Professional tool orchestration and pipeline automation platform with built-in log management and sequence library |
| **Purpose** | Bug bounty / penetration testing orchestration — run security tools (nmap, subfinder, nuclei, etc.) in automated pipelines against a target |
| **Default Port** | `3000` (overridable via `APP_PORT` in `.env`) |
| **Default Credentials** | `siuxsa` / `siuxsa` |
| **Database File** | `siuxsa.db` (SQLite, sits in project root, overridable via `DB_PATH` in `.env`) |
| **Config File** | `.env` in project root — never served via API (always 403) |

---

## 2. Technology Stack

### Backend
| Layer | Technology |
|---|---|
| Language | Python 3.x |
| Web Framework | **FastAPI** (>= 0.111.0) |
| ASGI Server | **Uvicorn** (with `[standard]` extras) |
| Database | **SQLite** — via stdlib `sqlite3` |
| Real-time Push | **Server-Sent Events** (custom, `asyncio.Queue` based) |
| Process Execution | `asyncio.create_subprocess_exec` |
| System Info | `psutil` (optional — graceful fallback) |
| Auth | SHA-256 token derived from `username:hashed_password` |
| Multipart | `python-multipart` (FastAPI dependency) |
| Config | `python-dotenv` — loads `.env` at startup |

### Frontend
| Layer | Technology |
|---|---|
| Markup | Vanilla HTML5 — **two pages**: `login.html` (auth) + `index.html` (dashboard SPA) |
| Logic | Vanilla JavaScript (ES2020, no bundler) |
| Styling | Vanilla CSS (3 files: `variables.css`, `layout.css`, `components.css`) |
| Real-time | `EventSource` (browser SSE client) — stored globally so it can be closed on logout |
| State | Plain JS variables in `state.js` (no framework) |
| Font | Google Fonts — **Inter** + **JetBrains Mono** |

---

## 3. Directory Layout

```
project-root/
│
├── main.py                  # FastAPI app factory + entry point
├── requirements.txt         # Python dependencies (incl. python-dotenv)
├── .env                     # Runtime config (NOT committed, always 403 via API)
├── .env.example             # Safe public template — commit this, not .env
├── ARCHITECTURE.md          # This file — full system reference for AI agents
├── metadata.json            # App identity / capability manifest
├── siuxsa.db                # SQLite database (auto-created on first run)
├── hosts                    # Custom DNS alias file (siuxsa -> 127.0.0.1)
├── bug_hunt/                # Scratch workspace for hunters
│
├── app/                     # Python application package
│   ├── __init__.py
│   ├── core/                # Shared infrastructure
│   │   ├── config.py        # Loads .env → exports PORT, HOST, DEBUG, CORS_ORIGINS,
│   │   │                    #   DB_PATH, SECRET_KEY, GEMINI_API_KEY, APP_URL,
│   │   │                    #   BLOCKED_FILENAMES, BLOCKED_SUFFIXES
│   │   ├── database.py      # SQLite connection, init, save/load state (uses DB_PATH from config)
│   │   ├── state.py         # Global mutable server state (CWD, processes, SSE queues)
│   │   └── sse.py           # broadcast_log() — persists to DB + pushes to SSE clients
│   ├── api/                 # FastAPI routers (one per domain)
│   │   ├── auth.py          # Login, logout, check, change-credentials
│   │   ├── logs.py          # Fetch logs, SSE stream, clear logs
│   │   ├── tools.py         # Tool registry CRUD + reorder
│   │   ├── pipes.py         # Saved pipeline CRUD
│   │   ├── filesystem.py    # File explorer, read, write, delete, sysinfo, serve
│   │   │                    #   ↳ _guard_sensitive() called on ALL endpoints (403 for .env etc.)
│   │   │                    #   ↳ _is_sensitive() silently hides blocked files from listings
│   │   │                    #   ↳ GET /api/fs/serve — inline by default, ?dl=1 for download
│   │   ├── environment.py   # CWD, shell, platform info
│   │   ├── app_state.py     # Arbitrary key/value UI state persistence
│   │   ├── processes.py     # List / stop running processes
│   │   ├── terminal.py      # Shell command execution + stdin injection
│   │   └── tasks.py         # Tool task execution (streaming output)
│   └── models/
│       └── schemas.py       # All Pydantic request body models
│
└── static/                  # Frontend (served as static files)
    ├── login.html           # Standalone login page (separate from dashboard)
    │                        #   ↳ Auto-redirects to / if already authenticated
    │                        #   ↳ On success: redirects to /
    ├── index.html           # Dashboard SPA shell (no login overlay)
    │                        #   ↳ Redirects to /login if not authenticated
    ├── css/
    │   ├── variables.css    # CSS custom properties + reset + body
    │   ├── layout.css       # Page layout, sidebar, canvas, explorer, editor panel
    │   └── components.css   # Buttons, modals, badges, viewer-footer, code viewer
    └── js/
        ├── state.js         # Global JS variables (single source of truth)
        ├── api.js           # fetch() wrapper + utilities (esc, rndId, replaceTarget)
        ├── app.js           # App init, tab switching, sidebar resize, event listeners
        └── ui/              # Domain-specific UI modules
            ├── auth.js      # Redirect-based auth (showLogin → /login redirect),
            │                #   logout, settings modal, credential change
            ├── tools.js     # Tool registry render, add/edit/delete, drag-reorder
            ├── tasks.js     # Workflow task list render, add/remove, drag-reorder
            ├── workflow.js  # Sequential/single task execution logic
            ├── pipes.js     # Saved pipeline save/load/delete, pipe modal
            ├── terminal.js  # Log render, SSE client (_sseSource + stopSSE()),
            │                #   running process list, terminal input
            ├── mission.js   # Mission Control modal — alternate drag/button reorder view
            ├── explorer.js  # Smart file viewer (image/video/audio/PDF/JSON/code/text),
            │                #   Prev/Next navigation, binary detection, edit mode
            ├── environment.js # CWD/shell display update
            └── output.js    # Task output modal (view, copy, download)
```

---

## 4. High-Level Architecture Diagram

```
+------------------------------------------------------------------+
|                      BROWSER                                      |
|                                                                   |
|  /login  → login.html (standalone, own CSS+JS)                   |
|       ↓ on success: window.location.replace('/')                  |
|  /     → index.html (dashboard SPA)                              |
|       ↓ on init: checkAuth() → redirect to /login if not authed  |
|                                                                   |
|  auth.js   tools.js   tasks.js   workflow.js   pipes.js           |
|  mission.js   explorer.js   terminal.js   output.js              |
|                          |                                        |
|                    api.js (fetch wrapper)                         |
|             state.js (global JS variables)                        |
|                          |              ^ SSE (EventSource)       |
|                          |              | _sseSource (closeable)  |
+--------------------------|---------------------------|-----------+
                           | HTTP/REST                 |
                           v                           |
+------------------------------------------------------------------+
|                 FastAPI (Python / Uvicorn)                         |
|                                                                   |
|  AuthMiddleware (Bearer token gate on /api/* except /api/auth/*)  |
|  → /login passes through (HTML page, no auth needed)             |
|                                                                   |
|  auth | logs | tools | pipes | filesystem | terminal | tasks      |
|  processes | environment | app_state                             |
|                    |                                              |
|  filesystem.py: _guard_sensitive() on every endpoint             |
|    .env / .env.* / *.pem / id_rsa / credentials.json → 403       |
|    directory listings: _is_sensitive() silently omits them        |
|                                                                   |
|  config.py: loads .env via python-dotenv                         |
|    PORT, HOST, DEBUG, CORS_ORIGINS, DB_PATH, SECRET_KEY          |
|                                                                   |
|  app/core/:  config | database | state | sse                     |
+--------------------------|--------------------------------------+
                           |
                       siuxsa.db (SQLite)
                       tables: auth, tools, saved_pipes,
                               logs, app_state
                           |
            OS Shell ------+  (asyncio subprocess -- bash/cmd)
            nmap, subfinder, nuclei, httpx, dirsearch, etc.
```

---

## 5. Backend — Entry Point (main.py)

### Startup lifecycle (`lifespan` context manager)
Runs **once on server start**, in order:
1. `init_db()` — creates all tables, seeds default tools if empty.
2. `init_auth_db()` — creates `auth` table, seeds default credentials, warms token cache.
3. `restore_env_state()` — loads previously saved `cwd` and `shell` from DB into memory.

### Configuration source
All runtime values come from `app.core.config` which reads `.env` via `python-dotenv`:
```python
from app.core.config import PORT, HOST, DEBUG, CORS_ORIGINS
```
No hardcoded ports, origins, or secrets remain in `main.py`.

### CORS
Origins list driven by `CORS_ORIGINS` environment variable (comma-separated). Defaults to `http://localhost:3000, http://127.0.0.1:3000, http://0.0.0.0:3000`.

### API Docs
Only exposed in debug mode: `docs_url="/api/docs" if DEBUG else None`.

### Router Registration Order
```
auth -> logs -> tools -> pipes -> filesystem -> app_state -> environment -> processes -> terminal -> tasks
```
All routers use prefix `/api`.

### AuthMiddleware (Starlette BaseHTTPMiddleware)

| Path pattern | Action |
|---|---|
| `/static/**` | Pass through — no auth |
| `/` | Pass through — no auth |
| `/login` | Pass through — no auth (serves login.html) |
| `/api/auth/**` | Pass through — no auth |
| Any other `/api/**` | Require `Authorization: Bearer <token>` header **or** `?token=<token>` query param |

### Route Definitions
```
GET  /          → serves static/index.html
GET  /login     → serves static/login.html
GET  /{path}    → SPA fallback → static/index.html (skips /api/* paths)
```

---

## 6. Backend — Core Layer (app/core/)

### config.py — Environment Configuration Hub
**The single authoritative source for all runtime settings.**

```python
from app.core.config import (
    PORT, HOST, DEBUG,
    CORS_ORIGINS,        # list[str]
    DB_PATH,             # str
    SECRET_KEY,          # str — random per-process if not set in .env
    GEMINI_API_KEY,      # str
    APP_URL,             # str
    BLOCKED_FILENAMES,   # frozenset[str] — used by filesystem guard
    BLOCKED_SUFFIXES,    # frozenset[str] — used by filesystem guard
)
```

Load priority (highest → lowest):
1. Real OS environment variables (Docker, systemd)
2. `.env` file values
3. Defaults in `config.py`

If `python-dotenv` is not installed, falls back to OS env only (graceful).

### database.py
- `get_db()` → opens SQLite connection with `check_same_thread=False`, `row_factory=sqlite3.Row`
- `init_db()` → creates tables + seeds default tool list
- Connections opened/closed per-request (no persistent pool)
- `DB_PATH` comes from `config.py` → reads from `.env`

### state.py
Global Python-level mutable state shared across all requests within one process:
```python
current_cwd: str               # Current working directory for shell commands
current_shell: str             # "bash" | "cmd" | etc.
running_processes: dict        # pid -> asyncio.Process
sse_queues: list               # List of asyncio.Queue for each connected SSE client
```

### sse.py
`broadcast_log(content, type, command)`:
1. Persists the log entry to the `logs` table in SQLite.
2. Puts the JSON-encoded entry into every queue in `state.sse_queues`.
3. SSE clients consume from their queue in the `/api/logs/stream` endpoint.

---

## 7. Backend — API Layer (app/api/)

### auth.py
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/login` | POST | None | Username + password → returns token |
| `/api/auth/logout` | POST | Bearer | Invalidates current token |
| `/api/auth/check` | GET | Bearer | Returns 200 if token valid |
| `/api/auth/change-credentials` | POST | Bearer | Updates username/password |

Token lifecycle:
- On login: SHA-256 of `username:password_hash` computed, stored in-memory cache.
- On logout: cache cleared.
- On check: in-memory comparison only (no DB read).
- On change-credentials: old token cleared, new one computed.

### filesystem.py — Security-First Design

#### Sensitive File Guard
**`_guard_sensitive(path)`** — called at the top of every endpoint before any filesystem operation.

```python
def _guard_sensitive(path: str | Path) -> None:
    p = Path(str(path))
    name   = p.name.lower()
    suffix = p.suffix.lower()
    blocked = (
        name in BLOCKED_FILENAMES    # exact match: .env, credentials.json, id_rsa, ...
        or name.startswith(".env")   # catches .env.local, .env.production, etc.
        or suffix in BLOCKED_SUFFIXES  # .pem, .key, .p12, .pfx, .pkcs12
    )
    if blocked:
        raise HTTPException(status_code=403, detail="Access denied.")
        # ↑ Generic body — no path/filename info leaked
```

**`_is_sensitive(name)`** — used in directory listings to silently omit blocked files. Callers never see `.env` in the file explorer UI.

#### Endpoints

| Endpoint | Method | Auth | Guard | Description |
|---|---|---|---|---|
| `/api/fs/list` | POST | Bearer | Listing-filter | List directory; sensitive files silently omitted |
| `/api/fs/read` | POST | Bearer | 403 | Read file content as UTF-8 text |
| `/api/fs/write` | POST | Bearer | 403 | Write text to file (creates parents) |
| `/api/fs/delete` | POST | Bearer | 403 | Delete file or directory recursively |
| `/api/fs/sysinfo` | GET | Bearer | None | OS, CPU, memory, hostname info |
| `/api/fs/serve` | GET | Bearer\* | 403 | Serve file binary inline or as download |

\* `/api/fs/serve` accepts `?token=` query param (required — browser media elements can't send headers).

#### `/api/fs/serve` — Inline vs Download
```
GET /api/fs/serve?path=<abs_path>         → Content-Disposition: inline  (browser renders)
GET /api/fs/serve?path=<abs_path>&dl=1    → Content-Disposition: attachment (browser saves)
```
MIME type auto-detected via Python's `mimetypes.guess_type()`.

### Other Routers

| File | Prefix | Key Endpoints |
|---|---|---|
| `logs.py` | `/api` | `GET /api/logs`, `GET /api/logs/stream` (SSE), `POST /api/logs/clear` |
| `tools.py` | `/api` | CRUD on `/api/tools`, reorder via `/api/tools/reorder` |
| `pipes.py` | `/api` | CRUD on `/api/pipes` |
| `terminal.py` | `/api` | `POST /api/terminal` (exec command), `POST /api/terminal/input` (stdin) |
| `tasks.py` | `/api` | `POST /api/tasks/run` (start tool execution with SSE streaming) |
| `environment.py` | `/api` | `GET /api/env`, `POST /api/env` (set CWD/shell) |
| `app_state.py` | `/api` | `GET /api/state`, `POST /api/state` (persist UI key-value pairs) |
| `processes.py` | `/api` | `GET /api/running-tools`, `POST /api/processes/stop` |

---

## 8. Backend — Models Layer (app/models/)

`schemas.py` — all Pydantic v2 request body models:

```python
class FsListBody   : path: str | None
class FsReadBody   : filePath: str
class FsWriteBody  : filePath: str, content: str | None
class FsDeleteBody : filePath: str
class LoginBody    : username: str, password: str
class ToolBody     : name, command, description, ...
class PipeBody     : name: str, tasks: list
class StateBody    : key: str, value: Any
```

---

## 9. Database Schema

```sql
-- Auth credentials (single-user system)
CREATE TABLE auth (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL,
    password_hash TEXT NOT NULL   -- SHA-256 hex digest
);

-- Tool registry
CREATE TABLE tools (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    command     TEXT NOT NULL,     -- {TARGET} placeholder replaced at runtime
    description TEXT,
    category    TEXT DEFAULT 'Custom',
    sort_order  INTEGER DEFAULT 0
);

-- Saved pipelines (sequences of tool IDs)
CREATE TABLE saved_pipes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL UNIQUE,
    tasks     TEXT NOT NULL        -- JSON array of task objects
);

-- Persistent log storage
CREATE TABLE logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    type      TEXT NOT NULL,       -- 'info' | 'error' | 'warn' | 'stdout' | 'stderr'
    content   TEXT NOT NULL,
    command   TEXT
);

-- Arbitrary UI state persistence (key-value)
CREATE TABLE app_state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL            -- JSON-encoded value
);
```

---

## 10. Authentication System

### Flow
```
1. POST /api/auth/login { username, password }
      ↓
2. SHA-256(password) → compare with stored hash in auth table
      ↓
3. If match: generate token = SHA-256(username:password_hash)
             store in in-memory cache
             return { token }
      ↓
4. Client stores token in localStorage ('siuxsa_token')

5. All subsequent API calls:
      Authorization: Bearer <token>   (standard requests)
      ?token=<token>                  (SSE / media elements)

6. AuthMiddleware compares token to cached value — pure memory, no DB

7. POST /api/auth/logout → clears in-memory cache
   Client: localStorage.removeItem('siuxsa_token')
           window.location.replace('/login')
```

### Security properties
- Token invalidated on logout (in-memory cache cleared)
- Token invalidated on credential change (new token computed)
- Single-user system — one active token at a time
- No JWT, no expiry by time — session ends on explicit logout or server restart

---

## 11. Server-Sent Events (SSE) Pipeline

### Server side (logs.py + sse.py + state.py)
```
Tool execution / terminal command produces output
         ↓
broadcast_log(content, type, command)      [sse.py]
         ↓
  1. INSERT INTO logs (timestamp, type, content, command)
  2. For each queue in state.sse_queues:
         queue.put_nowait(json_payload)
         ↓
GET /api/logs/stream                       [logs.py]
  - Creates asyncio.Queue, appends to state.sse_queues
  - async generator: yield from queue forever
  - On client disconnect: removes queue from list
  - Auth via ?token= query param
```

### Client side (terminal.js)
```javascript
// Module-level reference — closeable on logout
let _sseSource = null;

function startSSE() {
    if (_sseSource) { _sseSource.close(); }
    const es = new EventSource('/api/logs/stream?token=...');
    _sseSource = es;
    es.onmessage = e => { /* parse JSON, push to logs[], renderLogs() */ };
}

function stopSSE() {
    // Called before logout/navigation to prevent stream blocking page unload
    if (_sseSource) { _sseSource.close(); _sseSource = null; sseConnected = false; }
}
```

**Critical**: `_sseSource` must be stored at module level (not local to `startSSE`) so that `stopSSE()` can close it. If not closed before `window.location.replace('/login')`, the browser may stall the navigation because the open stream holds the connection.

---

## 12. Process Execution Model

```
POST /api/tasks/run { toolId, target }
         ↓
  1. Load tool from DB by toolId
  2. Replace {TARGET} in command with target string
  3. asyncio.create_subprocess_exec(shell command, stdout=PIPE, stderr=PIPE)
  4. Store process in state.running_processes[pid]
  5. Two async tasks:
       a. Read stdout lines → broadcast_log(line, 'stdout', command)
       b. Read stderr lines → broadcast_log(line, 'stderr', command)
  6. On process exit: remove from state.running_processes
         ↓
  All output flows through SSE to browser in real-time
```

```
POST /api/terminal { command }
         ↓
  subprocess.run(command, shell=True, cwd=current_cwd)
  stdout/stderr captured → broadcast_log() → SSE → browser
```

---

## 13. Frontend — Overview

The frontend is **two separate HTML pages**:

| Page | URL | File | Auth required |
|---|---|---|---|
| Login | `/login` | `static/login.html` | No — redirects to `/` if already logged in |
| Dashboard | `/` | `static/index.html` | Yes — redirects to `/login` if not authenticated |

**No login overlay / popup exists on the dashboard anymore.** Authentication is enforced by a page-level redirect, not a DOM element toggle. This prevents any flash of dashboard content to unauthenticated users.

The dashboard is a **single-page application (SPA)**. All content switching happens by showing/hiding `#canvas-view` and `#explorer-view` divs.

---

## 14. Frontend — Global State (state.js)

All mutable JS state is declared here. No module exports — everything is global (intentional, simple SPA architecture).

```javascript
let target = '';               // Current target asset (IP, domain)
let tasks = [];                // Workflow task list [{id, toolId, name, command}]
let tools = [];                // Full tool registry from API
let logs = [];                 // Log entries [{timestamp, message, level, ...}]
let runningTools = [];         // Currently executing processes
let explorerItems = [];        // Files in current explorer directory
let currentEnv = {};           // {cwd, shell, platform}
let isExecuting = false;       // True while pipeline is running
let isInitialLoad = true;      // Suppresses auto-save during first data fetch
let sseConnected = false;      // True when SSE stream is open

// File navigation state (managed by explorer.js)
let _navFiles = [];            // Files-only list in current directory
let _navIdx = -1;              // Index of currently open file
```

---

## 15. Frontend — API Client (api.js)

```javascript
async function api(method, url, body) {
    const token = localStorage.getItem('siuxsa_token') || '';
    const opts = {
        method,
        headers: { 'Authorization': 'Bearer ' + token }
    };
    if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    const r = await fetch(url, opts);
    if (r.status === 401) { showLogin(); return {}; }
    return r.json().catch(() => ({}));
}
```

Key utilities:
- `esc(str)` — HTML-escapes `&`, `<`, `>`, `"` — used in every innerHTML template
- `rndId()` — random 8-char ID for task items
- `replaceTarget(cmd, target)` — substitutes `{TARGET}` in tool commands

---

## 16. Frontend — App Bootstrap (app.js)

```javascript
async function init() {
    const authed = await checkAuth();  // redirects to /login if not authed
    if (!authed) return;
    await Promise.all([fetchState(), fetchTools(), fetchPipes(), fetchEnv(), fetchLogs()]);
    isInitialLoad = false;
    startSSE();                        // opens EventSource, stores in _sseSource
    setInterval(fetchRunningTools, 3000);
}
init();  // called immediately on dashboard load
```

---

## 17. Frontend — UI Modules (static/js/ui/)

### auth.js — Redirect-Based Auth

**No overlay divs.** All auth transitions are full page navigations.

```javascript
function showLogin()    → window.location.replace('/login')
function handleLogout() → stopSSE() + fetch logout API (sendBeacon) + window.location.replace('/login')
async function checkAuth() → fetch /api/auth/check
                             → if invalid: localStorage.removeItem + showLogin()
                             → if valid: return true
```

Settings modal (`showSettings`, `closeSettings`, `handleChangeCredentials`) — still rendered on the dashboard. Credential change triggers logout redirect.

### terminal.js — Logs + SSE

```javascript
let _sseSource = null;   // module-level so stopSSE() can close it

function startSSE()  { /* creates EventSource, assigns _sseSource */ }
function stopSSE()   { _sseSource.close(); _sseSource = null; sseConnected = false; }
function fetchLogs() { /* GET /api/logs, renders log list */ }
function renderLogs(){ /* writes log entries to #log-list DOM */ }
function addLog(msg, level) { /* pushes to logs[], calls renderLogs() */ }
```

### Other modules (unchanged from original)

| Module | Responsibility |
|---|---|
| `tools.js` | Render tool registry, CRUD, drag-and-drop reorder |
| `tasks.js` | Render workflow task list, add/remove, drag-reorder |
| `workflow.js` | Sequential + single task execution, progress tracking |
| `pipes.js` | Save/load/delete pipelines, pipe modal |
| `mission.js` | Mission Control modal — alternate pipeline editor |
| `environment.js` | Display CWD + shell in header |
| `output.js` | Task output modal — view stdout, copy, download |

---

## 18. Frontend — File Viewer System (explorer.js)

The file explorer opens files in a right-side viewer panel. Every file type has a dedicated viewer.

### File Kind Detection

```javascript
const FILE_TYPES = {
    image : ['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff','avif','heic',...],
    video : ['mp4','webm','ogv','avi','mov','mkv','flv','wmv','3gp','m4v','ts'],
    audio : ['mp3','wav','ogg','oga','flac','aac','m4a','opus','weba','wma'],
    pdf   : ['pdf'],
    json  : ['json','jsonl','geojson','json5'],
    code  : ['js','ts','py','rb','go','rs','java','c','cpp','html','css','sql','md',...],
    text  : ['txt','log','csv','tsv','diff','patch'],
};
// Unknown extension → binary fallback viewer
```

### Viewer Types

| Kind | Viewer | Editable |
|---|---|---|
| `image` | `<img>` inline, click to 2× zoom, download button | No |
| `video` | `<video controls autoplay>` native player | No |
| `audio` | `<audio controls>` with styled icon header | No |
| `pdf` | `<iframe src="/api/fs/serve?path=...">` inline PDF + download button | No |
| `json` | Syntax-highlighted `<pre>` (keys=cyan, strings=green, numbers=purple) + Edit toggle | Yes |
| `code` | Line numbers + syntax highlighted `<pre>` + Edit Mode toggle | Yes |
| `text` | Editable `<textarea>` + Save button | Yes |
| `unknown`| Binary download-only view | No |

### Serve URL Pattern

```javascript
function _serveUrl(path, forceDownload = false) {
    const token = localStorage.getItem('siuxsa_token') || '';
    let url = '/api/fs/serve?path=' + encodeURIComponent(path)
            + '&token=' + encodeURIComponent(token);
    if (forceDownload) url += '&dl=1';
    return url;
}
// Inline URLs (no &dl=1) → Content-Disposition: inline → browser renders
// Download URLs (&dl=1)  → Content-Disposition: attachment → browser saves
```

### Binary / Large File Guard

```javascript
const TEXT_SIZE_LIMIT   = 512 * 1024;  // 512 KB — truncate before rendering
const BINARY_RATIO_LIMIT = 0.04;        // 4% garbage chars → treat as binary

async function _readTextFile(path) {
    // 1. Fetch via /api/fs/read
    // 2. Truncate to TEXT_SIZE_LIMIT (show amber warning banner if truncated)
    // 3. Sample first 4096 chars for \ufffd (replacement) + \u0000 (null) chars
    // 4. If ratio > 4% → return { binary: true } → show download-only view
    // 5. Otherwise → return { content, truncated }
}
```

### Code Editor Mode Layout

The code viewer uses a **flex-column with sibling panels** — ensures View and Edit modes occupy identical space:

```
#viewer-body (flex column)
  ├── Toolbar (flex-shrink:0 — always visible)
  ├── #code-view-panel (flex:1, overflow:auto) — View mode
  │     ├── #ln-numbers (line number column)
  │     └── #viewer-code (<pre> with syntax highlight)
  └── #code-edit-area (<textarea>, display:none in view mode) — Edit mode
      flex:1 — same slot as view panel, toggled exclusively
```

`_toggleCodeEdit()` shows one, hides the other. Both fill `flex:1` identically.

### Prev / Next File Navigation

```javascript
let _navFiles = [];  // explorerItems filtered to files only (no directories)
let _navIdx   = -1;  // index of currently open file

// Called on every openFile(path):
function _updateNavState(path) {
    _navFiles = explorerItems.filter(i => i.type !== 'directory');
    _navIdx   = _navFiles.findIndex(i => i.path === path);
    _updateNavButtons(); // updates disabled state + "3 / 12" counter
}

function openPrevFile() { openFile(_navFiles[_navIdx - 1].path); }
function openNextFile()  { openFile(_navFiles[_navIdx + 1].path); }
```

Navigation buttons live in the editor topbar: `[ < Prev ]  3 / 12  [ Next > ]`.

---

## 19. Frontend — Auth Flow (login vs dashboard)

### login.html — Standalone Page

- Has its own self-contained CSS (no shared stylesheet dependency).
- On load: immediately checks `localStorage.siuxsa_token` → if present, calls `/api/auth/check` → if valid, `window.location.replace('/')`.
- Form submit: POST `/api/auth/login` → if token received, store + `window.location.replace('/')`.
- Password field cleared on failed attempt.
- No dependency on any JS from `static/js/`.

### index.html — Dashboard

- **No login overlay div** — it was removed entirely.
- `#app` div has no `filter:blur()` — it loads clean.
- `init()` in `app.js` calls `checkAuth()` first — if not authenticated, `window.location.replace('/login')` fires before any data loads.

### Auth State Machine

```
┌──────────────────────────────────────────────────────────────┐
│                        /login page                            │
│  Load: check token valid?                                     │
│    YES → redirect to /  (already logged in)                   │
│    NO  → show form                                            │
│  Submit: POST /api/auth/login                                 │
│    OK  → store token → redirect to /                          │
│    FAIL → show error, clear password                          │
└──────────────────────────────────────────────────────────────┘
                         ↕ redirect only
┌──────────────────────────────────────────────────────────────┐
│                       / dashboard                             │
│  Load: checkAuth()                                            │
│    PASS → load all data, start SSE                            │
│    FAIL → window.location.replace('/login')                   │
│  API 401 at any time → showLogin() → redirect to /login      │
│  Logout clicked:                                              │
│    stopSSE() → POST /api/auth/logout → clear token           │
│    → window.location.replace('/login')                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 20. Frontend — CSS Design System

Three files, loaded in order:

### variables.css
- All CSS custom properties (colors, spacing)
- Full `*` reset
- `body` base styles

```css
--bg1    : #090d13   /* darkest — page background */
--bg2    : #0f1520   /* panels */
--bg3    : #151d2e   /* inputs, code viewers */
--border : rgba(255,255,255,.08)
--cyan   : #06b6d4
--red    : #ef4444
--emerald: #10b981
--amber  : #f59e0b
--slate-4 through --slate-7  /* graded text colors */
```

### layout.css
- Header, sidebar, main canvas, explorer split-pane layout
- `.editor-panel` — right panel of the file explorer
- `.editor-topbar` — topbar with file name + navigation buttons
- `.editor-placeholder` — shown when no file is open
- `#viewer-body` — dynamic content injection point for all file viewers

### components.css
- Buttons: `.btn-primary`, `.btn-ghost`
- Badges, inputs, modals
- `.viewer-footer` — pinned footer bar shown in every file viewer type
- `#viewer-code`, `#line-numbers` — code viewer typography helpers

---

## 21. Complete API Reference

| Method | Path | Auth | Body / Params | Response |
|---|---|---|---|---|
| POST | `/api/auth/login` | No | `{username, password}` | `{token}` |
| POST | `/api/auth/logout` | Bearer | — | `{success}` |
| GET | `/api/auth/check` | Bearer | — | `{valid: true}` |
| POST | `/api/auth/change-credentials` | Bearer | `{currentPassword, newUsername?, newPassword?}` | `{success}` |
| GET | `/api/logs` | Bearer | — | `[{id,timestamp,type,content,command}]` |
| GET | `/api/logs/stream` | `?token=` | — | SSE stream of log events |
| POST | `/api/logs/clear` | Bearer | — | `{success}` |
| GET | `/api/tools` | Bearer | — | `[tool]` |
| POST | `/api/tools` | Bearer | tool object | `{id}` |
| PUT | `/api/tools/{id}` | Bearer | tool object | `{success}` |
| DELETE | `/api/tools/{id}` | Bearer | — | `{success}` |
| POST | `/api/tools/reorder` | Bearer | `{ids:[]}` | `{success}` |
| GET | `/api/pipes` | Bearer | — | `[pipe]` |
| POST | `/api/pipes` | Bearer | `{name, tasks}` | `{id}` |
| DELETE | `/api/pipes/{id}` | Bearer | — | `{success}` |
| POST | `/api/fs/list` | Bearer | `{path}` | `{currentPath, items[]}` |
| POST | `/api/fs/read` | Bearer | `{filePath}` | `{content, size, modified}` — 403 for .env |
| POST | `/api/fs/write` | Bearer | `{filePath, content}` | `{success}` — 403 for .env |
| POST | `/api/fs/delete` | Bearer | `{filePath}` | `{success}` — 403 for .env |
| GET | `/api/fs/sysinfo` | Bearer | — | OS/CPU/memory info |
| GET | `/api/fs/serve` | `?token=` | `?path=&dl=0\|1` | Binary file — 403 for .env |
| GET | `/api/env` | Bearer | — | `{cwd, shell, platform}` |
| POST | `/api/env` | Bearer | `{cwd?, shell?}` | `{success}` |
| GET | `/api/state` | Bearer | — | `{target, tasks}` |
| POST | `/api/state` | Bearer | `{key, value}` | `{success}` |
| GET | `/api/running-tools` | Bearer | — | `[{pid, command, ...}]` |
| POST | `/api/processes/stop` | Bearer | `{pid}` | `{success}` |
| POST | `/api/terminal` | Bearer | `{command}` | `{stdout, stderr, cwd}` |
| POST | `/api/terminal/input` | Bearer | `{pid, text}` | `{success}` |
| POST | `/api/tasks/run` | Bearer | `{toolId, target}` | SSE-streamed task output |

---

## 22. Data Flow — Workflow Execution

```
User clicks "Launch" in dashboard
    ↓
workflow.js: launchPipeline()
    ↓
For each task in tasks[]:
    POST /api/tasks/run { toolId, target }
         ↓
    tasks.py: load tool from DB, replace {TARGET}
         ↓
    asyncio.create_subprocess_exec(...)
         ↓
    stdout/stderr → broadcast_log() → sse.py
         ↓
    SSE → browser → terminal.js.onmessage → logs[] → renderLogs()
         ↓
    Task complete: POST next task or mark pipeline done
         ↓
    isExecuting = false, updateLaunchBtn()
```

---

## 23. Data Flow — Real-Time Logging

```
Any server event (tool output, terminal, system message)
    ↓
broadcast_log(content, type, command)           [sse.py]
    ↓
    ├── INSERT INTO logs                         [SQLite]
    └── queue.put_nowait(json_event)
             ↓
        /api/logs/stream (async generator)       [logs.py]
             ↓
        yield "data: {...}\n\n"                  [SSE protocol]
             ↓
        Browser EventSource.onmessage            [terminal.js]
             ↓
        logs.push(entry)
        renderLogs() → update #log-list DOM
```

---

## 24. Environment Configuration (.env)

The `.env` file in the project root controls all runtime behaviour. It is loaded by `app/core/config.py` at import time via `python-dotenv`.

### Variables

| Variable | Default | Description |
|---|---|---|
| `APP_PORT` | `3000` | Uvicorn listen port |
| `APP_HOST` | `0.0.0.0` | Uvicorn bind address |
| `CORS_ORIGINS` | `http://localhost:3000,...` | Comma-separated allowed origins |
| `DB_PATH` | `siuxsa.db` | SQLite file path (relative to project root) |
| `SECRET_KEY` | random | Used for internal signing. Falls back to random-per-process if not set (tokens won't survive restart) |
| `GEMINI_API_KEY` | `` | Optional AI integration key |
| `APP_URL` | `http://localhost:3000` | Public-facing URL |
| `DEBUG` | `false` | `true` = Uvicorn reload + verbose logs + API docs at `/api/docs` |

### `.env` vs `.env.example`
- `.env` — real secrets. **Never commit. Never serve.** API returns 403 for any request targeting it.
- `.env.example` — template with placeholder values. Safe to commit.

### Security guarantee
`_guard_sensitive()` blocks `.env`, `.env.*`, `.env.local`, `.env.production`, `.env.development`, etc. at every API endpoint. The directory listing filter removes `.env*` from the file explorer UI entirely. There is no path to read `.env` through the application — not through read, write, delete, or serve endpoints.

---

## 25. Security — Sensitive File Guard

### Blocked patterns (defined in `config.py`)

```python
BLOCKED_FILENAMES = frozenset({
    ".env", ".env.local", ".env.production", ".env.development",
    ".env.staging", ".env.test", ".env.example",
    "secrets.json", "secrets.yaml", "secrets.yml",
    "credentials", "credentials.json",
    ".htpasswd", ".netrc", ".pgpass",
    "id_rsa", "id_ed25519", "id_ecdsa", "id_dsa",
})

BLOCKED_SUFFIXES = frozenset({
    ".pem", ".key", ".p12", ".pfx", ".pkcs12",
})
```

### Guard logic (applied in filesystem.py)

```
Name match (exact, case-insensitive): BLOCKED_FILENAMES
  OR
Name starts with ".env" (catches all variants)
  OR
Suffix match (case-insensitive): BLOCKED_SUFFIXES
         ↓
HTTP 403  {"detail": "Access denied."}
  ↑
Intentionally generic — no path, no filename, no existence confirmation
```

### Coverage

| Endpoint | Blocked by |
|---|---|
| `POST /api/fs/read` | `_guard_sensitive()` → 403 |
| `POST /api/fs/write` | `_guard_sensitive()` → 403 |
| `POST /api/fs/delete` | `_guard_sensitive()` → 403 |
| `GET /api/fs/serve` | `_guard_sensitive()` → 403 |
| `POST /api/fs/list` | `_is_sensitive()` → silently omitted from results |

### Adding new patterns
Edit `BLOCKED_FILENAMES` or `BLOCKED_SUFFIXES` in `app/core/config.py`. All five endpoints are protected automatically — no other code changes needed.

---

## 26. Key Design Decisions and Constraints

| Decision | Rationale |
|---|---|
| Two separate HTML pages (login + dashboard) | Eliminates auth popup flash; prevents any dashboard content reaching unauthenticated users; cleaner browser history |
| Redirect-based auth (not overlay toggle) | `window.location.replace('/login')` — no Back button to blurred dashboard; clean slate |
| SSE stored in `_sseSource` at module level | Allows `stopSSE()` to close it before navigation. Open EventSource blocks page unload in some browsers |
| `navigator.sendBeacon` / fire-and-forget logout | Logout must not wait for server — redirect fires immediately |
| `.env` always 403, not 404 | Returning 404 leaks that the file doesn't exist at a given path. 403 reveals nothing |
| `.env*` files hidden from directory listing | Defense-in-depth — even if guard were bypassed at read, UI never shows the file exists |
| `_guard_sensitive()` on write + delete too | Prevents overwriting `.env` with attacker-controlled content |
| Inline serve by default, `?dl=1` for download | Browser `<img>`, `<video>`, `<audio>`, `<iframe>` need inline; user downloads need attachment header. Two distinct URL patterns |
| Binary detection in `_readTextFile()` | Prevents garbled output for binary files opened in text viewer. Samples first 4096 chars, 4% threshold |
| 512 KB text cap | Prevents browser DOM freeze on very large log files or generated output |
| Code editor as flex-sibling panel (not nested textarea) | View panel and edit textarea share the same `flex:1` slot — identical size in both modes |
| SQLite with `check_same_thread=False` | Simple, zero-dependency persistence. Connections open/close per-request — no pool needed at this scale |
| SHA-256 token from credentials | Fast, stateless validation. Single-user system makes rotation (logout/login) trivial |
| `python-dotenv` with graceful fallback | If not installed, falls back to OS env — doesn't crash |

---

## 27. Extension Points and How to Add Features

### Add a new API endpoint
1. Add a route function to the appropriate `app/api/*.py` file (or create a new file).
2. If new file: add `from app.api import your_module` and `app.include_router(your_module.router)` in `main.py`.
3. Add the Pydantic body model to `app/models/schemas.py` if needed.
4. Call `_guard_sensitive()` if the endpoint touches the filesystem.

### Add a new file type to the viewer
1. Add the extension to the appropriate list in `FILE_TYPES` in `explorer.js`.
2. If it needs a new viewer: add a `_renderXxxViewer()` function following the existing pattern.
3. Add the routing condition in `openFile()`.

### Add a new blocked filename pattern
Edit `BLOCKED_FILENAMES` or `BLOCKED_SUFFIXES` in `app/core/config.py`. All endpoints are automatically protected.

### Add a new environment variable
1. Add to `.env` and `.env.example`.
2. Add a `_get(...)` / `_get_int(...)` / `_get_bool(...)` call in `config.py`.
3. Import the new constant wherever needed.

### Add a new CORS origin
Edit `CORS_ORIGINS` in `.env`:
```
CORS_ORIGINS=http://localhost:3000,https://your-domain.com
```

### Change the port
```
APP_PORT=8080
```
in `.env`. No code changes needed.

### Enable debug mode
```
DEBUG=true
```
in `.env`. Enables: Uvicorn hot-reload, verbose logging, API docs at `/api/docs` and `/api/redoc`.
