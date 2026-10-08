// ═══════════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════
async function init() {
  const authed = await checkAuth();
  if (!authed) return;
  await Promise.all([fetchState(), fetchFolders(), fetchTools(), fetchPipes(), fetchEnv(), fetchLogs()]);
  renderRegistry();
  isInitialLoad = false;
  startSSE();
  setInterval(fetchRunningTools, 3000);
}

// ═══════════════════════════════════════════════════════════════════════
//  STATE PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════
async function fetchState() {
  const state = await api('GET', '/api/state');
  if (state.target) {
    target = state.target;
    document.getElementById('target-input').value = target;
  }
  if (state.tasks) {
    tasks = state.tasks;
    renderTasks();
  }
}

function saveTargetDebounced() {
  target = document.getElementById('target-input').value;
  clearTimeout(saveTargetTimer);
  saveTargetTimer = setTimeout(() => {
    api('POST', '/api/state', { key: 'target', value: target });
    updateLaunchBtn();
  }, 400);
}

async function saveTasksState() {
  if (!isExecuting) await api('POST', '/api/state', { key: 'tasks', value: tasks });
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB SWITCHING
// ═══════════════════════════════════════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.getElementById('canvas-view').style.display   = tab==='canvas'   ? 'flex' : 'none';
  document.getElementById('explorer-view').style.display = tab==='explorer' ? 'flex' : 'none';
  if (tab==='explorer') { fetchExplorer(''); fetchSysInfo(); }
}

// ═══════════════════════════════════════════════════════════════════════
//  SIDEBAR RESIZE
// ═══════════════════════════════════════════════════════════════════════
(function setupResize() {
  const handle = document.getElementById('resize-handle');
  let resizing = false;
  handle.addEventListener('mousedown', e => { resizing=true; e.preventDefault(); handle.classList.add('resizing'); document.body.style.cursor='col-resize'; });
  document.addEventListener('mousemove', e => { if (!resizing) return; const z=(parseFloat(getComputedStyle(document.documentElement).zoom)||1); const w=e.clientX/z; if(w>240&&w<760){document.getElementById('sidebar').style.width=w+'px';} });
  document.addEventListener('mouseup',   () => { resizing=false; handle.classList.remove('resizing'); document.body.style.cursor=''; });
})();

// ═══════════════════════════════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════════════════════════════
function toggleSavePipe() {
  const el = document.getElementById('save-pipe-form');
  const open = el.style.maxHeight === '0px' || el.style.maxHeight === '';
  el.style.maxHeight = open ? '80px' : '0';
  el.style.opacity   = open ? '1' : '0';
  if (open) document.getElementById('pipe-name-input').focus();
}
function updateSavePipeBtn() {
  document.getElementById('save-pipe-toggle').disabled = tasks.length===0;
}
function updateLaunchBtn() {
  const btn = document.getElementById('launch-btn');
  const ok  = !isExecuting && target.trim().length>0 && tasks.length>0;
  btn.disabled = !ok;
  if (isExecuting) btn.innerHTML=`<svg class="icon spin" width="14" height="14" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Launch`;
  else             btn.innerHTML=`<svg class="icon" width="14" height="14" viewBox="0 0 24 24" style="fill:currentColor;stroke:none;"><path d="M5 3l14 9-14 9V3z"/></svg> Launch`;
  if (typeof updateSystemChip === 'function') updateSystemChip();
}
function updateTerminateBtn() {
  document.getElementById('terminate-all-btn').disabled = runningTools.length===0;
}

// ═══════════════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════
document.getElementById('output-modal').addEventListener('click', e=>{ if(e.target===e.currentTarget) closeOutputModal(); });
document.getElementById('pipe-modal').addEventListener('click',   e=>{ if(e.target===e.currentTarget) closePipeModal(); });
document.getElementById('mission-modal').addEventListener('click',e=>{ if(e.target===e.currentTarget) closeMissionModal(); });
document.getElementById('status-modal').addEventListener('click',e=>{ if(e.target===e.currentTarget) closeStatusModal(); });

document.addEventListener('keydown', e=>{
  if(e.key==='Escape') { closeOutputModal(); closePipeModal(); closeMissionModal(); closeStatusModal(); }
});

// Start!
init();
