import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * 操作日志（系统运维 - 系统日志页面的数据来源）
 *
 * 由全局 OperationLogInterceptor 自动写入，记录"谁、什么时候、做了什么、结果如何"，
 * 供非技术人员阅读；技术排障用的原始日志仍在 logs/app-YYYY-MM-DD.log。
 */
@Entity({
    database: 'etp_default_sql',
    name: 'operation_log',
})
export class OperationLogEntity {
    @PrimaryGeneratedColumn({
        name: 'log_id',
        comment: '日志ID',
    })
    log_id: number;

    @Column({
        name: 'user_id',
        type: 'int',
        nullable: true,
        comment: '操作人用户ID',
    })
    user_id: number | null;

    @Column({
        name: 'username',
        type: 'varchar',
        length: 30,
        nullable: true,
        comment: '操作人账号',
    })
    username: string | null;

    @Column({
        name: 'role_id',
        type: 'int',
        nullable: true,
        comment: '操作人角色ID',
    })
    role_id: number | null;

    @Column({
        name: 'method',
        type: 'varchar',
        length: 10,
        comment: '请求方式',
    })
    method: string;

    @Column({
        name: 'url',
        type: 'varchar',
        length: 255,
        comment: '请求地址',
    })
    url: string;

    /** 由 operation_list 反查到的中文操作名，例如「删除用户」 */
    @Column({
        name: 'action_name',
        type: 'varchar',
        length: 50,
        nullable: true,
        comment: '操作名称',
    })
    action_name: string | null;

    /** 与 operation_list.operation_sign 一致，例如 UserAdminPage.delete */
    @Column({
        name: 'action_sign',
        type: 'varchar',
        length: 100,
        nullable: true,
        comment: '操作标识',
    })
    action_sign: string | null;

    @Column({
        name: 'menu_id',
        type: 'int',
        nullable: true,
        comment: '所属菜单ID',
    })
    menu_id: number | null;

    /** 参数摘要：已脱敏（密码/密钥等打码）并截断 */
    @Column({
        name: 'summary',
        type: 'varchar',
        length: 500,
        nullable: true,
        comment: '参数摘要（已脱敏）',
    })
    summary: string | null;

    /** 业务返回的提示语，例如「删除成功」 */
    @Column({
        name: 'result_message',
        type: 'varchar',
        length: 255,
        nullable: true,
        comment: '业务返回消息',
    })
    result_message: string | null;

    @Column({
        name: 'success',
        type: 'boolean',
        default: true,
        comment: '是否成功',
    })
    success: boolean;

    @Column({
        name: 'duration',
        type: 'int',
        default: 0,
        comment: '耗时(ms)',
    })
    duration: number;

    @Column({
        name: 'ip',
        type: 'varchar',
        length: 64,
        nullable: true,
        comment: '来源IP',
    })
    ip: string | null;

    @Column({
        name: 'user_agent',
        type: 'varchar',
        length: 255,
        nullable: true,
        comment: '浏览器标识',
    })
    user_agent: string | null;

    @Index()
    @CreateDateColumn({
        name: 'created_at',
        comment: '操作时间',
    })
    created_at: Date;
}
