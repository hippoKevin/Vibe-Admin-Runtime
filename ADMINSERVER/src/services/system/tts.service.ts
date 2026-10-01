import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BusinessException } from 'src/common/exceptions/business.exception';

/**
 * IndexTTS（Gradio WebUI）桥接服务
 *
 * 前端「开发模式」的快速回复通道需要把 Agent 的答复念出来。
 * IndexTTS 是本机的可选语音合成服务（ADMINTTS/，未入库），
 * 这里把它包装成三个稳定接口：探测状态 / 合成 / 取回音频。
 *
 * 协议（实测于 Gradio 5.45）：
 *   1) POST {base}/gradio_api/upload            multipart files=<wav> → 返回 [服务端路径]
 *   2) POST {base}/gradio_api/call/gen_single   {"data":[26 个位置参数]} → {event_id}
 *   3) GET  {base}/gradio_api/call/gen_single/{event_id}  SSE
 *        取 event: complete 那一行的 data，形如
 *        [{"visible":true,"value":{"path":"...","url":"..."}}]
 *
 * 关于仓库在中文路径下起不来（已知问题，不在本服务内解决）：
 *   wetext 依赖的 kaldifst 用窄字符 fopen 打开 .fst，非 ASCII 路径必然失败，
 *   表现为 RuntimeError: kaldi-io.cc ... Error opening input stream ...fst。
 *   解决办法是用 subst 把仓库映射成纯 ASCII 盘符后启动，
 *   仓库已提供一键脚本：node QuickStart/start_index_tts.js
 */

/** /gen_single 的第 0 个参数：与音色参考音频相同（来自 webui.py 的 EMO_CHOICES_ALL） */
const EMO_CONTROL_FROM_SPEAKER = '与音色参考音频相同';

/** 合成文本上限：太长会显著拖慢甚至超时，且当前是「播报答复」场景，不需要长文 */
const MAX_TEXT_LENGTH = 500;

/** 合成超时：首次调用要跑分词 + GPT + s2mel，实测几秒到几十秒，给足 3 分钟 */
const SYNTHESIZE_TIMEOUT = 3 * 60 * 1000;

/** 状态探测超时：只用来判断可达性，必须短，不能拖慢页面 */
const PROBE_TIMEOUT = 2500;

/** 允许的语言（webui.py 的 lang_dropdown choices） */
const LANGUAGES = ['ZH', 'EN', 'JA', 'AR', 'ES'];

/** 参考音色文件白名单校验：只接受 examples 下的 .wav */
const VOICE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.wav$/;

/** 音频文件名白名单校验：只接受 outputs 下的 .wav */
const AUDIO_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.wav$/;

/** 配置文件相对 ADMINAGENT 的文件名（要入库：这是用户的设置，不是运行时产物） */
const CONFIG_FILE_NAME = 'tts-config.json';

/** 配置文件名白名单：只允许固定在 ADMINAGENT 根目录下，不允许覆盖其它文件 */
const CONFIG_WRITE_LIMIT = 64 * 1024;

/** 参数取值范围（与 IndexTTS webui.py 的滑块区间一致），校验失败时用中文说清范围 */
type ParamRange = [min: number, max: number];

/**
 * 所有会影响输出声音的参数
 *
 * key 是配置/接口里的键名，default 是 IndexTTS 的官方默认值，
 * index 是 /gen_single 的 26 个位置参数里的下标（顺序必须与 webui.py 完全一致）。
 * type 区分「数值滑块」与「开关」，range 只对数值生效。
 */
