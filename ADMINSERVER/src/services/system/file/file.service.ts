// files/files.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileEntity, BusinessType, FileType } from 'src/entities/system/file/file.entity';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { getUploadDir } from 'src/common/utils/file/upload-file.utils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 业务层允许的原始文件大小上限：10MB

const MIME_RULES: Record<FileType, RegExp> = {
    [FileType.PICTURE]: /^image\/(jpeg|png|jpg|webp)$/,
    [FileType.PDF]: /^application\/pdf$/,
    [FileType.DOCX]: /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/,
    [FileType.EXCEL]: /^application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet$/,
    [FileType.OTHER]: /.*/,
};

@Injectable()
export class FilesService {
    constructor(
        @InjectRepository(FileEntity, 'etp_default_sql')
        private readonly fileRepo: Repository<FileEntity>,
    ) { }

    /**
     * 上传文件：接收 multer 已经读入内存的 buffer，
     * 转成 base64 字符串后写入磁盘（存储的文件内容本身就是 base64 文本），
     * 这样读取时不需要再做一次编码，直接读文件内容返回即可。
     */
    async uploadFile(params: {
        business_type: BusinessType;
        business_id: number;
        file_type: FileType;
        original_name: string;
        mimetype: string;
        buffer: Buffer;
    }) {
        const { business_type, business_id, file_type, original_name, mimetype, buffer } = params;

        if (!buffer?.length) {
            throw new BusinessException('文件内容为空，无法上传', 4002);
        }

        // 业务层大小限制：按原始文件字节数校验，不是 base64 膨胀后的体积
        if (buffer.length > MAX_FILE_SIZE) {
            throw new BusinessException('文件大小超过限制（最大 10MB）', 4002);
        }

        this.validateFileType(file_type, mimetype);

        // 把原始二进制内容转成纯 base64 字符串（不带 data:xxx;base64, 前缀，
        // 前缀在读取返回时再动态拼，存储时只存最原始的编码内容）
        const base64Content = buffer.toString('base64');

        // 存储文件用 .b64 后缀，跟原始格式区分开，避免有人直接双击当图片打开产生困惑
        const storageName = `${uuidv4()}.b64`;

        const dir = getUploadDir(business_type);
        const filePath = path.join(dir, storageName);
        await fs.writeFile(filePath, base64Content, 'utf-8');

        const code = uuidv4();
        const record = this.fileRepo.create({
            code,
            business_type,
            business_id,
            file_type,
            original_name,
            storage_name: storageName,
            mime_type: mimetype,
            size: buffer.length, // 记录原始文件大小，不是 base64 文本的长度，方便前端展示真实体积
        });
        await this.fileRepo.save(record);

        return {
            code: record.code,
            original_name: record.original_name,
            size: record.size,
        };
    }

    // 查询文件列表（仅元信息）
    async getFilesByBusiness(
        business_type: BusinessType,
        business_id: number,
        file_type?: FileType,
    ) {
        const where: any = { business_type, business_id };
        if (file_type) where.file_type = file_type;

        const files = await this.fileRepo.find({
            where,
            order: { created_at: 'DESC' },
        });

        return files.map(f => ({
            code: f.code,
            file_type: f.file_type,
            original_name: f.original_name,
            size: f.size,
            created_at: f.created_at,
        }));
    }

    /**
     * 获取单个文件内容：磁盘上存的本来就是 base64 文本，
     * 直接读出来拼上 data URL 前缀返回即可，不需要额外编码。
     */
    async getFileContentByCode(code: string) {
        const file = await this.findFileOrThrow(code);

        const filePath = path.join(getUploadDir(file.business_type), file.storage_name);

        let base64Content: string;
        try {
            base64Content = await fs.readFile(filePath, 'utf-8');
        } catch (err) {
            throw new BusinessException('文件已丢失，请联系管理员', 4006);
        }

        return {
            code: file.code,
            original_name: file.original_name,
            file_type: file.file_type,
            mime_type: file.mime_type,
            size: file.size,
            base64: `data:${file.mime_type ?? 'application/octet-stream'};base64,${base64Content}`,
        };
    }

    // 删除文件
    async deleteFile(code: string) {
        const file = await this.findFileOrThrow(code);

        const filePath = path.join(getUploadDir(file.business_type), file.storage_name);
        try {
            await fs.unlink(filePath);
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
                console.error('删除磁盘文件失败:', err);
            }
        }

