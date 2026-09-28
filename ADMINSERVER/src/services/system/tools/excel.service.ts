import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { PaginationService } from 'src/common/services/pagination.service';
import { MenuService } from '../menu.service';
import { PaginatedResult } from 'src/common/types/pagination.types';
import { ImportHistoryEntity } from 'src/entities/system/other/import_history.entity';
import { DataSource, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { ENUM_REGISTRY } from 'src/enums/others/import.enums';

const BATCH_SIZE = 500;
const UI_KEYS = new Set(['index', 'actions', 'row-select']);


// 唯一索引
const BUSINESS_UNIQUE_KEYS: Record<string, string[]> = {};

@Injectable()
export class ExcelService {

  constructor(
    @InjectDataSource('etp_default_sql')
    private readonly dataSource: DataSource,

    @InjectRepository(ImportHistoryEntity, 'etp_default_sql')
    private readonly importHistoryRepository: Repository<ImportHistoryEntity>,

    private readonly paginationService: PaginationService,
    private readonly menuService: MenuService,
  ) { }

  async getImportHistoryList(searchForm: any): Promise<PaginatedResult<ImportHistoryEntity>> {
    return this.paginationService.paginate<ImportHistoryEntity>(
      this.importHistoryRepository,
      {
        ...searchForm,
        paging: { sortField: 'import_time', sortDirection: 'DESC' },
      },
    );
  }

  async clearImportHistory() {
    return this.importHistoryRepository.clear();
  }

  async importExcel(
    file: Buffer,
    fileName: string,
    tableName: string,
    menu_id: number,
  ): Promise<{ message: string; total: number; success: number; failed: number; skipped: number; errors: string[] }> {
    // ─── Step 1: 解析 Excel ──────────────────────────────────────────
    const workbook = XLSX.read(file, {
      type: 'buffer',
      cellDates: true,
    });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: true,
    });

    if (rows.length === 0) throw new BadRequestException('Excel 文件中没有数据');

    const excelHeaders = Object.keys(rows[0]);

    // ─── Step 2: 查询列配置（含枚举映射）──────────────────────────────
    const { titleToColKey, enumMaps } = await this.getColumnConfigMapWithEnums(menu_id);
    if (!titleToColKey) throw new BadRequestException(`未找到 menu_id 为 ${menu_id} 的列配置`);

    // ─── Step 3: 字段映射 ────────────────────────────────────────────
    const headerToField = new Map<string, string>();
    excelHeaders.forEach(header => {
      const field = titleToColKey.get(header);
      if (field && !UI_KEYS.has(field)) headerToField.set(header, field);
    });

    if (headerToField.size === 0) throw new BadRequestException('Excel 表头与列模板无任何匹配');

    // ─── Step 4: 数据库元数据 ────────────────────────────────────────
    const dbColumns = await this.getTableColumns(tableName);
    if (dbColumns.length === 0) throw new BadRequestException(`表 ${tableName} 不存在`);

    const dbColumnNames = new Set(dbColumns.map(col => col.COLUMN_NAME));
    const uniqueKeys = await this.getUniqueKeys(tableName);

    const validHeaders = [...headerToField.keys()].filter(h => dbColumnNames.has(headerToField.get(h)!));
    if (validHeaders.length === 0) throw new BadRequestException('转换后的字段与数据库表不匹配');

    // ─── Step 5: 必填字段校验 ────────────────────────────────────────
    const requiredDbFields = dbColumns
      .filter(col => col.IS_NULLABLE === 'NO' && col.COLUMN_DEFAULT === null && col.EXTRA !== 'auto_increment')
      .map(col => col.COLUMN_NAME);

    const mappedFields = validHeaders.map(h => headerToField.get(h)!);
    const colKeyToTitle = this.buildColKeyToTitle(titleToColKey);

    const missingRequired = requiredDbFields.filter(f => !mappedFields.includes(f));
    if (missingRequired.length > 0) {
      const missingTitles = missingRequired.map(f => colKeyToTitle.get(f) || f);
      throw new BadRequestException(`Excel 缺少必填列: ${missingTitles.join(', ')}`);
    }

    // ─── Step 6: 构造 SQL 模板 ───────────────────────────────────────
    const keys = mappedFields;
    const columns = keys.map(k => `\`${k}\``).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const sql = this.buildUpsertSql(tableName, columns, placeholders, keys, uniqueKeys);

    // ─── Step 7: 逐行预处理 + 批量导入 ───────────────────────────────
    let success = 0;
    let failed = 0;
    let skipped = 0; // 新增跳过计数
    const errors: string[] = [];
    const validRows: { rowNumber: number; values: any[] }[] = [];

    // 判断该表是否有唯一索引
    const hasUniqueKey = uniqueKeys.length > 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const insertData: Record<string, any> = {};

      for (const header of validHeaders) {
        const field = headerToField.get(header)!;
        let value = row[header] ?? null;
        const enumMap = enumMaps.get(field);
        if (enumMap && value !== null && value !== '') {
          const mapped = enumMap.get(String(value));
          if (mapped !== undefined) value = mapped;
        }

        //  清理字符串中的换行符
        insertData[field] = this.sanitizeValue(value);
      }

      const emptyRequired = requiredDbFields.filter(
        f => mappedFields.includes(f) && (insertData[f] === null || insertData[f] === ''),
      );
      if (emptyRequired.length > 0) {
        const emptyTitles = emptyRequired.map(f => colKeyToTitle.get(f) || f);
        errors.push(`第 ${rowNumber} 行：必填字段 [${emptyTitles.join(', ')}] 不能为空`);
        failed++;
        continue;
      }

      const rowValues = keys.map(k => insertData[k] ?? null);

      if (!hasUniqueKey) {
        // ✅ 优先用业务唯一键比对，没配置才全字段比对
        const bizKeys = BUSINESS_UNIQUE_KEYS[tableName];
        const compareKeys = bizKeys ? bizKeys.filter(k => keys.includes(k)) : keys;
        const compareValues = compareKeys.map(k => insertData[k] ?? null);

        const duplicate = await this.isRowDuplicate(tableName, compareKeys, compareValues);
        if (duplicate) {
          skipped++;
          continue;
        }
      }

      validRows.push({ rowNumber, values: rowValues });
    }

    // 批量插入（500 条一批）
    for (let batchStart = 0; batchStart < validRows.length; batchStart += BATCH_SIZE) {
      const batch = validRows.slice(batchStart, batchStart + BATCH_SIZE);
      const placeholders = keys.map(() => '?').join(', ');
      const batchValues = batch.flatMap(r => r.values);

      // 批量 SQL 中 ON DUPLICATE KEY UPDATE 部分保持与单行一致
      const batchSql = this.buildUpsertSql(tableName, columns, placeholders, keys, uniqueKeys, batch.length);

      try {
        await this.dataSource.query(batchSql, batchValues);
        success += batch.length;
      } catch (err) {
        // 批量失败时降级逐行重试，以定位具体错误行
        for (const item of batch) {
          try {
            await this.dataSource.query(sql, item.values);
            success++;
          } catch (rowErr) {
            errors.push(`第 ${item.rowNumber} 行：${rowErr.message}`);
            failed++;
          }
        }
      }
    }

    // ─── Step 8: 写入导入历史 ────────────────────────────────────────
    const pureName = Buffer.from(fileName, 'latin1').toString('utf8');
    const menuName = await this.menuService.getMenuById(menu_id);
    await this.importHistoryRepository.insert({
      import_file_name: pureName,
      import_menu_name: menuName.menu_name,
      import_total: rows.length,
      import_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    });

    return { message: '导入完成', total: rows.length, success, failed, skipped, errors };
  }

  // 批量导入
  async batchImportExcel(
    files: Array<{ buffer: Buffer; originalname: string }>,
  ): Promise<{
    results: Array<{
      fileName: string;
      tableName: string;
      total: number;
      success: number;
      failed: number;
      errors: string[];
    }>;
  }> {
    // ─── 查询所有菜单 ────────────────────────────────────────────────
    const menus: Array<{ menu_name: string; table_name: string; menu_id: number }> =
      await this.dataSource.query(
        `SELECT menu_name, table_name, menu_id FROM menu_list WHERE table_name IS NOT NULL AND menu_type = 1`,
      );
    const menuMap = new Map(menus.map(m => [m.menu_name, { tableName: m.table_name, menuId: m.menu_id }]));

    // ─── 查询所有列模板（含枚举映射）────────────────────────────────
    const menuStatusList: Array<{ menu_id: number; column_config: string }> =
      await this.dataSource.query(`SELECT menu_id, column_config FROM menu_status`);

    // menu_id → { titleToColKey, enumMaps }
    const menuConfigMap = new Map<number, {
      titleToColKey: Map<string, string>;
      enumMaps: Map<string, Map<string, string | number>>;
    }>();

    for (const status of menuStatusList) {
      let columnConfig: Array<{ colKey: string; title: string; enums?: Record<string, string | number> }> = [];
      try {
        columnConfig = typeof status.column_config === 'string'
          ? JSON.parse(status.column_config)
          : status.column_config;
      } catch {
        columnConfig = [];
      }

      const menuInfo = menus.find(m => m.menu_id === status.menu_id)
      const tableName = menuInfo?.table_name ?? ''

      const titleToColKey = new Map<string, string>();
      const enumMaps = new Map<string, Map<string, string | number>>();

      columnConfig
        .filter(col => col.colKey && col.title && !UI_KEYS.has(col.colKey))
        .forEach(col => {
          titleToColKey.set(col.title, col.colKey);
          titleToColKey.set(col.colKey, col.colKey);

          // ✅ 用上面取到的 tableName
          const registryKey = `${tableName}.${col.colKey}`
          const enumConfig = ENUM_REGISTRY[registryKey]
          if (enumConfig) {
            enumMaps.set(
              col.colKey,
              new Map(Object.entries(enumConfig.importEnum).map(([k, v]) => [k, v]))
            )
          }
        });

      menuConfigMap.set(status.menu_id, { titleToColKey, enumMaps });
    }

    const results = [];

    for (const file of files) {
      const pureName = Buffer.from(file.originalname, 'latin1')
        .toString('utf8')
        .replace(/\.(xlsx|xls)$/i, '');

      const menuInfo = menuMap.get(pureName);
      if (!menuInfo) {
        results.push({
          fileName: file.originalname, tableName: '',
          total: 0, success: 0, failed: 0,
          errors: [`文件名 "${pureName}" 未匹配到任何菜单，已跳过`],
        });
        continue;
      }

      const { tableName, menuId } = menuInfo;
      const workbook = XLSX.read(file.buffer, {
        type: 'buffer',
        cellDates: false,
        cellText: false,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
        defval: null,
        raw: false,
      });
      if (rows.length === 0) {
        results.push({ fileName: file.originalname, tableName, total: 0, success: 0, failed: 0, errors: ['文件中没有数据'] });
        continue;
      }

      const dbColumns = await this.getTableColumns(tableName);
      if (dbColumns.length === 0) {
        results.push({
          fileName: file.originalname, tableName,
          total: rows.length, success: 0, failed: rows.length,
          errors: [`数据库表 ${tableName} 不存在`],
        });
        continue;
      }

      const dbColumnNames = new Set(
        dbColumns.filter(col => col.EXTRA !== 'auto_increment').map(col => col.COLUMN_NAME),
      );

      const excelHeaders = Object.keys(rows[0]);
      const config = menuConfigMap.get(menuId);
      const { titleToColKey, enumMaps } = config ?? { titleToColKey: null, enumMaps: new Map() };

      const headerToField = new Map<string, string>();
      if (titleToColKey && titleToColKey.size > 0) {
        excelHeaders.forEach(header => {
          const field = titleToColKey.get(header);
          if (field && dbColumnNames.has(field)) headerToField.set(header, field);
        });
      } else {
        excelHeaders.forEach(header => {
          if (dbColumnNames.has(header)) headerToField.set(header, header);
        });
      }

      if (headerToField.size === 0) {
        results.push({
          fileName: file.originalname, tableName,
          total: rows.length, success: 0, failed: rows.length,
          errors: [
            titleToColKey?.size
              ? `Excel表头与列模板title无匹配，表头: [${excelHeaders.join(', ')}]`
              : 'Excel表头与数据库字段无任何匹配',
          ],
        });
        continue;
      }

      const requiredFields = dbColumns
        .filter(col => col.IS_NULLABLE === 'NO' && col.COLUMN_DEFAULT === null && col.EXTRA !== 'auto_increment')
        .map(col => col.COLUMN_NAME);

      const mappedFields = [...headerToField.values()];
      const missingRequired = requiredFields.filter(f => !mappedFields.includes(f));
      if (missingRequired.length > 0) {
        const fieldToTitle = titleToColKey ? this.buildColKeyToTitle(titleToColKey) : new Map();
        results.push({
          fileName: file.originalname, tableName,
          total: rows.length, success: 0, failed: rows.length,
          errors: [`缺少必填列: ${missingRequired.map(f => fieldToTitle.get(f) || f).join(', ')}`],
        });
        continue;
      }

      // 构造 SQL
      const insertKeys = mappedFields;
      const keysSql = insertKeys.map(k => `\`${k}\``).join(', ');
      const placeholders = insertKeys.map(() => '?').join(', ');
      const uniqueKeys = await this.getUniqueKeys(tableName);

      // 预处理行数据
      let success = 0, failed = 0, skipped = 0;
      const errors: string[] = [];
      const validRows: { rowNumber: number; values: any[] }[] = [];

      // 判断该表是否有唯一索引
      const hasUniqueKey = uniqueKeys.length > 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2;
        const insertData: Record<string, any> = {};

        for (const [header, field] of headerToField) {
          let value = row[header] ?? null;
          const enumMap = enumMaps.get(field);
          if (enumMap && value !== null && value !== '') {
            const mapped = enumMap.get(String(value));
            if (mapped !== undefined) value = mapped;
          }
          insertData[field] = this.sanitizeValue(value);
        }

        const emptyRequired = requiredFields.filter(
          f => mappedFields.includes(f) && (insertData[f] === null || insertData[f] === ''),
        );

        if (emptyRequired.length > 0) {
          const fieldToTitle = titleToColKey ? this.buildColKeyToTitle(titleToColKey) : new Map();
          errors.push(`第 ${rowNumber} 行：必填字段 [${emptyRequired.map(f => fieldToTitle.get(f) || f).join(', ')}] 不能为空`);
          failed++;
          continue;
        }

        const rowValues = insertKeys.map(k => insertData[k] ?? null);


        // ✅ 无唯一索引时：查库判断是否完全重复，重复则跳过
        if (!hasUniqueKey) {
          const bizKeys = BUSINESS_UNIQUE_KEYS[tableName];
          const compareKeys = bizKeys ? bizKeys.filter(k => insertKeys.includes(k)) : insertKeys;
          const compareValues = compareKeys.map(k => insertData[k] ?? null);

          const duplicate = await this.isRowDuplicate(tableName, compareKeys, compareValues);
          if (duplicate) {
            skipped++;
            continue;
          }
        }

        validRows.push({ rowNumber, values: rowValues });
      }

      // 批量插入
      const singleSql = this.buildUpsertSql(tableName, keysSql, placeholders, insertKeys, uniqueKeys);

      for (let batchStart = 0; batchStart < validRows.length; batchStart += BATCH_SIZE) {
        const batch = validRows.slice(batchStart, batchStart + BATCH_SIZE);
        const batchSql = this.buildUpsertSql(tableName, keysSql, placeholders, insertKeys, uniqueKeys, batch.length);
        const batchValues = batch.flatMap(r => r.values);

        try {
          await this.dataSource.query(batchSql, batchValues);
          success += batch.length;
        } catch {
          for (const item of batch) {
            try {
              await this.dataSource.query(singleSql, item.values);
              success++;
            } catch (rowErr) {
              errors.push(`第 ${item.rowNumber} 行：${rowErr.message}`);
              failed++;
            }
          }
        }
      }

      const importHistoryFileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const menuName = await this.menuService.getMenuById(menuId);
      await this.importHistoryRepository.insert({
        import_file_name: importHistoryFileName,
        import_menu_name: menuName.menu_name,
        import_total: rows.length,
        import_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      });

      results.push({ fileName: pureName, tableName, total: rows.length, success, failed, skipped, errors });
    }

    return { results };
  }

  // ─── 工具方法 ──────────────────────────────────────────────────────

  /**
   * 构造批量 UPSERT SQL
   * @param batchSize 省略或为 1 时返回单行 SQL
   */
  private buildUpsertSql(
    tableName: string,
    columnsSql: string,
    singlePlaceholders: string,
    keys: string[],
    uniqueKeys: string[],
    batchSize = 1,
  ): string {
    const rowPh = `(${singlePlaceholders})`;
    const allRows = Array(batchSize).fill(rowPh).join(', ');

    if (uniqueKeys.length > 0) {
      const updatePart = keys
        .filter(k => !uniqueKeys.includes(k))
        .map(k => `\`${k}\` = VALUES(\`${k}\`)`)
        .join(', ');

      const onDuplicate = updatePart
        ? `ON DUPLICATE KEY UPDATE ${updatePart}`
        : `ON DUPLICATE KEY UPDATE \`${keys[0]}\` = \`${keys[0]}\``;

      return `INSERT INTO \`${tableName}\` (${columnsSql}) VALUES ${allRows} ${onDuplicate}`;
    }

    return `INSERT INTO \`${tableName}\` (${columnsSql}) VALUES ${allRows}`;
  }

  /**
   * 查询列配置，同时提取枚举映射
   * column_config 中每列可带 enums 字段，格式：{ "启用": 1, "禁用": 0 }
   */
  private async getColumnConfigMapWithEnums(menuId: number): Promise<{
    titleToColKey: Map<string, string> | null;
    enumMaps: Map<string, Map<string, string | number>>;
  }> {
    // 先查 menu_status 拿 column_config 和 table_name
    const result = await this.dataSource.query(
      `SELECT ms.column_config, ml.table_name
       FROM menu_status ms
       JOIN menu_list ml ON ms.menu_id = ml.menu_id
       WHERE ms.menu_id = ?`,
      [menuId],
    );

    if (!result?.length || !result[0].column_config) return { titleToColKey: null, enumMaps: new Map() };

    const tableName: string = result[0].table_name ?? ''
    let columnConfig: Array<{ colKey: string; title: string }> = [];

    try {
      const raw = result[0].column_config;
      columnConfig = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return { titleToColKey: null, enumMaps: new Map() };
    }

    const titleToColKey = new Map<string, string>();
    const enumMaps = new Map<string, Map<string, string | number>>();

    columnConfig
      .filter(col => col.colKey && col.title && !UI_KEYS.has(col.colKey))
      .forEach(col => {
        titleToColKey.set(col.title, col.colKey);
        titleToColKey.set(col.colKey, col.colKey);

        // 从注册表自动查枚举，用户无需配置任何东西
        const registryKey = `${tableName}.${col.colKey}`
        const enumConfig = ENUM_REGISTRY[registryKey]

        if (enumConfig) {
          enumMaps.set(
            col.colKey,
            new Map(Object.entries(enumConfig.importEnum).map(([k, v]) => [k, v]))
          );
        }
      });

    return { titleToColKey, enumMaps };
  }

  /** colKey → title 反向映射（用于错误提示） */
  private buildColKeyToTitle(titleToColKey: Map<string, string>): Map<string, string> {
    const colKeyToTitle = new Map<string, string>();
    titleToColKey.forEach((colKey, title) => {
      if (!UI_KEYS.has(colKey)) colKeyToTitle.set(colKey, title);
    });
    return colKeyToTitle;
  }

  private async getTableColumns(tableName: string): Promise<Array<{
    COLUMN_NAME: string;
    IS_NULLABLE: string;
    COLUMN_DEFAULT: string | null;
    EXTRA: string;
    DATA_TYPE: string;
  }>> {
    return this.dataSource.query(
      `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, DATA_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [tableName],
    );
  }

  exportExcel(data: Record<string, any>[], fileName = 'export'): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  private async getUniqueKeys(tableName: string): Promise<string[]> {
    const result = await this.dataSource.query(
      `SELECT k.COLUMN_NAME
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS t
       JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
         USING(CONSTRAINT_NAME, TABLE_NAME, TABLE_SCHEMA)
       WHERE t.CONSTRAINT_TYPE = 'UNIQUE'
         AND t.TABLE_SCHEMA = DATABASE()
         AND t.TABLE_NAME = ?`,
      [tableName],
    );
    return result.map(row => row.COLUMN_NAME);
  }


  /**
   * 检查行是否已存在（用于无唯一索引的表）
   * 对比所有即将插入的字段值，全部相同则视为重复
   */
  private async isRowDuplicate(
    tableName: string,
    keys: string[],
    values: any[],
  ): Promise<boolean> {
    const cleanedValues = values.map(v => this.sanitizeValue(v));

    const conditions = keys.map((k, i) => {
      const v = cleanedValues[i];
      // 只有真正的 null/undefined 才用 IS NULL，空字符串用 = ?
      return v === null || v === undefined
        ? `\`${k}\` IS NULL`
        : `\`${k}\` = ?`;
    }).join(' AND ');

    const params = cleanedValues.filter(v => v !== null && v !== undefined);
    const sql = `SELECT 1 FROM \`${tableName}\` WHERE ${conditions} LIMIT 1`;
    const result = await this.dataSource.query(sql, params);
    return result.length > 0;
  }

  /**
 * 统一清理单个字段值
 * 1. 字符串：清理首尾空白 + 换行符/制表符
 * 2. 数值：NaN → null
 * 3. null/undefined → null
 */
  private sanitizeValue(value: any): any {
    if (value === null || value === undefined) return null;

    // 数值类型 NaN 转 null
    if (typeof value === 'number' && isNaN(value)) return null;

    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return dayjs(value).format('YYYY-MM-DD');
    }

    return value;
  }
}