const PARAM_DEFS = {
    emoWeight: { default: 0.65, index: 5, type: 'number', range: [0, 1] as ParamRange },
    vec1: { default: 0, index: 6, type: 'number', range: [-1, 1] as ParamRange },
    vec2: { default: 0, index: 7, type: 'number', range: [-1, 1] as ParamRange },
    vec3: { default: 0, index: 8, type: 'number', range: [-1, 1] as ParamRange },
    vec4: { default: 0, index: 9, type: 'number', range: [-1, 1] as ParamRange },
    vec5: { default: 0, index: 10, type: 'number', range: [-1, 1] as ParamRange },
    vec6: { default: 0, index: 11, type: 'number', range: [-1, 1] as ParamRange },
    vec7: { default: 0, index: 12, type: 'number', range: [-1, 1] as ParamRange },
    vec8: { default: 0, index: 13, type: 'number', range: [-1, 1] as ParamRange },
    emoText: { default: '', index: 14, type: 'string' },
    emoRandom: { default: false, index: 15, type: 'boolean' },
    maxTextTokensPerSegment: { default: 120, index: 16, type: 'number', range: [20, 500] as ParamRange },
    durationFactor: { default: 1, index: 17, type: 'number', range: [0.5, 2] as ParamRange },
    doSample: { default: true, index: 18, type: 'boolean' },
    topP: { default: 0.8, index: 19, type: 'number', range: [0, 1] as ParamRange },
    topK: { default: 30, index: 20, type: 'number', range: [1, 100] as ParamRange },
    temperature: { default: 0.8, index: 21, type: 'number', range: [0.01, 5] as ParamRange },
    lengthPenalty: { default: 0, index: 22, type: 'number', range: [-2, 2] as ParamRange },
    numBeams: { default: 3, index: 23, type: 'number', range: [1, 10] as ParamRange },
    repetitionPenalty: { default: 10, index: 24, type: 'number', range: [0.1, 100] as ParamRange },
    maxMelTokens: { default: 1500, index: 25, type: 'number', range: [50, 3000] as ParamRange },
} as const;

type ParamKey = keyof typeof PARAM_DEFS;

/** 声音参数（键 → 值） */
export type TtsParams = Record<ParamKey, number | string | boolean>;

/** 参数键名单：前端据此判断后端认不认某个参数 */
const PARAM_KEYS = Object.keys(PARAM_DEFS) as ParamKey[];

/** 落到磁盘上的配置结构 */
export interface TtsConfig {
    voice: string | null;
    lang: string;
    params: TtsParams;
    /** 最后保存时间（后端写入，只作展示） */
    updatedAt: string | null;
}

/** Gradio 的 /gen_single 返回：取 Audio 组件里的真实文件信息 */
interface GradioFileValue {
    path?: string;
    url?: string;
}

@Injectable()
export class TtsService {
    private readonly logger = new Logger(TtsService.name);

    /** IndexTTS 服务地址 */
    getBaseUrl(): string {
        const raw = String(process.env.INDEX_TTS_URL || 'http://127.0.0.1:7860').trim();
        return raw.replace(/\/+$/, '');
    }

    /** IndexTTS 所在目录（默认仓库根下 ADMINTTS） */
    getHome(): string {
        const raw = String(process.env.INDEX_TTS_HOME || '').trim();
        if (raw) return path.resolve(raw);
        return path.join(this.getRepoRoot(), 'ADMINTTS');
    }

    /** 仓库根目录（ADMINSERVER 的上一级） */
    private getRepoRoot(): string {
        return path.resolve(process.cwd(), '..');
    }

    /** ADMINAGENT 根目录（与智能管理页共用同一个环境变量） */
    getAgentRoot(): string {
        return process.env.AGENT_ADMIN_ROOT
            ? path.resolve(process.env.AGENT_ADMIN_ROOT)
            : path.join(this.getRepoRoot(), 'ADMINAGENT');
    }

    /** 配置文件绝对路径：ADMINAGENT/tts-config.json（固定文件名，不做拼接） */
    getConfigPath(): string {
        return path.join(this.getAgentRoot(), CONFIG_FILE_NAME);
    }

