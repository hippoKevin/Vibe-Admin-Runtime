#!/usr/bin/env node

'use strict';

/**
 * 单独启动 IndexTTS（Gradio WebUI）
 *
 * IndexTTS 是可选的语音合成服务，放在仓库根目录的 ADMINTTS/ 下即可（该目录不入库）。
 * 本脚本会自动定位目录、挑选解释器、后台拉起服务、轮询就绪，并把日志写到
 * ADMINTTS/logs/index-tts.log。
 *
 * 用法：
 *   node QuickStart/start_index_tts.js [选项]
 *
 * 选项：
 *   --port <端口>      监听端口，默认 7860
 *   --host <地址>      监听地址，默认 127.0.0.1（避免 Windows 防火墙弹窗）
 *   --fp16             以半精度加载模型（显存较小时建议加上）
 *   --foreground       前台运行，实时打印输出（排查报错用），Ctrl+C 结束
 *   --timeout <秒>     后台启动最长等待就绪时间，默认 600
 *   --home <路径>      ADMINTTS 目录；优先级：--home > 环境变量 INDEX_TTS_HOME > 仓库根 ADMINTTS/
 *   --entry <文件>     入口脚本，默认 webui.py（可用 dsh_tts_launch.py 等兼容启动器覆盖）
 *   --extra "<参数>"   追加透传给 webui.py 的原始参数，例如 --extra "--deepspeed"
 *   --no-subst         禁用「ASCII 盘符桥接」（仓库路径含中文时默认开启，见下）
 *   --supervise        后台启动后不退出，持续转发子进程输出（供 quick_start.js 调用）
 *   --help             打印本帮助
 *
 * 关于中文路径：
 *   wetext 依赖的 kaldifst 用窄字符 fopen 打开 .fst 规则文件，仓库位于中文路径时
 *   （例如 F:\工作项目\...）会直接抛 "Error opening input stream ...fst"。
 *   本脚本检测到目录路径含非 ASCII 字符时，会用 subst 把一个空闲盘符映射到
 *   ADMINTTS 目录，并从该盘符以纯 ASCII 路径启动 Python，从而绕开该问题。
 *   该映射在 IndexTTS 运行期间必须保留；不需要时可用 `subst <盘符>: /d` 手动删除。
 *
 * 退出码：
 *   0  服务已在运行 / 后台启动成功 / 未找到 ADMINTTS（可选服务，优雅跳过）
 *   1  显式 --home 指向的目录无效、启动失败、超时或进程提前退出
 */

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');

const DEFAULT_PORT = 7860;
const DEFAULT_HOST = '127.0.0.1';
/** 秒；首次启动要下载/加载模型，默认给 10 分钟 */
const DEFAULT_TIMEOUT = 600;

const LOG_RELATIVE = path.join('logs', 'index-tts.log');
const ENTRY_DEFAULT = 'webui.py';
/** 仓库里可能存在的兼容启动器（修复中文路径下的 wetext 问题） */
const ENTRY_FALLBACKS = ['dsh_tts_launch.py'];

const LINE = '='.repeat(64);

/** 探测就绪的轮询间隔（毫秒） */
const POLL_INTERVAL = 2000;
/** 进度打印间隔（毫秒） */
const PROGRESS_INTERVAL = 12000;
/** 失败时回显日志的行数 */
const TAIL_LINES = 20;

/** 可用于 subst 桥接的盘符（跳过 A/B/C 和仓库自身所在盘） */
const DRIVE_LETTERS = [
  'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'N', 'O', 'P', 'Q', 'L', 'M', 'K', 'J', 'I', 'H', 'G', 'E', 'D'
];


// ==========================
// 参数解析
// ==========================

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const [key, inlineValue] = token.slice(2).split('=');
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

const ARGS = parseArgs(process.argv.slice(2));

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const HELP = Boolean(ARGS.help || ARGS.h);

const PORT = toInt(ARGS.port, DEFAULT_PORT);
const HOST = typeof ARGS.host === 'string' && ARGS.host ? ARGS.host : DEFAULT_HOST;
const TIMEOUT = toInt(ARGS.timeout, DEFAULT_TIMEOUT);
const FP16 = Boolean(ARGS.fp16);
const FOREGROUND = Boolean(ARGS.foreground);
const SUPERVISE = Boolean(ARGS.supervise);
const NO_SUBST = Boolean(ARGS['no-subst']);
const EXTRA = typeof ARGS.extra === 'string' ? ARGS.extra.trim() : '';

