// ═══════════════════════════════════════════════════════════════════════
//  TOOL REGISTRY  (+ folders for organisation)
// ═══════════════════════════════════════════════════════════════════════
async function fetchTools() {
  tools = await api('GET', '/api/tools');
  renderRegistry();
}
async function fetchFolders() {
  folders = (await api('GET', '/api/folders')) || [];
}

// ── View switching (All Tools / Folders) ───────────────────────────────
function switchRegistryView(view) {
  registryView = view;
  if (view === 'all') openFolderId = null;
  document.getElementById('reg-tab-all').classList.toggle('active', view === 'all');
  document.getElementById('reg-tab-folders').classList.toggle('active', view === 'folders');
  _closeForm('add-tool-form');
  _closeForm('add-folder-form');
  renderRegistry();
}

function _closeForm(id) {
  const f = document.getElementById(id);
  if (f) { f.classList.add('hidden'); f.classList.remove('visible'); }
}

// The header "+" is contextual: creates a folder in the Folders root, else a tool.
function registryAdd() {
  if (registryView === 'folders' && !openFolderId) toggleAddFolder();
  else toggleAddTool();
}
function toggleAddTool() {
  const f = document.getElementById('add-tool-form');
  f.classList.toggle('hidden'); f.classList.toggle('visible');
}
function toggleAddFolder() {
  const f = document.getElementById('add-folder-form');
  f.classList.toggle('hidden'); f.classList.toggle('visible');
  if (f.classList.contains('visible')) document.getElementById('new-folder-name').focus();
}

// ── Folder CRUD ────────────────────────────────────────────────────────
async function createFolder() {
  const el = document.getElementById('new-folder-name');
  const name = el.value.trim();
  if (!name) return;
  const f = await api('POST', '/api/folders', { name });
  if (f && f.id) {
    folders.push(f);
    el.value = '';
    toggleAddFolder();
    renderRegistry();
    addLog(`Folder created: ${name}`, 'info', 'system', 'System');
  }
}
async function deleteFolder(id, e) {
  if (e) e.stopPropagation();
  const f = folders.find(x => x.id === id);
  if (!confirm(`Delete folder "${f ? f.name : ''}"?\nTools inside it move back to All Tools.`)) return;
  await api('DELETE', `/api/folders/${id}`);
  folders = folders.filter(x => x.id !== id);
  tools.forEach(t => { if (t.folder_id === id) t.folder_id = null; });
  if (openFolderId === id) openFolderId = null;
  renderRegistry();
}
function openFolder(id) { openFolderId = id; renderRegistry(); }
function closeFolder() { openFolderId = null; renderRegistry(); }

async function moveToolToFolder(toolId, folderId) {
  const fid = folderId || null;
  await api('POST', `/api/tools/${toolId}/move`, { folderId: fid });
  const t = tools.find(x => x.id === toolId);
  if (t) t.folder_id = fid;
  await fetchFolders();
  renderRegistry();
}

// ── Rendering ──────────────────────────────────────────────────────────
function renderTools() { renderRegistry(); }   // alias kept for the search box

function renderRegistry() {
  const list = document.getElementById('tools-list');
  document.getElementById('stat-registry').textContent = tools.length;
  const q = (document.getElementById('tool-search').value || '').toLowerCase();

  // Folders root — show the folder list
  if (registryView === 'folders' && !openFolderId) {
    const filtered = folders.filter(f => f.name.toLowerCase().includes(q));
    if (filtered.length === 0) {
      list.innerHTML = `<div class="registry-empty">No folders yet — tap + to create one.</div>`;
      return;
    }
    list.innerHTML = filtered.map(f => `
      <div class="folder-item" onclick="openFolder('${f.id}')">
        <span class="folder-ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
        <span class="folder-name">${esc(f.name)}</span>
        <span class="folder-count">${f.toolCount || 0}</span>
        <span class="folder-del" title="Delete folder" onclick="deleteFolder('${f.id}',event)">
          <svg class="icon" width="13" height="13" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </span>
      </div>`).join('');
    return;
  }

  // Tool listing — either all tools, or the tools inside an open folder
  let scope = tools;
  let backHtml = '';
  if (registryView === 'folders' && openFolderId) {
    const f = folders.find(x => x.id === openFolderId);
    scope = tools.filter(t => t.folder_id === openFolderId);
    backHtml = `<div class="folder-back" onclick="closeFolder()">
      <svg class="icon" width="13" height="13" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      Folders / <span class="fb-name">${esc(f ? f.name : '')}</span>
    </div>`;
  }

  const filtered = scope.filter(t =>
    t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));

  list.innerHTML = backHtml;
  if (filtered.length === 0) {
    const msg = (registryView === 'folders' && openFolderId)
      ? 'This folder is empty. Edit a tool and pick this folder to add it here.'
      : 'No tools match your search';
    list.insertAdjacentHTML('beforeend', `<div class="registry-empty">${msg}</div>`);
    return;
  }
  filtered.forEach(tool => list.appendChild(makeToolItem(tool)));
}

function _folderOptions(selectedId) {
  return ['<option value="">— No folder —</option>']
    .concat(folders.map(f =>
      `<option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>${esc(f.name)}</option>`))
    .join('');
}

