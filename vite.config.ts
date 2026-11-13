import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/* 这个文件以前有 120 行，一半是「构建期把 content/*.mdx 编译成文章」的三件套：
     · postMetadataPlugin —— 造一个 virtual:post-metadata 模块，装全站文章清单
     · journalFrontmatterPlugin —— 把日记的 YAML 头改写成 ESM 导出
     · mdx() —— 把 .mdx 编译成 React 组件（还会跑 rehype-pretty-code / shiki 上色）
   2026-11-13 第 38 轮把它们全删了：文章和日记都从后端接口读（/api/posts、/api/journals），
   正文在浏览器里用 react-markdown 现渲染，构建期不再需要知道「有哪些文章」。
   现在留下来的只剩三件事：React 编译、Tailwind、两条开发代理。 */

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    /* host 0.0.0.0：手机连同一个 wifi 也能打开看（局域网调试）。
       ⚠️ 改了这个文件必须**重启** dev server —— 代理配置只在启动时读一次，
          热更新不会重载它。这是「明明配了却报跨域」最常见的原因。 */
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      /* 开发期把 /api 开头的请求转给本地 FastAPI。
         为什么需要它：前端跑 5173、后端跑 8000，端口不同 = 浏览器眼里的「跨域」，
         前端直接请求会被同源策略拦下。
         有了这条代理，浏览器以为请求是发给 5173 自己的，由 dev server 在服务端
         转发到 8000 —— 跨域问题从根上消失，后端一行 CORS 配置都不用写。
         changeOrigin：转发时把 Host 头改成目标地址，某些后端会校验它。 */
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      /* /uploads 是后端挂出来的静态图片目录（backend/uploads）。
         为什么也要代理：文章里插入的图片地址是 /uploads/xxx.jpg 这种「站内相对地址」，
         预览区（还有前台的详情页）会拿它当 5173 上的资源去请求。
         没有这条代理，开发时图片全是碎图标，但生产环境又正常 —— 这种「只在本地坏」
         的问题最费时间，所以这里必须先配好。 */
      "/uploads": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
})
