import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  @Entity('port_list') // 对应数据库表名，按实际调整
  export class PortEntity {
    @PrimaryGeneratedColumn({ name: 'port_id' })
    port_id: number;
  
    @Column({ type: 'varchar', length: 100, comment: '接口名称' })
    port_name: string;
  
    @Column({ type: 'varchar', length: 10, comment: '请求方法 GET/POST/PUT/DELETE/PATCH' })
    port_method: string;
  
    @Column({ type: 'varchar', length: 255, comment: '接口地址' })
    port_address: string;

    @Column({ type: 'tinyint', default: 0 , comment: '接口类型/0表示目录/1表示接口' })
    port_type: number;
  
    @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
    port_remark: string;
  
    @Column({ type: 'int', default: 0, comment: '父级ID，0为顶级' })
    parent_id: number;
  
    @CreateDateColumn({ comment: '创建时间' })
    created_at: Date;
  
    @UpdateDateColumn({ comment: '更新时间' })
    updated_at: Date;
  }