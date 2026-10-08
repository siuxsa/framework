// ═══════════════════════════════════════════════════════════════════════
//  WORKFLOW EXECUTION
// ═══════════════════════════════════════════════════════════════════════
// Execute one task and record its result. Never throws.
async function _execOne(task, tgt) {
  setTaskStatus(task.id, 'running');
  const cmd = replaceTarget(task.command, tgt);
  addLog(`Starting: ${cmd}`, 'info', task.id, task.toolName);
  // Populate the live process list quickly so Terminate/Skip work right away.
  setTimeout(fetchRunningTools, 400);
  try {
    const token = localStorage.getItem('cshunter_token');
    const r = await fetch('/api/execute-task', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify({ toolName: task.toolName, target: tgt, rawCommand: cmd })
    });
    if (r.status === 401) { showLogin(); return; }
    const { output, error: isErr } = await r.json();
    setTaskStatus(task.id, isErr ? 'failed' : 'completed', output);
    addLog(isErr ? 'Execution failed.' : 'Execution successful.', isErr ? 'error' : 'info', task.id, task.toolName);
  } catch (e) {
    setTaskStatus(task.id, 'failed');
    addLog('Communication failure.', 'error', task.id, task.toolName);
  }
}

// Launch the whole pipeline: linked tasks in a group run at the SAME TIME,
// and groups run one after another in order.
async function executeWorkflow() {
  target = document.getElementById('target-input').value.trim();
  if (isExecuting || !target || tasks.length === 0) return;
  isExecuting = true;
  updateLaunchBtn();
  addLog(`Initializing orchestration for ${target}...`, 'info');

  const groups = _taskGroups();   // arrays of task indices
  for (const g of groups) {
    const batch = g.map(i => tasks[i]).filter(Boolean);
    if (batch.length > 1) addLog(`Running ${batch.length} tools in parallel…`, 'info');
    await Promise.all(batch.map(t => _execOne(t, target)));
  }

  isExecuting = false;
  updateLaunchBtn();
  renderTasks();
  saveTasksState();
  addLog('Workflow orchestration sequence finalized.', 'info');
}

// Run a single task — or, if it belongs to a parallel group, run every
// linked tool in that group simultaneously.
async function runSingleTask(id) {
  target = document.getElementById('target-input').value.trim();
  if (isExecuting || !target) { addLog('Target asset required for execution.', 'warn'); return; }
  const group = _groupMembers(id);
  if (!group.length) return;
  isExecuting = true;
  updateLaunchBtn();
  if (group.length > 1) addLog(`Running ${group.length} linked tools in parallel…`, 'info', id, group[0].toolName);
  try {
    await Promise.all(group.map(t => _execOne(t, target)));
  } finally {
    isExecuting = false;
    updateLaunchBtn();
    renderTasks();
    saveTasksState();
  }
}

async function skipTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const cmd = replaceTarget(task.command, target);
  // Refresh the live process list first — the 3s poll may not have caught
  // this run yet, so match against a fresh snapshot.
  await fetchRunningTools();
  const rt = runningTools.find(r => r.command === cmd);
  if (rt) {
    await stopTool(rt.id);
    addLog('Skipped — process terminated.', 'warn', id, task.toolName);
  } else {
    addLog('No running process found to skip (it may have already finished).', 'warn', id, task.toolName);
  }
}

function setTaskStatus(id, status, output) {
  const t = tasks.find(t=>t.id===id);
  if (!t) return;
  t.status = status;
  if (output !== undefined) t.output = output;
  renderTasks();
}
