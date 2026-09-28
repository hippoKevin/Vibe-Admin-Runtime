import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/pages/Home/index.vue'
import NProgress from "nprogress";
import { useUserStore } from '@/stores/userStore';
import { useMenuStore } from '@/stores/menuStore';
import addMenuRoutes from './addMenuRoutes';
import { nextTick } from 'vue';
import { initTheme } from '@/utils/theme';



const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'HomePage',
      component: Home,
      redirect: '/UserAdminPage',
      children: [
        {
          path: '/BI',
          name: 'BI',
          component: () => import('@/pages/NotFound.vue'),
        }
      ]
    },
    {
      path: '/login',
      name: 'LoginPage',
      component: () => import('@/pages/Login/index.vue'),
    },
    {
      path: '/NotFound',
      name: 'NotFound',
      component: () => import('@/pages/NotFound.vue'),
    }
  ],
})

let dynamicRoutesAdded = false;
 // 路由守卫-进入之前
 router.beforeEach(async (to, from, next) => { 
  NProgress.start()
  

  // 白名单：统一小写，匹配/login和所有404路径
  const whiteList = ['/login']
  const hasToken = localStorage.getItem('token')
  // const menuStore = useMenuStore()
  const userStore = useUserStore();

  // 1. 白名单页面直接放行 
  if (whiteList.includes(to.path)) {
    next()
    return // 必须return，避免后续逻辑干扰
  }

  // 2. 有Token但访问登录页 → 跳首页
  if (to.path === '/login' && hasToken) {
    next('/')
    return 
  }


  // 3. 无Token且不在白名单 → 跳登录页
  if (!hasToken) {
    next('/login')
    return
  }

  // 4. 有Token且合法路径 → 正常放行
  // 4.1 动态加载路由

  if (!dynamicRoutesAdded && to.path !== '/login') {
    try {
      const res = await userStore.getUserInfoForToken()
  
      if (res.code === 2000) {
        // 动态注册路由
        const menu_list = res.data.data.menu_list
  
        addMenuRoutes(menu_list, router)
  
        router.addRoute({
          path: '/:pathMatch(.*)*',
          redirect: '/NotFound'
        })
  
        dynamicRoutesAdded = true
  
        next({ ...to, replace: true })
      } else {
        next()
      }
    } catch (error) {
      console.log(error)
      next()
    }
  } else {
    next()
  }
})

//  // 路由守卫-进入之后
 router.afterEach(async (to: any) => { 
  const menuStore = useMenuStore()
  const userStore = useUserStore();
  const menus = userStore.userInfo.data.menu_list

  menuStore.getActionMenu(menus, to.meta.id)
  menuStore.recordMenuRouterInfo(menus, to)

  // 记录路由切换信息
  NProgress.done()
 })

export default router
