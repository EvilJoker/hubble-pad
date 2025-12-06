const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// 获取服务器所在目录的绝对路径
const serverDir = __dirname;
const rootDir = path.resolve(serverDir, '..');
const distDir = path.resolve(rootDir, 'dist');

// 检查 dist 目录是否存在
if (!fs.existsSync(distDir)) {
  console.error(`Error: dist directory not found at ${distDir}`);
  console.error('Please run "npm run build" first to build the project.');
  process.exit(1);
}

// 获取 data 目录路径（支持环境变量配置）
function getDataDir() {
  if (process.env.HUBBLE_PAD_DATA_DIR) {
    return path.resolve(process.env.HUBBLE_PAD_DATA_DIR);
  }
  // 默认路径：优先使用当前工作目录下的 data 目录，如果没有则使用 ~/.local/.hubble-pad
  const currentWorkingDir = process.cwd();
  const currentDirData = path.resolve(currentWorkingDir, 'data');
  if (fs.existsSync(currentDirData)) {
    return currentDirData;
  }
  // 如果当前工作目录没有 data 目录，则使用 ~/.local/.hubble-pad
  const homeDir = os.homedir();
  return path.join(homeDir, '.local', '.hubble-pad');
}

const dataDir = getDataDir();

// 生成类似 Git commit 的 40 位十六进制 ID
function generateCommitLikeId() {
  return crypto.randomBytes(20).toString('hex');
}

// 规范化 workitem 的 id：
// - 如果调用方已经提供了非空 id，则直接使用，不再强制转换为 40 位
// - 只有在缺少 id 时，才自动生成一个 40 位的随机值
function normalizeWorkitemId(it, seed) {
  const id = typeof it.id === 'string' ? it.id.trim() : '';
  if (id) {
    return id;
  }
  // 兼容旧调用签名保留 seed 参数，但当前逻辑不再依赖 seed，直接生成随机 id
  return generateCommitLikeId();
}

