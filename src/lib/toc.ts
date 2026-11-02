import type { TableOfContentsItem } from "@/types/post"

/* 目录原本是一串扁平条目（页面里就是一条 <ol>），章和节混在一起。
   左栏要按「章」分组、每章可折叠，所以先把 h2 当章、紧随其后的 h3 当节分组。
   ⚠️ 老文章可能只用了 ## 一级标题（没有 h3）⇒ 分组后每章 children 为空，
   渲染侧就退化成普通链接列表，不会出现空的折叠箭头。

   工具函数放 lib 而不是组件文件：组件文件只能导出组件
   （react-refresh/only-export-components）。 */
export type TocGroup = {
  id: string
  title: string
  children: TableOfContentsItem[]
}

export function groupTocItems(items: TableOfContentsItem[]): TocGroup[] {
  const groups: TocGroup[] = []

  for (const item of items) {
    if (item.level === 2 || groups.length === 0) {
      groups.push({ id: item.id, title: item.title, children: [] })
      continue
    }

    groups.at(-1)?.children.push(item)
  }

  return groups
}

/* 当前高亮项属于哪一章：节命中时返回它所在的章，章自身命中时返回自己。
   目录要在滚动时自动展开这一章。 */
export function groupIdOf(groups: TocGroup[], itemId: string): string | undefined {
  for (const group of groups) {
    if (group.id === itemId) return group.id
    if (group.children.some((child) => child.id === itemId)) return group.id
  }
  return undefined
}
