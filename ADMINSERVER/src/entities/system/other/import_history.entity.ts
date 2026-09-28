import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";



@Entity({
    database: 'etp_default_sql',
    name: 'import_history'
})
export class ImportHistoryEntity {
    @PrimaryGeneratedColumn({
        type: 'int',
        comment: '历史导入ID'
    })
    import_history_id: number;

    @Column({
        type: 'varchar',
        length: 255,
        comment: '导入菜单名'
    })
    import_menu_name: string;

    // 导入时间
    @Column({
        type: 'datetime',
        comment: '导入时间'
    })
    import_time: Date;

    @Column({
        type: 'varchar',
        length: 255,
        comment: '导入文件名'
    })
    import_file_name: string;

    @Column({
        type: 'int',
        comment: '导入数据量'
    })
    import_total: number;
}