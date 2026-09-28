// api/files.ts
import requestApi from "./request";

export type BusinessType = 'commodity' | 'market_order' | 'print_template';
export type FileType = 'picture' | 'docx' | 'pdf' | 'excel' | 'other';

export interface FileListItem {
    code: string;
    file_type: FileType;
    original_name: string;
    size: number;
    created_at: string;
}

export interface FileContent {
    code: string;
    original_name: string;
    file_type: FileType;
    mime_type: string;
    size: number;
    base64: string;
}

// 上传文件：普通 multipart/form-data，不需要前端手动转 base64
export function uploadFile(params: {
    business_type: BusinessType;
    business_id: number;
    file_type: FileType;
    file: File;
}) {
    const formData = new FormData();
    formData.append('business_type', params.business_type);
    formData.append('business_id', String(params.business_id));
    formData.append('file_type', params.file_type);
    formData.append('file', params.file);

    return requestApi({
        url: '/hippoadmin/files/upload',
        method: 'post',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
    });
}

export function getFileList(business_type: BusinessType, business_id: number, file_type?: FileType) {
    return requestApi({
        url: '/hippoadmin/files/list',
        method: 'get',
        params: { business_type, business_id, file_type },
    });
}

// 获取文件内容，返回 base64（可直接用于 <img src> 或下载）
export function getFileContent(code: string) {
    return requestApi({
        url: `/hippoadmin/files/${code}`,
        method: 'get',
    });
}

export function deleteFile(code: string) {
    return requestApi({
        url: `/hippoadmin/files/${code}`,
        method: 'delete',
    });
}