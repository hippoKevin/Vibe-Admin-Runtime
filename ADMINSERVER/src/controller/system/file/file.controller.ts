// files/files.controller.ts
import {
    Controller, Post, Get, Delete, Param, Query, Body,
    UseInterceptors, UploadedFile, BadRequestException, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { FilesService } from 'src/services/system/file/file.service';
import { BusinessType, FileType } from 'src/entities/system/file/file.entity';
import { BusinessException } from 'src/common/exceptions/business.exception';

@Controller('files')
@UseGuards(AuthGuard('jwt'))
export class FilesController {
    constructor(private readonly filesService: FilesService) {}

    // 上传文件：前端用普通 multipart/form-data 传文件，
    // 后端拿到 buffer 后统一转 base64 存储
    @Post('upload')
    @UseInterceptors(
        FileInterceptor('file', {
            // 用内存模式接收，而不是直接落盘 —— 因为要先转 base64 再决定怎么存
            storage: memoryStorage(),
            limits: { fileSize: 10 * 1024 * 1024 }, // multer 自己的大小限制，10MB，与 body-parser 无关
        }),
    )
    async upload(
        @UploadedFile() file: Express.Multer.File,
        @Body('business_type') business_type: BusinessType,
        @Body('business_id') business_id: string,
        @Body('file_type') file_type: FileType,
    ) {
        if (!file) {
            throw new BusinessException('请上传文件', 4002);
        }
        if (!business_type || !business_id || !file_type) {
            throw new BusinessException('缺少必要参数：business_type / business_id / file_type', 4002);
        }
        if (!Object.values(BusinessType).includes(business_type)) {
            throw new BusinessException('无效的业务类型', 4002);
        }
        if (!Object.values(FileType).includes(file_type)) {
            throw new BusinessException('无效的文件类型', 4002);
        }

        const data = await this.filesService.uploadFile({
            business_type,
            business_id: Number(business_id),
            file_type,
            original_name: file.originalname,
            mimetype: file.mimetype,
            buffer: file.buffer,
        });

        return { message: '上传成功', data };
    }

    // 查询某业务对象下的文件列表（仅元信息）
    @Get('list')
    async list(
        @Query('business_type') business_type: BusinessType,
        @Query('business_id') business_id: string,
        @Query('file_type') file_type?: FileType,
    ) {
        const data = await this.filesService.getFilesByBusiness(
            business_type,
            Number(business_id),
            file_type,
        );
        return { data };
    }

    // 获取单个文件内容（返回 base64 data URL）
    @Get(':code')
    async getContent(@Param('code') code: string) {
        const data = await this.filesService.getFileContentByCode(code);
        return { data };
    }

    // 删除文件
    @Delete(':code')
    async remove(@Param('code') code: string) {
        return this.filesService.deleteFile(code);
    }
}