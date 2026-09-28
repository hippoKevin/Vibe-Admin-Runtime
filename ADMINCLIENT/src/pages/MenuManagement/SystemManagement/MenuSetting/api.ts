import requestApi from "@/utils/request/request";
import { useUserStore } from "@/stores/userStore";

const userStore = useUserStore();

/** 获取菜单列模板列表（带菜单名） */
export function getMenuStatusList(data: {
  ep: { menu_name: string };
  paging: { pageNumber: number; pageSize: number };
}) {
  return requestApi({
    url: '/hippoadmin/menu/status/list',
    method: 'get',
    params: data,
  });
}

/** 获取指定菜单的列模板 */
export function getMenuStatus(menuId: number) {
  return requestApi({
    url: `/hippoadmin/menu/status/${menuId}`,
    method: 'GET',
  });
}

/** 更新指定菜单的列模板 */
export function updateMenuStatus(menuStatusId: number, columnConfig: any[]) {
  return requestApi({
    url: `/hippoadmin/menu/status/update/${menuStatusId}`,
    method: 'POST',
    data: { column_config: columnConfig },
  });
}

/** 删除指定菜单的列模板配置 */
export function deleteMenuStatus(menuStatusId: number) {
  return requestApi({
    url: `/hippoadmin/menu/status/delete/${menuStatusId}`,
    method: 'POST',
  });
}

/** 获取菜单下拉列表（用于新增时选择菜单） */
export function getMenuOptions() {
  // 获取当前用户id
  const userId = userStore.userInfo.data.user_id;

  return requestApi({
    url: '/hippoadmin/menu/options/' + userId,
    method: 'GET',
  })
}

/** 新增菜单列模板（使用默认列配置） */
export function saveMenuStatus(menuId: number) {
  return requestApi({
    url: '/hippoadmin/menu/status/save',
    method: 'POST',
    data: { menu_id: menuId },
  })
}