function makeToolItem(tool) {
  const div = document.createElement('div');
  div.className = 'tool-item';
  div.dataset.id = tool.id;
  div.draggable = true;

  div.innerHTML = `
    <div class="tool-drag-handle" title="Drag to reorder">
      <svg class="icon" width="14" height="14" viewBox="0 0 24 24"><circle cx="9" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="19" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="19" r="1" fill="currentColor" stroke="none"/></svg>
    </div>
    <div class="tool-body" id="tool-body-${tool.id}">
      <div id="tool-view-${tool.id}">
        <div class="tool-name">${esc(tool.name)}</div>
        <div class="tool-desc">${esc(tool.description||'')}</div>
      </div>
      <div id="tool-edit-${tool.id}" style="display:none;flex-direction:column;gap:6px;">
        <input type="text" id="edit-name-${tool.id}" value="${esc(tool.name)}" style="font-size:11px;font-weight:700;color:var(--cyan);" />
        <textarea id="edit-desc-${tool.id}" rows="2" style="font-size:10px;resize:none;" placeholder="Description">${esc(tool.description||'')}</textarea>
        <input type="text" id="edit-cmd-${tool.id}" value="${esc(tool.command||'')}" style="font-size:10px;font-family:'JetBrains Mono',monospace;" placeholder="Command" />
        <select id="edit-folder-${tool.id}" style="font-size:10px;padding:6px 8px;background:rgba(0,0,0,.4);border:1px solid var(--border);color:var(--slate-3);border-radius:8px;outline:none;">
          ${_folderOptions(tool.folder_id || '')}
        </select>
        <div style="display:flex;gap:6px;">
          <button class="btn-primary" style="flex:1;font-size:10px;padding:5px;" onclick="saveToolEdit('${tool.id}')">
            <svg class="icon" width="10" height="10" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Save
          </button>
          <button class="btn-ghost" style="padding:5px 10px;font-size:10px;" onclick="cancelToolEdit('${tool.id}')">
            <svg class="icon" width="10" height="10" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="tool-actions">
      <button class="tool-act-btn" onclick="toggleToolEdit('${tool.id}')" title="Edit / move to folder">
        <svg class="icon" width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
      </button>
      <button class="tool-act-btn del" onclick="deleteTool('${tool.id}')" title="Delete">
        <svg class="icon" width="14" height="14" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </div>
  `;

  // Click tool body to add task
  div.querySelector(`#tool-view-${tool.id}`).addEventListener('click', () => addTask(tool));

  // Drag reorder
  div.addEventListener('dragstart', e => { dragSrcIndex = tools.findIndex(t=>t.id===tool.id); dragSrcList='tools'; e.dataTransfer.effectAllowed='move'; div.classList.add('dragging'); });
  div.addEventListener('dragend',   () => div.classList.remove('dragging'));
  div.addEventListener('dragover',  e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; });
  div.addEventListener('drop',      e => { e.preventDefault(); handleToolDrop(tools.findIndex(t=>t.id===tool.id)); });

  return div;
}

function toggleToolEdit(id) {
  const view = document.getElementById(`tool-view-${id}`);
  const edit = document.getElementById(`tool-edit-${id}`);
  if (edit.style.display === 'none') { view.style.display='none'; edit.style.display='flex'; }
  else                               { view.style.display='block'; edit.style.display='none'; }
}
function cancelToolEdit(id) { toggleToolEdit(id); }

async function saveToolEdit(id) {
  const name = document.getElementById(`edit-name-${id}`).value;
  const desc = document.getElementById(`edit-desc-${id}`).value;
  const cmd  = document.getElementById(`edit-cmd-${id}`).value;
  const folderSel = document.getElementById(`edit-folder-${id}`);
  const newFolder = folderSel ? (folderSel.value || null) : undefined;

  await api('PATCH', `/api/tools/${id}`, { name, description: desc, command: cmd });

  const t = tools.find(x => x.id === id);
  if (newFolder !== undefined && t && (t.folder_id || null) !== (newFolder || null)) {
    await api('POST', `/api/tools/${id}/move`, { folderId: newFolder });
  }
  await fetchTools();
  await fetchFolders();
  renderRegistry();
}

async function deleteTool(id) {
  await api('DELETE', `/api/tools/${id}`);
  tools = tools.filter(t=>t.id!==id);
  await fetchFolders();
  renderRegistry();
}

async function addTool() {
  const name = document.getElementById('new-tool-name').value.trim();
  if (!name) return;
  const desc = document.getElementById('new-tool-desc').value.trim();
  const cmd  = document.getElementById('new-tool-cmd').value.trim();
  // If a folder is open, the new tool lands in it.
  const folder_id = (registryView === 'folders' && openFolderId) ? openFolderId : null;
  const t = await api('POST', '/api/tools', { name, description: desc, command: cmd, folder_id });
  tools.push(t);
  document.getElementById('new-tool-name').value = '';
  document.getElementById('new-tool-desc').value = '';
  document.getElementById('new-tool-cmd').value  = '';
  await fetchFolders();
  renderRegistry();
  toggleAddTool();
  addLog(`New tool added to registry: ${t.name}`, 'info', 'system', 'System');
}

// Tool drag/drop reorder (operates on the global order)
async function handleToolDrop(toIdx) {
  if (dragSrcIndex === null || dragSrcList !== 'tools' || dragSrcIndex === toIdx) return;
  const arr = [...tools];
  const [item] = arr.splice(dragSrcIndex, 1);
  arr.splice(toIdx, 0, item);
  tools = arr;
  renderRegistry();
  await api('POST', '/api/tools/reorder', { order: tools.map(t=>t.id) });
  dragSrcIndex = null;
}
