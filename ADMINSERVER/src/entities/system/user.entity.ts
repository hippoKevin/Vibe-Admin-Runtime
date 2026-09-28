import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";



@Entity({ 
  database: 'etp_default_sql', // 关联的数据库
  name: "user_list",
})
export class UserEntity { 
    @PrimaryGeneratedColumn({
        comment: '用户id',
        type: 'int',
    })
    user_id: number;

    @Column({
        comment: '账户',
        type: 'varchar',
        length: 30,
        unique: true,
    })
    account: string;

    @Column({
        comment: '密码',
        type: 'varchar',
        length: 255,
        default: '',
    })
    password: string;

    @Column({
        comment: '真实姓名',
        type: 'varchar',
        length: 30,
        nullable: true,
        default: null,
    })
    username: string | null;

    // 邮箱
    @Column({
        comment: '邮箱',
        type: 'varchar',
        length: 255,
        nullable: true,
        default: null,
    })
    email: string | null;

    // 手机号
    @Column({
        comment: '手机号',
        type: 'varchar',
        length: 11,
        nullable: true,
        default: null,
    })
    phone_number: string | null;

    @Column({
        comment: '性别',
        type: 'tinyint',
        nullable: true,
        default: 0,
    })
    gender: number;


    // 权限id
    @Column({
        comment: '权限等级',
        type: 'int',
        nullable: true
    })
    role_id: number;

    // 权限名称
    @Column({
        comment: '权限名称',
        type: 'varchar',
        length: 30,
        nullable: true,
    })
    role_name: string | null;

    // 创建时间
    @Column({
        comment: '创建时间',
        type: 'datetime',
        nullable: false,
        default: () => 'CURRENT_TIMESTAMP',
    })
    created_at: Date;

    // 更新时间
    @Column({
        comment: '更新时间',
        type: 'datetime',
        nullable: false,
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP', // 数据库更新时自动修改
    })
    updated_at: Date;s

}