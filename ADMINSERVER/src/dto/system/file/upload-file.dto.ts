// files/dto/upload-file.dto.ts
import { IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { BusinessType, FileType } from 'src/entities/system/file/file.entity';

// 文件上传请求体：改为接收 base64 字符串，不再走 multipart 表单
export class UploadFileDTO {
    @IsEnum(BusinessType)
    business_type: BusinessType;

    @IsInt()
    business_id: number;

    @IsEnum(FileType)
    file_type: FileType;

    // 原始文件名（前端 File.name），用于取扩展名和展示
    @IsString()
    @IsNotEmpty()
    original_name: string;

    // base64 字符串，支持带 data URL 前缀（data:image/png;base64,xxxx）
    // 也支持纯 base64（不带前缀）
    @IsString()
    @IsNotEmpty()
    base64: string;
}