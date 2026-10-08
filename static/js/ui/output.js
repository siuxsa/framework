// ═══════════════════════════════════════════════════════════════════════
//  OUTPUT MODAL
// ═══════════════════════════════════════════════════════════════════════
function viewOutput(id) {
  const task = tasks.find(t=>t.id===id);
  if (!task) return;
  selectedTask = task;
  document.getElementById('output-tool-name').textContent = task.toolName;
  document.getElementById('output-command').textContent   = task.command;
  document.getElementById('output-content').textContent   = task.output || 'No output generated.';
  document.getElementById('output-exit').textContent      = `EXIT_CODE: ${task.status==='completed'?'0':'1'}`;
  document.getElementById('output-modal').classList.remove('hidden');
}
function closeOutputModal() { document.getElementById('output-modal').classList.add('hidden'); selectedTask=null; }
function copyOutput() {
  if (!selectedTask) return;
  navigator.clipboard.writeText(selectedTask.output || '');
  const btn = document.getElementById('copy-btn');
  btn.textContent = '✓ Copied';
  btn.style.color = 'var(--emerald)';
  setTimeout(() => { btn.innerHTML = '<svg class="icon" width="13" height="13" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy'; btn.style.color=''; }, 2000);
}
function downloadOutput() {
  if (!selectedTask) return;
  const blob = new Blob([selectedTask.output||''], {type:'text/plain'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${selectedTask.toolName.toLowerCase()}_result_${target||'unknown'}.txt`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════════════════════════════════════
//  EXPORT SESSION REPORT
//  Compiles every task in the current pipeline (command, status, output)
//  into a single Markdown report and downloads it.
// ═══════════════════════════════════════════════════════════════════════
function exportSessionReport() {
  const tgt = (document.getElementById('target-input')?.value || target || 'unknown').trim() || 'unknown';
  if (!tasks.length) { addLog('Nothing to export — pipeline is empty.', 'warn'); return; }

  const now  = new Date();
  const done = tasks.filter(t => t.status === 'completed').length;
  const fail = tasks.filter(t => t.status === 'failed').length;

  const statusMark = { completed: '✅ completed', failed: '❌ failed', running: '⏳ running', idle: '⚪ idle' };
  const lines = [];
  lines.push(`# CSHUNTER — Session Report`);
  lines.push('');
  lines.push(`- **Target:** \`${tgt}\``);
  lines.push(`- **Generated:** ${now.toISOString()}`);
  lines.push(`- **Units:** ${tasks.length}  (${done} completed · ${fail} failed)`);
  lines.push('');
  lines.push('---');
  lines.push('');

  tasks.forEach((t, i) => {
    const cmd = replaceTarget(t.command || '', tgt);
    lines.push(`## ${String(i + 1).padStart(2, '0')} · ${t.toolName}`);
    lines.push('');
    lines.push(`- **Status:** ${statusMark[t.status] || t.status}`);
    lines.push(`- **Command:** \`${cmd}\``);
    lines.push('');
    lines.push('```');
    lines.push((t.output && t.output.trim()) ? t.output.trimEnd() : '(no output captured)');
    lines.push('```');
    lines.push('');
  });

  const safeTarget = tgt.replace(/[^a-z0-9._-]+/gi, '_');
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cshunter_report_${safeTarget}_${stamp}.md`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  addLog(`Session report exported (${tasks.length} units).`, 'info');
}
