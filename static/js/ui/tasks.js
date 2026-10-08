// ═══════════════════════════════════════════════════════════════════════
//  TASKS
// ═══════════════════════════════════════════════════════════════════════
function addTask(tool) {
  const task = { id: rndId(), toolId: tool.id, toolName: tool.name, command: tool.command, status: 'idle', output: '', groupId: null };
  tasks.push(task);
  renderTasks();
  saveTasksState();
  addLog(`Added to workflow`, 'info', task.id, tool.name);
}

// ── Parallel groups (explicit, selection-based) ─────────────────────────
// Tasks sharing a groupId run at the same time. Build ordered execution
// batches: a group runs (in parallel) at the position of its first member;
// its other members are folded into that same batch.
function _taskGroups() {
  const groups = [];
  const startedAt = {};
  tasks.forEach((t, i) => {
    if (t.groupId) {
      if (t.groupId in startedAt) { groups[startedAt[t.groupId]].push(i); return; }
      startedAt[t.groupId] = groups.length;
      groups.push([i]);
    } else {
      groups.push([i]);
    }
  });
  return groups;
}
// Every task object sharing this task's group (or just itself if ungrouped)
function _groupMembers(taskId) {
  const t = tasks.find(x => x.id === taskId);
  if (!t) return [];
  if (t.groupId) return tasks.filter(x => x.groupId === t.groupId);
  return [t];
}
// Distinct groupIds in first-seen order → used for labelling (P1, P2, …)
function _groupLabels() {
  const labels = {};
  let n = 0;
  tasks.forEach(t => { if (t.groupId && !(t.groupId in labels)) labels[t.groupId] = 'P' + (++n); });
  return labels;
}

// ── Selection + grouping actions ────────────────────────────────────────
function toggleSelect(id, e) {
  if (e) e.stopPropagation();
  if (selectedTaskIds.has(id)) selectedTaskIds.delete(id);
  else selectedTaskIds.add(id);
  renderTasks();
}
function clearSelection() {
  selectedTaskIds.clear();
  renderTasks();
}
function groupSelectedParallel() {
  const ids = [...selectedTaskIds];
  if (ids.length < 2) { addLog('Select at least 2 tools to group as parallel.', 'warn'); return; }
  const gid = 'g' + rndId();
  tasks.forEach(t => { if (selectedTaskIds.has(t.id)) t.groupId = gid; });
  selectedTaskIds.clear();
  renderTasks();
  saveTasksState();
  addLog(`Grouped ${ids.length} tools to run in parallel.`, 'info');
}
function ungroupSelected() {
  const ids = [...selectedTaskIds];
  // If nothing is selected, do nothing; otherwise clear the group of each selected task
  const affected = new Set();
  tasks.forEach(t => { if (selectedTaskIds.has(t.id) && t.groupId) affected.add(t.groupId); });
  if (affected.size === 0) { addLog('Select a grouped tool to ungroup.', 'warn'); return; }
  tasks.forEach(t => { if (affected.has(t.groupId)) t.groupId = null; });
  selectedTaskIds.clear();
  renderTasks();
  saveTasksState();
  addLog('Parallel group removed.', 'info');
}
function updateSelectBar() {
  const bar = document.getElementById('task-select-bar');
  if (!bar) return;
  const n = selectedTaskIds.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  const cnt = document.getElementById('task-select-count');
  if (cnt) cnt.textContent = `${n} selected`;
  const gbtn = document.getElementById('tsb-group-btn');
  if (gbtn) gbtn.disabled = n < 2;
}

function removeTask(id) {
  tasks = tasks.filter(t=>t.id!==id);
  selectedTaskIds.delete(id);
  renderTasks();
  saveTasksState();
}

function clearPipeline() {
  tasks = [];
  selectedTaskIds.clear();
  renderTasks();
  // Force clear on server regardless of isExecuting flag
  api('POST', '/api/state', { key: 'tasks', value: [] });
}

function updateTaskCommand(id, cmd) {
  const t = tasks.find(t=>t.id===id);
  if (t) t.command = cmd;
}