// 确保 data 目录存在
function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    // 创建必要的子目录
    const logsDir = path.join(dataDir, 'logs');
    const hooksDir = path.join(dataDir, 'hook');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

    // 初始化必要的文件
    const workitemsFile = path.join(dataDir, 'workitems.json');
    const hooksFile = path.join(dataDir, 'hooks.json');
    const kindsFile = path.join(dataDir, 'kind.json');
    const notifyFile = path.join(dataDir, 'notify.json');
    if (!fs.existsSync(workitemsFile)) {
      fs.writeFileSync(workitemsFile, '[]\n', 'utf-8');
    }
    if (!fs.existsSync(hooksFile)) {
      fs.writeFileSync(hooksFile, '[]\n', 'utf-8');
    }
    if (!fs.existsSync(kindsFile)) {
      const defaultKinds = [
        {
          value: 'code',
          label: 'Code',
          color: 'bg-blue-100 text-blue-700',
          description: '用于代码相关的工作项',
          example: JSON.stringify({
            id: 'CODE-001',
            title: '示例：代码审查任务',
            description: '这是一个代码类型的示例工作项，用于演示系统功能',
            url: 'https://example.com/workitems/code-001',
            kind: 'code',
            attributes: {
              repository: 'github.com/example/repo',
              branch: 'main',
              priority: 'high',
              status: 'in-progress',
            },
            favorite: false,
            storage: {
              records: [
                {
                  content: '20251204 开始代码审查工作，发现3个潜在问题',
                  type: 'update',
                  createdAt: '2025-12-04T10:00:00.000Z',
                },
              ],
            },
          }, null, 2),
        },
        {
          value: 'task',
          label: 'Task',
          color: 'bg-green-100 text-green-700',
          description: '用于任务管理',
          example: JSON.stringify({
            id: 'TASK-001',
            title: '示例：任务管理项',
            description: '这是一个任务类型的示例工作项',
            url: 'https://example.com/workitems/task-001',
            kind: 'task',
            attributes: {
              assignee: '张三',
              dueDate: '2025-12-31',
              priority: 'medium',
              status: 'todo',
            },
            favorite: false,
            storage: {
              records: [
                {
                  content: '20251203 任务已分配给开发团队',
                  type: 'update',
                  createdAt: '2025-12-03T14:30:00.000Z',
                },
                {
                  content: '20251204 开发进度50%，预计下周完成',
                  type: 'update',
                  createdAt: '2025-12-04T09:15:00.000Z',
                },
              ],
            },
          }, null, 2),
        },
        {
          value: 'environment',
          label: 'Environment',
          color: 'bg-purple-100 text-purple-700',
          description: '用于环境配置相关的工作项',
          example: JSON.stringify({
            id: 'ENV-001',
            title: '示例：环境配置项',
            description: '这是一个环境类型的示例工作项，用于管理开发环境配置',
            url: 'https://example.com/workitems/env-001',
            kind: 'environment',
            attributes: {
              environment: 'production',
              region: 'cn-north-1',
              status: 'active',
              version: 'v1.2.3',
            },
            favorite: false,
            storage: {
              records: [],
            },
          }, null, 2),
        },
        {
          value: 'knowledge',
          label: 'Knowledge',
          color: 'bg-yellow-100 text-yellow-700',
          description: '用于知识文档管理',
          example: JSON.stringify({
            id: 'KNOW-001',
            title: '示例：知识文档',
            description: '这是一个知识类型的示例工作项，用于文档管理',
            url: 'https://example.com/workitems/know-001',
            kind: 'knowledge',
            attributes: {
              category: 'documentation',
              version: '1.0',
              author: '李四',
              tags: ['guide', 'tutorial'],
            },
            favorite: true,
            storage: {
              records: [
                {
                  content: '20251201 创建初始文档结构',
                  type: 'update',
                  createdAt: '2025-12-01T08:00:00.000Z',
                },
                {
                  content: '20251202 完成API文档编写',
                  type: 'update',
                  createdAt: '2025-12-02T16:45:00.000Z',
                },
                {
                  content: '20251203 添加使用示例和最佳实践',
                  type: 'update',
                  createdAt: '2025-12-03T11:20:00.000Z',
                },
              ],
            },
          }, null, 2),
        },
      ];
      fs.writeFileSync(kindsFile, JSON.stringify(defaultKinds, null, 2) + '\n', 'utf-8');
    }
    if (!fs.existsSync(notifyFile)) {
      fs.writeFileSync(notifyFile, '[]\n', 'utf-8');
    }
  }
}

ensureDataDir();

const app = express();
const PORT = parseInt(process.env.PORT || '10002', 10);

// 解析 JSON 请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: 'application/json', limit: '10mb' }));

// API: 获取 data 路径配置
app.get('/api/config', (req, res) => {
  res.json({ dataDir });
});

