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

export type Post = PostMetadata & {
  slug: string
  Content: LazyExoticComponent<ComponentType<{ components?: MDXComponents }>>
}