    /**
     * 默认配置
     *
     * 文件不存在 / 被改坏都返回这个，保证「TTS 管理」页永远有东西可渲染。
     * 默认音色优先取环境变量 INDEX_TTS_VOICE，其次 voice_01.wav，最后 examples 里的第一个。
     */
    getDefaultConfig(): TtsConfig {
        return {
            voice: this.getDefaultVoice(),
            lang: 'ZH',
            params: PARAM_KEYS.reduce((acc, key) => {
                (acc as Record<string, unknown>)[key] = PARAM_DEFS[key].default;
                return acc;
            }, {} as TtsParams),
            updatedAt: null,
        };
    }

    /** 参考音色目录 */
    getVoicesDir(): string {
        return path.join(this.getHome(), 'examples');
    }

    /** 对外提供的音频目录（只从这里读文件） */
    getAudioDir(): string {
        const dir = path.join(this.getHome(), 'outputs');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    /** 可用的参考音色（examples/*.wav） */
    listVoices(): string[] {
        const dir = this.getVoicesDir();
        try {
            if (!fs.existsSync(dir)) return [];
            return fs
                .readdirSync(dir, { withFileTypes: true })
                .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.wav'))
                .map((entry) => entry.name)
                .sort((prev, next) => prev.localeCompare(next));
        } catch (error) {
            this.logger.warn(`读取参考音色失败（${dir}）：${error?.message || error}`);
            return [];
        }
    }

    /** 默认参考音色 */
    getDefaultVoice(): string | null {
        const voices = this.listVoices();
        if (!voices.length) return null;
        const configured = String(process.env.INDEX_TTS_VOICE || '').trim();
        if (configured && voices.includes(configured)) return configured;
        return voices.includes('voice_01.wav') ? 'voice_01.wav' : voices[0];
    }

    /**
     * 读配置
     *
     * 文件不存在 → 默认值；文件损坏 / 单项非法 → 用默认值兜底（只警告不抛错），
     * 避免用户手改坏一个字符就打不开管理页。
     */
    getConfig(): TtsConfig {
        const file = this.getConfigPath();
        const fallback = this.getDefaultConfig();
        if (!fs.existsSync(file)) return fallback;

        let raw: Record<string, unknown>;
        try {
            raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
        } catch (error) {
            this.logger.warn(`解析 TTS 配置失败，已回退默认值（${file}）：${error?.message || error}`);
            return fallback;
        }

        const params = { ...fallback.params };
        const rawParams = (raw?.params || {}) as Record<string, unknown>;
        for (const key of PARAM_KEYS) {
            if (rawParams[key] === undefined) continue;
            try {
                (params as Record<string, unknown>)[key] = this.normalizeParam(key, rawParams[key]);
            } catch (error) {
                this.logger.warn(`TTS 配置项 ${key} 非法，已用默认值：${error?.message || error}`);
            }
        }

        const voices = this.listVoices();
        const voice = typeof raw?.voice === 'string' && voices.includes(raw.voice) ? raw.voice : fallback.voice;
        const lang = LANGUAGES.includes(String(raw?.lang || '').toUpperCase())
            ? String(raw.lang).toUpperCase()
            : fallback.lang;

        return {
            voice,
            lang,
            params,
            updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : null,
        };
    }

    /**
     * 保存配置（部分更新：只覆盖传进来的字段）
     *
     * 校验失败抛 BusinessException（中文说明具体项与范围），
     * 校验通过后整份写回 ADMINAGENT/tts-config.json。
     */
    saveConfig(input: { voice?: string; lang?: string; params?: Record<string, unknown> }): TtsConfig {
        const current = this.getConfig();

        let voice = current.voice;
        if (input?.voice !== undefined) {
            const voices = this.listVoices();
            const wanted = String(input.voice || '').trim();
            if (wanted && !voices.includes(wanted)) {
                throw new BusinessException(`音色不存在：${wanted}（可用音色见 ${this.getVoicesDir()}）`);
            }
            voice = wanted || current.voice;
        }

        let lang = current.lang;
        if (input?.lang !== undefined) {
            const wanted = String(input.lang || '').trim().toUpperCase();
            if (!LANGUAGES.includes(wanted)) {
                throw new BusinessException(`不支持的语言：${wanted || '（空）'}（可选 ${LANGUAGES.join(' / ')}）`);
            }
            lang = wanted;
        }

        const params = { ...current.params };
        for (const [key, value] of Object.entries(input?.params || {})) {
            if (!PARAM_KEYS.includes(key as ParamKey)) {
                throw new BusinessException(`不支持的参数：${key}`);
            }
            // 范围校验都在这里做，错误信息带中文与具体区间
            (params as Record<string, unknown>)[key] = this.normalizeParam(key as ParamKey, value);
        }

        const config: TtsConfig = { voice, lang, params, updatedAt: new Date().toISOString() };
        this.writeConfig(config);
        this.logger.log(`TTS 配置已保存：${this.getConfigPath()}（音色 ${voice || '无'}，语言 ${lang}）`);
        return config;
    }

    /** 写盘：原子替换（先写 .tmp 再 rename），避免写一半把配置写坏 */
    private writeConfig(config: TtsConfig): void {
        const file = this.getConfigPath();
        const text = `${JSON.stringify(config, null, 2)}\n`;
        if (Buffer.byteLength(text) > CONFIG_WRITE_LIMIT) {
            throw new BusinessException('TTS 配置内容过大，保存被拒绝');
        }

        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, text, 'utf-8');
        fs.renameSync(tmp, file);
    }

