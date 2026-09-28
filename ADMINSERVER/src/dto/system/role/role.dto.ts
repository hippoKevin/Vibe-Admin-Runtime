import { IsString, IsOptional, MaxLength, MinLength, IsArray, IsNumber } from 'class-validator';

export class UpdateRoleDto {
  
  // 1. 角色名称
  // 允许更新，但如果是字符串，长度需在 2-30 之间
  @IsOptional()
  @IsString()
  @MinLength(2, { message: '角色名称至少需要2个字符' })
  @MaxLength(30, { message: '角色名称不能超过30个字符' })
  role_name?: string;

  // 3. 角色归属单位
  @IsOptional()
  @IsString()
  @MaxLength(30)
  role_unit?: string;

  // 4. 角色归属部门
  @IsOptional()
  @IsString()
  @MaxLength(30)

  role_dept?: string;

  // 5. 角色描述
  // 描述通常较长，允许为空
  @IsOptional()
  @IsString()
  role_desc?: string;
}

export class addRoleDto {
     // 1. 角色名称
    // 允许更新，但如果是字符串，长度需在 2-30 之间
    @IsOptional()
    @IsString()
    @MinLength(2, { message: '角色名称至少需要2个字符' })
    @MaxLength(30, { message: '角色名称不能超过30个字符' })
    role_name?: string;

    // 3. 角色归属单位
    @IsOptional()
    @IsString()
    @MaxLength(30)
    role_unit?: string;

    // 4. 角色归属部门
    @IsOptional()
    @IsString()
    @MaxLength(30)
    role_dept?: string;

    // 5. 角色描述
    // 描述通常较长，允许为空
    @IsOptional()
    @IsString()
    role_desc?: string;
}


export class ConfigRoleAuthDto {
    @IsArray()
    @IsNumber({}, { each: true })
    @IsOptional()
    menuIds: number[];

    @IsArray()
    @IsNumber({}, { each: true })
    @IsOptional()
    operationIds: number[];
}