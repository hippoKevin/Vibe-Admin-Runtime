import requestApi from "@/utils/request/request";
import axios from "axios";

// 修改密码参数
interface ChangePasswordDTO {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
}


// 更新个人信息参数
interface UpdateUserInfoDTO {
    username: string;
    phone_number: string;
    email: string;
    gender: number;
}

// 获取菜单列表
export function getMenuList() {
    return requestApi({
        url: '/hippoadmin/menu/list',
        method: 'get'
    })
}

// 修改密码
export function changePassword(userId: number, changePasswordDTO: ChangePasswordDTO) {
    return requestApi({
        url: `hippoadmin/user/${userId}/changePassword`,
        method: 'post',
        data: changePasswordDTO
    })
}

// 获取个人信息
export function getPersonalInfo(userId: number) {
    return requestApi({
        url: `hippoadmin/user/${userId}/info`,
        method: 'get'
    })
}

// 更新个人信息
export function updatePersonalInfo(userId: number, updateDTO: UpdateUserInfoDTO) {
    return requestApi({
        url: `hippoadmin/user/${userId}/update`,
        method: 'post',
        data: updateDTO
    })
}
