import axios from "axios";
import { MessagePlugin } from 'tdesign-vue-next';
import { translateServerText } from '@/locales';
import { isMockEnabled, mockMode, handleMockRequest } from './mock/index';

// 所有请求统一走 /proxy，由 Vite 代理到后端接口地址（见 vite.config.ts）
const instance = axios.create({
    baseURL: '/proxy',
    // 请求超时：防止后端不可用时长时间等待（超时同样会触发 Mock 兜底）
    timeout: 8000,
});


// 添加请求拦截器
instance.interceptors.request.use(function (config) {
    const token = localStorage.getItem("token")
    if (token) {
        config.headers.Authorization = token
    }

    // 纯 Mock 模式（VITE_ENABLE_MOCK=true / force，仅开发环境）：
    // 命中 mock/*.json 映射的请求直接返回 Mock，绝不向后端发起真实请求；
    // 未映射的接口直接报错提示，同样不请求后端。
    if (mockMode() === 'force') {
        const mockResp = handleMockRequest(config)
        if (mockResp) {
            // 覆盖 adapter：不发起真实请求，直接返回 Mock
            config.adapter = (() => mockResp) as any
        } else {
            const errMsg = `[mock] 接口未配置 Mock 数据：${(config.method || 'GET').toUpperCase()} ${config.url || ''}`
            MessagePlugin.error(errMsg)
            return Promise.reject(Object.assign(new Error(errMsg), { config }))
        }
    }

    return config;
}, function (error) {
    return Promise.reject(error);
});

// 添加响应拦截器
instance.interceptors.response.use(async function (response) {
    switch (response.data.code) {
        case 4000://响应失败
            MessagePlugin.error(translateServerText(response.data.msg));
            break;
        case 4001://令牌相关
            const currentPath = window.location.pathname;
            if (response.data.msg == '令牌过期') {
                localStorage.removeItem("token");
                //当前路由地址

                MessagePlugin.error({
                    content: translateServerText(response.data.msg), duration: 1500, onClose: () => {
                        // 跳转到登录页面
                        if (currentPath.includes("/WorkshopHome")) {
                            return
                        } else {
                            window.location.href = "/login";
                        }

                    }
                });
            } else if (response.data.msg == '无效令牌') {
                MessagePlugin.error(translateServerText(response.data.msg));
                // 返回登录页面
                window.location.href = "/login";
            } else if (response.data.msg == '未提供身份认证') {
                MessagePlugin.error(translateServerText(response.data.msg));
                // 返回登录页面
                window.location.href = "/login";
            } else {
                MessagePlugin.error(translateServerText(response.data.msg));
                // 返回登录页面
                window.location.href = "/login";
            }
            break;
        case 4003://没有操作权限
            MessagePlugin.error(translateServerText(response.data.msg));
            break;
        case 4004://接口地址不正确
            MessagePlugin.error(translateServerText(response.data.msg));
            break;
        case 4005://接口Method调用方式出错
            MessagePlugin.error(translateServerText(response.data.msg));
            break;
    }
    return response
}, function (error) {
    // ================================================================
    // 开发环境 Mock 兜底（auto 模式）：
    // 当 VITE_ENABLE_MOCK=true 时，只要请求最终失败——
    //   1) 网络层错误（后端未启动、连接拒绝、超时：无 error.response）
    //   2) HTTP 错误（Vite /proxy 在后端不可用时返回的 500/502/503/504 等，
    //      这类错误带 error.response，之前按“有 response 就不是网络错误”漏判）
    // ——且命中 mock/*.json 映射，就自动切换为 Mock 数据。
    // 后端正常返回的业务错误（HTTP 200 包裹的 code 业务码，如 4000/4001）
    // 不会进入本分支，因此不会被 Mock 覆盖。
    // force 模式下请求不会失败（请求前已短路），无需在此处理。
    // ================================================================
    if (isMockEnabled() && error.config) {
        const mockResp = handleMockRequest(error.config)
        if (mockResp) {
            return mockResp.catch((err: any) => {
                console.warn('[mock] Mock 处理失败：', err)
                MessagePlugin.error(error.message || '请求失败');
                return Promise.reject(error);
            })
        }
    }

    MessagePlugin.error(error.message || '请求失败');
    return Promise.reject(error);
});

export default instance
