// ═══════════════════════════════════════════════════════════════════════
//  AUTHENTICATION — REDIRECT-BASED FLOW
//
//  Login lives at /login (login.html).
//  Dashboard lives at / (index.html).
//
//  checkAuth()   → validates the stored token; redirects to /login if invalid
//  handleLogout() → clears token + redirects to /login
//  showLogin()   → alias for redirect (called by legacy code paths)
// ═══════════════════════════════════════════════════════════════════════

function showLogin() {
  // Replace history entry so Back doesn't return to a broken dashboard
  window.location.replace('/login');
}

async function checkAuth() {
  const token = localStorage.getItem('cshunter_token');
  if (!token) {
    showLogin();
    return false;
  }
  try {
    const r = await fetch('/api/auth/check', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (r.ok) return true;
  } catch {
    // network error — let user stay; will fail on next API call
    return false;
  }
  // Token was rejected by the server
  localStorage.removeItem('cshunter_token');
  showLogin();
  return false;
}

function handleLogout() {
  const token = localStorage.getItem('cshunter_token');
  if (token) {
    fetch('/api/auth/logout', {
      method : 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    }).catch(() => {});
  }
  localStorage.removeItem('cshunter_token');
  window.location.replace('/login');
}

// ═══════════════════════════════════════════════════════════════════════
//  SETTINGS — Change credentials modal (still on dashboard)
// ═══════════════════════════════════════════════════════════════════════

function showSettings() {
  document.getElementById('settings-modal').style.display = 'flex';
  document.getElementById('settings-error').textContent   = '';
  document.getElementById('settings-success').textContent = '';
  document.getElementById('settings-current-pw').value   = '';
  document.getElementById('settings-new-user').value     = '';
  document.getElementById('settings-new-pw').value       = '';
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

// ── Maintenance: clear cache / factory reset ────────────────────────────
async function clearCacheData() {
  if (!confirm('Clear cached logs and tool run/command data?\n\nYour saved tools and pipes will be kept.')) return;
  const msg = document.getElementById('maint-msg');
  msg.style.color = 'var(--slate-4)'; msg.textContent = 'Clearing cache…';
  const r = await api('POST', '/api/maintenance/reset', { mode: 'cache' });
  if (r && r.success) {
    try { localStorage.removeItem('cshunter_cmd_history'); } catch {}
    msg.style.color = 'var(--emerald)'; msg.textContent = 'Cache cleared — reloading…';
    setTimeout(() => window.location.reload(), 700);
  } else {
    msg.style.color = 'var(--red)'; msg.textContent = (r && r.detail) || 'Failed to clear cache.';
  }
}

async function freshStart() {
  if (!confirm('FRESH START\n\nThis permanently deletes ALL tools, pipes, logs and saved state, then restores the default tools. Your login is kept.\n\nThis cannot be undone. Continue?')) return;
  const msg = document.getElementById('maint-msg');
  msg.style.color = 'var(--slate-4)'; msg.textContent = 'Resetting…';
  const r = await api('POST', '/api/maintenance/reset', { mode: 'all' });
  if (r && r.success) {
    try { localStorage.removeItem('cshunter_cmd_history'); } catch {}
    msg.style.color = 'var(--emerald)'; msg.textContent = 'Reset complete — reloading…';
    setTimeout(() => window.location.reload(), 700);
  } else {
    msg.style.color = 'var(--red)'; msg.textContent = (r && r.detail) || 'Failed to reset.';
  }
}

async function handleChangeCredentials(e) {
  if (e) e.preventDefault();

  const currentPw = document.getElementById('settings-current-pw').value;
  const newUser   = document.getElementById('settings-new-user').value.trim();
  const newPw     = document.getElementById('settings-new-pw').value;
  const errorEl   = document.getElementById('settings-error');
  const successEl = document.getElementById('settings-success');

  errorEl.textContent   = '';
  successEl.textContent = '';

  if (!currentPw)         { errorEl.textContent = 'Current password is required.'; return; }
  if (!newUser && !newPw) { errorEl.textContent = 'Enter a new username or password.'; return; }

  const body = { currentPassword: currentPw };
  if (newUser) body.newUsername = newUser;
  if (newPw)   body.newPassword = newPw;

  const data = await api('POST', '/api/auth/change-credentials', body);
  if (data.success) {
    successEl.textContent = 'Credentials updated — signing out…';
    setTimeout(() => {
      closeSettings();
      handleLogout();   // redirect to /login
    }, 1500);
  } else {
    errorEl.textContent = data.detail || 'Failed to update credentials.';
  }
}