const BASE_URL = `http://127.0.0.1:${PORT}`;


// ==========================
// 小工具
// ==========================

function log(msg) {
  console.log(`[IndexTTS] ${msg}`);
}

function warn(msg) {
  console.warn(`[IndexTTS] ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`[IndexTTS] ${msg}`);
  process.exit(code);
}

function printHelp() {
  const self = path.relative(ROOT, __filename).split(path.sep).join('/');
  console.log([
    LINE,
    ' IndexTTS 单独启动脚本',
    LINE,
    ` 用法： node ${self} [选项]`,
    '',
    ' 选项：',
    `   --port <端口>      监听端口，默认 ${DEFAULT_PORT}`,
    `   --host <地址>      监听地址，默认 ${DEFAULT_HOST}`,
    '   --fp16             半精度加载（显存较小时建议加上）',
    '   --foreground       前台运行并实时打印输出，Ctrl+C 结束',
    `   --timeout <秒>     后台等待就绪的最长时间，默认 ${DEFAULT_TIMEOUT}`,
    '   --home <路径>      ADMINTTS 目录（也可用环境变量 INDEX_TTS_HOME）',
    '   --entry <文件>     入口脚本，默认 webui.py',
    '   --extra "<参数>"   追加透传给入口脚本的原始参数',
    '   --no-subst         禁用 ASCII 盘符桥接（中文仓库路径下默认开启）',
    '   --supervise        后台启动但不退出，持续转发输出',
    '   --help             打印本帮助',
    '',
    ' 示例：',
    `   node ${self}`,
    `   node ${self} --fp16 --port 7860`,
    `   node ${self} --foreground --timeout 900`,
    '',
    ` 日志： <ADMINTTS>/logs/index-tts.log`,
    LINE
  ].join('\n'));
}

function hasCommand(name) {
  const command = process.platform === 'win32' ? `${name}.exe` : name;
  const result = spawnSync(command, ['--version'], {
    shell: false,
    stdio: 'ignore',
    timeout: 20000
  });

  return result.status === 0;
}

function isAscii(text) {
  return /^[\x00-\x7F]*$/.test(text);
}

function tailLog(file, lines = TAIL_LINES) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const all = content.split(/\r?\n/);
    while (all.length && all[all.length - 1].trim() === '') all.pop();
    return all.slice(-lines).join('\n');
  } catch (e) {
    return `(无法读取日志 ${file}: ${e.message})`;
  }
}

function printTail(file, reason) {
  console.error(`[IndexTTS] ${reason}`);
  console.error(`[IndexTTS] ---- 日志最后 ${TAIL_LINES} 行 (${file}) ----`);
  console.error(tailLog(file));
  console.error('[IndexTTS] ---- 日志结束 ----');
}


// ==========================
// 定位 ADMINTTS 目录
// ==========================

function looksLikeIndexTts(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
  if (fs.existsSync(path.join(dir, ENTRY_DEFAULT))) return true;
  return ENTRY_FALLBACKS.some((name) => fs.existsSync(path.join(dir, name)));
}

function printMissingHome(expected, source) {
  const fallback = path.join(ROOT, 'ADMINTTS');

  console.error('');
  console.error(`[IndexTTS] 未找到 IndexTTS 目录：${expected}${source ? `（来自 ${source}）` : ''}`);
  console.error('[IndexTTS] IndexTTS 是可选服务，缺失不影响前后端的启动与使用。');
  console.error('[IndexTTS] 如需启用语音合成，请任选一种方式提供该目录：');
  console.error(`[IndexTTS]   1) 把 IndexTTS 仓库放到 ${fallback}`);
  console.error('[IndexTTS]   2) 用 --home <路径> 指定已有目录');
  console.error('[IndexTTS]   3) 设置环境变量 INDEX_TTS_HOME=<路径>');
  console.error('[IndexTTS] 不需要语音合成时，可用 --no-tts 静默跳过：');
  console.error('[IndexTTS]   node QuickStart/quick_start.js --no-tts');
  console.error('');
}

/**
 * 按优先级定位 ADMINTTS：--home > INDEX_TTS_HOME > 仓库根 ADMINTTS/
 * 显式指定的路径无效时按错误处理（exit 1）；默认位置缺失时优雅退出（exit 0）。
 */
function locateHome() {
  const explicit = typeof ARGS.home === 'string' && ARGS.home ? ARGS.home : null;
  const fromEnv = String(process.env.INDEX_TTS_HOME || '').trim();
  const fallback = path.join(ROOT, 'ADMINTTS');

  if (explicit) {
    const dir = path.resolve(explicit);
    if (!looksLikeIndexTts(dir)) {
      printMissingHome(dir, '--home');
      process.exit(1);
    }
    return { source: '--home', dir };
  }

  if (fromEnv) {
    const dir = path.resolve(fromEnv);
    if (!looksLikeIndexTts(dir)) {
      printMissingHome(dir, 'INDEX_TTS_HOME');
      process.exit(1);
    }
    return { source: 'INDEX_TTS_HOME', dir };
  }

  if (looksLikeIndexTts(fallback)) return { source: '仓库默认位置', dir: fallback };

  printMissingHome(fallback, null);
  process.exit(0);
}


// ==========================
// ASCII 盘符桥接（中文路径修复）
// ==========================

function sameDir(a, b) {
  try {
    const sa = fs.statSync(a);
    const sb = fs.statSync(b);
    return sa.isDirectory() && sb.isDirectory() && sa.ino === sb.ino && sa.dev === sb.dev;
  } catch (e) {
    return false;
  }
}

/** 找一个已有映射：把某个盘符指向 ADMINTTS（或它的上级），从而得到纯 ASCII 路径 */
function findExistingBridge(homeDir) {
  const base = path.basename(homeDir);

  for (const letter of DRIVE_LETTERS) {
    const candidate = `${letter}:\\${base}`;
    if (!isAscii(candidate)) continue;
    if (sameDir(candidate, homeDir)) return candidate;
  }

  return null;
}

/** 用 subst 新建一个纯 ASCII 盘符映射，返回映射路径；失败返回 null */
function createBridge(homeDir) {
  if (process.platform !== 'win32') return null;
  if (!hasCommand('subst')) return null;

  for (const letter of DRIVE_LETTERS) {
    // 目标盘符已被真实磁盘占用时 subst 会失败，跳过即可
    const result = spawnSync('subst', [`${letter}:`, homeDir], {
      shell: false,
      stdio: 'ignore',
      timeout: 20000
    });

    if (result.status !== 0) continue;

    const mapped = `${letter}:\\`;
    if (sameDir(mapped, homeDir)) {
      return `${letter}:\\`;
    }

    // 映射出来了但目标不对，撤销后继续尝试
    spawnSync('subst', [`${letter}:`, '/d'], { shell: false, stdio: 'ignore', timeout: 20000 });
  }

  return null;
}

function removeBridge(letter) {
  if (process.platform !== 'win32' || !letter) return;
  spawnSync('subst', [`${letter}`, '/d'], { shell: false, stdio: 'ignore', timeout: 20000 });
}

/**
 * 解析出「启动用的目录」：
 *  - 路径本身是纯 ASCII → 直接用
 *  - 含非 ASCII（中文）→ 优先复用已有盘符映射，其次用 subst 新建
 * 返回 { runDir, bridgeLetter, ascii }
 */
function resolveRunDir(homeDir) {
  if (isAscii(homeDir)) return { runDir: homeDir, bridgeLetter: null, ascii: true };
  if (NO_SUBST) {
    warn('仓库路径含非 ASCII 字符，但已用 --no-subst 禁用盘符桥接；启动可能因 kaldifst 报错。');
    return { runDir: homeDir, bridgeLetter: null, ascii: false };
  }

  const existing = findExistingBridge(homeDir);
  if (existing) {
    log(`检测到中文路径，复用已有 ASCII 盘符映射：${existing} -> ${homeDir}`);
    return { runDir: existing, bridgeLetter: null, ascii: true };
  }

  const mapped = createBridge(homeDir);
  if (mapped) {
    log(`检测到中文路径，已建立 ASCII 盘符映射：${mapped} -> ${homeDir}`);
    return { runDir: mapped, bridgeLetter: mapped.slice(0, 2), ascii: true };
  }

  warn('检测到中文路径，但无法建立 ASCII 盘符映射（subst 不可用）。');
  warn('kaldifst 无法打开中文路径下的 .fst 文件，启动大概率会失败。');
  warn('可选做法：设置 ADMINTTS_FST_CACHE 指向纯英文可写目录后重试。');
  return { runDir: homeDir, bridgeLetter: null, ascii: false };
}


// ==========================
// 选择解释器与入口
// ==========================

function venvPython(runDir) {
  const candidates = process.platform === 'win32'
    ? [path.join(runDir, '.venv', 'Scripts', 'python.exe')]
    : [path.join(runDir, '.venv', 'bin', 'python')];

  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }

  return null;
}

function resolveEntry(runDir, ascii) {
  if (typeof ARGS.entry === 'string' && ARGS.entry) {
    const explicit = path.join(runDir, ARGS.entry);
    if (!fs.existsSync(explicit)) {
      fail(`--entry 指定的入口脚本不存在：${explicit}`);
    }
    return ARGS.entry;
  }

  // 中文路径且没有 ASCII 桥接时，优先用仓库里的兼容启动器
  if (!ascii) {
    for (const name of ENTRY_FALLBACKS) {
      if (fs.existsSync(path.join(runDir, name))) {
        log(`中文路径下改用兼容启动器：${name}`);
        return name;
      }
    }
  }

  if (!fs.existsSync(path.join(runDir, ENTRY_DEFAULT))) {
    fail(`在 ${runDir} 下没有找到 ${ENTRY_DEFAULT}，不像是 IndexTTS 目录。`);
  }

  return ENTRY_DEFAULT;
}

/**
 * 返回 { command, args, label }
 * 优先级：.venv 解释器 > uv run（目录里有 uv.lock）> 系统 python
 */
function resolveLauncher(runDir, entry, entryArgs) {
  const python = venvPython(runDir);
  if (python) {
    return { command: python, args: [entry, ...entryArgs], label: `.venv (${python})` };
  }

  if (fs.existsSync(path.join(runDir, 'uv.lock')) && hasCommand('uv')) {
    return {
      command: 'uv',
      args: ['run', 'python', entry, ...entryArgs],
      label: `uv run（未找到 .venv，改用 uv.lock 环境）`
    };
  }

  for (const name of ['python', 'python3']) {
    if (hasCommand(name)) {
      return {
        command: name,
        args: [entry, ...entryArgs],
        label: `${name}（未找到 .venv，使用系统解释器）`
      };
    }
  }

  fail([
    '未找到可用解释器。已尝试：',
    `  1) ${path.join(runDir, '.venv', 'Scripts', 'python.exe')}`,
    '  2) uv run（需要 uv.lock）',
    '  3) python / python3',
    '请在 ADMINTTS 目录下先创建环境，例如： cd ADMINTTS && uv sync'
  ].join('\n'));
}


// ==========================
// 健康探测
// ==========================

function httpProbe(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => {
        // 只取开头一段判断是不是 IndexTTS
        if (body.length < 20000) body += chunk;
      });
      res.on('end', () => done({ ok: true, statusCode: res.statusCode, body }));
      res.on('error', (err) => done({ ok: false, error: err }));
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });

    req.on('error', (err) => done({ ok: false, error: err }));
  });
}

function looksLikeIndexTtsHtml(body) {
  return /indextts/i.test(body) || /gradio/i.test(body);
}

/** 探测服务状态：running / foreign(端口被别的服务占用) / down */
async function probeService() {
  const result = await httpProbe(`${BASE_URL}/`, 3000);

  if (!result.ok) return { state: 'down', error: result.error };
  if (result.statusCode >= 200 && result.statusCode < 500) {
    return {
      state: looksLikeIndexTtsHtml(result.body || '') ? 'running' : 'foreign',
      statusCode: result.statusCode
    };
  }

  return { state: 'foreign', statusCode: result.statusCode };
}

async function describePortOccupancy() {
  if (process.platform !== 'win32') return null;

  const result = spawnSync('netstat', ['-ano', '-p', 'TCP'], {
    shell: false,
    encoding: 'utf-8',
    timeout: 20000
  });

  if (result.status !== 0 || !result.stdout) return null;

  const line = result.stdout
    .split(/\r?\n/)
    .find((l) => new RegExp(`[:.]${PORT}\\s+\\S+\\s+LISTENING`, 'i').test(l));

  if (!line) return null;

  const pid = line.trim().split(/\s+/).pop();
  return `占用端口的进程 PID: ${pid}（可用 taskkill /pid ${pid} /f /t 结束）`;
}


// ==========================
// 启动
// ==========================

function buildEntryArgs() {
  const args = ['--port', String(PORT), '--host', HOST];
  if (FP16) args.push('--fp16');
  if (EXTRA) args.push(...EXTRA.split(/\s+/).filter(Boolean));
  return args;
}

function spawnForeground(launcher, runDir, env) {
  log(`前台运行：${launcher.command} ${launcher.args.join(' ')}`);
  log(`工作目录：${runDir}`);

  const child = spawn(launcher.command, launcher.args, {
    cwd: runDir,
    shell: false,
    stdio: 'inherit',
    env
  });

  const cleanup = () => {
    if (bridgeLetter) removeBridge(bridgeLetter);
  };

  process.on('SIGINT', () => {
    try { child.kill(); } catch (e) {}
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    try { child.kill(); } catch (e) {}
    cleanup();
    process.exit(0);
  });

  child.on('error', (err) => {
    cleanup();
    fail(`启动失败：${err.message}`);
  });

  child.on('exit', (code) => {
    cleanup();
    process.exit(code === null ? 0 : code);
  });
}

function startBackground({ launcher, runDir, env, logFile, bridgeLetter, supervise }) {
  let out = null;

  if (!supervise) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    out = fs.openSync(logFile, 'a');
    fs.writeSync(out, `\n${LINE}\n[${new Date().toISOString()}] 启动：${launcher.command} ${launcher.args.join(' ')}\n工作目录：${runDir}\n${LINE}\n`);
  }

  log(`解释器：${launcher.label}`);
  log(`启动命令：${launcher.command} ${launcher.args.join(' ')}`);
  log(`工作目录：${runDir}`);

  const stdio = supervise || FOREGROUND
    ? ['ignore', 'pipe', 'pipe']
    : ['ignore', out, out];

  // 注意：这里不能用 detached / windowsHide 创建"无控制台"进程，
  // 否则 MKL 的 Intel Fortran 运行时会在加载模型时以
  // "forrtl: error (200): program aborting due to window-CLOSE event" 退出（退出码 2）。
  // 让子进程继承当前控制台，输出仍然写日志文件；node 退出后子进程继续运行。
  const child = spawn(launcher.command, launcher.args, {
    cwd: runDir,
    shell: false,
    stdio,
    env,
    detached: false
  });

  if (out !== null) fs.closeSync(out);

  if (process.platform === 'win32' && !supervise) {
    log(`子进程 PID：${child.pid}`);
  }

  if (supervise) {
    let buffer = '';
    const forward = (chunk, stream) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) stream.write(`[TTS] ${line}\n`);
    };
    child.stdout.on('data', (c) => forward(c, process.stdout));
    child.stderr.on('data', (c) => forward(c, process.stderr));
  }

  if (!supervise) child.unref();

  return { child, logFile, bridgeLetter, supervise };
}


// ==========================
// 等待就绪
// ==========================

function waitForReady(child, { supervise, logFile, startedAt, bridgeLetter }) {
  return new Promise((resolve) => {
    let exited = null;
    let readyLogged = false;
    let lastProgress = Date.now();
    let polling = false;
    let timer = null;

    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (!supervise) child.removeAllListeners('exit');
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
    };

    const onSignal = () => {
      stop();
      try { child.kill(); } catch (e) {}
      if (bridgeLetter) removeBridge(bridgeLetter);
      process.exit(0);
    };

    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    child.on('error', (err) => {
      stop();
      if (!supervise) printTail(logFile, `进程启动失败：${err.message}`);
      resolve(1);
    });

    child.on('exit', (code) => {
      exited = code;
    });

    const tick = async () => {
      if (exited !== null) {
        stop();
        if (supervise) {
          console.error(`${readyLogged ? '' : '[TTS] '}[IndexTTS] 进程已退出，退出码 ${exited}`);
        } else {
          printTail(logFile, `IndexTTS 进程已提前退出（退出码 ${exited}）`);
        }
        if (bridgeLetter) removeBridge(bridgeLetter);
        return resolve(exited === 0 ? 0 : 1);
      }

      const elapsed = Math.round((Date.now() - startedAt) / 1000);

      // 超时只约束「等待就绪」阶段；--supervise 就绪后要一直存活到子进程退出
      if (!readyLogged && elapsed >= TIMEOUT) {
        stop();
        if (!supervise) {
          printTail(logFile, `等待就绪超时（${TIMEOUT}s），IndexTTS 仍未响应 ${BASE_URL}/`);
          console.error('[IndexTTS] 可加大 --timeout，或先用 --foreground 观察真实报错。');
        } else {
          console.error(`[TTS] [IndexTTS] 等待就绪超时（${TIMEOUT}s）`);
        }
        return resolve(1);
      }

      if (!polling) {
        polling = true;
        try {
          const status = await probeService();

          if (status.state === 'running') {
            if (!readyLogged) {
              readyLogged = true;
              log(`已就绪：${BASE_URL}/ （耗时 ${elapsed}s）`);
              log(`日志：${logFile}`);
            }
            if (!supervise) {
              stop();
              return resolve(0);
            }
          } else if (status.state === 'foreign' && !supervise) {
            stop();
            warn(`端口 ${PORT} 已被其他服务占用（HTTP ${status.statusCode}），看起来不是 IndexTTS。`);
            const hint = await describePortOccupancy();
            if (hint) warn(hint);
            warn(`请换端口：node QuickStart/start_index_tts.js --port ${PORT + 1}`);
            return resolve(1);
          }
        } finally {
          polling = false;
        }
      }

      if (!readyLogged && Date.now() - lastProgress >= PROGRESS_INTERVAL) {
        lastProgress = Date.now();
        log(`等待就绪... 已等待 ${elapsed}s（加载模型中，日志：${logFile}）`);
      }

      timer = setTimeout(tick, POLL_INTERVAL);
    };

    timer = setTimeout(tick, POLL_INTERVAL);
  });
}


// ==========================
// 主流程
// ==========================

let bridgeLetter = null;

async function main() {
  if (HELP) {
    printHelp();
    return 0;
  }

  const { dir: homeDir, source: homeSource } = locateHome();

  log(`目录：${homeDir}${homeSource === '仓库默认位置' ? '' : `（${homeSource}）`}`);
  log(`启动前的健康检查：${BASE_URL}/`);

  const current = await probeService();
  if (current.state === 'running') {
    log(`IndexTTS 已在运行：${BASE_URL}/`);
    return 0;
  }
  if (current.state === 'foreign') {
    warn(`端口 ${PORT} 已被其他服务占用（HTTP ${current.statusCode}），不是 IndexTTS。`);
    const hint = await describePortOccupancy();
    if (hint) warn(hint);
    warn('请换一个端口，例如：node QuickStart/start_index_tts.js --port 7861');
    return 1;
  }

  const { runDir, bridgeLetter: letter, ascii } = resolveRunDir(homeDir);
  bridgeLetter = letter;

  const entry = resolveEntry(runDir, ascii);
  const entryArgs = buildEntryArgs();
  const launcher = resolveLauncher(runDir, entry, entryArgs);

  const logFile = path.join(homeDir, LOG_RELATIVE);
  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    GRADIO_ANALYTICS_ENABLED: 'False'
  };

  if (!FOREGROUND) log(`日志：${logFile}`);
  log(`监听：${HOST}:${PORT}`);

  if (FOREGROUND) {
    spawnForeground(launcher, runDir, env);
    return null; // 由子进程 exit 决定退出码
  }

  const startedAt = Date.now();
  const session = startBackground({
    launcher,
    runDir,
    env,
    logFile,
    bridgeLetter: letter,
    supervise: SUPERVISE
  });

  if (!SUPERVISE) {
    log('已在后台启动，等待服务就绪（首次启动需要加载模型，请耐心等待）...');
  }

  return waitForReady(session.child, {
    supervise: SUPERVISE,
    logFile,
    startedAt,
    bridgeLetter: letter
  });
}

main()
  .then((code) => {
    if (code === null) return;
    process.exit(code);
  })
  .catch((err) => {
    if (bridgeLetter) removeBridge(bridgeLetter);
    fail(`启动失败：${err && err.message ? err.message : err}`);
  });
