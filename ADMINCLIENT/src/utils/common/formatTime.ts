export const formatTime = (time: string | Date) => {
    if (!time) return '';
    const date = new Date(time);
    
    // 获取本地时间的各个部分
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，记得+1
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 获取当前日期
export const getCurrentDate = () => {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，记得+1
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

// 自定义时间格式化
export const getCustomDate = (
    date: string | Date,
    format: string
): string => {

    if (!date) return ''

    const d = typeof date === 'string' ? new Date(date) : date

    if (isNaN(d.getTime())) return ''

    const map: Record<string, string> = {
        yyyy: d.getFullYear().toString(),
        mm: String(d.getMonth() + 1).padStart(2, '0'),
        dd: String(d.getDate()).padStart(2, '0'),
        hh: String(d.getHours()).padStart(2, '0'),
        MM: String(d.getMinutes()).padStart(2, '0'),
        ss: String(d.getSeconds()).padStart(2, '0'),
    }

    let result = format

    // 替换 yyyy / mm / dd / hh / MM / ss
    Object.keys(map).forEach(key => {
        result = result.replace(new RegExp(key, 'g'), map[key])
    })

    return result
}