        await this.fileRepo.remove(file);
        return { message: '删除成功' };
    }

    /**
    * 批量获取一批业务对象各自"最新一张文件"的 base64 内容
    *
    * 使用场景：商品列表要显示每个商品的主图、销售单列表要显示每单的附件缩略图等，
    * 任何"给一批 business_id，各自只要最新一条文件"的场景都可以复用这个方法，
    * 避免在每个业务 Service 里重复写一遍 N+1 查询、Map 组装、磁盘读取的逻辑。
    *
    * @param business_type 业务类型，如 'commodity'、'market_order'
    * @param business_ids  业务ID列表，如这一页的所有 commodity_id
    * @param file_type     可选，按文件类型过滤（如只要图片）
    * @returns Map<business_id, base64DataUrl>，查不到文件的 business_id 不会出现在 Map 中
    */
    async getLatestFileBase64Map(
        business_type: BusinessType,
        business_ids: number[],
        file_type?: FileType,
    ): Promise<Map<number, string>> {
        const imageMap = new Map<number, string>();

        if (!business_ids.length) {
            return imageMap;
        }

        // 1. 批量查询这批业务对象对应的文件记录，避免逐条查询（N+1）
        const where: any = {
            business_type,
            business_id: In(business_ids),
        };
        if (file_type) where.file_type = file_type;

        const fileRecords = await this.fileRepo.find({
            where,
            order: { created_at: 'DESC' },
        });

        // 2. 建立 business_id -> 最新一条文件记录 的映射
        // 因为按 created_at DESC 排序，同一个 business_id 第一次出现的就是最新的一条
        const latestFileMap = new Map<number, FileEntity>();
        for (const file of fileRecords) {
            if (!latestFileMap.has(file.business_id)) {
                latestFileMap.set(file.business_id, file);
            }
        }

        // 3. 并行读取磁盘文件内容，转成 base64 data URL
        await Promise.all(
            Array.from(latestFileMap.entries()).map(async ([businessId, file]) => {
                try {
                    const filePath = path.join(getUploadDir(file.business_type), file.storage_name);
                    // 磁盘上存的本身就是纯 base64 文本内容
                    const base64Content = await fs.readFile(filePath, 'utf-8');
                    imageMap.set(
                        businessId,
                        `data:${file.mime_type ?? 'application/octet-stream'};base64,${base64Content}`,
                    );
                } catch (err) {
                    // 磁盘文件丢失（比如被误删）时不影响其它记录，只是这一条为空
                    console.error(`业务对象 ${business_type}:${businessId} 文件读取失败:`, err);
                }
            }),
        );

        return imageMap;
    }

    /**
     * 更进一步的封装：直接给一个业务对象数组"贴上"对应的最新文件字段，
     * 免去调用方还要自己写 map + Map.get 的拼装代码。
     *
     * @param list          业务对象数组，如商品列表、销售单列表
     * @param idField       用哪个字段作为 business_id 去匹配，如 'commodity_id'
     * @param business_type 业务类型
     * @param targetField   附加到每个对象上的新字段名，如 'commodity_image'
     * @param file_type     可选，按文件类型过滤
     */
    async attachLatestFile<T extends Record<string, any>>(
        list: T[],
        idField: keyof T,
        business_type: BusinessType,
        targetField: string,
        file_type?: FileType,
    ): Promise<(T & Record<string, string | null>)[]> {
        if (!list.length) return list as any;

        const ids = list.map(item => item[idField] as number);
        const fileMap = await this.getLatestFileBase64Map(business_type, ids, file_type);

        return list.map(item => ({
            ...item,
            [targetField]: fileMap.get(item[idField] as number) ?? null,
        }));
    }

    private async findFileOrThrow(code: string) {
        const file = await this.fileRepo.findOne({ where: { code } });
        if (!file) {
            throw new BusinessException('文件不存在', 4006);
        }
        return file;
    }

    private validateFileType(file_type: FileType, mimetype: string) {
        const pattern = MIME_RULES[file_type];
        if (pattern && !pattern.test(mimetype)) {
            throw new BusinessException(`文件内容与所选类型 ${file_type} 不匹配`, 4002);
        }
    }
}