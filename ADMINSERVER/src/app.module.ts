import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
// 数据库
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuModule } from './module/system/menu.module';
import { UserModule } from './module/system/user.module';
import { CommonModule } from './module/system/common.module';
import { RoleModule } from './module/system/role.module';
import { JwtStrategy } from 'src/common/strategies/jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { FileModule } from './module/system/file/file.module';

@Module({
  imports: [
    // 读取 .env 环境变量（isGlobal: true 让全局可注入 ConfigService）
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'hippoadmin',
      signOptions: { expiresIn: '1h' },
    }),
    // 数据库连接：全部从 .env 读取，未配置时默认使用本机 127.0.0.1
    TypeOrmModule.forRoot({
      name: 'etp_default_sql',
      type: 'mysql', // mysql数据
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'ETP_DEFAULT_SQL',
      password: process.env.DB_PASSWORD || 'kevin_hippo',
      database: process.env.DB_DATABASE || 'etp_default_sql',
      autoLoadEntities: true,
      logging: true,  // 日志
      synchronize: true, // 同步数据库结构
      connectTimeout: 60000,
      acquireTimeout: 60000,        // 获取连接超时 60s
      extra: {
        connectionLimit: 10,
        waitForConnections: true,
      },
    }),
    MenuModule,
    UserModule,
    CommonModule,
    RoleModule,
    FileModule,
  ],
  providers: [
    JwtStrategy, // 关键：注册 Strategy
  ],
})
export class AppModule { }
