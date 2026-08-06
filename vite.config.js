import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

// MPA：三个入口各自独立成页。这不是审美选择 —— 引擎是硬单例
// （public/js/engine/boot-guards.js 的 Web Lock + engine.js 的 booted 标志），
// wasm runtime 进入 main() 后无法在同页销毁重建，所以"退出游戏"必须整页卸载。
// 附带收益：画廊页完全不加载引擎脚本，浏览列表不再先下 22MB wasm。
export default defineConfig({
    publicDir: 'public',

    build: {
        outDir: 'dist',
        emptyOutDir: true,
        // gen-sw.js 要靠它枚举带哈希的产物文件名
        manifest: true,
        rollupOptions: {
            input: {
                gallery: resolve(__dirname, 'index.html'),
                player: resolve(__dirname, 'play.html'),
                admin: resolve(__dirname, 'admin.html')
            }
        }
    },

    plugins: [vue()],

    server: {
        port: 5173,
        // 引擎依赖 SharedArrayBuffer，dev server 也必须发这两个头，
        // 否则本地开发时 wasm 起不来。生产环境由 worker/headers.js 负责。
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp'
        }
    }
});
