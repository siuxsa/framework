// ═══════════════════════════════════════════════════════════════════════
//  FILE TYPE REGISTRY
// ═══════════════════════════════════════════════════════════════════════
const FILE_TYPES = {
  image : ['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff','tif','avif','heic','heif'],
  video : ['mp4','webm','ogv','avi','mov','mkv','flv','wmv','3gp','m4v','ts'],
  audio : ['mp3','wav','ogg','oga','flac','aac','m4a','opus','weba','wma'],
  pdf   : ['pdf'],
  json  : ['json','jsonl','geojson','json5'],
  code  : [
    'js','mjs','cjs','ts','tsx','jsx','py','rb','go','rs','java','c','cpp','cc','h','hpp',
    'cs','php','swift','kt','kts','r','sh','bash','zsh','fish','ps1','lua','pl','scala',
    'ex','exs','elm','clj','cljs','hs','dart','zig','toml','yaml','yml','xml','html',
    'htm','css','scss','sass','less','styl','vue','svelte','astro','graphql','gql',
    'sql','md','mdx','markdown','rst','tex','latex','dockerfile','makefile','cmake',
    'ini','cfg','conf','env','gitignore','editorconfig','htaccess','nginx',
  ],
  text  : ['txt','log','csv','tsv','diff','patch'],
};

// Max file size to attempt text rendering (bytes). Above this: warn + truncate.
const TEXT_SIZE_LIMIT = 1024 * 512; // 512 KB
// Max binary-replacement-character ratio before treating file as binary
const BINARY_RATIO_LIMIT = 0.04;    // 4 % of sampled chars

function getFileKind(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  for (const [kind, exts] of Object.entries(FILE_TYPES)) {
    if (exts.includes(ext)) return kind;
  }
  return 'unknown';
}

// Returns an SVG string for use inside a <span>
function _fileIconSvg(kind) {
  const icons = {
    directory : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    image     : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    video     : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
    audio     : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    pdf       : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    json      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    code      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    text      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    unknown   : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
  };
  return icons[kind] || icons.unknown;
}

// ═══════════════════════════════════════════════════════════════════════
//  SERVE URL HELPERS
// ═══════════════════════════════════════════════════════════════════════
function _serveUrl(path, forceDownload = false) {
  const token = localStorage.getItem('cshunter_token') || '';
  let url = '/api/fs/serve?path=' + encodeURIComponent(path)
          + '&token=' + encodeURIComponent(token);
  if (forceDownload) url += '&dl=1';
  return url;
}

// ═══════════════════════════════════════════════════════════════════════
//  EXPLORER — DIRECTORY LISTING
// ═══════════════════════════════════════════════════════════════════════
async function fetchExplorer(path) {
  document.getElementById('explorer-list').innerHTML =
    '<div style="text-align:center;padding:40px;font-size:12px;color:var(--slate-5);">Loading...</div>';
  document.getElementById('explorer-path').value = path;
  const data = await api('POST', '/api/fs/list', { path });
  if (data.error) {
    addLog('Explorer error: ' + data.error, 'error');
    document.getElementById('explorer-list').innerHTML =
      '<div style="text-align:center;padding:30px;font-size:12px;color:var(--red);">' + esc(data.error) + '</div>';
    return;
  }
  document.getElementById('explorer-path').value = data.currentPath;
  explorerItems = data.items || [];
  renderExplorer(data.currentPath);
}

function explorerUp() {
  const p = document.getElementById('explorer-path').value;
  const parent = p === '/' ? '/' : p.substring(0, p.lastIndexOf('/')) || '/';
  fetchExplorer(parent);
}

