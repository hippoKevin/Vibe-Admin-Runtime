// src/entities/other/menu_status.entities.ts
import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

/**
 * 对应 TDesign TableColumn 的持久化配置
 */
export interface ColumnConfig {
  colKey: string;                        // 列唯一标识（对应 TDesign colKey）
  title: string;                         // 列标题
  width?: number;                        // 列宽
  align?: 'left' | 'center' | 'right';  // 对齐方式
  fixed?: 'left' | 'right';             // 是否固定列
  visible: boolean;                      // 是否显示该列
  displayIndex: number;                  // 列显示顺序（拖拽排序后的位置）
  sortOrder?: 'ASC' | 'DESC' | null;    // 数据排序方向（非列位置排序）
}

@Entity({ 
  database: 'etp_default_sql',
  name: "menu_status",
})
export class MenuStatusEntity { 
  @PrimaryGeneratedColumn({
    comment: '菜单状态ID',
    type: 'int',
  })
  menu_status_id: number;

  @Column({
    comment: '菜单ID',
    type: 'int',
    nullable: false,
    unique: true,  // 每个菜单只有一条配置记录
  })
  menu_id: number;

  @Column({
    comment: '菜单名称',
    type: 'varchar',
    nullable: false,
    length: 255,
  })
  menu_name: string;

  @Column({
    comment: 'TDesign 列配置（JSON数组）',
    type: 'json',
    nullable: true,
    default: null,
  })
  column_config: ColumnConfig[] | null;

  @Column({
    comment: '创建时间',
    type: 'datetime',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @Column({
    comment: '更新时间',
    type: 'datetime',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}