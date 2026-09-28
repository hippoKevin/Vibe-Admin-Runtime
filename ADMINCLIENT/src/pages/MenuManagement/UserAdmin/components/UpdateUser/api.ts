import requestApi from "@/utils/request/request";

// 更新个人信息参数
interface UpdateUserInfoDTO {
    username: string;
    phone_number: string;
    email: string;
    gender: number;
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

// 获取权限列表
export function getRoleList(data: any) {
    return requestApi({
      url: '/hippoadmin/role/list',
      method: 'get',
      data,
    })
  }
  