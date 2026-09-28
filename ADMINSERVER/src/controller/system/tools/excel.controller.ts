import { Controller, Post, UploadedFile, UseInterceptors, Query, Res, Body, BadRequestException, UploadedFiles, Param, Get, UseGuards } from '@nestjs/common';

import { AuthGuard as PermissionGuard, Permission } from "src/common/guards/auth.guard"; // 权限验证
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ExcelService } from 'src/services/system/tools/excel.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('excel')
export class ExcelController {
    constructor(private readonly excelService: ExcelService) { }

    //获取导入历史列表
    @Get('importHistory/list')
    async getImportHistoryList(@Param() searchForm: any) {
        return await this.excelService.getImportHistoryList(searchForm);
    }

    // 清空导入历史
    @Get('/clearHistory')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('DataImport.clearImportHistory')
    async clearImportHistory() {
        return await this.excelService.clearImportHistory();
    }

    // 导入
    @Post('import/:menu_id')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('DataImport.importExcel')
    @UseInterceptors(FileInterceptor('file'))
    async importExcel(
        @UploadedFile() file: { buffer: Buffer; originalname: string },
        @Body('tableName') tableName: string,
        @Param('menu_id') menu_id: number,
    ) {
        const result = await this.excelService.importExcel(
            file.buffer,
            file.originalname,
            tableName,
            menu_id
        )
        return result
    }


    // 批量导入
    @Post('batch-import')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('DataImport.batchImportExcel')
    @UseInterceptors(FilesInterceptor('files'))  // 注意是 FilesInterceptor 多文件
    async batchImportExcel(
        @UploadedFiles() files: Array<{ buffer: Buffer; originalname: string }>,
    ) {
        if (!files || files.length === 0) {
            throw new BadRequestException('请上传文件')
        }
        const result = await this.excelService.batchImportExcel(files)
        return result
    }
}
