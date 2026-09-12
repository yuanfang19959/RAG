import { defineConfig } from 'umi';

const isProd = process.env.NODE_ENV === 'production';

// 后端在 8000，umi dev 默认也是 8000，所以前端挪到 8001（PORT=8001 pnpm dev）
export default defineConfig({
  npmClient: 'pnpm',
  routes: [
    { path: '/', component: 'index' },
    { path: '/widget', component: 'widget' },
  ],
  // 用 hash 路由，产物挂在任意子路径下都不用后端配 fallback
  history: { type: 'hash' },
  // 构建产物交给 FastAPI 挂在 /ui 下，和 API 同源，iframe 里不涉及跨域
  publicPath: isProd ? '/ui/' : '/',
  outputPath: '../static/ui',
  // dev 时把 API 请求转发给 FastAPI，浏览器侧同样没有跨域
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    },
  },
  title: 'RAG 问答',
});
