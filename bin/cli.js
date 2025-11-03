#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 获取 CLI 所在目录的绝对路径
const cliDir = __dirname;
const rootDir = path.resolve(cliDir, '..');

// 读取 package.json 获取版本号
function getVersion() {
  const packageJsonPath = path.resolve(rootDir, 'package.json');
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version || 'unknown';
  } catch (error) {
    console.error('Error reading package.json:', error.message);
    return 'unknown';
  }
}

// 解析命令行参数
const args = process.argv.slice(2);

if (args.length === 0 || (args.length === 1 && (args[0] === '--version' || args[0] === '-v'))) {
  // 显示版本号
  console.log(getVersion());
  process.exit(0);
}

if (args[0] === 'start') {
  // 启动服务器
  const serverPath = path.resolve(rootDir, 'server', 'index.js');

  // 检查服务器文件是否存在
  if (!fs.existsSync(serverPath)) {
    console.error('Error: Server file not found at', serverPath);
    process.exit(1);
  }

  // 启动服务器（继承环境变量，包括 PORT）
  const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    cwd: rootDir,
    env: process.env
  });

  server.on('error', (error) => {
    console.error('Error starting server:', error.message);
    process.exit(1);
  });

  server.on('exit', (code) => {
    process.exit(code || 0);
  });

  // 处理退出信号
  process.on('SIGINT', () => {
    server.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    server.kill('SIGTERM');
  });
} else {
  // 未知命令
  console.error(`Unknown command: ${args[0]}`);
  console.log('Available commands:');
  console.log('  start          Start the server');
  console.log('  --version, -v  Show version number');
  process.exit(1);
}
