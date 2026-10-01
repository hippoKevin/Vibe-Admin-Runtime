#!/usr/bin/env node

'use strict';

const { spawn, spawnSync } = require('child_process');
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
// IndexTTS（可选语音合成服务）
// ==========================

// IndexTTS 放在仓库根 ADMINTTS/ 下（可用 INDEX_TTS_HOME 覆盖），缺失时只提示、不影响前后端
const TTS_HOME = process.env.INDEX_TTS_HOME
  ? path.resolve(String(process.env.INDEX_TTS_HOME).trim())
  : path.join(ROOT, 'ADMINTTS');

// 复用独立启动脚本，保证启动逻辑只有一份
const TTS_SCRIPT = path.join(__dirname, 'start_index_tts.js');

// node quick_start.js --no-tts    跳过 IndexTTS
// node quick_start.js --tts-only  只启动 IndexTTS
const NO_TTS = process.argv.includes('--no-tts');
const TTS_ONLY = process.argv.includes('--tts-only');

// node quick_start.js --dry-run   只打印解析出的配置，不启动任何服务
const DRY_RUN = process.argv.includes('--dry-run');

/** 读取 --key value / --key=value 形式的参数值 */
function readArgValue(name, fallback) {
  const argv = process.argv;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith(name)) continue;

    if (token === name) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) return next;
      return fallback;
    }

    if (token.startsWith(`${name}=`)) return token.slice(name.length + 1);
  }

  return fallback;
}

const TTS = {
  name: 'TTS',
  port: Number(readArgValue('--tts-port', 7860)) || 7860,
  // 首次启动要加载模型，给足等待时间
  timeout: Number(readArgValue('--tts-timeout', 600)) || 600,
  logFile: path.join(TTS_HOME, 'logs', 'index-tts.log')
};

const ttsState = {
  status: NO_TTS ? 'skipped' : 'pending'
};


// ==========================
// 依赖检查 / 自动安装
// ==========================

// 默认优先使用 pnpm，未安装时回退到 npm
// 可用环境变量 HC_PACKAGE_MANAGER=pnpm 强制指定包管理器
const PM_CANDIDATES = (() => {
  const forced = String(process.env.HC_PACKAGE_MANAGER || '').trim().toLowerCase();
  return forced ? [forced] : ['pnpm', 'npm'];
})();

// node quick_start.js --skip-install 可跳过依赖检查，直接启动
const SKIP_INSTALL = process.argv.includes('--skip-install');

// 需要检查依赖的前后端项目
const PROJECTS = [
  { label: 'Backend', dir: SERVER_DIR },
  { label: 'Frontend', dir: CLIENT_DIR }
];

let packageManager = null;


function toCommand(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function hasCommand(name) {
  const result = spawnSync(toCommand(name), ['--version'], {
    shell: true,
    stdio: 'ignore',
    timeout: 20000
  });

  return result.status === 0;
}

function resolvePackageManager() {
  if (packageManager) return packageManager;

  for (const name of PM_CANDIDATES) {
    if (hasCommand(name)) {
      packageManager = { name, command: toCommand(name) };
      return packageManager;
    }

    console.log(`[Install] 未检测到 ${name}`);
  }

  return null;
}

function readManifest(dir) {
  const file = path.join(dir, 'package.json');
  if (!fs.existsSync(file)) return null;

  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    console.error(`[Install] package.json 解析失败 ${file}: ${e.message}`);
    return null;
  }
}

function collectDependencies(manifest) {
  const names = new Set();

  for (const group of [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.optionalDependencies
  ]) {
    if (!group) continue;

    for (const name of Object.keys(group)) names.add(name);
  }

  return [...names];
}

// 判断依赖是否已安装：node_modules/<包名>/package.json 存在即视为已安装
// 该判断同时兼容 npm 与 pnpm 的目录结构（scoped 包会被正确展开）
function findMissingDependencies(dir, manifest) {
  const nodeModules = path.join(dir, 'node_modules');
  const dependencies = collectDependencies(manifest);

  if (!fs.existsSync(nodeModules)) return dependencies;

  return dependencies.filter((name) => {
    const entry = path.join(nodeModules, ...name.split('/'));
    return !fs.existsSync(path.join(entry, 'package.json'));
  });
}

