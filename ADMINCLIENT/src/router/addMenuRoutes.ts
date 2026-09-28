const routesPath = import.meta.glob('@/**/*.vue');
export default function addMenuRoutes(routeList: any, router: any) {
    routeList.forEach((item: any) => {
        const routeObj = {
            path: `/${item.component_name}`,
            name: item.component_name,
            meta: {
                menu_name: item.menu_name,
                icon: item.menu_icon,
                is_cached: item.is_cached,
                id: item.menu_id
            },
            // component: routesPath[item.component_address]
            component: routesPath[item.component_address]
        }

        if (item.children) {
            addMenuRoutes(item.children, router);
        }
        if (item.component_address) {
            const hasRoute = router.getRoutes().find((items: any) => item.component_name == items.name);
            if (!hasRoute&&!item.bi_path) {
                router.addRoute("HomePage", routeObj as any)
            }
        }

    })
}