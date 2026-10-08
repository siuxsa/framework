// ═══════════════════════════════════════════════════════════════════════
//  API HELPER
// ═══════════════════════════════════════════════════════════════════════
async function api(method, path, body) {
  const token = localStorage.getItem('cshunter_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  if (r.status === 401 && !path.startsWith('/api/auth')) {
    // Session expired or invalid — show login
    localStorage.removeItem('cshunter_token');
    showLogin();
    return {};
  }
  return r.json();
}

// ═══════════════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════════════
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function rndId() { return Math.random().toString(36).substring(2,9); }

function replaceTarget(command, targetValue) {
  if (!command || !targetValue) return command;
  let result = command;
  result = result.split('${target}').join(targetValue);
  result = result.split('$target').join(targetValue);
  result = result.split('{target}').join(targetValue);
  return result;
}