function renderExplorer(currentPath) {
  const el = document.getElementById('explorer-list');
  if (explorerItems.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px;font-size:12px;color:var(--slate-6);font-style:italic;">Empty or blocked directory</div>';
    return;
  }
  el.innerHTML = explorerItems.map(item => {
    const kind  = item.type === 'directory' ? 'directory' : getFileKind(item.name);
    const icon  = _fileIconSvg(kind);
    const click = item.type === 'directory'
      ? "fetchExplorer('" + esc(item.path) + "')"
      : "openFile('"      + esc(item.path) + "')";
    return `
    <div class="fs-item ${item.type}" onclick="${click}">
      <div class="fs-item-left">
        <span style="color:var(--slate-5);display:flex;align-items:center;flex-shrink:0;">${icon}</span>
        <div class="fs-item-info">
          <div class="fs-item-name">${esc(item.name)}</div>
          <div class="fs-item-meta">${esc(item.sizeString)}${item.isWritable ? ' <span class="fs-item-wr">W+R</span>' : ''}</div>
        </div>
      </div>
      <div class="fs-item-actions">
        ${item.type === 'directory'
          ? '<button class="fs-action-btn fs-setcwd" onclick="setCwd(\'' + esc(item.path) + '\');event.stopPropagation()">SET CWD</button>'
          : ''}
        <button class="fs-action-btn fs-del" onclick="deleteItem('${esc(item.path)}');event.stopPropagation()">Remove</button>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════════
//  FILE NAVIGATION STATE
//  Tracks which file is open so Prev/Next buttons work.
//  _navFiles is re-computed whenever openFile() is called, from the current
//  explorerItems list filtered to files only (no directories).
// ═══════════════════════════════════════════════════════════════════════
let _navFiles = [];   // files in the current directory (no dirs)
let _navIdx   = -1;   // index of the currently open file in _navFiles

function _updateNavState(path) {
  _navFiles = (explorerItems || []).filter(i => i.type !== 'directory');
  _navIdx   = _navFiles.findIndex(i => i.path === path);
  _updateNavButtons();
}

function _updateNavButtons() {
  const prevBtn  = document.getElementById('file-prev-btn');
  const nextBtn  = document.getElementById('file-next-btn');
  const counter  = document.getElementById('file-nav-counter');
  const total    = _navFiles.length;

  if (prevBtn) prevBtn.disabled = (_navIdx <= 0);
  if (nextBtn) nextBtn.disabled = (_navIdx < 0 || _navIdx >= total - 1);
  if (counter) {
    counter.textContent = total > 0 ? (_navIdx + 1) + ' / ' + total : '—';
  }
}

function openPrevFile() {
  if (_navIdx > 0) openFile(_navFiles[_navIdx - 1].path);
}

function openNextFile() {
  if (_navIdx >= 0 && _navIdx < _navFiles.length - 1)
    openFile(_navFiles[_navIdx + 1].path);
}

async function openFile(path) {
  const name = path.replace(/\\/g, '/').split('/').pop() || path;
  const kind = getFileKind(name);

  // Show viewer panel
  document.getElementById('editor-placeholder').style.display = 'none';
  const editorContent = document.getElementById('editor-content');
  editorContent.style.display    = 'flex';
  editorContent.style.flexDirection = 'column';
  editorContent.style.flex       = '1';
  editorContent.style.overflow   = 'hidden';

  document.getElementById('editor-filename').textContent = name;
  document.getElementById('editor-filepath').textContent = '(' + path + ')';
  document.getElementById('save-status').textContent     = '';

  // Update Prev/Next nav buttons for this file
  _updateNavState(path);

  // Show loading state in viewer body immediately
  document.getElementById('viewer-body').innerHTML =
    '<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--slate-5);">Loading...</div>';

  if      (kind === 'image') _renderImageViewer(path, name);
  else if (kind === 'video') _renderVideoViewer(path, name);
  else if (kind === 'audio') _renderAudioViewer(path, name);
  else if (kind === 'pdf')   _renderPdfViewer(path, name);
  else if (kind === 'json')  await _renderJsonViewer(path, name);
  else if (kind === 'code' || kind === 'text') await _renderCodeViewer(path, name);
  else                       await _renderTextOrBinary(path, name);
}

// ═══════════════════════════════════════════════════════════════════════
//  VIEWER IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════

// ── SVG icon helpers for viewer buttons ──────────────────────────────
const _ico = {
  download : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  newTab   : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  copy     : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  edit     : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  save     : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
  view     : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  binary   : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`,
};

// ── Image ────────────────────────────────────────────────────────────
function _renderImageViewer(path, name) {
  const src  = _serveUrl(path);
  const dlSrc = _serveUrl(path, true);
  _setViewerBody(`
    <div style="flex:1;display:flex;align-items:center;justify-content:center;overflow:auto;
         background:repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%,transparent 0% 50%) 0 0/20px 20px;
         min-height:0;padding:20px;">
      <img src="${src}" alt="${esc(name)}"
           style="max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;
                  box-shadow:0 8px 32px rgba(0,0,0,.6);cursor:zoom-in;transition:transform .2s;"
           onclick="this.style.transform=this.style.transform?'':'scale(2)';
                    this.style.cursor=this.style.transform?'zoom-out':'zoom-in';"
           onerror="this.outerHTML='<div style=\\'color:var(--red);font-size:12px;\\'>Image failed to load.</div>'" />
    </div>
    <div class="viewer-footer">
      <span style="font-size:10px;color:var(--slate-5);">Click image to toggle 2x zoom</span>
      <a href="${dlSrc}" download="${esc(name)}" class="btn-ghost"
         style="font-size:10px;padding:5px 12px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
        ${_ico.download} Download
      </a>
    </div>`);
}

// ── Video ─────────────────────────────────────────────────────────────
function _renderVideoViewer(path, name) {
  const src   = _serveUrl(path);
  const dlSrc = _serveUrl(path, true);
  _setViewerBody(`
    <div style="flex:1;display:flex;align-items:center;justify-content:center;background:#000;min-height:0;overflow:hidden;">
      <video controls autoplay style="max-width:100%;max-height:100%;outline:none;" preload="metadata">
        <source src="${src}">
        <p style="color:var(--slate-4);padding:20px;">This video format cannot be played in the browser.</p>
      </video>
    </div>
    <div class="viewer-footer">
      <span style="font-size:10px;color:var(--slate-5);">Video Player</span>
      <a href="${dlSrc}" download="${esc(name)}" class="btn-ghost"
         style="font-size:10px;padding:5px 12px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
        ${_ico.download} Download
      </a>
    </div>`);
}

// ── Audio ─────────────────────────────────────────────────────────────
function _renderAudioViewer(path, name) {
  const src   = _serveUrl(path);
  const dlSrc = _serveUrl(path, true);
  _setViewerBody(`
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:40px;">
      <div style="width:80px;height:80px;border-radius:50%;
           background:radial-gradient(circle,rgba(255,106,42,.25),rgba(255,106,42,.05));
           border:1px solid rgba(255,106,42,.3);display:flex;align-items:center;justify-content:center;
           box-shadow:0 0 36px rgba(255,106,42,.15);">
        ${_ico.audio || ''}
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
      </div>
      <div style="text-align:center;">
        <div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:4px;">${esc(name)}</div>
        <div style="font-size:10px;color:var(--slate-5);">Audio file</div>
      </div>
      <audio controls autoplay style="width:100%;max-width:480px;outline:none;" preload="metadata">
        <source src="${src}">
        <p style="color:var(--slate-4);">This audio format cannot be played in the browser.</p>
      </audio>
    </div>
    <div class="viewer-footer">
      <span style="font-size:10px;color:var(--slate-5);">Audio Player</span>
      <a href="${dlSrc}" download="${esc(name)}" class="btn-ghost"
         style="font-size:10px;padding:5px 12px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
        ${_ico.download} Download
      </a>
    </div>`);
}

// ── PDF ───────────────────────────────────────────────────────────────
function _renderPdfViewer(path, name) {
  // Use the inline URL (no ?dl=1) so the iframe gets Content-Disposition: inline
  const inlineSrc = _serveUrl(path);
  // For the download button, use ?dl=1 so the browser prompts Save-As
  const dlSrc     = _serveUrl(path, true);
  _setViewerBody(`
    <div style="flex:1;min-height:0;overflow:hidden;">
      <iframe src="${inlineSrc}" style="width:100%;height:100%;border:none;background:#fff;"
              title="${esc(name)}"></iframe>
    </div>
    <div class="viewer-footer">
      <span style="font-size:10px;color:var(--slate-5);">PDF Viewer</span>
      <div style="display:flex;gap:8px;">
        <a href="${inlineSrc}" target="_blank" class="btn-ghost"
           style="font-size:10px;padding:5px 12px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          ${_ico.newTab} Open in new tab
        </a>
        <a href="${dlSrc}" download="${esc(name)}" class="btn-ghost"
           style="font-size:10px;padding:5px 12px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
          ${_ico.download} Download
        </a>
      </div>
    </div>`);
}

// ── JSON ──────────────────────────────────────────────────────────────
async function _renderJsonViewer(path, name) {
  const data = await _readTextFile(path);
  if (data.error) {
    _renderBinaryFallback(path, name, data.error); return;
  }
  if (data.binary) {
    _renderBinaryFallback(path, name, 'File appears to be binary.'); return;
  }

  let pretty = data.content;
  let parseError = null;
  try   { pretty = JSON.stringify(JSON.parse(data.content), null, 2); }
  catch (e) { parseError = e.message; }

  const highlighted = _highlightJson(pretty);
  _setViewerBody(`
    <div style="flex:1;overflow:auto;min-height:0;background:var(--bg3);">
      ${parseError
        ? '<div style="padding:6px 16px;background:rgba(239,68,68,.08);border-bottom:1px solid rgba(239,68,68,.2);font-size:10px;color:var(--red);">Parse warning: ' + esc(parseError) + ' — showing raw content</div>'
        : ''}
      <pre id="viewer-code" style="font-family:\'JetBrains Mono\',monospace;font-size:11px;line-height:1.7;padding:20px;white-space:pre-wrap;word-break:break-all;tab-size:2;margin:0;">${highlighted}</pre>
    </div>
    <div class="viewer-footer">
      <span style="font-size:10px;color:var(--slate-5);">JSON &bull; ${data.content.length.toLocaleString()} bytes</span>
      <div style="display:flex;gap:8px;">
        <button class="btn-ghost" style="font-size:10px;padding:5px 12px;display:inline-flex;align-items:center;gap:6px;"
                onclick="_copyViewerContent(event)">${_ico.copy} Copy</button>
        <button class="btn-ghost" style="font-size:10px;padding:5px 12px;display:inline-flex;align-items:center;gap:6px;"
                onclick="_switchToTextEdit('${esc(path)}','${esc(name)}')">${_ico.edit} Edit</button>
      </div>
    </div>`);
}

// ── Code / Config / Markup ───────────────────────────────────────────
async function _renderCodeViewer(path, name) {
  const data = await _readTextFile(path);
  if (data.error) {
    _renderBinaryFallback(path, name, data.error); return;
  }
  if (data.binary) {
    _renderBinaryFallback(path, name, 'File appears to be binary or has too many non-printable characters.'); return;
  }

  const ext       = (name.split('.').pop() || '').toLowerCase();
  const lang      = _extToLang(ext);
  const content   = data.content;
  const lineCount = content.split('\n').length;
  const lineNums  = Array.from({length: lineCount}, (_, i) => i + 1).join('\n');
  const highlighted = _highlightCode(content, ext);

  // ─── Outer structure: flex column, toolbar on top, view-panel and edit-panel
  // share the same flex:1 slot and are toggled exclusively. This ensures both
  // modes occupy an identical area with no size difference.
  _setViewerBody(`
    <div style="flex:1;display:flex;flex-direction:column;min-height:0;background:var(--bg3);">

      <!-- ── Toolbar (always visible) ─────────────────────────────── -->
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:5px 16px;flex-shrink:0;
                  background:rgba(255,255,255,.02);border-bottom:1px solid var(--border);">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--slate-5);">
          ${esc(lang)} &bull; ${lineCount.toLocaleString()} lines &bull; ${data.content.length.toLocaleString()} bytes
          ${data.truncated ? ' <span style="color:var(--amber);">[truncated at 512 KB]</span>' : ''}
        </span>
        <div style="display:flex;gap:6px;">
          <button class="btn-ghost" style="font-size:9px;padding:3px 10px;display:inline-flex;align-items:center;gap:5px;"
                  id="toggle-edit-btn"
                  onclick="_toggleCodeEdit('${esc(path)}','${esc(name)}')">${_ico.edit} Edit Mode</button>
          <button class="btn-ghost" style="font-size:9px;padding:3px 10px;display:inline-flex;align-items:center;gap:5px;"
                  onclick="_copyViewerContent(event)">${_ico.copy} Copy</button>
        </div>
      </div>

      <!-- ── View panel (syntax-highlighted, scrollable) ───────────── -->
      <div id="code-view-panel"
           style="flex:1;overflow:auto;min-height:0;display:flex;align-items:flex-start;">
        <div id="ln-numbers"
             style="padding:14px 10px 14px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;
                    line-height:1.7;color:var(--slate-7);text-align:right;user-select:none;
                    flex-shrink:0;border-right:1px solid var(--border);background:rgba(0,0,0,.12);
                    white-space:pre;position:sticky;left:0;">${lineNums}</div>
        <pre id="viewer-code"
             style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.7;
                    padding:14px 20px;white-space:pre;overflow-x:visible;flex:1;margin:0;tab-size:2;">${highlighted}</pre>
      </div>

      <!-- ── Edit panel (full-size textarea, same slot as view panel) ─ -->
      <!-- display:none hides it; shown by _toggleCodeEdit              -->
      <textarea id="code-edit-area" data-path="${esc(path)}"
                style="display:none;flex:1;min-height:0;
                       font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.7;
                       padding:14px 20px;width:100%;box-sizing:border-box;
                       background:var(--bg3);color:#f2f2f0;
                       border:none;resize:none;outline:none;tab-size:2;
                       white-space:pre;overflow:auto;"
                spellcheck="false">${esc(content)}</textarea>

    </div>

    <!-- ── Footer ────────────────────────────────────────────────── -->
    <div class="viewer-footer" id="code-footer">
      <span style="font-size:10px;color:var(--slate-5);">${esc(name)}</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn-ghost" style="font-size:10px;padding:5px 12px;display:inline-flex;align-items:center;gap:6px;"
                onclick="_copyViewerContent(event)">${_ico.copy} Copy</button>
        <button class="btn-primary" id="save-code-btn"
                style="display:none;font-size:10px;padding:5px 12px;align-items:center;gap:6px;"
                onclick="_saveCodeEdit()">${_ico.save} Save</button>
      </div>
    </div>`);
}

// ── Text / unknown — attempts text render with binary guard ──────────
async function _renderTextOrBinary(path, name) {
  const data = await _readTextFile(path);

  if (data.error || data.binary) {
    _renderBinaryFallback(path, name,
      data.binary ? 'File contains binary or non-printable content and cannot be displayed as text.'
                  : (data.error || 'Cannot read file.'));
    return;
  }

  _setViewerBody(`
    <div style="flex:1;overflow:auto;min-height:0;background:var(--bg3);">
      ${data.truncated
        ? '<div style="padding:6px 16px;background:rgba(245,158,11,.08);border-bottom:1px solid rgba(245,158,11,.2);font-size:10px;color:var(--amber);">File is large — displaying first 512 KB. Download for full content.</div>'
        : ''}
      <textarea id="editor-textarea" data-path="${esc(path)}"
                style="font-family:\'JetBrains Mono\',monospace;font-size:11px;line-height:1.7;
                       width:100%;min-height:100%;padding:16px 20px;background:transparent;
                       color:#f2f2f0;border:none;resize:none;outline:none;tab-size:2;
                       white-space:pre;">${esc(data.content)}</textarea>
    </div>
    <div class="viewer-footer">
      <span style="font-size:10px;color:var(--slate-5);">${esc(name)} &bull; ${data.content.length.toLocaleString()} chars</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <span id="save-status" style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;"></span>
        <button class="btn-primary" style="font-size:10px;padding:5px 12px;display:inline-flex;align-items:center;gap:6px;"
                onclick="saveFile()">${_ico.save} Save</button>
      </div>
    </div>`);
}

// ── Binary fallback ───────────────────────────────────────────────────
function _renderBinaryFallback(path, name, reason) {
  const dlSrc = _serveUrl(path, true);
  _setViewerBody(`
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:40px;">
      <div style="color:var(--slate-6);">${_ico.binary}</div>
      <div style="text-align:center;">
        <div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:6px;">${esc(name)}</div>
        <div style="font-size:11px;color:var(--slate-5);max-width:360px;line-height:1.6;">${esc(reason)}</div>
      </div>
      <a href="${dlSrc}" download="${esc(name)}" class="btn-primary"
         style="font-size:11px;padding:8px 20px;text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
        ${_ico.download} Download file
      </a>
    </div>`);
}

// ═══════════════════════════════════════════════════════════════════════
//  READ TEXT FILE — WITH BINARY DETECTION AND SIZE GUARD
// ═══════════════════════════════════════════════════════════════════════
async function _readTextFile(path) {
  let data;
  try {
    data = await api('POST', '/api/fs/read', { filePath: path });
  } catch (e) {
    return { error: 'Network error: ' + e.message };
  }

  if (data.detail || data.error) {
    return { error: data.detail || data.error };
  }

  let content = data.content || '';
  let truncated = false;

  // Guard: extremely large files — truncate before rendering to prevent browser hang
  if (content.length > TEXT_SIZE_LIMIT) {
    content   = content.slice(0, TEXT_SIZE_LIMIT);
    truncated = true;
  }

  // Binary detection: check for Unicode replacement chars (\ufffd) and null bytes
  // which appear when binary data is forced through UTF-8 decoding
  const sample      = content.slice(0, 4096);
  const badChars    = (sample.match(/[\ufffd\u0000]/g) || []).length;
  const badRatio    = sample.length > 0 ? badChars / sample.length : 0;
  if (badRatio > BINARY_RATIO_LIMIT) {
    return { binary: true };
  }

  return { content, truncated, size: data.size };
}

// ═══════════════════════════════════════════════════════════════════════
//  VIEWER HELPERS
// ═══════════════════════════════════════════════════════════════════════
function _setViewerBody(html) {
  const el = document.getElementById('viewer-body');
  if (el) el.innerHTML = html;
}

function _toggleCodeEdit(path, name) {
  // view-panel and textarea are flex siblings inside the same flex:1 column.
  // Toggling them exclusively means both modes fill identical space.
  const viewPanel  = document.getElementById('code-view-panel');
  const ta         = document.getElementById('code-edit-area');
  const saveBtn    = document.getElementById('save-code-btn');
  const toggleBtn  = document.getElementById('toggle-edit-btn');
  if (!ta || !viewPanel) return;

  const inEditMode = ta.style.display !== 'none';

  if (!inEditMode) {
    // Switch to edit mode
    viewPanel.style.display = 'none';
    ta.style.display        = 'flex';   // flex so it stretches with flex:1
    ta.focus();
    if (saveBtn)  { saveBtn.style.display  = 'inline-flex'; }
    if (toggleBtn){ toggleBtn.innerHTML    = _ico.view + ' View Mode'; }
  } else {
    // Switch back to view mode — re-render highlighted pre from textarea value
    const ext = (name.split('.').pop() || '').toLowerCase();
    const pre = document.getElementById('viewer-code');
    const ln  = document.getElementById('ln-numbers');
    if (pre) { pre.innerHTML = _highlightCode(ta.value, ext); }
    if (ln)  {
      const lines = ta.value.split('\n').length;
      ln.textContent = Array.from({length: lines}, (_, i) => i + 1).join('\n');
    }
    ta.style.display        = 'none';
    viewPanel.style.display = 'flex';
    if (saveBtn)  { saveBtn.style.display  = 'none'; }
    if (toggleBtn){ toggleBtn.innerHTML    = _ico.edit + ' Edit Mode'; }
  }
}

async function _saveCodeEdit() {
  const ta  = document.getElementById('code-edit-area');
  const btn = document.getElementById('save-code-btn');
  if (!ta || !ta.dataset.path) return;
  if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
  const r = await api('POST', '/api/fs/write', { filePath: ta.dataset.path, content: ta.value });
  if (btn) { btn.disabled = false; }
  if (r.success) {
    if (btn) { btn.innerHTML = _ico.save + ' Saved'; }
    addLog('Updated: ' + ta.dataset.path, 'info');
    setTimeout(() => { if (btn) btn.innerHTML = _ico.save + ' Save'; }, 2000);
  } else {
    if (btn) { btn.innerHTML = 'Error'; }
    setTimeout(() => { if (btn) btn.innerHTML = _ico.save + ' Save'; }, 2000);
  }
}

async function _switchToTextEdit(path, name) {
  await _renderTextOrBinary(path, name);
}

function _copyViewerContent(evt) {
  const pre = document.getElementById('viewer-code');
  const ta  = document.getElementById('code-edit-area') || document.getElementById('editor-textarea');
  const text = (pre ? pre.innerText : '') || (ta ? ta.value : '');
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = evt && evt.target ? evt.target.closest('button') : null;
    if (btn) {
      const orig = btn.innerHTML;
      btn.textContent = 'Copied';
      btn.style.color = 'var(--emerald)';
      setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
    }
  });
}

