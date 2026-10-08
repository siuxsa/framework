// ═══════════════════════════════════════════════════════════════════════
//  ENVIRONMENT — reflects the REAL machine (user, host, working directory)
// ═══════════════════════════════════════════════════════════════════════
async function fetchEnv() {
  currentEnv = await api('GET', '/api/env');
  updateEnvDisplay();
}

// Show only the last (current) directory name — not the full path.
// Home collapses to ~ and filesystem root stays /. Full path lives in title.
function _displayCwd() {
  const cwd  = currentEnv.cwd  || '';
  const home = currentEnv.home || '';
  if (!cwd || cwd === '/') return cwd ? '/' : '/';
  if (home && cwd === home) return '~';
  const seg = cwd.split('/').filter(Boolean).pop();
  return seg || '/';
}

function updateEnvDisplay() {
  const cwdFull  = currentEnv.cwd || '/';
  const cwdLabel = _displayCwd();
  const user = currentEnv.user || '';
  const host = currentEnv.host || '';

  const envCwd = document.getElementById('env-cwd');
  if (envCwd) { envCwd.textContent = cwdLabel; envCwd.title = cwdFull; }

  const shellEl = document.getElementById('env-shell');
  if (shellEl) shellEl.textContent = (currentEnv.shell || '').split('/').pop() || currentEnv.shell || '';

  const termCwd = document.getElementById('terminal-cwd');
  if (termCwd) { termCwd.textContent = cwdLabel; termCwd.title = cwdFull; }

  // Real user@host in the interactive terminal prompt
  const prompt = document.getElementById('terminal-prompt');
  if (prompt && !prompt.className.includes('active-input') && user) {
    prompt.textContent = host ? `${user}@${host}` : user;
  }

  if (currentEnv.shell) {
    document.getElementById('shell-label').textContent = currentEnv.shell;
    document.getElementById('shell-chip').style.display = 'flex';
  }
}
