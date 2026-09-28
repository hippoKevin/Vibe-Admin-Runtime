import { useMenuStore } from "@/stores/menuStore"

const menuStore = useMenuStore()


export const getActionMenuId = () => {
    return menuStore.menuRouterInfo.activeRouter
}