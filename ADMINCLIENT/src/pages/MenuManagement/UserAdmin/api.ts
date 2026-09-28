import requestApi from "@/utils/request/request";

// 获取用户列表
export function getUserList(data: any) {
  return requestApi({
    url: '/hippoadmin/user/list',
    method: 'get',
    params: data,
  })
}

// 新增用户
export function addUser(data: any) {
  return requestApi({
    url: '/hippoadmin/user/add',
    method: 'post',
    data,
  })
}

// 更新个人信息参数
interface UpdateUserInfoDTO {
  username: string;
  phone_number: string;
  email: string;
  gender: number;
}

// 修改用户
export function updatePersonalInfo(userId: number, updateDTO: UpdateUserInfoDTO) {
  return requestApi({
      url: `hippoadmin/user/${userId}/update`,
      method: 'post',
      data: updateDTO
  })
}


// 删除用户
export function deleteUser(userId: number) {
  return requestApi({
      url: `hippoadmin/user/${userId}/delete`,
      method: 'post',
  })
}

// 获取菜单配置
export function getMenuStatus(menu_id: number) {
  return requestApi({
    url: '/hippoadmin/menu/status/' + menu_id,
    method: 'get',
  })
}

// 设置菜单配置
export function setMenuStatus(menu_status_id: number, data: any) {
  return requestApi({
    url: '/hippoadmin/menu/status/update/' + menu_status_id,
    method: 'post',
    data: {
      column_config: data
    },
  })
}