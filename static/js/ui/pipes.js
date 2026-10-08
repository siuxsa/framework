// ═══════════════════════════════════════════════════════════════════════
//  PIPES
// ═══════════════════════════════════════════════════════════════════════
async function fetchPipes() {
  savedPipes = await api('GET', '/api/pipes');
}

async function savePipe() {
  const name = document.getElementById('pipe-name-input').value.trim();
  if (!name || tasks.length === 0) return;
  const sanitized = tasks.map(t=>({...t, status:'idle', output:'', error:false}));
  const p = await api('POST', '/api/pipes', {name, tools: sanitized});
  savedPipes.unshift(p);
  document.getElementById('pipe-name-input').value='';
  toggleSavePipe();
  addLog(`Pipe saved: ${name}`, 'info');
}

function loadPipe(pipe) {
  if (tasks.length > 0 && !confirm('Overwrite current workflow with this pipe?')) return;
  tasks = pipe.tools.map(t=>({...t, status:'idle', output:'', error:false}));
  renderTasks();
  saveTasksState();
  addLog(`Loaded pipe: ${pipe.name}`, 'info');
}

async function deletePipe(id, e) {
  e.stopPropagation();
  await api('DELETE', `/api/pipes/${id}`);
  savedPipes = savedPipes.filter(p=>p.id!==id);
  renderPipeList();
  addLog('Saved pipe deleted', 'info');
}

function showPipeModal() {
  fetchPipes().then(renderPipeList);
  document.getElementById('pipe-modal').classList.remove('hidden');
}
function closePipeModal() { document.getElementById('pipe-modal').classList.add('hidden'); }

function renderPipeList() {
  const el = document.getElementById('pipe-list');
  if (savedPipes.length === 0) {
    el.innerHTML=`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;">
      <div style="width:64px;height:64px;border:2px dashed var(--slate-7);border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;opacity:.5;">
        <svg class="icon" width="28" height="28" viewBox="0 0 24 24" style="color:var(--slate-5);"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </div>
      <h3 style="font-size:15px;font-weight:700;color:#fff;margin-bottom:8px;">No Pipelines Saved</h3>
      <p style="font-size:12px;color:var(--slate-5);max-width:280px;">Create a workflow in the Pipeline Designer, then save it here for quick reuse across sessions.</p>
    </div>`;
    return;
  }
  el.innerHTML = savedPipes.map(p => {
    const toolChain = p.tools.map(t =>
      `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(255,106,42,.08);border:1px solid rgba(255,106,42,.15);border-radius:5px;font-size:10px;color:var(--cyan);font-weight:600;white-space:nowrap;">${esc(t.toolName)}</span>`
    ).join('<span style="color:var(--slate-6);font-size:10px;margin:0 2px;">→</span>');
    return `
    <div class="pipe-item" onclick="loadPipe_modal('${p.id}')">
      <div class="pipe-icon"><span>${p.tools.length}</span><span>Nodes</span></div>
      <div class="pipe-info">
        <div class="pipe-name">${esc(p.name)}</div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:8px;">${toolChain}</div>
      </div>
      <div class="pipe-actions">
        <button class="btn-primary" style="font-size:9px;padding:6px 14px;" onclick="loadPipe_modal('${p.id}');event.stopPropagation();">Apply</button>
        <button class="modal-close" style="width:30px;height:30px;" onclick="deletePipe('${p.id}',event)">
          <svg class="icon" width="14" height="14" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}
function loadPipe_modal(id) {
  const p = savedPipes.find(x=>x.id===id);
  if (!p) return;
  loadPipe(p);
  closePipeModal();
}