    /**
     * 单参数校验 + 归一化
     *
     * 数值：必须是数字（字符串数字也接受，表单里常见）、在范围内；
     * 开关：true/false（字符串 'true'/'false' 也接受）；
     * 文本：字符串，且限长（emo_text 会直接送进模型，太长会拖慢合成）。
     */
    private normalizeParam(key: ParamKey, valueRaw: unknown): number | string | boolean {
        const def = PARAM_DEFS[key];

        if (def.type === 'boolean') {
            if (typeof valueRaw === 'boolean') return valueRaw;
            if (valueRaw === 'true' || valueRaw === 1) return true;
            if (valueRaw === 'false' || valueRaw === 0) return false;
            throw new BusinessException(`${key} 只能是 true 或 false`);
        }

        if (def.type === 'string') {
            if (typeof valueRaw !== 'string') throw new BusinessException(`${key} 必须是文本`);
            if (valueRaw.length > 200) throw new BusinessException(`${key} 不能超过 200 字（当前 ${valueRaw.length} 字）`);
            return valueRaw;
        }

        const value = typeof valueRaw === 'number' ? valueRaw : Number(String(valueRaw ?? '').trim());
        if (!Number.isFinite(value)) throw new BusinessException(`${key} 必须是数字`);

        const [min, max] = def.range;
        if (value < min || value > max) {
            throw new BusinessException(`${key} 必须在 ${min} ~ ${max} 之间（当前 ${value}）`);
        }
        return value;
    }

    /**
     * 可用音色列表（供管理页做单选 + 试听）
     *
     * 返回文件名、大小与「是否当前选中」，前端不需要自己再拼路径。
     */
    listVoiceItems() {
        const config = this.getConfig();
        const dir = this.getVoicesDir();

        return this.listVoices().map((name) => {
            let size = 0;
            try {
                size = fs.statSync(path.join(dir, name)).size;
            } catch {
                size = 0;
            }
            return { name, size, selected: name === config.voice };
        });
    }

