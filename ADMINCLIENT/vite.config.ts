
import { ConfigEnv, defineConfig, loadEnv, UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import path from 'node:path'

import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { TDesignResolver } from 'unplugin-vue-components/resolvers';

// https://vite.dev/config/
export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [
      vue(),
      vueJsx(),
      vueDevTools(),
      AutoImport({
        resolvers: [TDesignResolver({
          library: 'vue-next'
        })],
      }),
      Components({
        resolvers: [TDesignResolver({
          library: 'vue-next'
        })],
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      },
    },
    server: {
      // Windows 上 Vite 的文件监听会漏事件（编辑器/工具以"替换文件"方式写入时尤其明显），
      // 表现为「硬盘上代码是新的，dev server 却一直吐旧模块」，排查时非常费劲。
      // 改成轮询换取确定性：代价是少量 CPU，但改动一定会被感知。
      watch: {
        usePolling: true,
        interval: 400
      },
      // 代理配置
      proxy: {
        '/proxy': {
          target: 'http://' + env.VITE_SERVER_URL, // 代理地址
          changeOrigin: true, // 更新请求的源
          rewrite: (path) => path.replace(/^\/proxy/, '') // 重写路径
        },
        // 开发模式独立控制台（/hippoadmin/dev-agent/console）：
        // 页面由后端直接吐出、不经过 Vite，避免被 HMR / 整页刷新刷掉。
        // 生产环境由 nginx 代理同样的路径。
        '/hippoadmin': {
          target: 'http://' + env.VITE_SERVER_URL,
          changeOrigin: true
        }
      },
      host: env.VITE_OPEN_CLIENT,
      port: env.VITE_OPEN_CLIENT_PORT as unknown as number,
      open: false
    }
  }
})

