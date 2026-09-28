import requestApi from "@/utils/request/request";

// 添加角色
export function addRole(data: any) {
    return requestApi({
      url: "/hippoadmin/role/add",
      method: "post",
      data,
    });
  }