    /**
     * 试听：用当前（或传入的）配置真合成一段短音频
     *
     * 参数优先级：传入的 voice/lang/params > 已保存的配置 > IndexTTS 默认值。
     * params 里只认 PARAM_KEYS，非法值直接抛中文错误，不会静默忽略。
     */
    async preview(input: { text?: string; voice?: string; lang?: string; params?: Record<string, unknown> }) {
        const config = this.getConfig();

        const params: Record<string, unknown> = { ...config.params };
        for (const [key, value] of Object.entries(input?.params || {})) {
            if (!PARAM_KEYS.includes(key as ParamKey)) {
                throw new BusinessException(`不支持的参数：${key}`);
            }
            params[key] = this.normalizeParam(key as ParamKey, value);
        }

        const result = await this.synthesize(
            String(input?.text || '').trim() || '你好，这是音色试听',
            input?.voice || config.voice || undefined,
            input?.lang || config.lang,
            params,
        );

        return {
            ok: true,
            audioUrl: result.audioUrl,
            /** 合成耗时（毫秒） */
            ms: result.duration,
            /** 音频字节数 */
            bytes: result.size,
            /** 音频本身时长（毫秒，由 wav 头读出） */
            audioMs: result.audioMs,
            voice: result.voice,
            lang: result.lang,
            text: result.text,
        };
    }

    /**
     * 探测 IndexTTS 是否可达
     *
     * 用 /gradio_api/info（无需登录、体量小）当探针；
     * 任何异常都当成「不可达」，不往上抛，页面永远能拿到一个状态。
     */
    async getStatus() {
        const baseUrl = this.getBaseUrl();
        const home = this.getHome();
        const voices = this.listVoices();
        const reachable = await this.probe();
        const config = this.getConfig();

        return {
            reachable,
            baseUrl,
            home,
            items: voices,
            defaultVoice: this.getDefaultVoice(),
            /** 没有参考音色就没法合成，前端可据此禁用语音播报 */
            ready: reachable && voices.length > 0,
            /** 当前配置（管理页读的是 /tts/config，这里顺带回一份便于状态行展示） */
            config,
            /** 配置文件落在哪块磁盘上（出问题时用户能直接去改） */
            configFile: this.getConfigPath(),
            /** 参考音色目录 */
            voicesDir: this.getVoicesDir(),
            /** 后端认得的全部声音参数键名 */
            paramKeys: PARAM_KEYS,
            /** 服务不可达 / 没有音色时，直接给一句能照做的人话 */
            hint: reachable
                ? voices.length
                    ? null
                    : `未在 ${this.getVoicesDir()} 找到参考音色（*.wav），无法合成语音`
                : this.buildUnreachableHint(home),
        };
    }

    /** 不可达提示：把「中文路径会让 IndexTTS 起不来」这件已知问题说清楚 */
    private buildUnreachableHint(home: string): string {
        const homeIsAscii = /^[\x20-\x7E]*$/.test(home);
        const lines = [
            `IndexTTS 未启动或不可达（${this.getBaseUrl()}）。`,
            '请在仓库根目录执行：node QuickStart/start_index_tts.js --supervise',
        ];
        if (!homeIsAscii) {
            lines.push(
                '注意：本仓库位于中文路径下，IndexTTS 依赖的 kaldifst 无法打开非 ASCII 路径下的 .fst 规则文件，' +
                    '直接运行 webui.py 会报 "Error opening input stream ...fst"。' +
                    '上面的脚本会自动用 subst 映射一个纯 ASCII 盘符再启动，请务必用它启动。',
            );
        }
        return lines.join(' ');
    }

    /** 探针：能拿到 200 就算可达 */
    private async probe(): Promise<boolean> {
        try {
            const res = await this.fetchWithTimeout(`${this.getBaseUrl()}/gradio_api/info`, {
                method: 'GET',
            }, PROBE_TIMEOUT);
            return res.ok;
        } catch {
            return false;
        }
    }

