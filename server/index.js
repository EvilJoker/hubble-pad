const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
  // 默认路径：~/.local/.hubble-pad
  const homeDir = os.homedir();
  return path.join(homeDir, '.local', '.hubble-pad');
}

const dataDir = getDataDir();

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
    if (!fs.existsSync(workitemsFile)) {
      fs.writeFileSync(workitemsFile, '[]\n', 'utf-8');
    }
    if (!fs.existsSync(hooksFile)) {
      fs.writeFileSync(hooksFile, '[]\n', 'utf-8');
    }
  }
}

ensureDataDir();

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

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

    for (const it of json) {
      if (!it || typeof it !== 'object') throw new Error('workitem must be object');
      const reqFields = ['id', 'title', 'description', 'url'];
      for (const f of reqFields) {
        if (typeof it[f] !== 'string') throw new Error(`workitem.${f} must be string`);
      }
    }

    const target = path.join(dataDir, 'workitems.json');
    fs.writeFileSync(target, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
});

// API: 保存 hooks 文件
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

// API: 运行 hook
app.post('/__hooks/run/:name', async (req, res) => {
  // TODO: 实现 hook 运行逻辑（如果需要）
  res.status(501).json({ error: 'Not implemented' });
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

// 启动服务器
app.listen(PORT, () => {
  console.log(`Hubble Pad server is running at http://localhost:${PORT}`);
  console.log(`Serving static files from: ${distDir}`);
  console.log(`Data directory: ${dataDir}`);
});

// 处理未捕获的错误
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
