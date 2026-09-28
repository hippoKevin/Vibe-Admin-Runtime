// src/common/dto/add-user.dto.ts
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class AddUserDto {
  @IsString() // 必须是字符串
  @IsNotEmpty({ message: '用户名不能为空' }) // 不能为空
  username: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度不能少于6位' }) // 密码最小长度6位
  password: string;

  @IsString()
  @IsNotEmpty({ message: '用户姓名不能为空' })
  realName: string; // 可根据实际需求添加其他字段（如角色、手机号等）
}