    /**
     * 合成语音
     *
     * @param textRaw 待合成文本（上限 500 字）
     * @param voiceRaw 参考音色文件名（examples/ 下），缺省用配置里选中的音色
     * @param langRaw 语言（ZH/EN/JA/AR/ES），缺省用配置里的语言
     * @param paramsRaw 声音参数（emoWeight / vec1..8 / temperature 等），缺省全用配置
     */
    async synthesize(textRaw: string, voiceRaw?: string, langRaw?: string, paramsRaw?: Record<string, unknown>) {
        const text = String(textRaw || '').trim();
        if (!text) throw new BusinessException('待合成文本不能为空');
        if (text.length > MAX_TEXT_LENGTH) {
            throw new BusinessException(`待合成文本不能超过 ${MAX_TEXT_LENGTH} 字（当前 ${text.length} 字）`);
        }

        // 一律读配置：音色 / 语言 / 参数未显式传入时都用它，
        // 这样「TTS 管理」页保存的设置对实际输出立即生效（不会出现“改了没用”）。
        const config = this.getConfig();
        const voice = String(voiceRaw || '').trim() || config.voice || this.getDefaultVoice();
        if (!voice) {
            throw new BusinessException(
                `未找到参考音色：请在 ${this.getVoicesDir()} 放入 .wav 参考音频（如 voice_01.wav）`,
            );
        }
        if (!VOICE_PATTERN.test(voice)) {
            throw new BusinessException('参考音色文件名不合法');
        }

        const voicePath = path.join(this.getVoicesDir(), voice);
        if (!fs.existsSync(voicePath)) {
            throw new BusinessException(`参考音色不存在：${voice}`);
        }

        const lang = String(langRaw || config.lang || 'ZH').trim().toUpperCase() || 'ZH';
        if (!LANGUAGES.includes(lang)) {
            throw new BusinessException(`不支持的语言：${lang}（可选 ${LANGUAGES.join(' / ')}）`);
        }

        if (!(await this.probe())) {
            throw new BusinessException(this.buildUnreachableHint(this.getHome()));
        }

        const params: Record<string, unknown> = { ...config.params, ...(paramsRaw || {}) };
        const startedAt = Date.now();
        try {
            const serverPath = await this.uploadVoice(voicePath, voice);
            const eventId = await this.enqueue(serverPath, voice, text, lang, params);
            const output = await this.waitForResult(eventId);

            const audio = await this.saveToAudioDir(output.path, output.url);

            return {
                ok: true,
                /** 前端拿它拼 /hippoadmin/dev-agent/tts/audio?file=... */
                file: audio.file,
                audioUrl: `/hippoadmin/dev-agent/tts/audio?file=${encodeURIComponent(audio.file)}`,
                voice,
                lang,
                duration: Date.now() - startedAt,
                /** 音频真身（毫秒），由 wav 头计算，前端可显示「已合成 x.xs」 */
                audioMs: readWavDurationMs(audio.buffer),
                size: audio.buffer.length,
                text,
            };
        } catch (error) {
            if (error instanceof BusinessException) throw error;
            const message = error?.name === 'AbortError' ? '合成超时' : error?.message || '合成失败';
            throw new BusinessException(
                `${message}。若 IndexTTS 未启动，请先在仓库根目录执行：node QuickStart/start_index_tts.js --supervise`,
            );
        }
    }

    /** 1) 上传参考音色，拿到 Gradio 的服务端路径 */
    private async uploadVoice(voicePath: string, voiceName: string): Promise<string> {
        const buffer = fs.readFileSync(voicePath);
        const form = new FormData();
        form.append('files', new Blob([buffer], { type: 'audio/wav' }), voiceName);

        const res = await this.fetchWithTimeout(
            `${this.getBaseUrl()}/gradio_api/upload`,
            { method: 'POST', body: form },
            SYNTHESIZE_TIMEOUT,
        );
        if (!res.ok) {
            throw new BusinessException(`上传参考音色失败（HTTP ${res.status}）`);
        }

        const list = (await res.json()) as string[];
        const serverPath = Array.isArray(list) ? list[0] : '';
        if (!serverPath) throw new BusinessException('上传参考音色失败：接口未返回文件路径');
        return serverPath;
    }

