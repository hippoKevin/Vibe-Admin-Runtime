// entities/business/file/file.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// 文件类型枚举
export enum FileType {
    PICTURE = 'picture',
    DOCX = 'docx',
    PDF = 'pdf',
    EXCEL = 'excel',
    OTHER = 'other',
}

// 业务类型枚举（后续新增业务只需要在这里加一行）
export enum BusinessType {
    COMMODITY = 'commodity',
    MARKET_ORDER = 'market_order',
    PRINT_TEMPLATE = 'print_template',
}

@Entity({
    database: 'etp_default_sql',
    name: 'file_list'
})
export class FileEntity {
    @PrimaryGeneratedColumn()
    file_id: number;

    // 文件唯一编码，前端引用文件时用这个，不暴露自增ID
    @Column({ type: 'varchar', length: 36, unique: true })
    code: string;

    // 关联的业务类型：commodity / market_order ...
    @Column({ type: 'varchar', length: 50 })
    business_type: BusinessType;

    // 关联的业务ID，比如 commodity_id 或 market_order_id
    @Column({ type: 'int' })
    business_id: number;

    // 文件类型：picture / docx / pdf ...
    @Column({ type: 'varchar', length: 20 })
    file_type: FileType;

    // 原始文件名（用户上传时的文件名，用于下载时展示）
    @Column({ type: 'varchar', length: 255 })
    original_name: string;

    // 实际存储在磁盘上的文件名（避免中文/重名冲突，一般用 code + 后缀）
    @Column({ type: 'varchar', length: 255 })
    storage_name: string;

    // MIME类型
    @Column({ type: 'varchar', length: 100, nullable: true })
    mime_type: string;

    // 文件大小（字节）
    @Column({ type: 'int', nullable: true })
    size: number;

    @CreateDateColumn()
    created_at: Date;
}