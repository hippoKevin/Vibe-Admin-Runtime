import {  Injectable,  } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ChagnePasswordDTO } from "src/dto/system/user/change-password.dto";
import { UserEntity } from "src/entities/system/user.entity";
import { Repository } from "typeorm";
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from "src/dto/system/user/update-user.dto";
import { BusinessException } from "src/common/exceptions/business.exception";
import { CreateUserDto } from "src/dto/system/user/create_user.dto";
import { SearchForm, PaginatedResult } from "src/common/types/pagination.types";
import { PaginationService } from "src/common/services/pagination.service";


@Injectable()
export class UserService {
    
    // 初始化菜单服务
    constructor(
        // 注入菜单数据仓库
        @InjectRepository(UserEntity, 'etp_default_sql') // 新增连接名参数
        // 菜单数据仓库
        private readonly userRepository: Repository<UserEntity>,
        private readonly paginationService: PaginationService
    ) {}


    /**
     * 获取用户列表
     * @param searchForm 查询参数
     * @returns 用户列表
     */
    async getUserList(searchForm: SearchForm): Promise<PaginatedResult<UserEntity>> {
        return this.paginationService.paginate(this.userRepository, searchForm);
      }

    /**
     * 获取个人信息
     * @param userId 用户ID
     * @returns 个人信息
     */
    async getUserInfo(userId): Promise<UserEntity> {
        // 1. 获取用户信息
        const userInfo: UserEntity = await this.userRepository.findOne({
            where: {
                user_id: userId
            }
        });
        // 2. 删除密码字段
        delete userInfo.password;
        // 3. 返回用户信息
        return userInfo;
    }

    /**
     * 新增用户
     * @param updateUserDto 新增用户信息
     * @returns 新增用户信息
     */
    async addUser(createUserDto: CreateUserDto) {

        // 1. 验证用户名是否已存在
        const user = await this.userRepository.findOne({
            where: {
                account: createUserDto.account
            }
        });

        if (user) {
            throw new BusinessException('账号已存在');
        }

        if (createUserDto.email !== '') {
            // 2. 验证邮箱是否已存在
            const email = await this.userRepository.findOne({
                where: {
                    email: createUserDto.email
                }
            });

            if (email) {
                throw new BusinessException('邮箱已存在');
            }
        }

        if (createUserDto.phone_number !== '') {
            // 3. 验证手机号是否已存在
            const phone = await this.userRepository.findOne({
                where: {
                    phone_number: createUserDto.phone_number
                }
            });

            if (phone) {
                throw new BusinessException('手机号已存在');
            }
        }

        // 密码加密
        createUserDto.password = await bcrypt.hash(createUserDto.password, 10);

        return await this.userRepository.save(createUserDto);
    }

    /**
     * 更新用户信息
     * @param userId 用户ID
     * @param updateUserDto 更新用户信息
     * @returns 更新后的用户信息
     */
    async updateUserInfo(userId: number, updateUserDto: UpdateUserDto) {
        // 1. 获取用户信息
        const user = await this.userRepository.findOne({
            where: {
                user_id: userId
            }
        });

        if (!user) {
            throw new BusinessException('用户不存在');
        }

        // 2. 建立更新模板
        const updateObject = {
            ...user,
            ...updateUserDto
        }
        
        // 如果密码有更新，则进行加密
        if (updateUserDto.password) {
            updateObject.password = await bcrypt.hash(updateUserDto.password, 10);
        }

        // 3. 更新
        const updateUser = await this.userRepository.update(userId, updateObject);

        return {
            message: '用户信息修改成功',
            data: updateUser
        }
    }

    /**
     * 修改密码
     * @param oldPassword 旧密码
     * @param password 密码
     * @param confirmPassword 确认密码
     * @returns 修改密码结果
     */
    async changePassword(userId: number, ChagnePasswordDTO: ChagnePasswordDTO) {
        // 1. 查找需要修改密码的用户
        const user = await this.userRepository.findOne({
            where: { user_id: userId }
        });

        // 2. 判断用户是否存在
        if (!user) {
            // 抛出异常
            return { message: '用户不存在' };
        }

        // 3. 判断旧密码是否正确
        if (!(await bcrypt.compare(ChagnePasswordDTO.oldPassword, user.password))) {
            // 抛出异常
            return { message: '旧密码错误' };
            // throw new Error('旧密码错误');
        }

        // 4. 判断确认密码是否与密码一致
        if (ChagnePasswordDTO.newPassword !== ChagnePasswordDTO.confirmPassword) {
            // 抛出异常
            return { message: '确认密码与新密码不一致' };
            // throw new Error('确认密码与新密码不一致');
        }

        // 5. 修改密码
        user.password = await bcrypt.hash(ChagnePasswordDTO.newPassword, 10);
        await this.userRepository.save(user);
        return { message: '修改密码成功' };
    }

    /**
     * 删除用户
     * @param userId 用户ID
     * @returns 删除结果
     */
    async deleteUser(userId: number) {
        // 1. 获取用户信息
        const user = await this.userRepository.findOne({
            where: {
                user_id: userId
            }
        });

        if (!user) {
            throw new BusinessException('用户不存在');
        }

        // 2. 删除
        await this.userRepository.delete(userId);

        return {
            message: '用户删除成功',
        }
    }
}
