// src/dto/system/dev-agent/dev-agent.dto.ts
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** 开发模式的两个通道：reply = 简短回复（前端 TTS 播报），code = 后台执行代码 */
export const DEV_AGENT_CHANNELS = ['reply', 'code'] as const;
export type DevAgentChannel = (typeof DEV_AGENT_CHANNELS)[number];

/** 开发模式：把一句话任务交给 DSH 执行 */
export class GenerateCodeDto {
    @IsString()
    @IsNotEmpty({ message: '请先说明要做什么' })
    @MaxLength(4000, { message: '任务描述过长，请精简到 4000 字以内' })
    prompt: string;

    /**
     * 通道
     * - reply：只要一两句简短回复，同步返回，前端用 TTS 念出来
     * - code：后台改代码，立刻返回 runId，前端轮询执行历史看进度
     */
    @IsOptional()
    @IsIn(DEV_AGENT_CHANNELS as unknown as string[], { message: 'channel 只能是 reply 或 code' })
    channel?: DevAgentChannel;

    /** 执行目录，默认仓库根目录（这样 Agent 改的就是本项目的代码，Vite 会热更新） */
    @IsOptional()
    @IsString()
    cwd?: string;
}
