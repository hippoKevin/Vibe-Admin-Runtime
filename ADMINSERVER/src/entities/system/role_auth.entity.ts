import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";



@Entity({ 
    database: 'etp_default_sql', // 关联的数据库
    name: "role_menu",
})

export class RoleMenuEntity { 
    @PrimaryGeneratedColumn({
        comment: '角色可操作菜单ID',
        type: 'int', 
    })
    role_auth_id: number;

    @Column({
        comment: '角色Id',
        type: 'int',
    })
    role_id: number;

    @Column({
        comment: '菜单Id',
        type: 'int',
    })
    menu_id: number;

    @Column({ nullable: true })
    menu_code: string;

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