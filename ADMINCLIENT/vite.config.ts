
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
      // 代理配置
      proxy: {
        '/proxy': {
          target: 'http://' + env.VITE_SERVER_URL, // 代理地址
          changeOrigin: true, // 更新请求的源
          rewrite: (path) => path.replace(/^\/proxy/, '') // 重写路径
        }
      },
      host: env.VITE_OPEN_CLIENT,
      port: env.VITE_OPEN_CLIENT_PORT as unknown as number,
      open: false
    }
  }
})

