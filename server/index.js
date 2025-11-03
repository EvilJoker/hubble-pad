const express = require('express');
const path = require('path');
const fs = require('fs');

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

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

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
