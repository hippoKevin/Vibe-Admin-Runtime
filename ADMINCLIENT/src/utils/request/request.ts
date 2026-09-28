import { type AxiosRequestConfig } from "axios";
import request from '@/utils/request/index';
import { MessagePlugin } from "tdesign-vue-next";


/*
    * 接口请求封装
    * config.autoMsg: 自动提示 默认false
*/
interface Res {
    code: number;
    msg: string;
    data: any;
}

interface RequestConfig extends AxiosRequestConfig {
    autoMsg?: boolean;        // 是否自动提示
    filterRes?: boolean;      // 是否过滤响应
}


export default async function requestApi(config: RequestConfig): Promise<Res | any> {
    // 1. 默认配置
    const defaultConfig: RequestConfig = {
        autoMsg: false,
        filterRes: true,
        ...config
    };
    try {
        const res: Res = await request(defaultConfig);
        const _res = defaultConfig.filterRes ? res.data : res
        if (defaultConfig.autoMsg && _res.code == 2000) {
            // 自动提示
            MessagePlugin.success(_res.msg);
        }
        return await Promise.resolve(_res);
    } catch (error) {
        return await Promise.reject(error);
    }
}