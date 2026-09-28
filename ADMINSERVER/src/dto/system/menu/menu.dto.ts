import { Type } from "class-transformer";
import { IsString, IsNumber, IsBoolean, IsOptional, IsNotEmpty, IsArray, ValidateNested } from "class-validator";

export class CreateMenuDto {
  @IsString()
  menu_name: string; // 菜单名称（必传）

  @IsOptional()
  @IsString()
  menu_icon?: string; // 菜单图标（可选）

  @IsOptional()
  @IsString()
  component_name?: string; // 组件名称（可选）

  @IsOptional()
  @IsString()
  component_address?: string; // 组件地址（可选）

  @IsNumber()
  menu_type: number; // 菜单类型（必传：0-目录，1-菜单）

  @IsOptional()
  @IsBoolean()
  is_cached?: boolean = false; // 是否缓存（默认true）

  @IsNumber()
  parent_id: number = null; // 父级ID

  @IsOptional()
  @IsBoolean()
  is_show?: boolean = true; // 是否显示（默认true）

  @IsOptional()
  @IsString()
  menu_remark?: string; // 备注（可选）
}


export class UpdateMenuDto {
  @IsNumber()
  menu_id: number; // 菜单ID（必传） 

  @IsString()
  menu_name: string; // 菜单名称（必传）

  @IsOptional()
  @IsString()
  menu_icon?: string; // 菜单图标（可选）

  @IsOptional()
  @IsString()
  component_name?: string; // 组件名称（可选）

  @IsOptional()
  @IsString()
  component_address?: string; // 组件地址（可选）

  @IsNumber()
  menu_type: number; // 菜单类型（必传：0-目录，1-菜单）

  @IsOptional()
  @IsBoolean()
  is_cached?: boolean = false; // 是否缓存（默认true）

  @IsNumber()
  parent_id: number = null; // 父级ID

  @IsOptional()
  @IsBoolean()
  is_show?: boolean = true; // 是否显示（默认true）

  @IsOptional()
  @IsString()
  menu_remark?: string; // 备注（可选）

  menu_sort?: number; 
}


/**
 * ==============================
 * 操作模块
 * ==============================
 */


export class CreateOperationDto {
  @IsNotEmpty()
  @IsString()
  operation_name: string;

  @IsNotEmpty()
  @IsString()
  operation_sign: string;

  @IsOptional()
  @IsString()
  operation_port: string;

  @IsOptional()
  @IsString()
  operation_method: string;

  @IsNotEmpty()
  @IsNumber()
  menu_id: number;
}

export class DeleteOperationDto {
  @IsNotEmpty()
  @IsNumber()
  operation_id: number;
}


export class ColumnConfigDto {
  colKey: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
  visible: boolean;
  displayIndex: number;
  sortOrder?: 'ASC' | 'DESC' | null;
}

export class UpdateMenuStatusDto {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ColumnConfigDto)
  column_config: ColumnConfigDto[];
}