// ── saveFile (generic text textarea) ─────────────────────────────────
async function saveFile() {
  const ta   = document.getElementById('editor-textarea');
  const path = ta && ta.dataset.path;
  if (!path) return;
  const st = document.getElementById('save-status');
  if (st) { st.textContent = 'Saving...'; st.style.color = 'var(--cyan)'; }
  const r = await api('POST', '/api/fs/write', { filePath: path, content: ta.value });
  if (r.success) {
    if (st) { st.textContent = 'Saved'; st.style.color = 'var(--emerald)'; }
    addLog('Updated: ' + path, 'info');
    setTimeout(() => { if (st) st.textContent = ''; }, 2500);
  } else {
    if (st) { st.textContent = 'Error'; st.style.color = 'var(--red)'; }
  }
}

function closeEditor() {
  document.getElementById('editor-placeholder').style.display = '';
  document.getElementById('editor-content').style.display     = 'none';
}

// ═══════════════════════════════════════════════════════════════════════
//  SYNTAX HIGHLIGHTING — LIGHTWEIGHT REGEX
// ═══════════════════════════════════════════════════════════════════════
function _highlightJson(str) {
  return esc(str).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+\.?\d*([eE][+-]?\d+)?)/g,
    m => {
      if (/^"/.test(m)) {
        if (/:$/.test(m)) return '<span style="color:#ff6a2a;">' + m + '</span>';   // key
        return '<span style="color:#a3e635;">' + m + '</span>';                      // string
      }
      if (/true|false/.test(m)) return '<span style="color:#f59e0b;">' + m + '</span>';
      if (/null/.test(m))       return '<span style="color:#ef4444;">' + m + '</span>';
      return '<span style="color:#c084fc;">' + m + '</span>';                        // number
    }
  );
}

