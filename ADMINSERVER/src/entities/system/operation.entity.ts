import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";


@Entity('operation_list')
export class OperationListEntity { 
    @PrimaryGeneratedColumn({
        name: 'operation_id',
        comment: '操作ID',
    })
    operation_id: number;

    @Column({
        name: 'operation_name',
        type: 'varchar',
        length: 50,
        comment: '操作名称',
    })
    operation_name: string;

    @Column({
        name: 'operation_sign',
        type: 'varchar',
        length: 100,
        comment: '操作标识',
    })
    operation_sign: string;

    @Column({
        name: 'operation_port',
        type: 'varchar',
        length: 50,
        comment: '操作接口',
        nullable: true,
    })
    operation_port: string;

    @Column({
        name: 'operation_method',
        type: 'varchar',
        length: 10,
        comment: '操作方式',
        nullable: true,
    })
    operation_method: string;

    @Column({
        name: 'menu_id',
        type: 'int',
        comment: '菜单ID',
    })
    menu_id: number; 

    @CreateDateColumn({ comment: '创建时间' })
    created_at: Date;
  
    @UpdateDateColumn({ comment: '更新时间' })
    updated_at: Date;
}