function renderTasks() {
  const list  = document.getElementById('tasks-list');
  const empty = document.getElementById('tasks-empty');
  document.getElementById('stat-tasks').textContent = tasks.length;
  updateLaunchBtn();
  updateSavePipeBtn();

  if (tasks.length === 0) { list.innerHTML=''; empty.style.display='flex'; updateSelectBar(); return; }
  empty.style.display = 'none';
  list.innerHTML = '';
  const labels = _groupLabels();
  tasks.forEach((task, i) => list.appendChild(makeTaskItem(task, i, labels[task.groupId] || '')));
  updateSelectBar();
}

function makeTaskItem(task, idx, groupLabel) {
  const inParallel = !!task.groupId;
  const selected = selectedTaskIds.has(task.id);
  const div = document.createElement('div');
  div.className = 'task-item' + (inParallel ? ' parallel' : '') + (selected ? ' selected' : '');
  div.dataset.id = task.id;
  div.draggable = true;

  const statusIcon = {
    idle:      `<svg class="icon status-idle" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`,
    running:   `<svg class="icon status-running spin" width="16" height="16" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    completed: `<svg class="icon status-completed" width="16" height="16" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    failed:    `<svg class="icon status-failed" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  }[task.status] || '';

  const isRunning = task.status === 'running';
  const canRun    = !isExecuting && task.status !== 'running';

  div.innerHTML = `
    <label class="task-select" title="Select for parallel grouping">
      <input type="checkbox" ${selected ? 'checked' : ''} onclick="toggleSelect('${task.id}', event)" ${isExecuting ? 'disabled' : ''} />
    </label>
    <div class="task-drag-handle">
      <svg class="icon" width="16" height="16" viewBox="0 0 24 24"><circle cx="9" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="19" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="19" r="1" fill="currentColor" stroke="none"/></svg>
    </div>
    <div class="task-status-icon">${statusIcon}</div>
    <div class="task-info">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:1px;">
        <span class="task-tool-name">${esc(task.toolName)}</span>
        ${inParallel ? `<span class="parallel-chip">⚡ Parallel ${groupLabel}</span>` : '<span class="task-unit-label">Execution Unit</span>'}
      </div>
      <input type="text" class="task-command-input" value="${esc(task.command)}" placeholder="Raw Command..."
        ${isRunning || isExecuting ? 'disabled' : ''}
        onchange="updateTaskCommand('${task.id}', this.value)" />
    </div>
    <div class="task-btns">
      ${!isRunning ? `<button class="task-btn run" onclick="runSingleTask('${task.id}')" ${isExecuting ? 'disabled' : ''}>
        <svg class="icon" width="13" height="13" viewBox="0 0 24 24" style="fill:currentColor;stroke:none;"><path d="M5 3l14 9-14 9V3z"/></svg> Run
      </button>` : ''}
      ${isRunning ? `<button class="task-btn skip" onclick="skipTask('${task.id}')">
        <svg class="icon" width="13" height="13" viewBox="0 0 24 24"><polygon points="13 19 22 12 13 5 13 19"/><line x1="2" y1="19" x2="2" y2="5"/></svg> Skip
      </button>` : ''}
      ${task.output ? `<button class="task-btn view" onclick="viewOutput('${task.id}')">
        <svg class="icon" width="13" height="13" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> View Log
      </button>` : ''}
      <button class="task-btn del" onclick="removeTask('${task.id}')" ${isRunning || isExecuting ? 'disabled' : ''}>
        <svg class="icon" width="13" height="13" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      </button>
    </div>
  `;

  // Drag
  div.addEventListener('dragstart', e => { dragSrcIndex = tasks.findIndex(t=>t.id===task.id); dragSrcList='tasks'; e.dataTransfer.effectAllowed='move'; div.classList.add('dragging'); });
  div.addEventListener('dragend',   () => div.classList.remove('dragging'));
  div.addEventListener('dragover',  e => { e.preventDefault(); });
  div.addEventListener('drop',      e => { e.preventDefault(); handleTaskDrop(tasks.findIndex(t=>t.id===task.id)); });

  return div;
}

function handleTaskDrop(toIdx) {
  if (dragSrcIndex === null || dragSrcList !== 'tasks' || dragSrcIndex === toIdx) return;
  const arr = [...tasks];
  const [item] = arr.splice(dragSrcIndex, 1);
  arr.splice(toIdx, 0, item);
  tasks = arr;
  renderTasks();
  saveTasksState();
  dragSrcIndex = null;
}
