// ═══════════════════════════════════════════════════════════════════════
//  LOGS & SSE
// ═══════════════════════════════════════════════════════════════════════
async function fetchLogs() {
  const data = await api('GET', '/api/logs');
  logs = data.map(l=>{
    const isOutput = l.type === 'stdout' || l.type === 'stderr';
    return {
      timestamp: new Date(l.timestamp).toLocaleTimeString(),
      message: l.content,
      level: l.type === 'stderr' ? 'error' : 'info',
      taskId: 'persistent',
      toolName: (l.command||'').split(' ')[0]||'System',
      isOutput
    };
  });
  renderLogs();
}

function addLog(message, level='info', taskId='system', toolName='System', isOutput=false, isCmd=false) {
  logs.push({ timestamp: new Date().toLocaleTimeString(), message, level, taskId, toolName, isOutput, isCmd });
  if (logs.length > 200) logs.splice(0, logs.length - 200);
  renderLogs();
}

// ── ANSI → HTML: render real terminal colors, strip control sequences ───
const _ANSI_FG = {
  30:'#4b5057', 31:'#ff6b6b', 32:'#4ade80', 33:'#fbbf24', 34:'#60a5fa',
  35:'#c084fc', 36:'#22d3ee', 37:'#e6e7e5',
  90:'#8b929b', 91:'#ff8585', 92:'#86efac', 93:'#fde047', 94:'#93c5fd',
  95:'#d8b4fe', 96:'#67e8f9', 97:'#ffffff',
};
function ansiToHtml(input) {
  let str = String(input == null ? '' : input);
  // Strip OSC (window title etc.) and non-SGR CSI (cursor moves, clears)
  str = str.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
  str = str.replace(/\x1b\[[0-9;?]*[A-Za-ln-z]/g, '');   // CSI, all letters except 'm'
  str = str.replace(/\x1b[=>()#][0-9A-Za-z]?/g, '');
  str = str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''); // stray control chars
  let fg = null, bold = false, out = '';
  for (const tk of str.split(/(\x1b\[[0-9;]*m)/g)) {
    const m = tk.match(/^\x1b\[([0-9;]*)m$/);
    if (m) {
      for (const raw of (m[1] || '0').split(';')) {
        const c = raw === '' ? 0 : parseInt(raw, 10);
        if (c === 0) { fg = null; bold = false; }
        else if (c === 1) bold = true;
        else if (c === 22) bold = false;
        else if (c === 39) fg = null;
        else if (_ANSI_FG[c]) fg = _ANSI_FG[c];
      }
      continue;
    }
    if (!tk) continue;
    let style = '';
    if (fg) style += 'color:' + fg + ';';
    if (bold) style += 'font-weight:700;';
    out += style ? `<span style="${style}">${esc(tk)}</span>` : esc(tk);
  }
  return out;
}

// Coalesce rapid log updates (SSE can emit many lines per frame) into a
// single DOM write per animation frame instead of thrashing layout per line.
let _logRenderScheduled = false;
function renderLogs() {
  if (_logRenderScheduled) return;
  _logRenderScheduled = true;
  requestAnimationFrame(() => { _logRenderScheduled = false; _renderLogsNow(); });
}

function _renderLogsNow() {
  const el = document.getElementById('log-entries');
  if (!el) return;
  el.innerHTML = logs.map(l=>{
    // Command echo — styled like a shell prompt line
    if (l.isCmd) {
      return `<div class="terminal-cmd"><span class="tc-arrow">❯</span> <span class="tc-text">${esc(l.message)}</span></div>`;
    }
    // Tool / command output — render ANSI colors
    if (l.isOutput) {
      return `<div class="terminal-out ${l.level==='error'?'error':''}"><span class="tmsg">${ansiToHtml(l.message)}</span></div>`;
    }
    // Status / info line
    const lv = l.level==='error' ? 'error' : (l.level==='warn' ? 'warn' : '');
    return `
      <div class="terminal-log ${lv}">
        <span class="ts">${esc(l.timestamp)}</span>
        <span class="tname">${esc(l.toolName)}</span>
        <span class="tmsg">${esc(l.message)}</span>
      </div>
    `;
  }).join('') || '<div style="color:var(--slate-7);font-style:italic;margin-bottom:10px;">Terminal ready — type a command below. Try <span style="color:var(--cyan)">ls</span> or <span style="color:var(--cyan)">help</span>.</div>';

  // Auto-scroll to bottom (within the same frame — no extra timer)
  const body = document.getElementById('terminal-body');
  if (body) body.scrollTop = body.scrollHeight;
}

function clearLogs() {
  api('DELETE', '/api/logs');
  logs = [];
  renderLogs();
}

function startSSE() {
  const token = localStorage.getItem('cshunter_token') || '';
  const es = new EventSource('/api/logs/stream?token=' + encodeURIComponent(token));
  es.onopen = () => { sseConnected = true; };
  es.onmessage = e => {
    try {
      const l = JSON.parse(e.data);
      const isOutput = l.type === 'stdout' || l.type === 'stderr';
      logs.push({
        timestamp: new Date(l.timestamp).toLocaleTimeString(),
        message: l.content,
        level: l.type === 'stderr' ? 'error' : 'info',
        taskId: 'persistent',
        toolName: (l.command||'').split(' ')[0]||'System',
        isOutput
      });
      if (logs.length > 200) logs.splice(0, logs.length - 200);
      renderLogs();
    } catch{}
  };
  es.onerror = () => { sseConnected = false; };
}

// ═══════════════════════════════════════════════════════════════════════
//  RUNNING PROCESSES
// ═══════════════════════════════════════════════════════════════════════
async function fetchRunningTools() {
  runningTools = await api('GET', '/api/running-tools');
  renderRunningProcs();
  updateTerminateBtn();
  if (typeof updateSystemChip === 'function') updateSystemChip();
}

async function stopTool(id) {
  await api('POST', '/api/stop-tool', { id });
  fetchRunningTools();
}

async function stopAllTools() {
  await api('POST', '/api/stop-all');
  fetchRunningTools();
}

function renderRunningProcs() {
  const el = document.getElementById('running-procs');
  const chip = document.getElementById('running-chip');
  const cnt  = document.getElementById('running-count');
  if (runningTools.length === 0) { el.innerHTML=''; chip.style.display='none'; return; }
  chip.style.display = 'flex';
  cnt.textContent = `${runningTools.length} Active`;
  el.innerHTML = runningTools.map(rt=>`
    <div class="running-proc">
      <div class="running-proc-left">
        <svg class="icon spin" width="11" height="11" viewBox="0 0 24 24" style="color:var(--cyan);flex-shrink:0;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span style="color:var(--cyan);font-weight:700;font-size:11px;flex-shrink:0;">[PID: ${rt.pid||'...'}]</span>
        <span class="running-proc-cmd">${esc(rt.command)}</span>
      </div>
      <button class="terminate-btn" onclick="stopTool(${rt.id})">Terminate</button>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════════
//  TERMINAL
// ═══════════════════════════════════════════════════════════════════════
// ── Command history (persisted, arrow-key recall) ──────────────────────
const CMD_HISTORY_KEY = 'cshunter_cmd_history';
const CMD_HISTORY_MAX = 100;
let _cmdHistory = [];
let _cmdHistoryIdx = -1;   // -1 = "current line" (nothing selected)
let _cmdDraft = '';        // preserves a half-typed command while browsing

function _loadCmdHistory() {
  try { _cmdHistory = JSON.parse(localStorage.getItem(CMD_HISTORY_KEY)) || []; }
  catch { _cmdHistory = []; }
}
function _pushCmdHistory(cmd) {
  if (!cmd.trim()) return;
  // Skip if identical to the most recent entry
  if (_cmdHistory[_cmdHistory.length - 1] === cmd) return;
  _cmdHistory.push(cmd);
  if (_cmdHistory.length > CMD_HISTORY_MAX) _cmdHistory.splice(0, _cmdHistory.length - CMD_HISTORY_MAX);
  try { localStorage.setItem(CMD_HISTORY_KEY, JSON.stringify(_cmdHistory)); } catch {}
  _cmdHistoryIdx = -1;
}
function terminalHistoryKey(e) {
  const input = e.target;
  if (e.key === 'ArrowUp') {
    if (_cmdHistory.length === 0) return;
    e.preventDefault();
    if (_cmdHistoryIdx === -1) { _cmdDraft = input.value; _cmdHistoryIdx = _cmdHistory.length; }
    if (_cmdHistoryIdx > 0) _cmdHistoryIdx--;
    input.value = _cmdHistory[_cmdHistoryIdx] ?? '';
    input.setSelectionRange(input.value.length, input.value.length);
    updateGhost();
  } else if (e.key === 'ArrowDown') {
    if (_cmdHistoryIdx === -1) return;
    e.preventDefault();
    _cmdHistoryIdx++;
    if (_cmdHistoryIdx >= _cmdHistory.length) { _cmdHistoryIdx = -1; input.value = _cmdDraft; }
    else input.value = _cmdHistory[_cmdHistoryIdx];
    input.setSelectionRange(input.value.length, input.value.length);
    updateGhost();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    terminalComplete(input);
  } else if ((e.key === 'ArrowRight' || e.key === 'End') && _atEnd(input)) {
    if (acceptGhost(input)) e.preventDefault();
  }
}

// ── zsh-style inline autosuggestion (ghost text from history) ───────────
function _atEnd(input) {
  return input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
}
function _suggestFromHistory(val) {
  if (!val) return '';
  for (let i = _cmdHistory.length - 1; i >= 0; i--) {
    const h = _cmdHistory[i];
    if (h.length > val.length && h.startsWith(val)) return h.slice(val.length);
  }
  return '';
}
function updateGhost() {
  const input = document.getElementById('terminal-input');
  const ghost = document.getElementById('terminal-ghost');
  if (!input || !ghost) return;
  const val = input.value;
  const suffix = _atEnd(input) ? _suggestFromHistory(val) : '';
  if (!suffix) { ghost.innerHTML = ''; ghost.dataset.suffix = ''; return; }
  ghost.dataset.suffix = suffix;
  ghost.innerHTML =
    `<span style="visibility:hidden">${esc(val)}</span>` +
    `<span style="color:var(--slate-6)">${esc(suffix)}</span>`;
}
function acceptGhost(input) {
  const ghost = document.getElementById('terminal-ghost');
  const suffix = ghost ? (ghost.dataset.suffix || '') : '';
  if (!suffix) return false;
  input.value += suffix;
  input.setSelectionRange(input.value.length, input.value.length);
  updateGhost();
  return true;
}

// ── Tab completion (real commands + filesystem paths via backend) ───────
function _longestCommonPrefix(arr) {
  if (!arr.length) return '';
  let p = arr[0];
  for (const s of arr) {
    let i = 0;
    while (i < p.length && i < s.length && p[i] === s[i]) i++;
    p = p.slice(0, i);
    if (!p) break;
  }
  return p;
}
async function terminalComplete(input) {
  const line = input.value;
  const r = await api('POST', '/api/terminal/complete', { line });
  const matches = (r && r.matches) || [];
  const token = (r && r.token) || '';
  if (matches.length === 0) return;
  const head = line.slice(0, line.length - token.length);
  if (matches.length === 1) {
    const m = matches[0];
    input.value = head + m + (m.endsWith('/') ? '' : ' ');
  } else {
    const lcp = _longestCommonPrefix(matches);
    if (lcp.length > token.length) input.value = head + lcp;
    // Print the candidates like a real shell
    addLog(matches.join('    '), 'info', 'complete', 'tab', true);
  }
  input.setSelectionRange(input.value.length, input.value.length);
  updateGhost();
}

_loadCmdHistory();
(function wireTerminalHistory() {
  const input = document.getElementById('terminal-input');
  if (!input) return;
  input.addEventListener('keydown', terminalHistoryKey);
  input.addEventListener('input', updateGhost);
  input.addEventListener('click', updateGhost);
  input.addEventListener('blur', () => {
    const g = document.getElementById('terminal-ghost');
    if (g) { g.innerHTML = ''; g.dataset.suffix = ''; }
  });
  input.addEventListener('focus', updateGhost);
})();

async function terminalSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('terminal-input');
  const cmd = input.value;
  input.value = '';
  const _g = document.getElementById('terminal-ghost');
  if (_g) { _g.innerHTML = ''; _g.dataset.suffix = ''; }

  if (!cmd.trim()) return;
  _pushCmdHistory(cmd);
  addLog(cmd, 'info', 'system', cmd.split(' ')[0], false, true);   // styled echo

  if (cmd.trim() === 'clear') { clearLogs(); return; }

  const r = await api('POST', '/api/terminal', { command: cmd });
  if (r.output === 'CLEAR_SIGNAL') { clearLogs(); return; }

  // Show the full output as a single block without timestamps
  if (r.output && r.output.trim()) {
    addLog(r.output, r.error ? 'error' : 'info', 'terminal', cmd.split(' ')[0], true);
  } else if (!r.output && r.error) {
    addLog('Command returned no output.', 'warn', 'terminal', cmd.split(' ')[0], false);
  }

  if (r.shell) { document.getElementById('shell-label').textContent=r.shell; document.getElementById('shell-chip').style.display='flex'; }
  if (r.cwd)   { currentEnv.cwd=r.cwd; updateEnvDisplay(); }
}

// Click anywhere in the terminal to focus the input (real-terminal feel)
(function focusOnClick() {
  const body = document.getElementById('terminal-body');
  if (!body) return;
  body.addEventListener('mousedown', e => {
    // don't steal focus when the user is selecting text or clicking a button
    if (e.target.closest('button') || window.getSelection().toString()) return;
    const input = document.getElementById('terminal-input');
    if (input) setTimeout(() => input.focus(), 0);
  });
})();
