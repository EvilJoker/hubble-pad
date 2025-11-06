const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');

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

// API: 运行单个 hook
app.post('/__hooks/run/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const hooksFile = path.join(dataDir, 'hooks.json');
    if (!fs.existsSync(hooksFile)) {
      return res.status(404).json({ error: 'hooks.json not found' });
    }

    const hooks = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'));
    const hook = Array.isArray(hooks) ? hooks.find(h => h.name === name) : null;

    if (!hook) {
      return res.status(404).json({ error: `Hook "${name}" not found` });
    }

    if (!hook.enabled) {
      return res.status(400).json({ error: `Hook "${name}" is disabled` });
    }

    // 执行 hook 命令
    const { exec } = require('child_process');
    const cmd = hook.cmd;
    const cwd = hook.cwd ? path.resolve(rootDir, hook.cwd) : rootDir;

    exec(cmd, { cwd, timeout: 300000 }, (error, stdout, stderr) => {
      // 更新 hook 状态
      const updatedHooks = hooks.map(h => {
        if (h.name === name) {
          return {
            ...h,
            lastRunAt: new Date().toISOString(),
            lastError: error ? (stderr || error.message) : null
          };
        }
        return h;
      });
      fs.writeFileSync(hooksFile, JSON.stringify(updatedHooks, null, 2) + '\n', 'utf-8');

      if (error) {
        return res.status(500).json({ error: error.message, stderr });
      }
      res.json({ ok: true, stdout });
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// API: 运行所有 hooks
app.post('/__hooks/run-all', async (req, res) => {
  try {
    const hooksFile = path.join(dataDir, 'hooks.json');
    if (!fs.existsSync(hooksFile)) {
      return res.status(404).json({ error: 'hooks.json not found' });
    }

    const hooks = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'));
    const enabledHooks = Array.isArray(hooks) ? hooks.filter(h => h.enabled) : [];

    if (enabledHooks.length === 0) {
      return res.json({ ok: true, message: 'No enabled hooks to run' });
    }

    // 异步执行所有 hooks，不等待完成
    const { exec } = require('child_process');
    enabledHooks.forEach(hook => {
      const cmd = hook.cmd;
      const cwd = hook.cwd ? path.resolve(rootDir, hook.cwd) : rootDir;

      exec(cmd, { cwd, timeout: 300000 }, (error, stdout, stderr) => {
        // 更新 hook 状态
        const updatedHooks = hooks.map(h => {
          if (h.name === hook.name) {
            return {
              ...h,
              lastRunAt: new Date().toISOString(),
              lastError: error ? (stderr || error.message) : null
            };
          }
          return h;
        });
        fs.writeFileSync(hooksFile, JSON.stringify(updatedHooks, null, 2) + '\n', 'utf-8');
      });
    });

    res.json({ ok: true, message: `Running ${enabledHooks.length} hooks` });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

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