function _highlightCode(code, ext) {
  const e = esc(code);
  const isMarkup = ['html','htm','xml','svg'].includes(ext);
  const isCss    = ['css','scss','sass','less','styl'].includes(ext);
  const isScript = ['js','ts','jsx','tsx','mjs','cjs','py','rb','go','rs','java',
                    'c','cpp','h','cs','php','swift','kt','sh','bash','zsh','lua',
                    'pl','dart'].includes(ext);

  if (isMarkup) {
    return e
      .replace(/(&lt;\/?[a-zA-Z][a-zA-Z0-9-]*)(\s)/g, '<span style="color:#ff6a2a;">$1</span>$2')
      .replace(/(&lt;\/?[a-zA-Z][a-zA-Z0-9-]*&gt;)/g, '<span style="color:#ff6a2a;">$1</span>')
      .replace(/([\w-]+)=(&quot;[^&]*?&quot;)/g, '<span style="color:#a3e635;">$1</span>=<span style="color:#fb923c;">$2</span>')
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span style="color:#475569;font-style:italic;">$1</span>');
  }

  if (isCss) {
    return e
      .replace(/(\/\*[\s\S]*?\*\/)/g,       '<span style="color:#475569;font-style:italic;">$1</span>')
      .replace(/(#[0-9a-fA-F]{3,8})\b/g,    '<span style="color:#f59e0b;">$1</span>')
      .replace(/(-?[\d.]+(?:px|em|rem|vh|vw|%|s|ms|deg)?)\b/g, '<span style="color:#c084fc;">$1</span>')
      .replace(/(\.[a-zA-Z][\w-]*|:[: a-zA-Z-]+)\b/g, '<span style="color:#ff6a2a;">$1</span>');
  }

  if (isScript) {
    const kw = /\b(import|export|from|as|default|const|let|var|function|class|extends|return|if|else|for|while|do|switch|case|break|continue|new|this|super|typeof|instanceof|in|of|try|catch|finally|throw|async|await|yield|static|get|set|null|undefined|true|false|def|pass|None|True|False|print|elif|except|with|global|nonlocal|raise|lambda|self|and|or|not)\b/g;
    return e
      .replace(/(\/\/[^\n]*|#(?![ 0-9a-fA-F])[^\n]*)/g,           '<span style="color:#475569;font-style:italic;">$1</span>')
      .replace(/(\/\*[\s\S]*?\*\/)/g,                               '<span style="color:#475569;font-style:italic;">$1</span>')
      .replace(/(&quot;[^&\n]*?&quot;|&#39;[^&\n]*?&#39;)/g,        '<span style="color:#a3e635;">$1</span>')
      .replace(kw,                                                   '<span style="color:#f59e0b;">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g,                                   '<span style="color:#c084fc;">$1</span>');
  }

  return e; // plain for everything else
}

function _extToLang(ext) {
  const m = {
    js:'JavaScript',ts:'TypeScript',jsx:'React JSX',tsx:'React TSX',py:'Python',rb:'Ruby',
    go:'Go',rs:'Rust',java:'Java',c:'C',cpp:'C++',h:'C Header',cs:'C#',php:'PHP',
    swift:'Swift',kt:'Kotlin',sh:'Shell',bash:'Bash',zsh:'Zsh',html:'HTML',htm:'HTML',
    xml:'XML',svg:'SVG',css:'CSS',scss:'SCSS',sass:'Sass',json:'JSON',yaml:'YAML',
    yml:'YAML',toml:'TOML',sql:'SQL',md:'Markdown',dockerfile:'Dockerfile',
    makefile:'Makefile',lua:'Lua',pl:'Perl',graphql:'GraphQL',gql:'GraphQL',
    txt:'Plain Text',log:'Log File',csv:'CSV',ini:'INI Config',conf:'Config',
    env:'Environment',gitignore:'Gitignore',
  };
  return m[ext] || (ext ? ext.toUpperCase() : 'Text');
}

// ═══════════════════════════════════════════════════════════════════════
//  FILESYSTEM OPERATIONS
// ═══════════════════════════════════════════════════════════════════════
async function setCwd(path) {
  const r = await api('POST', '/api/terminal', { command: 'cd ' + path });
  if (r.cwd) { currentEnv.cwd = r.cwd; updateEnvDisplay(); addLog('CWD set to ' + r.cwd, 'info'); }
}

async function deleteItem(path) {
  if (!confirm('Permanently delete?\n' + path)) return;
  const r = await api('POST', '/api/fs/delete', { filePath: path });
  if (r.success) { fetchExplorer(document.getElementById('explorer-path').value); addLog('Deleted: ' + path, 'info'); }
  else alert('Failed: ' + (r.error || r.detail));
}

async function createHostItem() {
  const name = document.getElementById('new-file-name').value.trim();
  if (!name) return;
  const base = document.getElementById('explorer-path').value;
  const full = (base + '/' + name).replace(/\/+/g, '/');
  const type = document.querySelector('input[name="new-type"]:checked').value;
  const writePath = type === 'directory' ? full + '/.keep' : full;
  await api('POST', '/api/fs/write', { filePath: writePath, content: '' });
  document.getElementById('new-file-name').value = '';
  toggleNewFileForm();
  fetchExplorer(base);
  addLog('Created: ' + full, 'info');
}

function toggleNewFileForm() {
  const f = document.getElementById('new-file-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

async function fetchSysInfo() {
  const d = await api('GET', '/api/fs/sysinfo');
  document.getElementById('sys-hostname').innerHTML  =
    esc(d.hostname || 'cshunter-node-vm') +
    ' <span class="badge" style="background:rgba(255,106,42,.15);color:var(--cyan);">GUEST VNET</span>';
  document.getElementById('sys-hypervisor').textContent = d.hypervisor || '...';
  document.getElementById('sys-mem').textContent  = (d.freeMem || '?') + ' / ' + (d.totalMem || '?');
  document.getElementById('sys-arch').textContent = (d.arch || '?') + ' (Cores: ' + (d.cpus || '?') + ')';
  document.getElementById('sys-os').textContent   = d.osRelease || 'Standard Sandbox';
}
