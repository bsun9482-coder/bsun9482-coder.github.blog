import { lazy } from "react"
import postMetadataModules from "virtual:post-metadata"

import { formatPostDate } from "@/lib/post-date"
import type { LocalPost } from "@/types/post"
import type { MDXComponents } from "mdx/types"
import type { ComponentType } from "react"

/* ⚠️ 这一份是「构建期 MDX」数据源，前台已经改从 /api/posts 取文章（见 lib/api-posts.ts）。
   现在保留它有两个用途：① 万一要回退，改一行 import 就行；② 相册页（lib/gallery.ts）
   还从 MDX 里取图片清单。
   等确认接口那套稳定之后，这个文件连同 content/resources/*.mdx 可以一起删掉。 */

/* 日期格式化挪到了 lib/post-date.ts（前台卡片也要用，不该为了它把 MDX 清单拖进包）。
   这里原样再导出一次，是为了不动历史调用点。 */
export { formatPostDate }

type PostModule = {
  default: ComponentType<{ components?: MDXComponents }>
}

const postModules = import.meta.glob<PostModule>("/content/resources/*.mdx")

function getSlug(path: string) {
  const filename = path.split("/").at(-1)
  if (!filename?.endsWith(".mdx")) {
    throw new Error(`Invalid MDX post path: ${path}`)
  }

  return filename.slice(0, -4)
}

function getTimestamp(date: string) {
  const timestamp = Date.parse(date)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function createPosts(): LocalPost[] {
  return Object.entries(postMetadataModules)
    .map(([path, metadata]) => {
      const loadContent = postModules[path]
      if (!loadContent) {
        throw new Error(`Missing compiled MDX module for ${path}`)
      }

      return {
        ...metadata,
        slug: getSlug(path),
        Content: lazy(loadContent),
      }
    })
    .filter((post) => !post.draft)
    .sort((a, b) => getTimestamp(b.date) - getTimestamp(a.date))
}

export const posts = createPosts()

export function getPostBySlug(slug: string) {
  return posts.find((post) => post.slug === slug)
}
