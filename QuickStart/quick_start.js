#!/usr/bin/env node

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');


// ==========================
// 基础路径
// ==========================

const ROOT = path.resolve(__dirname, '..');

const SERVER_DIR = path.join(ROOT, 'ADMINSERVER');

const CLIENT_DIR = path.join(ROOT, 'ADMINCLIENT');


// ==========================
// env 解析
// ==========================

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;

  const content = fs.readFileSync(filePath, 'utf-8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }
  return result;
}

function loadEnv(dir) {
  const files = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.development.local'
  ];

  let env = {};
  for (const f of files) {
    env = { ...env, ...parseEnvFile(path.join(dir, f)) };
  }
  return env;
}

const CLIENT_ENV = loadEnv(CLIENT_DIR);
const SERVER_ENV = loadEnv(SERVER_DIR);


// ==========================
// 从 env 推导地址
// ==========================

function normalizeHost(host) {
  if (!host) return 'localhost';
  if (host === '0.0.0.0') return 'localhost';
  return host;
}

const CLIENT_HOST = normalizeHost(
  CLIENT_ENV.VITE_OPEN_CLIENT || 'localhost'
);
const CLIENT_PORT = Number(
  CLIENT_ENV.VITE_OPEN_CLIENT_PORT || 5173
);

function resolveBackendUrl(env) {
  const raw =
    env.VITE_SERVER_URL ||
    env.VITE_DEVELOPMENT_SERVER_URL ||
    '';

  if (!raw) return 'http://localhost:3000';
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '');
  return 'http://' + raw.replace(/\/$/, '');
}

const BACKEND_URL = resolveBackendUrl(CLIENT_ENV);


// ==========================
// 配置
// ==========================

const SERVER = {
  name: 'SERVER',
  cwd: SERVER_DIR,
  command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
  args: ['run', 'start:dev'],
  readyKeywords: [
    'Nest application successfully started',
    'Application is running on'
  ]
};


const CLIENT = {
  name: 'CLIENT',
  cwd: CLIENT_DIR,
  command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
  args: ['run', 'dev'],
  readyKeywords: [
    'Local:',
    'ready in'
  ]
};


// ==========================
// 全局状态
// ==========================

const processes = [];

let shuttingDown = false;

let runtimeClientUrl = `http://${CLIENT_HOST}:${CLIENT_PORT}`;


// ==========================
// Banner
// ==========================

const LINE = '='.repeat(64);

const banner = [
  LINE,
  '██╗  ██╗ ██████╗    ███████╗████████╗██████╗ ',
  '██║  ██║██╔════╝    ██╔════╝╚══██╔══╝██╔══██╗',
  '███████║██║         █████╗     ██║   ██████╔╝',
  '██╔══██║██║         ██╔══╝     ██║   ██╔═══╝ ',
  '██║  ██║╚██████╗    ███████╗   ██║   ██║     ',
  '╚═╝  ╚═╝ ╚═════╝    ╚══════╝   ╚═╝   ╚═╝     ',
  LINE,
  '             汇创 ETP 启动中......'
];

function printBanner() {
  console.log(banner.join('\n'));
}


// ==========================
// 打开浏览器
// ==========================

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      // Windows 下 start 第一个参数是窗口标题，必须给空串
      spawn('cmd', ['/c', 'start', '', url], {
        stdio: 'ignore',
        detached: true
      }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], {
        stdio: 'ignore',
        detached: true
      }).unref();
    } else {
      spawn('xdg-open', [url], {
        stdio: 'ignore',
        detached: true
      }).unref();
    }
  } catch (e) {
    console.error(`[Frontend] 打开浏览器失败: ${e.message}`);
  }
}


// ==========================
// 启动 NestJS
// ==========================

function startServer() {
  return new Promise((resolve) => {
    console.log('[Backend] 正在启动 NestJS...');

    const child = spawn(SERVER.command, SERVER.args, {
      cwd: SERVER.cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    processes.push(child);

    child.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(`[Backend] ${text}`);

      if (SERVER.readyKeywords.some((k) => text.includes(k))) {
        console.log('[Backend] NestJS 启动完成');
        resolve();
      }
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(`[Backend] ${data}`);
    });

    child.on('exit', (code) => {
      console.log(`[Backend] 已退出 ${code}`);
      if (!shuttingDown) shutdown();
    });
  });
}


// ==========================
// 启动 Vue
// ==========================

function extractClientUrl(text) {
  const matches = text.match(/https?:\/\/[^\s/]+(:\d+)?\/?/g);
  if (!matches) return null;

  for (const m of matches) {
    if (/localhost|127\.0\.0\.1/i.test(m)) {
      return m.replace(/\/$/, '');
    }
  }
  return matches[0].replace(/\/$/, '');
}

function printStartupInfo() {
  console.log([
    '================================================',
    ' HC ETP 已启动',
    ` Backend:  ${BACKEND_URL}`,
    ` Frontend: ${runtimeClientUrl}`,
    '================================================'
  ].join('\n'));
}

function startClient() {
  return new Promise((resolve) => {
    console.log('[Frontend] 正在启动 Vue...');

    const child = spawn(CLIENT.command, CLIENT.args, {
      cwd: CLIENT.cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    processes.push(child);

    let resolved = false;

    const handleReady = (text) => {
      const url = extractClientUrl(text);
      if (url) runtimeClientUrl = url;

      if (resolved) return;
      resolved = true;

      console.log('[Frontend] Vue 启动完成');
      printStartupInfo();

      // 启动成功后自动打开浏览器
      openBrowser(runtimeClientUrl);

      resolve();
    };

    child.stdout.on('data', (data) => {
      const text = data.toString();

      // 统一用 [Frontend] 前缀输出，避免原始 ➜ Local 等杂乱内容
      process.stdout.write(`[Frontend] ${text}`);

      if (
        CLIENT.readyKeywords.some((k) => text.includes(k)) ||
        extractClientUrl(text)
      ) {
        handleReady(text);
      }
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      process.stderr.write(`[Frontend] ${text}`);

      if (
        CLIENT.readyKeywords.some((k) => text.includes(k)) ||
        extractClientUrl(text)
      ) {
        handleReady(text);
      }
    });

    child.on('exit', (code) => {
      console.log(`[Frontend] 已退出 ${code}`);
      if (!shuttingDown) shutdown();
    });
  });
}


// ==========================
// 关闭所有服务
// ==========================

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('正在关闭 HC ETP...');

  for (const child of processes) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', child.pid, '/f', '/t'], { stdio: 'ignore' });
      } else {
        process.kill(-child.pid, 'SIGTERM');
      }
    } catch (e) {}
  }

  setTimeout(() => process.exit(), 1000);
}


// ==========================
// 信号监听
// ==========================

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);


// ==========================
// 启动流程
// ==========================

(async () => {
  printBanner();

  console.log(`[ENV] Backend  -> ${BACKEND_URL}`);
  console.log(`[ENV] Frontend -> http://${CLIENT_HOST}:${CLIENT_PORT}`);

  await startServer();
  await startClient();
})();