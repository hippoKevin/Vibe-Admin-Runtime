import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { UserEntity } from "src/entities/system/user.entity";
import { DataSource, Repository } from "typeorm";
import * as bcrypt from 'bcrypt';
import { LoginDto } from "src/dto/system/login.dto";
import { JwtService } from "@nestjs/jwt";
import { BusinessException } from "src/common/exceptions/business.exception";
import { Request } from "express";
import { MenuService } from "./menu.service";
import * as fs from 'fs';
import * as path from 'path';

// 新增：定义JWT Payload的类型，统一login和verifyToken的payload格式
export interface JwtPayload {
  sub: number;    // 用户ID
  username: string;// 用户名
  role_id: number; // 权限等级（和user.role_name一致）
}

@Injectable()
export class CommonService {
  constructor(
    @InjectDataSource('etp_default_sql')
    private readonly dataSource: DataSource,

    @InjectRepository(UserEntity, 'etp_default_sql')
    private readonly userRepository: Repository<UserEntity>,
    private readonly menuService: MenuService,
    private readonly jwtService: JwtService
  ) { }

  /**
   * 登录功能（账号密码验证）
   * @param loginDto 前端传入的登录信息
   * @returns 登录成功信息
   */
  async login(loginDto: LoginDto) {
    // 1. 检查数据是否为空
    if (!loginDto.username || !loginDto.password) {
      // 抛出异常
      throw new BusinessException('用户名或密码不能为空');
    }

    // 2. 检查用户是否存在
    const user = await this.userRepository.findOne({
      where: { account: loginDto.username }
    });


    // 3. 验证密码是否正确 compare默认使用bcrypt进行密码验证 解密位数 10
    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      // 抛出异常
      throw new BusinessException('用户名或密码错误');
    }



    // 4. 生成token
    const payload = {
      sub: user.user_id,
      username: user.username,
      role_id: user.role_name
    };

    const token = this.jwtService.sign(payload);

    // 获取所有路由列表
    const menuList = await this.menuService.getAuthMenuTreeByUser(user.user_id);

    const userInfo = {
      user_id: user.user_id,
      username: user.username,
      role_name: user.role_name,
      email: user.email,
      menu_list: menuList,
    };

