import { IsNumber, IsOptional, IsString, Matches, Max, Min } from "class-validator";

// 正则常量抽离，便于维护和复用
export const REGEX = {
  // 账号：字母/数字/下划线，3-20位（可根据业务调整）
  ACCOUNT: /^[a-zA-Z0-9_]{3,20}$/,
  // 手机号：支持+86前缀，11位纯数字（国内手机号规则）
  PHONE: /^(\+86)?1[3-9]\d{9}$/,
  // 邮箱：通用邮箱正则（支持主流邮箱格式）
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  // 姓名：2-10位中文/字母（支持中英文姓名，可根据业务调整）
  USERNAME: /^[\u4e00-\u9fa5a-zA-Z]{2,10}$/,
  // 权限名称：中文/字母/数字/下划线，2-16位（可根据业务调整）
  AUTH_NAME: /^[\u4e00-\u9fa5a-zA-Z0-9_]{2,16}$/
};

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Matches(REGEX.ACCOUNT, { message: "账号只能由字母、数字、下划线组成，且长度3-20位" })
  account: string; // 账号 可选

  @IsOptional()
  @IsNumber()
  role_id: number; // 权限等级 可选

  @IsOptional()
  @IsString()
  @Matches(REGEX.AUTH_NAME, { message: "权限名称只能由中文、字母、数字、下划线组成，且长度2-16位" })
  role_name: string; // 权限名称 可选

  @IsOptional()
  @IsString()
  @Matches(REGEX.USERNAME, { message: "用户姓名只能由中文、字母组成，且长度2-10位" })
  username: string; // 用户姓名 可选

  @IsOptional()
  @IsString()
  password: string; 

  @IsOptional()
  @IsString()
  @Matches(REGEX.PHONE, { message: "手机号格式错误，支持+86前缀，如+8613800138000或13800138000" })
  phone_number: string; // 手机号 可选

  @IsOptional()
  @IsString()
  @Matches(REGEX.EMAIL, { message: "邮箱格式错误，如example@xxx.com" })
  email: string; // 邮箱 可选

  @IsOptional()
  @IsNumber()
  @Min(0, { message: "性别只能是0（未知）、1（男）、2（女）" })
  @Max(2, { message: "性别只能是0（未知）、1（男）、2（女）" })
  gender: number; // 性别 0未知 1男 2女 可选
}