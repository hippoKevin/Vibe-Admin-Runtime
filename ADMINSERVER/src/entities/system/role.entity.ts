// src/menu/entities/menu.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ 
  database: 'etp_default_sql', // 关联的数据库
  name: "role_list",
})
export class RoleEntity { 
  @PrimaryGeneratedColumn({
    comment: '角色id',
    type: 'int', 
  })
  role_id: number;

  @Column({
    comment: '角色名称',
    type: 'varchar',
    length: 30,
    nullable: false,
    unique: true,
  })
  role_name: string;

  @Column({
    comment: "角色归属单位",
    type: 'varchar',
    nullable: true,
    length: 30,
    default: null,
  })
  role_unit: string | null;

  @Column({
    comment: '角色归属部门',
    type: 'varchar',
    nullable: true,
    length: 30,
    default: null,
  })
  role_dept: string | null;

  @Column({
    comment: '角色描述',
    type: 'text',
    nullable: true,
    default: null,
  })
  role_desc: string | null;

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