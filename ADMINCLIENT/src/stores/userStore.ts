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

/**
 * 用户信息持久化键（单一事实来源）
 *
 * 全仓库统一用 `userInfo` 存「data 这一层」（扁平结构：user_id/username/menu_list…）：
 *   - 写入端：本 store 的 saveUserInfo / setToken
 *   - 读取端：utils/request/mock/index.ts、LayoutHeader、PersonCenter、ChangePassword
 *
 * 历史 bug：state 初始化读的是 `userData`（没有任何地方写这个键），而写入端一直写
 * `userInfo`，导致整页刷新后 store 里的用户信息为空，依赖它的逻辑（例如
 * DevModeConsole 的「改动文件 → 页面路由」映射）拿不到菜单数据。
 */
export const USER_INFO_KEY = 'userInfo'

/**
 * 旧版持久化键（只读，用于一次性兼容迁移）
 *
 * 老用户的浏览器里可能只有这个键。读到后迁移写回 USER_INFO_KEY，
 * 但**不删旧键**：这样即使回滚到老版本前端，用户信息也不会丢。
 * 登出时（clearUserInfo）会一并清掉，避免下次启动又被迁移回来。
 */
export const LEGACY_USER_INFO_KEY = 'userData'

/**
 * 兼容解析本地存的用户信息
 *
 * 历史上 setToken 曾把 `{ token, data }` 整体写进 `userInfo`，这里遇到这种包裹结构
 * 就取出内层 data，避免「键对了但形状不对」导致 menu_list 读不到。
 */
function normalizeStoredUserData(parsed: any): Record<string, any> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const inner = (parsed as any).data
  const looksWrapped =
    (parsed as any).menu_list === undefined &&
    (parsed as any).user_id === undefined &&
    inner &&
    typeof inner === 'object' &&
    !Array.isArray(inner)
  return looksWrapped ? { ...inner } : { ...parsed }
}

/** 解析一个键；不存在/非法/空对象都返回 null（交给调用方决定回退） */
function parseStoredUserData(raw: string | null): Record<string, any> | null {
  if (raw === null || raw === undefined || raw === '') return null
  try {
    const data = normalizeStoredUserData(JSON.parse(raw))
    return Object.keys(data).length ? data : null
  } catch {
    return null
  }
}

/**
 * 读取本地持久化的用户信息（刷新后恢复登录态的唯一来源）
 *
 * 优先读 USER_INFO_KEY；只有旧键 LEGACY_USER_INFO_KEY 存在时读它并做一次性迁移。
 */
function readPersistedUserData(): Record<string, any> {
  try {
    const current = parseStoredUserData(localStorage.getItem(USER_INFO_KEY))
    if (current) return current

    const legacy = parseStoredUserData(localStorage.getItem(LEGACY_USER_INFO_KEY))
    if (legacy) {
      try {
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(legacy))
      } catch {
        /* 写入失败（隐私模式等）不影响本次读取 */
      }
      return legacy
    }
  } catch {
    /* localStorage 不可用（隐私模式/SSR）时退化为空对象 */
  }
  return {}
}

export const useUserStore = defineStore('user', {
  // 1. 状态定义：初始化时从localStorage读取，实现持久化
  state: () => ({
    userInfo: {
      token: localStorage.getItem('token') || '', // 优先读本地token
      data: readPersistedUserData()  // 与写入端同一个键（userInfo），并兼容旧键 userData
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
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(this.userInfo.data));
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
      // 同步到本地存储（userInfo 键只存 data 这一层，形状与 saveUserInfo 保持一致）
      localStorage.setItem('token', token)
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(this.userInfo?.data ?? {}))
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
      localStorage.removeItem(USER_INFO_KEY)
      localStorage.removeItem('token')
      // 旧键一并清掉：否则下次启动的一次性迁移会把登出前的旧数据又读回来
      localStorage.removeItem(LEGACY_USER_INFO_KEY)

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
