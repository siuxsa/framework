// ═══════════════════════════════════════════════════════════════════════
//  SYSTEM STATUS MODAL — live process & pipeline monitor
// ═══════════════════════════════════════════════════════════════════════
let _statusTimer = null;

function showStatusModal() {
  document.getElementById('status-modal').classList.remove('hidden');
  renderStatus();
  fetchRunningTools().then(renderStatus);
  clearInterval(_statusTimer);
  _statusTimer = setInterval(async () => { await fetchRunningTools(); renderStatus(); }, 1000);
}
function closeStatusModal() {
  document.getElementById('status-modal').classList.add('hidden');
  clearInterval(_statusTimer);
  _statusTimer = null;
}

// Header chip reflects live state even while the modal is closed.
function updateSystemChip() {
  const dot = document.getElementById('system-status-dot');
  const txt = document.getElementById('system-status-text');
  if (!txt) return;
  const active = (typeof runningTools !== 'undefined' ? runningTools.length : 0);
  if (isExecuting || active > 0) {
    txt.textContent = active > 0 ? `${active} Running` : 'Executing';
    txt.style.color = 'var(--amber)';
    if (dot) dot.style.background = 'var(--amber)';
  } else {
    txt.textContent = 'System Nominal';
    txt.style.color = 'var(--emerald)';
    if (dot) dot.style.background = 'var(--emerald)';
  }
}

function _elapsed(iso) {
  if (!iso) return '—';
  const start = new Date(iso).getTime();
  if (isNaN(start)) return '—';
  let s = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const m = Math.floor(s / 60); s = s % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const _STATUS_META = {
  idle:      { c: 'var(--slate-6)', label: 'Idle' },
  running:   { c: 'var(--amber)',   label: 'Running' },
  completed: { c: 'var(--emerald)', label: 'Completed' },
  failed:    { c: 'var(--red)',     label: 'Failed' },
};

function _tile(label, value, color) {
  return `<div style="flex:1;min-width:120px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
    <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--slate-5);margin-bottom:4px;">${label}</div>
    <div style="font-size:20px;font-weight:900;font-family:'JetBrains Mono',monospace;color:${color||'#fff'};line-height:1;">${value}</div>
  </div>`;
}

function renderStatus() {
  updateSystemChip();
  const body = document.getElementById('status-body');
  if (!body || document.getElementById('status-modal').classList.contains('hidden')) return;

  const running   = tasks.filter(t => t.status === 'running').length;
  const done      = tasks.filter(t => t.status === 'completed').length;
  const failed    = tasks.filter(t => t.status === 'failed').length;
  const state     = isExecuting ? 'Executing' : (runningTools.length ? 'Running' : 'Idle');
  const stateCol  = (isExecuting || runningTools.length) ? 'var(--amber)' : 'var(--emerald)';
  const labels    = (typeof _groupLabels === 'function') ? _groupLabels() : {};

  document.getElementById('status-sub').textContent =
    `${runningTools.length} active process${runningTools.length === 1 ? '' : 'es'} · ${tasks.length} pipeline step${tasks.length === 1 ? '' : 's'}`;

  // ── Summary tiles ──
  let html = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
    ${_tile('State', state, stateCol)}
    ${_tile('Active Procs', runningTools.length, runningTools.length ? 'var(--amber)' : 'var(--slate-4)')}
    ${_tile('Completed', done, done ? 'var(--emerald)' : 'var(--slate-4)')}
    ${_tile('Failed', failed, failed ? 'var(--red)' : 'var(--slate-4)')}
    ${_tile('Registry', (typeof tools !== 'undefined' ? tools.length : 0), 'var(--cyan)')}
  </div>`;

  // ── Active processes ──
  html += `<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--slate-5);margin:0 0 8px;">Active Processes</div>`;
  if (runningTools.length === 0) {
    html += `<div style="padding:14px;border:1px dashed var(--slate-7);border-radius:10px;color:var(--slate-6);font-size:12px;text-align:center;margin-bottom:18px;">No processes running right now.</div>`;
  } else {
    html += `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:18px;">` +
      runningTools.map(rt => `
        <div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border:1px solid rgba(255,106,42,.2);border-radius:10px;padding:9px 12px;">
          <svg class="icon spin" width="13" height="13" viewBox="0 0 24 24" style="color:var(--amber);flex-shrink:0;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--amber);font-weight:700;flex-shrink:0;">PID ${rt.pid || '—'}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--slate-3);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(rt.command)}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--slate-5);flex-shrink:0;">${_elapsed(rt.startTime)}</span>
          <button class="task-btn" style="background:rgba(239,68,68,.12);color:var(--red);flex-shrink:0;" onclick="stopTool(${rt.id});setTimeout(()=>{fetchRunningTools().then(renderStatus)},200)">Terminate</button>
        </div>`).join('') + `</div>`;
  }

  // ── Pipeline steps ──
  html += `<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--slate-5);margin:0 0 8px;">Pipeline Steps</div>`;
  if (tasks.length === 0) {
    html += `<div style="padding:14px;border:1px dashed var(--slate-7);border-radius:10px;color:var(--slate-6);font-size:12px;text-align:center;margin-bottom:18px;">Pipeline is empty.</div>`;
  } else {
    html += `<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:18px;">` +
      tasks.map((t, i) => {
        const m = _STATUS_META[t.status] || _STATUS_META.idle;
        const grp = t.groupId ? `<span class="parallel-chip">⚡ ${labels[t.groupId] || 'P'}</span>` : '';
        return `<div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border:1px solid var(--border);border-radius:9px;padding:7px 12px;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--slate-6);width:22px;flex-shrink:0;">${String(i + 1).padStart(2, '0')}</span>
          <span style="width:8px;height:8px;border-radius:50%;background:${m.c};flex-shrink:0;"></span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:var(--cyan);flex-shrink:0;">${esc(t.toolName)}</span>
          ${grp}
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--slate-5);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.command)}</span>
          <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:${m.c};flex-shrink:0;">${m.label}</span>
        </div>`;
      }).join('') + `</div>`;
  }

  // ── Environment / session ──
  const env = (typeof currentEnv !== 'undefined') ? currentEnv : {};
  const row = (k, v) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid var(--border);">
    <span style="font-size:11px;color:var(--slate-5);">${k}</span>
    <span style="font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--slate-3);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%;">${esc(v)}</span>
  </div>`;
  html += `<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--slate-5);margin:0 0 6px;">Session</div>
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:6px 14px;">
      ${row('Target', (document.getElementById('target-input')?.value || target || '—') || '—')}
      ${row('User', `${env.user || '—'}@${env.host || '—'}`)}
      ${row('Working directory', env.cwd || '—')}
      ${row('Shell', env.shell || '—')}
      ${row('Platform', env.platform || '—')}
    </div>`;

  body.innerHTML = html;
}
