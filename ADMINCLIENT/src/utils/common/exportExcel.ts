// src/utils/excel.ts
import * as XLSX from 'xlsx';
import i18n from '@/locales';

const excelT = (key: string): string => i18n.global.t(`excel.${key}`)

export type ExcelFormatters<T> = {
  [K in keyof T]?: (value: T[K], row: T) => string | number;
};

/**
 * 计算字符串的显示宽度（中文算2个字符，英文算1个）
 */
const getStrWidth = (str: string): number => {
  let width = 0;
  for (const char of String(str)) {
    width += /[\u4e00-\u9fa5\uff00-\uffff]/.test(char) ? 2 : 1;
  }
  return width;
};

/**
 * 自动计算每列宽度
 * 遍历表头 + 所有数据行，取最大宽度，加上 padding
 */
const autoFitColumns = (
  ws: XLSX.WorkSheet,
  formattedData: Record<string, any>[],
  headerMap: Record<string, string>,
  validKeys: string[],
  padding = 4,
  maxWidth = 50,
  minWidth = 8,
): void => {
  const colWidths = validKeys.map((key) => {
    // 表头宽度
    const headerWidth = getStrWidth(headerMap[key] || key);

    // 数据行最大宽度
    const dataMaxWidth = formattedData.reduce((max, row) => {
      const cellVal = row[key];
      const cellWidth = cellVal != null ? getStrWidth(String(cellVal)) : 0;
      return Math.max(max, cellWidth);
    }, 0);

    // 取表头和数据中最大值，加 padding，限制最大最小宽度
    const width = Math.min(maxWidth, Math.max(minWidth, Math.max(headerWidth, dataMaxWidth) + padding));
    return { wch: width };
  });

  ws['!cols'] = colWidths;
};

/**
 * 通用导出 Excel 函数
 */
export const exportExcel = <T extends Record<string, any>>({
  data,
  fileName = excelT('defaultFileName'),
  columns,
  excludeKeys = [],
  formatters = {},
  autoWidth = true,   // ← 是否自动列宽，默认开启
  colPadding = 4,     // ← 列宽内边距
  maxColWidth = 50,   // ← 最大列宽
  minColWidth = 8,    // ← 最小列宽
}: {
  data: T[];
  fileName?: string;
  columns?: any[];
  excludeKeys?: string[];
  formatters?: ExcelFormatters<T>;
  autoWidth?: boolean;
  colPadding?: number;
  maxColWidth?: number;
  minColWidth?: number;
}) => {
  if (!data || data.length === 0) {
    console.warn('导出数据为空');
    return;
  }

  const defaultExclude = ['create_at', 'update_at', 'actions', 'row-select'];
  const finalExcludeKeys = Array.from(new Set([...defaultExclude, ...excludeKeys]));

  const headerMap: Record<string, string> = {};
  let validKeys: string[] = [];

  if (columns && columns.length > 0) {
    const validColumns = columns.filter(col => !finalExcludeKeys.includes(col.colKey));
    validColumns.forEach(col => {
      headerMap[col.colKey] = col.title;
    });
    validKeys = validColumns.map(col => col.colKey);
  } else {
    validKeys = Object.keys(data[0]).filter(key => !finalExcludeKeys.includes(key));
    validKeys.forEach(key => {
      headerMap[key] = key;
    });
  }

  const formattedData = data.map((item, index) => {
    const newItem: any = {};
    validKeys.forEach((key) => {
      let value = item[key];
      if (key === 'index') {
        value = index + 1;
      } else if (formatters[key]) {
        value = formatters[key]!(value, item);
      }
      newItem[key] = value == null ? '' : value;
    });
    return newItem;
  });

  const ws = XLSX.utils.json_to_sheet(formattedData, {
    header: validKeys,
    skipHeader: false,
  });

  // 替换表头为中文
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = XLSX.utils.encode_col(C) + '1';
    const key = ws[address].v;
    if (headerMap[key]) {
      ws[address].v = headerMap[key];
    }
  }

  // ─── 自动列宽 ──────────────────────────────────────────────────────
  if (autoWidth) {
    autoFitColumns(ws, formattedData, headerMap, validKeys, colPadding, maxColWidth, minColWidth);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, excelT('sheetName'));
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

/** 性别格式化 1=男 0=女 */
export const formatGender = (val: number) => val === 1 ? i18n.global.t('common.male') : i18n.global.t('common.female');

/** 在职状态格式化 1=在职 0=离职 */
export const formatWorkingStatus = (val: number) => val === 1 ? excelT('working') : excelT('left');

/** 启用状态格式化 1=启用 0=禁用 */
export const formatStatus = (val: number) => val === 1 ? i18n.global.t('common.enabled') : i18n.global.t('common.disabled');

/** 日期格式化 */
export const formatDate = (val: string | Date) =>
  val ? new Date(val).toLocaleDateString(i18n.global.locale.value) : '';

/** 日期时间格式化 */
export const formatDateTime = (val: string | Date) =>
  val ? new Date(val).toLocaleString(i18n.global.locale.value) : '';

/** 重要度格格式化 0 重要 1 较重要 2一般 3 不重要 */
export const formatImportance = (val: number) => {
  switch (val) {
    case 0:
      return excelT('importanceHigh');
    case 1:
      return excelT('importanceMediumHigh');
    case 2:
      return excelT('importanceMedium');
    case 3:
      return excelT('importanceLow');
    default:
      return '';
  }
};

/** 出库状态格式化 */
export const formatOutboundStatus = (val: number) => {
  switch (val) {
    case 0:
      return excelT('notOutbound');
    case 2:
      return excelT('outbound');
    case 1:
      return excelT('partialOutbound');
    default:
      return '';
  }
};

/** 入库状态格式化 */
export const formatInboundStatus = (val: number) => {
  switch (val) {
    case 0:
      return excelT('notInbound');
    case 2:
      return excelT('inbound');
    case 1:
      return excelT('partialInbound');
    default:
      return '';
  }
};

/**
 * 入库类型格式化
 */
export const formatInboundType = (val: number) => {
  switch (val) {
    case -1:
      return excelT('manual');
    case 0:
      return excelT('purchaseInbound');
    case 1:
      return excelT('productionReturnInbound');
    default:
      return '';
  }
};

/**
 * 出库类型格式化
 */
export const formatOutboundType = (val: number) => {
  switch (val) {
    case -1:
      return excelT('manual');
    case 0:
      return excelT('saleOutbound');
    case 1:
      return excelT('productionIssueOutbound');
    default:
      return '';
  }
};

/**
 * 收款状态
 */
export const formatReceiptStatus = (val: number) => {
  switch (val) {
    case 0:
      return excelT('notReceived');
    case 2:
      return excelT('received');
    case 1:
      return excelT('partialReceived');
    default:
      return '';
  }
};

/**
 * 付款状态
 */
export const formatPaymentStatus = (val: number) => {
  switch (val) {
    case 0:
      return excelT('notPaid');
    case 2:
      return excelT('paid');
    case 1:
      return excelT('partialPaid');
    default:
      return '';
  }
};

/**
 * 库存状态
 */
export const  formatStockStatus = (val: number) => {
  switch (val) {
    case 0:
      return excelT('stockNormal');
    case 1:
      return excelT('stockLow');
    case 2:
      return excelT('stockWarning');
    default:
      return '';
  }
};
