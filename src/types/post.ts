import type { ComponentType, LazyExoticComponent } from "react"
import type { MDXComponents } from "mdx/types"

export type PostFrontmatter = {
  title: string
  description: string
  date: string
  category: string
  tags: string[]
  draft?: boolean
}

export type TableOfContentsItem = {
  id: string
  title: string
  level: 2 | 3
}

export type PostMetadata = PostFrontmatter & {
  readingMinutes: number
  searchText: string
  tableOfContents: TableOfContentsItem[]
}

/* 前台展示用的文章（不含正文渲染方式）。
   两套数据源都要产出这个形状 —— 构建期的 MDX 和运行时的 /api/posts ——
   页面组件只认它，换数据源时页面一行都不用改。
   这就是「适配层」的意义：数据长什么样归数据管，怎么显示归页面管。 */
export type Post = PostMetadata & {
  slug: string
}

/* 构建期（MDX）那一套额外带一个「怎么渲染正文」的懒加载组件。
   数据库来的文章没有它 —— 正文是纯 Markdown 字符串，交给 react-markdown 渲染。 */
export type LocalPost = Post & {
  Content: LazyExoticComponent<ComponentType<{ components?: MDXComponents }>>
}

/* 详情页专用：比列表多一条「正文原文」。
   为什么不把 content 直接塞进 Post 并写成可选？
   可选字段会让详情页被迫写 `post.content ?? ""` —— 那种兜底会把「其实没取到正文」
   悄悄变成「一篇空文章」。单开一个类型，取详情的地方就一定能拿到正文。 */
export type ArticleDetail = Post & {
  content: string
}

/* ---------------------------------------------------------------- 后端契约
   下面这个形状 = 后端 schemas.PostRead 的原样输出（见 backend/schemas.py）。
   后台管理页和前台文章页都用它，所以只定义一次 ——
   两份定义迟早会漂移，漂移的后果是某个页面读到 undefined 还以为数据没问题。 */
export type ApiPost = {
  id: number
  title: string
  /* 地址里的短名，全站唯一 */
  slug: string
  description: string
  /* Markdown 正文。列表接口也会带上（后端没做「列表瘦身」） */
  content: string
  category: string
  tags: string[]
  reading_minutes: number
  /* 草稿=true 表示还没发布 */
  is_draft: boolean
  /* 发布日期，后端可能给 null（还没定） */
  published_at: string | null
  created_at: string
  updated_at: string
}
