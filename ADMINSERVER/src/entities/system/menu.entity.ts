// src/menu/entities/menu.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ 
  database: 'etp_default_sql', // 关联的数据库
  name: "menu_list",
})
export class MenuEntity { 
  @PrimaryGeneratedColumn({
    comment: '菜单id',
    type: 'int', 
  })
  menu_id: number;

  @Column({
    comment: '菜单名称',
    type: 'varchar',
    length: 30,
    nullable: false, // 数据库“否”
  })
  menu_name: string;

  @Column({
    comment: '菜单icon',
    type: 'varchar',
    length: 30,
    nullable: false,
  })
  menu_icon: string;

  @Column({
    comment: '组件名称',
    type: 'varchar',
    length: 30,
    nullable: true, // 数据库“是”
    default: null,
  })
  component_name: string | null;

  @Column({
    comment: '组件地址',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  component_address: string | null;

  @Column({
    comment: '数据表名',
    type: 'varchar',
    length: 30,
    nullable: true,
    default: null,
  })
  table_name: string | null;

  @Column({
    comment: '绑定打印单据id',
    type: 'int',
    nullable: true,
    default: null,
  })
  print_receipt_id: number | null;

  @Column({
      comment: '菜单排序',
      type: 'int',
      nullable: false,
      default: 0,
  })
  menu_sort: number;

  @Column({
    comment: '菜单状态',
    type: 'tinyint',
    width: 10,
    nullable: false,
    default: 0, // 0: 目录，1：菜单
  })
  menu_type: number;

  @Column({
    comment: '是否缓存',
    type: 'boolean',
    nullable: false,
    default: true,
  })
  is_cached: boolean | null;

  @Column({
    comment: '是否显示',
    type: 'boolean',
    nullable: false,
    default: true,
  })
  is_show: boolean | null;

  @Column({
    comment: '父级目录id',
    type: 'int',
    nullable: true,
    default: null,
  })
  parent_id: number | null;

  @Column({
    comment: '菜单备注',
    type: 'text',
    nullable: true,
    default: null,
  })
  menu_remark: string | null;

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
    onUpdate: 'CURRENT_TIMESTAMP', // 数据库更新时自动修改
  })
  updated_at: Date;
}