function installDependencies(project, pm) {
  return new Promise((resolve, reject) => {
    console.log(`[Install] ${project.label} 正在执行 ${pm.name} install ...`);

    const child = spawn(pm.command, ['install'], {
      cwd: project.dir,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    const prefix = `[Install:${project.label}] `;

    child.stdout.on('data', (data) => {
      process.stdout.write(prefix + data);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(prefix + data);
    });

    let settled = false;

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });

    child.on('exit', (code) => {
      if (settled) return;
      settled = true;

      if (code === 0) {
        console.log(`[Install] ${project.label} 依赖安装完成`);
        resolve();
      } else {
        reject(new Error(`${project.label} 依赖安装失败，退出码 ${code}`));
      }
    });
  });
}

async function ensureDependencies() {
  if (SKIP_INSTALL) {
    console.log('[Install] 已跳过依赖检查 (--skip-install)');
    return;
  }

  const pending = [];

  for (const project of PROJECTS) {
    const manifest = readManifest(project.dir);

    if (!manifest) {
      console.log(`[Install] ${project.label} 未找到 package.json，跳过检查`);
      continue;
    }

    const missing = findMissingDependencies(project.dir, manifest);

    if (missing.length === 0) {
      console.log(`[Install] ${project.label} 依赖已安装，无需处理`);
      continue;
    }

    const preview = missing.slice(0, 5).join(', ');
    const suffix = missing.length > 5 ? ', ...' : '';

    console.log(
      `[Install] ${project.label} 缺少 ${missing.length} 个依赖: ${preview}${suffix}`
    );

    pending.push(project);
  }

  if (pending.length === 0) return;

  const pm = resolvePackageManager();

  if (!pm) {
    console.error(
      `[Install] 未找到可用包管理器 (${PM_CANDIDATES.join(' / ')})，请先执行: npm i -g pnpm`
    );
    process.exit(1);
  }

  // 顺序执行，避免多个 pnpm 进程争抢同一个全局 store
  for (const project of pending) {
    await installDependencies(project, pm);
  }
}


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
  const lines = [
    '================================================',
    ' HC ETP 已启动',
    ` Backend:  ${BACKEND_URL}`,
    ` Frontend: ${runtimeClientUrl}`
  ];

  if (!NO_TTS) {
    lines.push(` TTS:      ${ttsStatusText()}`);
    if (ttsState.status !== 'missing') lines.push(` TTS 日志: ${TTS.logFile}`);
  }

  lines.push('================================================');

  console.log(lines.join('\n'));
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
// 启动 IndexTTS（后台，不阻塞主流程）
// ==========================

function ttsUrl() {
  return `http://127.0.0.1:${TTS.port}`;
}

/**
 * 后台拉起 IndexTTS，失败只提示，不影响前后端。
 * 用 --supervise 让包装进程一直活着，退出时 taskkill /t 能连 Python 一起清掉。
 */
