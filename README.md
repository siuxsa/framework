# CSHUNTER

**CSHUNTER** is a high-performance orchestration console for building, managing, and executing automated command pipelines — purpose-built for bug-bounty and security reconnaissance workflows. It bridges high-level pipeline design with low-level system execution, with a reactive real-time interface, a virtual host explorer, and an interactive terminal.

## 🚀 Key Features

- **Pipeline Designer** — Chain multiple command-line tools into a single execution sequence, with drag-and-drop reordering.
- **Mission Control (CSHUNTER Strategist)** — Dedicated orchestration layer for reordering steps and triggering independent tool runs.
- **Dynamic Tool Registry** — Add, edit, and persist a custom tool library backed by SQLite. Use `$target` as the placeholder in commands (e.g. `nmap -sV $target`).
- **Pipe Library** — Save and reload whole workflows across sessions.
- **Virtual Host Explorer** — Browse the host filesystem, view 40+ file types (images, video, audio, PDF, code, text), and edit files inline. Sensitive files (`.env`, private keys, etc.) are blocked server-side.
- **Interactive Terminal** — Live streaming logs over SSE, plus a real shell with **command history** (↑/↓ recall, persisted).
- **Export Session Report** — One click compiles every pipeline unit's command, status, and output into a downloadable Markdown report.
- **Persistent State** — Target, tasks, CWD, and shell preference survive restarts.

## 🛠 Tech Stack

- **Backend:** Python, FastAPI, Uvicorn.
- **Frontend:** Vanilla JS (no build step), CSS custom properties.
- **Database:** SQLite (WAL mode).
- **Streaming:** Server-Sent Events (SSE).

## 🎨 Theme

Dark-slate palette with an orange accent:

| Token | Hex |
| --- | --- |
| Base surface | `#1A1C1F` |
| Elevated slate | `#3A3F45` |
| Muted grey | `#6E7781` |
| Accent | `#FF6A2A` |
| Text | `#F2F2F0` |

## 📥 Installation

### Prerequisites

- **Python 3.11+**
- **WSL (optional, recommended on Windows)** for full tool compatibility.

### Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment** (optional — sensible defaults apply):
   Copy `.env.example` to `.env` and adjust `APP_PORT`, `APP_HOST`, `SECRET_KEY`, `CORS_ORIGINS`, etc.

3. **Run**:
   ```bash
   python main.py
   ```
   Then open `http://localhost:3000` (or your configured `APP_PORT`).

### Default credentials

Fresh installs seed the login with `siuxsa` / `siuxsa`. Change them from **Settings** after first login. (Existing databases keep whatever credentials were already set.)

## 🎮 How to Use

1. **Configure Registry** — Add tools in the left sidebar. Use `$target` where the target should be substituted.
2. **Build Sequence** — Click tools to add them to the Active Pipeline.
3. **Set Target** — Enter the domain, IP, or path in the central "Target Asset" field.
4. **Reorder** — Open Mission Control (gear-orbit icon) to drag steps or run tools independently.
5. **Launch** — Hit **Launch** to run the sequence.
6. **Review & Export** — Click any completed step to view output, or use **Export Report** to save the full session as Markdown.

## ⚖️ License

MIT © CSHUNTER