    // 5. 返回登录成功信息
    return {
      data: userInfo,
      token: 'Bearer ' + token,
      message: '登录成功'
    }
  }

  /**
   * 验证Token并返回解析后的用户信息（含最新用户数据+对应权限菜单）
   * @param request Express请求对象（需包含headers.authorization）
   * @returns 返回用户完整信息（ID/用户名/权限/邮箱/菜单列表）
   */
  // 修复：修改返回值类型，匹配实际返回的用户信息结构
  async verifyToken(request: Request) {
    // 1. 提取Token
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new BusinessException('请先登录');
    }

    // 2. 验证Token有效性并解析
    try {
      // 修复：添加类型断言，指定payload为自定义的JwtPayload
      const payload = this.jwtService.verify<JwtPayload>(token);

      // 3. 验证用户是否仍存在于数据库中（防止注销/删除后Token仍有效）
      const user = await this.userRepository.findOne({
        where: { user_id: payload.sub }
      });
      if (!user) {
        throw new BusinessException('用户已注销，Token无效');
      }

      return {
        message: '验证成功'
      }

    } catch (error) {
      // 统一捕获Token过期、无效、签名错误等所有异常
      throw new BusinessException('Token无效或已过期，请重新登录');
    }
  }

  /**
   * 从请求头提取Token
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  /**
* 刷新Token（标准实现：验证旧Token有效性→解析载荷→二次验证用户→生成新Token→返回用户信息+新Token）
* @param token 前端传入的Token（支持带Bearer/纯Token两种格式）
* @returns { data: userInfo, token: 新Token, message: 提示语s }
*/
  async refreshToken(request: Request) {
    try {
      // 1. 处理Token格式：移除可能的Bearer前缀，提取纯Token4
      const token = this.extractTokenFromHeader(request);
      const pureToken = token.replace(/^Bearer\s+/, '');
      if (!pureToken) {
        throw new BusinessException('刷新Token不能为空');
      }

      // 2. 解析并验证旧Token有效性（自动校验是否过期、签名是否正确，无需手动判断过期）
      // 复用自定义的JwtPayload类型，明确解析后的数据结构
      const payload = this.jwtService.verify<JwtPayload>(pureToken);

      // 3. 二次验证用户是否仍存在（核心：防止用户注销/删除后，旧Token仍能刷新新Token）
      const user = await this.userRepository.findOne({
        where: { user_id: payload.sub },
      });
      if (!user) {
        throw new BusinessException('用户已注销，无法刷新Token');
      }
      // 可选：添加用户状态验证（如禁用用户不能刷新Token）
      // if (user.status !== 1) throw new BusinessException('用户已被禁用，无法刷新Token');

      // 4. 生成新的JWT Token（复用原有载荷，重新签名，刷新过期时间）
      // 保持payload和登录接口一致，保证前端解析逻辑通用
      const newPayload: JwtPayload = {
        sub: user.user_id,
        username: user.username,
        role_id: user.role_id,
      };
      const newToken = this.jwtService.sign(newPayload); // 同步生成，无需await

      // 5. 按用户实际权限获取菜单（和登录/verifyToken逻辑一致，避免获取所有菜单）
      const menuList = await this.menuService.getAuthMenuTreeByUser(user.user_id);

      // 6. 构造用户信息（隐藏敏感字段，和登录接口返回格式完全一致）
      const userInfo = {
        user_id: user.user_id,
        username: user.username,
        role_name: user.role_name,
        email: user.email,
        menu_list: menuList,
      };

      // 7. 返回结果（格式和login一致，前端可复用同一套解析逻辑）
      return {
        data: userInfo,
        message: 'Token刷新成功',
        token: 'Bearer ' + newToken, // 拼接Bearer前缀，和登录返回一致
      };
    } catch (error) {
      // 统一捕获所有异常：Token过期/无效/签名错误/用户不存在等
      if (error.name === 'TokenExpiredError') {
        throw new BusinessException('旧Token已过期，请重新登录');
      }
      throw new BusinessException('Token无效，无法刷新，请重新登录');
    }
  }

  /**
    * 恢复默认
    */
  async refreshDefault() {
    const sqlFilePath = path.join(process.cwd(), 'src/sql', 'default.sql');

    let sqlContent: string;
    try {
      sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
    } catch (err) {
      throw new Error(`读取 SQL 文件失败: ${err?.message}`);
    }

    const statements = sqlContent
      .split(';')
      .map((s) => s.trim())
      .filter((s) => {
        if (!s) return false;
        if (s.startsWith('--')) return false;       // 过滤普通注释
        if (s.startsWith('/*')) return false;       // 过滤 /* */ 注释块
        if (s.startsWith('/*!')) return false;      // 过滤 MySQL 条件注释 /*!40101 ... */
        return true;
      });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 关闭外键约束
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

      // 2. 获取当前数据库所有表名
      const tables: { TABLE_NAME: string }[] = await queryRunner.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
    `);

      // 3. 删除所有现有表
      for (const { TABLE_NAME } of tables) {
        await queryRunner.query(`DROP TABLE IF EXISTS \`${TABLE_NAME}\``);
      }

      // 4. 执行默认 SQL，重建所有表和数据
      for (const statement of statements) {
        await queryRunner.query(statement);
      }

      // 5. 恢复外键约束
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');

      await queryRunner.commitTransaction();
      return { success: true, message: '数据库已恢复默认状态' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new Error(`恢复默认失败: ${error?.message ?? JSON.stringify(error)}`);
    } finally {
      await queryRunner.release();
    }
  }
}