// src/dto/system/dev-agent/dev-agent.dto.ts
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** 开发模式：把一句话任务交给 DSH 执行 */
export class GenerateCodeDto {
    @IsString()
    @IsNotEmpty({ message: '请先说明要做什么' })
    @MaxLength(4000, { message: '任务描述过长，请精简到 4000 字以内' })
    prompt: string;

    /** 执行目录，默认仓库根目录（这样 Agent 改的就是本项目的代码，Vite 会热更新） */
    @IsOptional()
    @IsString()
    cwd?: string;
}
