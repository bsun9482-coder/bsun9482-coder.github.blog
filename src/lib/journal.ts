import type { MDXComponents } from "mdx/types"
import type { ComponentType } from "react"

/* 日记：短内容，一页聚合，没有详情路由。
   收集方式和文章一样走 import.meta.glob，但这里用 eager ——
   日记都很短，一次性进主包反而省掉每条一个 chunk 的请求；
   文章是长文，所以那边仍是懒加载 + virtual 元数据模块。

   frontmatter 是 vite-plugins/journal-frontmatter.ts 在编译期注入的
   `export const frontmatter = {...}`，所以 eager glob 能直接读到。 */

export type JournalEntry = {
  /** 文件名去掉 .mdx，仅用于 React key，不对外暴露路由 */
  slug: string
  /** YYYY-MM-DD，frontmatter 里已校验过格式 */
  date: string
  mood?: string
  Content: ComponentType<{ components?: MDXComponents }>
}

type JournalModule = {
  default: ComponentType<{ components?: MDXComponents }>
  frontmatter?: {
    date?: unknown
    mood?: unknown
  }
}

const journalModules = import.meta.glob<JournalModule>(
  "/content/journal/*.mdx",
  {
    eager: true,
  }
)

function getSlug(path: string) {
  const filename = path.split("/").at(-1)

  return filename?.endsWith(".mdx") ? filename.slice(0, -4) : (filename ?? path)
}

function getTimestamp(date: string) {
  const timestamp = Date.parse(date)

  return Number.isNaN(timestamp) ? 0 : timestamp
}

function createEntries(): JournalEntry[] {
  return Object.entries(journalModules)
    .map(([path, module]) => {
      const date = module.frontmatter?.date
      if (typeof date !== "string") {
        /* 正常情况下插件已经挡在前面了，这里是 type-safe 的兜底 */
        throw new Error(`日记缺少 date：${path}`)
      }

      const mood = module.frontmatter?.mood

      return {
        slug: getSlug(path),
        date,
        mood: typeof mood === "string" && mood !== "" ? mood : undefined,
        Content: module.default,
      }
    })
    .sort((a, b) => {
      const byDate = getTimestamp(b.date) - getTimestamp(a.date)

      /* 同一天写了两条时按文件名倒序，保证每次渲染顺序稳定 */
      return byDate !== 0 ? byDate : b.slug.localeCompare(a.slug)
    })
}

export const journalEntries = createEntries()

/** 2026-11-09 → 2026.11.09（等宽字体下比短横线更容易扫读） */
export function formatJournalDate(date: string) {
  return date.replaceAll("-", ".")
}

/** 2026-11-09 → 周日。日期非法时返回空串，调用方决定要不要显示。 */
export function formatJournalWeekday(date: string) {
  const parsed = new Date(`${date}T00:00:00`)

  return Number.isNaN(parsed.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(parsed)
}