    /**
     * 2) 入队 /gen_single，拿 event_id
     *
     * 26 个位置参数，顺序必须与 webui.py 的 gen_single 签名完全一致。
     * 说话会变的那 20 项全部来自配置（PARAM_DEFS 里的 index 就是这里的下标），
     * 不再写死默认值 —— 否则管理页改了参数对实际输出无效。
     */
    private async enqueue(
        serverPath: string,
        voiceName: string,
        text: string,
        lang: string,
        params: Record<string, unknown>,
    ): Promise<string> {
        const fileData = {
            path: String(serverPath).replace(/\\/g, '/'),
            orig_name: voiceName,
            meta: { _type: 'gradio.FileData' },
        };

        // 先用默认值铺满 26 个位置（0-4 是固定项），再把配置里的参数按 index 写进去
        const data: unknown[] = [
            EMO_CONTROL_FROM_SPEAKER, // 0  emo_control_method
            fileData, //                  1  prompt（音色参考音频）
            text, //                      2  text
            lang, //                      3  lang_choice
            null, //                      4  emo_ref_path
            0.65, //                      5  emo_weight
            0, 0, 0, 0, 0, 0, 0, 0, //    6-13 vec1..vec8
            '', //                        14 emo_text
            false, //                     15 emo_random
            120, //                       16 max_text_tokens_per_segment
            1.0, //                       17 duration_factor
            true, //                      18 do_sample
            0.8, //                       19 top_p
            30, //                        20 top_k
            0.8, //                       21 temperature
            0, //                         22 length_penalty
            3, //                         23 num_beams
            10, //                        24 repetition_penalty
            1500, //                      25 max_mel_tokens
        ];

        for (const key of PARAM_KEYS) {
            const value = params[key];
            if (value === undefined) continue;
            data[PARAM_DEFS[key].index] = value;
        }

        const res = await this.fetchWithTimeout(
            `${this.getBaseUrl()}/gradio_api/call/gen_single`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
            },
            SYNTHESIZE_TIMEOUT,
        );
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new BusinessException(`合成请求被拒绝（HTTP ${res.status}）${detail ? `：${detail.slice(0, 200)}` : ''}`);
        }

        const payload = (await res.json()) as { event_id?: string };
        const eventId = String(payload?.event_id || '').trim();
        if (!eventId) throw new BusinessException('合成请求失败：接口未返回 event_id');
        return eventId;
    }

    /** 3) 读 SSE 直到 complete，取回音频地址 */
    private async waitForResult(eventId: string): Promise<GradioFileValue> {
        const res = await this.fetchWithTimeout(
            `${this.getBaseUrl()}/gradio_api/call/gen_single/${encodeURIComponent(eventId)}`,
            { method: 'GET', headers: { Accept: 'text/event-stream' } },
            SYNTHESIZE_TIMEOUT,
        );
        if (!res.ok) throw new BusinessException(`读取合成结果失败（HTTP ${res.status}）`);

        const body = await res.text();
        // SSE 以空行分段；这里只需要找到 event: complete 那一段的 data
        let lastEvent = '';
        for (const chunk of body.split(/\n\n/)) {
            const lines = chunk.split('\n');
            const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() ?? '';
            if (event) lastEvent = event;
            if (!event) continue;

            const dataLine = lines
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trim())
                .join('');

            if (event === 'error') {
                throw new BusinessException(`IndexTTS 返回错误：${dataLine.slice(0, 200) || '（无详情）'}`);
            }
            if (event === 'complete') {
                const parsed = JSON.parse(dataLine) as Array<{ value?: GradioFileValue } | GradioFileValue>;
                const first = Array.isArray(parsed) ? parsed[0] : parsed;
                const value = (first as { value?: GradioFileValue })?.value ?? (first as GradioFileValue);
                if (!value?.path && !value?.url) {
                    throw new BusinessException('IndexTTS 未返回音频文件');
                }
                return value;
            }
        }

        throw new BusinessException(`合成未返回结果（最后事件：${lastEvent || '无'}）`);
    }

    /**
     * 4) 把 Gradio 产出的音频收进 outputs/，对外只暴露这个目录
     *
     * 为什么必须复制：Gradio 把结果写在 ADMINTTS/gradio/<hash>/ 下，
     * 那个目录名不可预测且会随会话变化，不便做白名单校验；
     * 统一收进 outputs/ 后，GET /tts/audio 只认这一个目录里的 .wav。
     */
    private async saveToAudioDir(
        outputPath?: string,
        outputUrl?: string,
    ): Promise<{ file: string; buffer: Buffer }> {
        let buffer: Buffer | null = null;

        // 优先直接读本地文件（同机部署，最快且不依赖 URL 解析）
        if (outputPath && fs.existsSync(outputPath)) {
            buffer = fs.readFileSync(outputPath);
        } else if (outputUrl) {
            const url = outputUrl.startsWith('http')
                ? outputUrl
                : `${this.getBaseUrl()}${outputUrl.startsWith('/') ? '' : '/'}${outputUrl}`;
            const res = await this.fetchWithTimeout(url, { method: 'GET' }, SYNTHESIZE_TIMEOUT);
            if (!res.ok) throw new BusinessException(`下载合成音频失败（HTTP ${res.status}）`);
            buffer = Buffer.from(await res.arrayBuffer());
        }

        if (!buffer?.length) throw new BusinessException('合成音频为空');

        const file = `tts-${Date.now()}.wav`;
        fs.writeFileSync(path.join(this.getAudioDir(), file), buffer);
        return { file, buffer };
    }

    /**
     * 读取 outputs/ 下的音频
     *
     * 安全要点：文件名必须匹配白名单（无路径分隔符、无 ..），
     * 解析后的绝对路径必须真的落在 outputs 目录内，双重防目录穿越。
     */
    resolveAudioFile(fileRaw: string): { absolute: string; size: number } {
        const file = String(fileRaw || '').trim();
        if (!file) throw new BusinessException('缺少 file 参数');
        if (!AUDIO_FILE_PATTERN.test(file) || file.includes('..')) {
            throw new BusinessException('文件参数不合法');
        }

        const dir = this.getAudioDir();
        const absolute = path.resolve(dir, file);

        // 路径穿越断言：必须在 outputs 目录内
        const base = path.resolve(dir);
        if (absolute !== base && !absolute.startsWith(base + path.sep)) {
            throw new BusinessException('文件参数不合法');
        }

        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
            throw new BusinessException(`音频文件不存在：${file}`);
        }

        return { absolute, size: fs.statSync(absolute).size };
    }

    /** 带超时的 fetch（AbortController 在 Node 18+ 原生可用） */
    private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...init, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }
}

/**
 * 从 WAV 头读时长（毫秒）
 *
 * 只解析标准 PCM 头（fmt/data 块），拿不到就返回 0 —— 时长仅用于展示，不值得引入依赖。
 */
function readWavDurationMs(buffer: Buffer): number {
    try {
        if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') return 0;
        let offset = 12;
        let byteRate = 0;
        let dataSize = 0;

        while (offset + 8 <= buffer.length) {
            const id = buffer.toString('ascii', offset, offset + 4);
            const size = buffer.readUInt32LE(offset + 4);
            if (id === 'fmt ') {
                byteRate = buffer.readUInt32LE(offset + 16);
            } else if (id === 'data') {
                dataSize = size;
                break;
            }
            offset += 8 + size + (size % 2);
        }

        if (!byteRate || !dataSize) return 0;
        return Math.round((dataSize / byteRate) * 1000);
    } catch {
        return 0;
    }
}
