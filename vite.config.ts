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
})
