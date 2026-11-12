import mdx from "@mdx-js/rollup"
import { readdirSync, readFileSync } from "node:fs"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypePrettyCode from "rehype-pretty-code"
import rehypeSlug from "rehype-slug"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import { defineConfig, type Plugin } from "vite"

import { getPostMetadata } from "./vite-plugins/remark-post-metadata.ts"
import { journalFrontmatterPlugin } from "./vite-plugins/journal-frontmatter.ts"

const POST_METADATA_MODULE_ID = "virtual:post-metadata"
const RESOLVED_POST_METADATA_MODULE_ID = `\0${POST_METADATA_MODULE_ID}`
const CONTENT_POSTS_DIRECTORY = path.resolve(
  import.meta.dirname,
  "content/resources"
)

function postMetadataPlugin(): Plugin {
  return {
    name: "post-metadata",
    enforce: "pre",
    resolveId(id) {
      if (id === POST_METADATA_MODULE_ID) {
        return RESOLVED_POST_METADATA_MODULE_ID
      }
    },
    load(id) {
      if (id !== RESOLVED_POST_METADATA_MODULE_ID) return null

      const entries = readdirSync(CONTENT_POSTS_DIRECTORY, {
        withFileTypes: true,
      })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
        .map((entry) => {
          const filename = path.join(CONTENT_POSTS_DIRECTORY, entry.name)
          this.addWatchFile(filename)

          return [
            `/content/resources/${entry.name}`,
            getPostMetadata(readFileSync(filename, "utf8"), filename),
          ]
        })

      return `export default ${JSON.stringify(Object.fromEntries(entries))}`
    },
    handleHotUpdate({ file, modules, server }) {
      if (!file.startsWith(CONTENT_POSTS_DIRECTORY) || !file.endsWith(".mdx")) {
        return
      }

      const metadataModule = server.moduleGraph.getModuleById(
        RESOLVED_POST_METADATA_MODULE_ID
      )
      if (!metadataModule) return

      server.moduleGraph.invalidateModule(metadataModule)
      return [...modules, metadataModule]
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    postMetadataPlugin(),
    /* 必须在 mdx() 之前：把 content/journal 的 YAML 头改写成 ESM 导出。 */
    journalFrontmatterPlugin(),
    {
      enforce: "pre",
      ...mdx({
        include: /\.mdx$/,
        remarkPlugins: [remarkFrontmatter, remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: "wrap" }],
          [
            rehypePrettyCode,
            {
              keepBackground: false,
              theme: {
                dark: "github-dark-default",
                light: "github-light-default",
              },
            },
          ],
        ],
      }),
    },
    react({ include: /\.(js|jsx|md|mdx|ts|tsx)$/ }),
    tailwindcss(),
  ],
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
         的问题最费时间，所以这里必须先配好。
         注意：改完这个文件一定要重启 dev server（代理只在启动时读一次）。 */
      "/uploads": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
})