function startTts() {
  if (NO_TTS) {
    console.log('[TTS] 已按 --no-tts 跳过 IndexTTS');
    return null;
  }

  if (!fs.existsSync(path.join(TTS_HOME, 'webui.py')) && !fs.existsSync(path.join(TTS_HOME, 'dsh_tts_launch.py'))) {
    console.log('[TTS] 未找到 ADMINTTS，跳过 IndexTTS（可用 --no-tts 静默）');
    ttsState.status = 'missing';
    return null;
  }

  if (!fs.existsSync(TTS_SCRIPT)) {
    console.log(`[TTS] 未找到启动脚本 ${TTS_SCRIPT}，跳过 IndexTTS`);
    ttsState.status = 'missing';
    return null;
  }

  console.log(`[TTS] 正在后台启动 IndexTTS（端口 ${TTS.port}）...`);
  console.log(`[TTS] 日志：${TTS.logFile}`);

  const child = spawn(process.execPath, [
    TTS_SCRIPT,
    '--port', String(TTS.port),
    '--timeout', String(TTS.timeout),
    '--supervise'
  ], {
    cwd: ROOT,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  processes.push(child);
  ttsState.status = 'starting';
  ttsState.pid = child.pid;

  const handle = (data, stream) => {
    const text = data.toString();

    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      stream.write(`[TTS] ${line}\n`);
    }

    if (/已就绪|已在运行/.test(text)) {
      ttsState.status = 'ready';
    }

    if (/未找到 IndexTTS 目录/.test(text)) {
      ttsState.status = 'missing';
    }
  };

  child.stdout.on('data', (data) => handle(data, process.stdout));
  child.stderr.on('data', (data) => handle(data, process.stderr));

  // TTS 是可选服务：它退出不触发整体关闭
  child.on('error', (err) => {
    ttsState.status = 'failed';
    console.log(`[TTS] 启动失败：${err.message}（不影响前后端）`);
  });

  child.on('exit', (code) => {
    if (ttsState.status !== 'ready') ttsState.status = 'failed';
    console.log(`[TTS] 已退出 ${code}（不影响前后端）`);
  });

  return child;
}

function ttsStatusText() {
  if (NO_TTS) return '已跳过 (--no-tts)';
  if (ttsState.status === 'missing') return '未找到 ADMINTTS，已跳过';
  if (ttsState.status === 'ready') return ttsUrl();
  if (ttsState.status === 'failed') return `启动失败，详见日志 ${TTS.logFile}`;
  return `${ttsUrl()} （启动中，加载模型需要几分钟）`;
}

/** --dry-run：只打印解析结果，便于确认参数而不真正拉起服务 */
function printDryRunConfig() {
  const ttsHomeReady = fs.existsSync(path.join(TTS_HOME, 'webui.py'))
    || fs.existsSync(path.join(TTS_HOME, 'dsh_tts_launch.py'));

  console.log('[DryRun] 仅打印配置，不启动任何服务');
  console.log(`[DryRun] Backend      -> ${BACKEND_URL}`);
  console.log(`[DryRun] Frontend     -> http://${CLIENT_HOST}:${CLIENT_PORT}`);
  console.log(`[DryRun] --no-tts     -> ${NO_TTS}`);
  console.log(`[DryRun] --tts-only   -> ${TTS_ONLY}`);
  console.log(`[DryRun] --skip-install -> ${SKIP_INSTALL}`);
  console.log(`[DryRun] TTS 目录     -> ${TTS_HOME}（存在: ${ttsHomeReady}）`);
  console.log(`[DryRun] TTS 启动脚本 -> ${TTS_SCRIPT}（存在: ${fs.existsSync(TTS_SCRIPT)}）`);
  console.log(`[DryRun] TTS 端口     -> ${TTS.port}`);
  console.log(`[DryRun] TTS 超时     -> ${TTS.timeout}s`);
  console.log(`[DryRun] TTS 日志     -> ${TTS.logFile}`);
  console.log(`[DryRun] TTS 地址     -> ${ttsUrl()}`);
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

  if (DRY_RUN) {
    printDryRunConfig();
    return;
  }

  if (TTS_ONLY) {
    console.log('[QuickStart] --tts-only：只启动 IndexTTS（不启动前后端）');
    startTts();
    return;
  }

  console.log(`[ENV] Backend  -> ${BACKEND_URL}`);
  console.log(`[ENV] Frontend -> http://${CLIENT_HOST}:${CLIENT_PORT}`);

  // 先起 TTS：后台异步加载模型，不阻塞前后端
  startTts();

  await ensureDependencies();

  await startServer();
  await startClient();
})().catch((err) => {
  console.error(`[QuickStart] 启动失败: ${err.message}`);
  process.exit(1);
});