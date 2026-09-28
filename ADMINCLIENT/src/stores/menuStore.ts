import router from "@/router";
import { defineStore } from "pinia";
import { ref } from "vue";

export interface MenuRouterInfo { 
    userMenuList: any[], // 用户可操作菜单列表
    menuRouterList: any[], // 菜单路由列表
    activeRouter: number | null, // 当前激活的路由
    expanded: any[] | any | null, 
}


export const useMenuStore = defineStore('menu', () => {
    /**
     * 
     * 保存的菜单路由信息
     */
    const menuRouterInfo = ref<MenuRouterInfo>({
        userMenuList: [],
        menuRouterList: [],
        activeRouter: null,
        expanded: null
    })

    const userMenuList = ref([])

    /**
     * 保存用户可操作菜单列表
     * @param menu_list -菜单列表
     */
    const saveUserMenuList = (menu_list: any) => { 
        userMenuList.value = menu_list;
        menuRouterInfo.value.userMenuList = menu_list;
    }


    /**
     * 动态激活菜单导航
     * @param user_menu 用户菜单
     * @param menu_id 激活的菜单的id
     * @returns 
     */
    const getActionMenu = (user_menu: any,menu_id: any) => { 
        // 如果user_menu为空，则返回空
        if (!user_menu || user_menu.length == 0) return;

        // 递归函数
        function dfs(menus: any, currentPath: number[]): number[] | null {
            for (const menu of menus) {
              const newPath = [...currentPath, menu.menu_id];
    
              // 找到目标菜单，返回路径
              if (menu.menu_id === menu_id) {
                return newPath;
              }
    
              // 如果有子菜单，继续递归搜索
              if (menu.children && menu.children.length > 0) {
                const result = dfs(menu.children, newPath);
                if (result) {
                  return result;
                }
              }
            }
    
            // 未找到目标菜单
            return null;
        }

        // 从根菜单开始搜素
        const result =  dfs(user_menu, []) ;

        if (result) {
            menuRouterInfo.value.activeRouter = result[result.length - 1] || null;
            menuRouterInfo.value.expanded = result;
        } else { 
            menuRouterInfo.value.activeRouter = menuRouterInfo.value.userMenuList[0];
        }
        
    }


    /**
     * 记录切换路由的信息
     * @param menu_list =菜单路由列表
     * @param menu_id -切换的路由id
     *
     * @returns {void} 
     */
    const recordMenuRouterInfo = (menus: any,to: any) => { 
        // 1.记录路由nav，如果有重复的，就不继续追加
        if (menuRouterInfo.value.menuRouterList.findIndex((item: any) => item.path == to.path) != -1 && to.path != '/') {
            menuRouterInfo.value.menuRouterList[menuRouterInfo.value.menuRouterList.findIndex((item: any) => item.path == to.path)] = to;
            return;
        }
        // 2.白名单
        const excludePath = ['/login', '/LoginIndex'];
        if (excludePath.includes(to.path)) {
            return;
        }

        menuRouterInfo.value.menuRouterList.push(to);
        menuRouterInfo.value.activeRouter = to.meta.id;
    }

    /**
     * 
     * @param menu_id -关闭的路由id
     * @returns { boolean } -true 表示关闭成功，false表示不存在该路由
     */
    // 关闭指定id路由
    const closeMenuRouter = (menu_id: number) => { 
        const index = menuRouterInfo.value.menuRouterList.findIndex((item: any) => item.meta.id == menu_id);
        if (index != -1) {
          //如果关闭的是当前页面，就跳转到上一个页面
          if (menuRouterInfo.value.menuRouterList[index].meta.id == menuRouterInfo.value.activeRouter) {
            const preIndex = index - 1;
            if (preIndex >= 0) {
              router.push(menuRouterInfo.value.menuRouterList[preIndex].path);
            } else {
              router.push('/');
            }
          }
          menuRouterInfo.value.menuRouterList.splice(index, 1);
        }   
    }

    // 关闭其他所有路由
    const closeOtherMenuRouter = (menu_id: number) => { 
      // 只保留当前这一个
      menuRouterInfo.value.menuRouterList = menuRouterInfo.value.menuRouterList.filter(
        (item: any) => item.meta.id == menu_id
      )
      // 跳转到保留的那个路由
      const current = menuRouterInfo.value.menuRouterList[0]
      if (current) {
        menuRouterInfo.value.activeRouter = current.meta.id
        router.push(current.path)
      }
    }

    /**
     * 清空所有路由
     * @returns
     */
    const clearMenuRouter = () => { 
      menuRouterInfo.value.menuRouterList = []
      menuRouterInfo.value.activeRouter = null
      // 跳转回首页
      router.push('/')
    }

    /**
     * 退出登录，清空路由
     */
    const logout = () => { 
      // 清空用户可操作路由
      saveUserMenuList([])
      clearMenuRouter()

      router.push({name: 'LoginPage'})
    }

    return {
        menuRouterInfo,
        // 方法
        recordMenuRouterInfo,
        closeMenuRouter,
        clearMenuRouter,
        getActionMenu,
        saveUserMenuList,
        closeOtherMenuRouter,
        logout
    }

})