// API: 提供 data 文件服务
app.get('/data/*', (req, res) => {
  const url = req.url || '';
  const rel = decodeURIComponent(url.replace(/^\/data\/?/, ''));
  const filePath = path.join(dataDir, rel);

  // 安全检查：确保文件在 dataDir 内
  if (!filePath.startsWith(dataDir)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// API: 保存 data 文件
app.post('/__data/save', (req, res) => {
  try {
    const body = req.body;
    let json;

    // 支持两种格式：JSON 对象或字符串
    if (typeof body === 'string') {
      json = JSON.parse(body);
    } else {
      json = body;
    }

    // 验证 workitems 格式
    if (!Array.isArray(json)) {
      throw new Error('workitems must be an array');
    }

    const target = path.join(dataDir, 'workitems.json');
    const exists = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '[]';
    const current = JSON.parse(exists || '[]');
    const map = new Map(current.map((x) => [x.id, x]));

    const normalized = [];
    for (const it of json) {
      if (!it || typeof it !== 'object') throw new Error('workitem must be object');
      const reqFields = ['title', 'description', 'url'];
      for (const f of reqFields) {
        if (typeof it[f] !== 'string') throw new Error(`workitem.${f} must be string`);
      }
      const next = Object.assign({}, it);
      next.id = normalizeWorkitemId(
        it,
        `manual:${String(it.id || '')}:${String(it.title || '')}:${String(it.url || '')}`,
      );
      // 保留现有的 storage 字段（本地信息）
      const existing = map.get(next.id);
      if (existing && existing.storage) {
        next.storage = existing.storage;
      }
      normalized.push(next);
    }

    fs.writeFileSync(target, JSON.stringify(normalized, null, 2) + '\n', 'utf-8');
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
});

// API: 切换 workitem 的收藏状态
app.post('/__data/toggle-favorite/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { favorite } = req.body;

    if (typeof favorite !== 'boolean') {
      return res.status(400).json({ ok: false, message: 'favorite must be boolean' });
    }

    const target = path.join(dataDir, 'workitems.json');
    if (!fs.existsSync(target)) {
      return res.status(404).json({ ok: false, message: 'workitems.json not found' });
    }

    const content = fs.readFileSync(target, 'utf-8');
    const workitems = JSON.parse(content);

    if (!Array.isArray(workitems)) {
      return res.status(400).json({ ok: false, message: 'workitems must be an array' });
    }

    const item = workitems.find(it => it && it.id === id);
    if (!item) {
      return res.status(404).json({ ok: false, message: `WorkItem with id "${id}" not found` });
    }

    // 更新收藏状态
    if (favorite) {
      item.favorite = true;
    } else {
      delete item.favorite;
    }

    // 原子写入：先写到临时文件，再重命名，避免并发写入导致数据丢失
    const tmpFile = target + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(workitems, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmpFile, target);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
});

// API: 添加 workitem 的变更记录到 storage.records
app.post('/__data/add-record/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { record } = req.body;

    if (!record || typeof record !== 'object') {
      return res.status(400).json({ ok: false, message: 'record must be an object' });
    }

    const target = path.join(dataDir, 'workitems.json');
    if (!fs.existsSync(target)) {
      return res.status(404).json({ ok: false, message: 'workitems.json not found' });
    }

    const content = fs.readFileSync(target, 'utf-8');
    const workitems = JSON.parse(content);

    if (!Array.isArray(workitems)) {
      return res.status(400).json({ ok: false, message: 'workitems must be an array' });
    }

    const item = workitems.find(it => it && it.id === id);
    if (!item) {
      return res.status(404).json({ ok: false, message: `WorkItem with id "${id}" not found` });
    }

    // 确保 storage 对象存在
    if (!item.storage) {
      item.storage = {};
    }
    // 确保 records 数组存在
    if (!Array.isArray(item.storage.records)) {
      item.storage.records = [];
    }

    // 添加时间戳（如果记录中没有）
    const recordWithTime = {
      ...record,
      createdAt: record.createdAt || new Date().toISOString(),
    };

    // 添加到 records 数组
    item.storage.records.push(recordWithTime);

    // 原子写入：先写到临时文件，再重命名，避免并发写入导致数据丢失
    const tmpFile = target + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(workitems, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmpFile, target);
    res.json({ ok: true, record: recordWithTime });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
});

// API: 删除指定 workitem（按 id）
app.post('/__data/delete/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, message: 'id is required' });
    }

    const target = path.join(dataDir, 'workitems.json');
    if (!fs.existsSync(target)) {
      return res.status(404).json({ ok: false, message: 'workitems.json not found' });
    }

    const content = fs.readFileSync(target, 'utf-8');
    const workitems = JSON.parse(content || '[]');
    if (!Array.isArray(workitems)) {
      return res.status(400).json({ ok: false, message: 'workitems must be an array' });
    }

    const before = workitems.length;
    const next = workitems.filter((it) => !it || typeof it !== 'object' ? false : it.id !== id);
    const after = next.length;

    if (before === after) {
      return res.status(404).json({ ok: false, message: `WorkItem with id "${id}" not found` });
    }

    const tmpFile = target + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(next, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmpFile, target);

    return res.json({ ok: true, deleted: before - after });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
});

