// src/entities/admin/role_operation.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('role_operation')
export class RoleOperationEntity {

    @PrimaryGeneratedColumn()
    role_auth_id: number;

    @Column()
    role_id: number;

    @Column()
    operation_id: number;

    @Column({ nullable: true })
    operation_code: string;

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