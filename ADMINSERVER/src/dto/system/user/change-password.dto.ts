import { IsNotEmpty, IsString } from "class-validator";

export class ChagnePasswordDTO {
    @IsString()
    @IsNotEmpty({message: "旧密码不能为空"})
    oldPassword: string;

    @IsString()
    @IsNotEmpty({message: "新密码不能为空"})
    newPassword: string;

    @IsString()
    @IsNotEmpty({message: "确认密码不能为空"})
    confirmPassword: string;
}