// API: 获取 hooks 列表
app.get('/__hooks/list', (req, res) => {
  try {
    const hooksFile = path.join(dataDir, 'hooks.json');
    if (!fs.existsSync(hooksFile)) {
      return res.json([]);
    }
    const content = fs.readFileSync(hooksFile, 'utf-8');
    const hooks = JSON.parse(content);
    res.json(Array.isArray(hooks) ? hooks : []);
  } catch (error) {
    console.error('Error reading hooks:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Unified client log endpoint (compat with dev server). Swallows logs to file.
app.post('/__log', (req, res) => {
  try {
    const logDir = path.join(dataDir, 'logs');
    try { if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true }); } catch {}
    const logFile = path.join(logDir, 'dev.log');
    const entry = Object.assign({ time: new Date().toISOString() }, req.body || {});
    try { fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8'); } catch {}
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
});

// API: 保存 hooks 文件
// API: 获取 kinds 配置
app.get('/__data/kinds', (req, res) => {
  try {
    const kindsFile = path.join(dataDir, 'kind.json');
    if (!fs.existsSync(kindsFile)) {
      res.json([]);
      return;
    }
    const content = fs.readFileSync(kindsFile, 'utf-8');
    const kinds = JSON.parse(content || '[]');
    res.json(kinds);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// API: 获取 notify 列表（可选按 workitemId 过滤）
app.get('/__data/notify', (req, res) => {
  try {
    const notifyFile = path.join(dataDir, 'notify.json');
    if (!fs.existsSync(notifyFile)) {
      res.json([]);
      return;
    }
    const content = fs.readFileSync(notifyFile, 'utf-8');
    const items = JSON.parse(content || '[]');
    const workitemId = typeof req.query.workitemId === 'string' ? req.query.workitemId : '';
    let result = Array.isArray(items) ? items : [];
    if (workitemId) {
      result = result.filter((it) => it && it.workitemId === workitemId);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// API: 更新 notify（支持新增和清理）
// body: { action: 'add' | 'clearByWorkitem' | 'clearAll' | 'removeById' | 'removeByIds', item?, workitemId?, id?, ids? }
app.post('/__data/notify', (req, res) => {
  try {
    const body = req.body || {};
    const action = body.action;
    const notifyFile = path.join(dataDir, 'notify.json');
    const exists = fs.existsSync(notifyFile) ? fs.readFileSync(notifyFile, 'utf-8') : '[]';
    let items = JSON.parse(exists || '[]');
    if (!Array.isArray(items)) items = [];

    if (action === 'add') {
      const item = body.item || {};
      if (!item || typeof item !== 'object') {
        throw new Error('item must be object');
      }
      const now = new Date().toISOString();
      const id = typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : generateCommitLikeId();
      const next = {
        id,
        title: typeof item.title === 'string' ? item.title : '提醒',
        content: typeof item.content === 'string' ? item.content : '',
        workitemId: typeof item.workitemId === 'string' ? item.workitemId : undefined,
        createdAt: item.createdAt || now,
      };
      items.push(next);
    } else if (action === 'clearByWorkitem') {
      const workitemId = typeof body.workitemId === 'string' ? body.workitemId : '';
      if (!workitemId) {
        throw new Error('workitemId is required');
      }
      items = items.filter((it) => !it || it.workitemId !== workitemId);
    } else if (action === 'clearAll') {
      items = [];
    } else if (action === 'removeById') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) {
        throw new Error('id is required');
      }
      items = items.filter((it) => !it || it.id !== id);
    } else if (action === 'removeByIds') {
      const ids = Array.isArray(body.ids) ? body.ids : [];
      if (ids.length === 0) {
        throw new Error('ids array is required and cannot be empty');
      }
      const idSet = new Set(ids.filter((id) => typeof id === 'string' && id.trim()));
      items = items.filter((it) => !it || !idSet.has(it.id));
    } else {
      throw new Error('invalid action');
    }

    const tmpFile = notifyFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(items, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmpFile, notifyFile);

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
});

// API: 保存 kinds 配置
app.post('/__data/kinds', (req, res) => {
  try {
    const body = req.body;
    let json;

    // 支持两种格式：JSON 对象或字符串
    if (typeof body === 'string') {
      json = JSON.parse(body);
    } else {
      json = body;
    }

    // 验证 kinds 格式
    if (!Array.isArray(json)) {
      throw new Error('kinds must be an array');
    }

    // 验证每个 kind 项
    for (const kind of json) {
      if (!kind || typeof kind !== 'object') {
        throw new Error('kind must be object');
      }
      if (typeof kind.value !== 'string' || !kind.value.trim()) {
        throw new Error('kind.value must be non-empty string');
      }
      if (typeof kind.label !== 'string' || !kind.label.trim()) {
        throw new Error('kind.label must be non-empty string');
      }
      if (typeof kind.color !== 'string') {
        throw new Error('kind.color must be string');
      }
    }

    const kindsFile = path.join(dataDir, 'kind.json');
    const tmpFile = kindsFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmpFile, kindsFile);

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/__hooks/save', (req, res) => {
  try {
    const body = req.body;
    let json;

    if (typeof body === 'string') {
      json = JSON.parse(body);
    } else {
      json = body;
    }

    if (!Array.isArray(json)) {
      throw new Error('hooks must be an array');
    }

    const target = path.join(dataDir, 'hooks.json');
    fs.writeFileSync(target, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
});

// API: 运行单个 hook
app.post('/__hooks/run/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const hooksFile = path.join(dataDir, 'hooks.json');
    if (!fs.existsSync(hooksFile)) {
      return res.status(404).json({ error: 'hooks.json not found' });
    }

    const hooks = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'));
    let hook = null;
    let hookIndex = -1;
    if (Array.isArray(hooks)) {
      // 兼容两种调用：按名称或按索引
      const idx = Number(name);
      if (!Number.isNaN(idx)) {
        hook = hooks[idx];
        hookIndex = idx;
      }
      if (!hook) {
        hookIndex = hooks.findIndex(h => h && h.name === name);
        if (hookIndex >= 0) {
          hook = hooks[hookIndex];
        }
      }
    }

    if (!hook) {
      return res.status(404).json({ error: `Hook "${name}" not found` });
    }

    if (!hook.enabled) {
      return res.status(400).json({ error: `Hook "${name}" is disabled` });
    }

    const result = await executeHook(hook, hookIndex);
    if (result.ok) {
      const count = Array.isArray(result.items) ? result.items.length : 0;
      return res.json({ ok: true, merged: hook.type === 'update', count });
    } else {
      return res.status(500).json({ error: result.error, stderr: result.stderr });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 定时任务调度器
const scheduledTasks = new Map(); // 存储定时任务 ID

// 执行单个 hook（内部函数，供定时任务和手动触发使用）
async function executeHook(hook, hookIndex) {
  return new Promise((resolve) => {
    const hooksFile = path.join(dataDir, 'hooks.json');
    const { exec } = require('child_process');
    const cmd = hook.cmd;
    const cwd = hook.cwd ? path.resolve(rootDir, hook.cwd) : rootDir;

    exec(cmd, { cwd, timeout: 300000 }, async (error, stdout, stderr) => {
          const nowISO = new Date().toISOString();
      try {
        const hooks = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'));
        const updatedHooks = hooks.map((x, xi) => {
          // 通过名称或索引匹配
          const isTarget = (hookIndex >= 0 && xi === hookIndex) || (x && x.name === hook.name);
          return isTarget ? {
            ...x,
            lastRunAt: nowISO,
            lastError: error ? (stderr || error?.message) : null,
          } : x;
        });
        fs.writeFileSync(hooksFile, JSON.stringify(updatedHooks, null, 2) + '\n', 'utf-8');
      } catch (e) {
        // 忽略更新错误
      }

      if (error) {
        return resolve({ ok: false, error: error.message, stderr });
      }

          // 解析 JSON
          let parsed;
          try {
            const out = String(stdout || '').trim();
        if (!out || out.trim() === '') {
          return resolve({
            ok: false,
            error: 'Hook 未输出有效的 JSON 结果',
            stderr: stderr || '脚本执行完成但无输出',
          });
        }
        // 优先查找 response= 格式的输出
        let jsonStr = '';
        const responseMatch = out.match(/response\s*=\s*(\{[\s\S]*\})/i);
        if (responseMatch && responseMatch[1]) {
          jsonStr = responseMatch[1];
        } else {
          // 如果没有找到 response= 格式，回退到原来的解析方式
          // 查找最后一个完整的 JSON 对象
          const jsonMatch = out.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}$/s);
          if (jsonMatch) {
            jsonStr = jsonMatch[0];
          } else {
            // 如果正则匹配失败，尝试简单的匹配
            const simpleMatch = out.match(/\{[\s\S]*\}$/);
            jsonStr = simpleMatch ? simpleMatch[0] : out;
          }
          // 如果还是找不到，尝试直接解析整个输出
          if (!jsonStr || jsonStr.trim() === '') {
            jsonStr = out;
          }
        }
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        return resolve({
          ok: false,
          error: `JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`,
          stderr: stderr || `stdout: ${String(stdout || '').slice(0, 200)}`,
        });
      }

          const ok = !!(parsed && (parsed.ok === true || parsed.status === 'success'));
          const items = Array.isArray(parsed?.items) ? parsed.items : [];

      // 如果 parsed 中有 error 字段，使用它作为错误信息
      if (!ok && parsed && typeof parsed.error === 'string') {
        return resolve({
          ok: false,
          error: parsed.error,
          stderr: stderr || '',
        });
      }

      // 如果是更新信息类任务，合并到 workitems.json
      if (ok && items.length > 0 && hook.type === 'update') {
        try {
          const workitemsFile = path.join(dataDir, 'workitems.json');
          const exists = fs.existsSync(workitemsFile) ? fs.readFileSync(workitemsFile, 'utf-8') : '[]';
          const current = JSON.parse(exists || '[]');
          const map = new Map(current.map((x) => [x.id, x]));
          const filtered = items
            .filter((it) => it && typeof it === 'object'
              && typeof it.title === 'string'
              && typeof it.description === 'string'
              && typeof it.url === 'string')
            .map((it) => {
              const next = Object.assign({}, it);
              next.id = normalizeWorkitemId(
                it,
                `hook:${hook?.name || hookIndex}:${String(it.id || '')}:${String(it.url || '')}`,
              );
              return next;
            });

          for (const it of filtered) {
            const existing = map.get(it.id);
            const next = {
              ...it,
              source: `hook:${hook?.name || hookIndex}`,
              updatedAt: nowISO,
              ...(existing && existing.storage ? { storage: existing.storage } : {}),
            };
            map.set(next.id, next);
          }

          const tmp = workitemsFile + '.tmp';
          fs.writeFileSync(tmp, JSON.stringify(Array.from(map.values()), null, 2) + '\n', 'utf-8');
          fs.renameSync(tmp, workitemsFile);
        } catch (e) {
          // 合并失败不影响任务执行结果
        }
      }

      resolve({ ok, items });
    });
  });
}

// 启动定时任务调度
function startScheduledTasks() {
  const hooksFile = path.join(dataDir, 'hooks.json');
  if (!fs.existsSync(hooksFile)) return;

  try {
    const hooks = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'));
    if (!Array.isArray(hooks)) return;

    // 清除所有现有定时任务
    scheduledTasks.forEach((taskId) => clearInterval(taskId));
    scheduledTasks.clear();

    // 为每个启用的任务设置定时
    hooks.forEach((hook, index) => {
      if (!hook || !hook.enabled || !hook.schedule) return;

      const schedule = hook.schedule.trim();
      if (!schedule) return;

      // 解析定时设置：支持毫秒间隔或 cron 表达式
      let intervalMs = null;

      // 尝试解析为数字（毫秒间隔）
      const numSchedule = Number(schedule);
      if (!Number.isNaN(numSchedule) && numSchedule > 0) {
        intervalMs = numSchedule;
      } else {
        // 简单的 cron 表达式解析
        // 支持格式：
        // - 0 */N * * * (每 N 小时)
        // - */N * * * * (每 N 分钟)
        // - 0 H * * D (每周 D 天 H 点，D=0-6，0=周日，1=周一)
        const hourCronMatch = schedule.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/); // 0 */N * * *
        if (hourCronMatch) {
          const hours = parseInt(hourCronMatch[1], 10);
          if (hours > 0) {
            intervalMs = hours * 60 * 60 * 1000;
          }
        } else {
          const minuteCronMatch = schedule.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/); // */N * * * *
          if (minuteCronMatch) {
            const minutes = parseInt(minuteCronMatch[1], 10);
            if (minutes > 0) {
              intervalMs = minutes * 60 * 1000;
            }
          } else {
            // 支持每周特定时间：0 H * * D (每周 D 天 H 点)
            // 例如：0 9 * * 1 表示每周一早上 9 点
            const weeklyCronMatch = schedule.match(/^0\s+(\d+)\s+\*\s+\*\s+(\d+)$/); // 0 H * * D
            if (weeklyCronMatch) {
              const hour = parseInt(weeklyCronMatch[1], 10);
              const dayOfWeek = parseInt(weeklyCronMatch[2], 10);
              if (hour >= 0 && hour < 24 && dayOfWeek >= 0 && dayOfWeek <= 6) {
                // 计算到下一个执行时间的毫秒数
                const now = new Date();
                const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
                const currentHour = now.getHours();

                // cron 格式：0=Sunday, 1=Monday, ..., 6=Saturday
                // JavaScript Date.getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
                // 所以 dayOfWeek 可以直接使用

                let daysUntilNext = dayOfWeek - currentDay;
                if (daysUntilNext < 0) {
                  daysUntilNext += 7; // 下周
                } else if (daysUntilNext === 0 && currentHour >= hour) {
                  daysUntilNext = 7; // 今天已经过了，下周
                }

                const nextRun = new Date(now);
                nextRun.setDate(now.getDate() + daysUntilNext);
                nextRun.setHours(hour, 0, 0, 0);

                intervalMs = nextRun.getTime() - now.getTime();
                // 如果计算出的时间小于 0 或大于 7 天，设置为 7 天后
                if (intervalMs < 0 || intervalMs > 7 * 24 * 60 * 60 * 1000) {
                  intervalMs = 7 * 24 * 60 * 60 * 1000;
                }
              }
            }
          }
        }
      }

      if (intervalMs && intervalMs > 0) {
        const taskId = setInterval(async () => {
          try {
            await executeHook(hook, index);
          } catch (e) {
            console.error(`[scheduled task] Error executing hook ${hook.name}:`, e);
          }
        }, intervalMs);
        scheduledTasks.set(`${hook.name}-${index}`, taskId);
        console.log(`[scheduled task] Started task "${hook.name}" with interval ${intervalMs}ms`);
      }
    });
  } catch (e) {
    console.error('[scheduled task] Error loading hooks:', e);
  }
}

// 监听 hooks.json 文件变化，重新加载定时任务
let hooksFileWatcher = null;
function watchHooksFile() {
  const hooksFile = path.join(dataDir, 'hooks.json');
  if (fs.existsSync(hooksFile)) {
    try {
      if (hooksFileWatcher) {
        fs.unwatchFile(hooksFile);
      }
      fs.watchFile(hooksFile, { interval: 2000 }, () => {
        console.log('[scheduled task] hooks.json changed, reloading scheduled tasks...');
        startScheduledTasks();
      });
    } catch (e) {
      // 忽略监听错误
    }
  }
}

// AI API 配置
const AI_API_URL = process.env.AI_API_URL || 'https://studio.zte.com.cn/zte-studio-ai-platform/openapi/v1/chat';
const AI_API_KEY = process.env.AI_API_KEY || 'a87bc16274ed4b748ad33ee1f362023c';

// API: AI 聊天接口代理
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, ...otherParams } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages must be an array' });
    }

    // 构建请求体
    const requestBody = {
      messages,
      ...otherParams,
    };

    // 解析 URL
    const url = new URL(AI_API_URL);
    const isHttps = url.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    // 准备请求选项
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
    };

    // 发送请求
    const requestPromise = new Promise((resolve, reject) => {
      const req = requestModule.request(options, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            // 设置响应头
            res.status(response.statusCode || 200);
            Object.keys(response.headers).forEach((key) => {
              if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'content-length') {
                res.setHeader(key, response.headers[key]);
              }
            });

            // 尝试解析 JSON，如果失败则返回原始数据
            try {
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } catch {
              resolve(data);
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      // 设置超时
      req.setTimeout(60000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      // 发送请求体
      req.write(JSON.stringify(requestBody));
      req.end();
    });

    const result = await requestPromise;
    res.json(result);
  } catch (error) {
    console.error('AI API error:', error);
    res.status(500).json({
      error: 'Failed to call AI API',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// 提供静态文件服务
app.use(express.static(distDir));

// 支持 SPA 路由（所有路由返回 index.html）
app.get('*', (req, res) => {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found');
  }
});

// 写入服务状态信息到 status.json
function writeStatusFile() {
  try {
    const statusFile = path.join(dataDir, 'status.json');
    const networkInterfaces = os.networkInterfaces();
    const addresses = [];

    // 收集所有 IPv4 地址
    for (const interfaceName of Object.keys(networkInterfaces)) {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        for (const iface of interfaces) {
          if (iface.family === 'IPv4' && !iface.internal) {
            addresses.push(iface.address);
          }
        }
      }
    }

    const status = {
      server: {
        ip: addresses.length > 0 ? addresses[0] : '127.0.0.1',
        port: PORT,
        url: `http://${addresses.length > 0 ? addresses[0] : '127.0.0.1'}:${PORT}`,
        localUrl: `http://127.0.0.1:${PORT}`,
      },
      dataDir: dataDir,
      startedAt: new Date().toISOString(),
    };

    fs.writeFileSync(statusFile, JSON.stringify(status, null, 2) + '\n', 'utf-8');
  } catch (error) {
    // 忽略写入错误，不影响服务启动
    console.warn('Failed to write status.json:', error.message);
  }
}

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`Hubble Pad server is running at http://localhost:${PORT}`);
  console.log(`Serving static files from: ${distDir}`);
  console.log(`Data directory: ${dataDir}`);
  // 写入状态文件
  writeStatusFile();
  // 启动定时任务调度
  startScheduledTasks();
  watchHooksFile();
});

// 优雅关闭处理（容器化支持）
function gracefulShutdown(signal) {
  console.log(`\n收到 ${signal} 信号，正在优雅关闭服务器...`);
  server.close(() => {
    console.log('HTTP 服务器已关闭');
    process.exit(0);
  });

  // 如果 10 秒后仍未关闭，强制退出
  setTimeout(() => {
    console.error('强制关闭服务器');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 处理未捕获的错误
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
