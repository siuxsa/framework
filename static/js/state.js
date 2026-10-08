// ═══════════════════════════════════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════
let tools      = [];
let folders    = [];
let registryView = 'all';   // 'all' | 'folders'
let openFolderId = null;     // when in 'folders' view and a folder is opened
let tasks      = [];
let selectedTaskIds = new Set();   // transient multi-select for parallel grouping
let savedPipes = [];
let logs       = [];
let runningTools = [];
let isExecuting  = false;
let sseConnected = false;
let target = '';
let currentEnv = { cwd: '~', baseCwd: '', user: '', host: '', home: '', shell: '' };
let selectedTask = null;
let sidebarWidth = 480;
let abortController = null;
let isInitialLoad = true;
let saveTargetTimer = null;
let dragSrcIndex = null;
let dragSrcList  = null;
let explorerItems = [];
