// files/utils/upload-path.util.ts
import * as fs from 'fs';
import * as path from 'path';
import { BusinessType } from 'src/entities/system/file/file.entity';

const uploadRoot = path.join(process.cwd(), 'uploads');

// 获取（并确保存在）某业务类型对应的磁盘目录，Windows/Linux 通用
export function getUploadDir(business_type: BusinessType): string {
    const dir = path.join(uploadRoot, business_type);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}