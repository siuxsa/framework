// ═══════════════════════════════════════════════════════════════════════
//  MISSION CONTROL — SEQUENCE STRATEGIST
//  Primary drag-to-reorder interface. Changes sync to the main pipeline.
// ═══════════════════════════════════════════════════════════════════════

let _missionDragIdx = null;

function showMissionModal() {
  renderMissionList();
  document.getElementById('mission-modal').classList.remove('hidden');
}
function closeMissionModal() {
  document.getElementById('mission-modal').classList.add('hidden');
}

// ── Move helpers (button-based reorder) ─────────────────────────────
function missionMoveUp(idx) {
  if (idx <= 0) return;
  [tasks[idx - 1], tasks[idx]] = [tasks[idx], tasks[idx - 1]];
  _syncAfterReorder();
}
function missionMoveDown(idx) {
  if (idx >= tasks.length - 1) return;
  [tasks[idx], tasks[idx + 1]] = [tasks[idx + 1], tasks[idx]];
  _syncAfterReorder();
}

// ── Drag handlers ───────────────────────────────────────────────────
function missionDragStart(e, idx) {
  _missionDragIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  const row = e.target.closest('.mission-row');
  if (row) row.classList.add('dragging');
}
function missionDragEnd(e) {
  _missionDragIdx = null;
  const row = e.target.closest('.mission-row');
  if (row) row.classList.remove('dragging');
  // clear all drop indicators
  document.querySelectorAll('.mission-row.drop-above, .mission-row.drop-below')
    .forEach(el => { el.classList.remove('drop-above', 'drop-below'); });
}
function missionDragOver(e, idx) {
  e.preventDefault();
  if (_missionDragIdx === null || _missionDragIdx === idx) return;
  // visual indicator
  const row = e.target.closest('.mission-row');
  if (!row) return;
  document.querySelectorAll('.mission-row.drop-above, .mission-row.drop-below')
    .forEach(el => { el.classList.remove('drop-above', 'drop-below'); });
  row.classList.add(_missionDragIdx < idx ? 'drop-below' : 'drop-above');
}
function missionDrop(e, toIdx) {
  e.preventDefault();
  document.querySelectorAll('.mission-row.drop-above, .mission-row.drop-below')
    .forEach(el => { el.classList.remove('drop-above', 'drop-below'); });
  if (_missionDragIdx === null || _missionDragIdx === toIdx) return;
  const arr = [...tasks];
  const [item] = arr.splice(_missionDragIdx, 1);
  arr.splice(toIdx, 0, item);
  tasks = arr;
  _missionDragIdx = null;
  _syncAfterReorder();
}

// ── Sync reorder back to main UI ────────────────────────────────────
function _syncAfterReorder() {
  renderTasks();
  saveTasksState();
  renderMissionList();
}

// ── Render ──────────────────────────────────────────────────────────
function renderMissionList() {
  const el = document.getElementById('mission-list');
  document.getElementById('mission-count').textContent = `${tasks.length} Steps`;

  if (tasks.length === 0) {
    el.innerHTML = `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:.4;text-align:center;padding:40px;">
      <div style="width:60px;height:60px;border:2px dashed var(--slate-7);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <svg class="icon" width="28" height="28" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </div>
      <h3 style="font-size:15px;font-weight:700;color:#fff;margin-bottom:8px;">No Sequence Detected</h3>
      <p style="font-size:12px;color:var(--slate-4);max-width:260px;">Add tools to the registry from the main console to begin strategic orchestration.</p>
    </div>`;
    return;
  }

  el.innerHTML = `<div style="width:100%;">` +
    tasks.map((task, i) => {
      const isFirst = i === 0;
      const isLast  = i === tasks.length - 1;
      return `
      <div class="mission-row" draggable="true"
           ondragstart="missionDragStart(event,${i})"
           ondragend="missionDragEnd(event)"
           ondragover="missionDragOver(event,${i})"
           ondrop="missionDrop(event,${i})">
        <div class="mission-item">
          <!-- Drag handle -->
          <div class="mission-drag-handle" title="Drag to reorder">
            <svg class="icon" width="16" height="16" viewBox="0 0 24 24"><circle cx="9" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="19" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="19" r="1.5" fill="currentColor" stroke="none"/></svg>
          </div>

          <!-- Step number -->
          <div class="mission-step">
            <span>Step</span>
            <div class="mission-step-num">${String(i + 1).padStart(2, '0')}</div>
          </div>

          <!-- Info -->
          <div style="flex:1;min-width:0;">
            <h4 style="font-size:13px;font-weight:700;color:#fff;font-family:'JetBrains Mono',monospace;">${esc(task.toolName)}</h4>
            <code style="font-size:10px;color:var(--slate-5);font-family:'JetBrains Mono',monospace;word-break:break-all;display:block;margin-top:1px;">${esc(task.command)}</code>
          </div>

          <!-- Reorder buttons -->
          <div class="mission-reorder-btns">
            <button class="mission-move-btn" onclick="missionMoveUp(${i})" ${isFirst ? 'disabled' : ''} title="Move up">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button class="mission-move-btn" onclick="missionMoveDown(${i})" ${isLast ? 'disabled' : ''} title="Move down">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>

          <!-- Actions -->
          <div style="display:flex;gap:6px;margin-left:8px;">
            <button class="task-btn run" onclick="runSingleTask('${task.id}');closeMissionModal()">
              <svg class="icon" width="13" height="13" viewBox="0 0 24 24" style="fill:currentColor;stroke:none;"><path d="M5 3l14 9-14 9V3z"/></svg>
            </button>
            <button class="task-btn del" style="opacity:1;" onclick="removeTask('${task.id}');renderMissionList()">
              <svg class="icon" width="13" height="13" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>
        </div>
      </div>`;
    }).join('') + `</div>`;
}

