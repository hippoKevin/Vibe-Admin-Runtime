export default function downFile(response, name) {
    // // 从响应头获取文件名（如果有）
    // const contentDisposition = response.headers['content-disposition'];
    // let filename = '';
    // if (contentDisposition) {
    //     // 解析文件名（示例格式：attachment; filename=example.xlsx）
    //     const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    //     if (filenameMatch && filenameMatch[1]) {
    //         // 解码URL编码的文件名
    //         filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
    //     }
    // }

    // 创建 Blob 对象
    const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/vnd.ms-excel;charset=UTF-8'
    });

    // 生成下载链接
    const urlObject = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObject;
    a.download = name;
    document.body.appendChild(a);
    a.click();

    // 释放资源
    document.body.removeChild(a);
    URL.revokeObjectURL(urlObject);
    return {
        blob
    }
}
