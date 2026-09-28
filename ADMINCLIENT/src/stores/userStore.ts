import { defineStore } from 'pinia'
import * as api from './api'
import { useMenuStore } from '@/stores/menuStore';

// 定义用户信息类型（抽离出来，方便复用）
interface UserInfo {
  token: string
  data: {
    user_id?: number     // 用户ID
    username?: string // 用户名
    email?: string // 昵称
    role_name: string
    menu_list?: any[]
  }
  // 其他需要的字段
}



export const useUserStore = defineStore('user', {
  // 1. 状态定义：初始化时从localStorage读取，实现持久化
  state: () => ({
    userInfo: {
      token: localStorage.getItem('token') || '', // 优先读本地token
      data: JSON.parse(localStorage.getItem('userData') || '{}')  // 单独存用户信息
    },
  }),

  // 2. 方法定义（选项式写法的actions）
  actions: {
    /**
     * 修复：先初始化userInfo，再赋值属性
     * @param data 接口返回的 { token, data } 结构数据
     */
    saveUserInfo(data: UserInfo) {
      // 1. 先判断data是否有效（防御性编程）
      if (!data) {
        return;
      }

      // 2. 给userInfo赋值（先确保userInfo是对象，而非null）
      // 方式1：整体替换（推荐，避免属性层级错误）
      this.userInfo = {
        token: data.token || '',
        data: { ...data.data } // 深拷贝用户信息，避免引用问题
      };

      // 3. 持久化存储（拆分存储，方便单独读取）
      localStorage.setItem('token', this.userInfo.token);
      localStorage.setItem('userInfo', JSON.stringify(this.userInfo.data));
    },


    /**
     * 设置token（单独更新token）
     * @param token 新的token
     */
    setToken(token: string) {
      if (this.userInfo) {
        this.userInfo.token = token // 更新状态中的token
      } else {
        // this.userInfo.token = { token } // 无用户信息时初始化
      }
      // 同步到本地存储
      localStorage.setItem('token', token)
      localStorage.setItem('userInfo', JSON.stringify(this.userInfo))
    },

    /**
     * 清除用户信息（退出登录）
     */
    clearUserInfo() {
      // 清空Pinia状态
      this.userInfo = {
        token: '', data: {
          id: null,
          username: null,
          nickname: null,
          avatar: null,
          user_id: null
        }
      }
      // 清空本地存储
      localStorage.removeItem('userInfo')
      localStorage.removeItem('token')

      // 退出登录
        
    },

    /**
     * 根据token获取用户信息（并自动保存）
     */
    async getUserInfoForToken() {
      try {
        const menuStore = useMenuStore();
        const res = await api.getUserInfoForToken()
        if (res.code === 2000) {
          this.saveUserInfo(res.data)
          menuStore.menuRouterInfo.userMenuList = res.data.data.menu_list.data
        } else {
          console.warn('获取用户信息失败：', res.msg)
        }
        return res
      } catch (error) {
        console.error('获取用户信息异常：', error)
        throw error // 抛出异常，方便上层处理
      }
    },
  },
})
