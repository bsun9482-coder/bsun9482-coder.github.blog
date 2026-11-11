import type { LucideIcon } from "lucide-react"

/* 页面标题区：图标 + 大标题 + 一句副标题。
   抽出来的原因：文章 / 项目 / 日记 / 相册四个页面本来是各写一遍
   「图标 + 大标题 + 一句副标题」各写一遍 —— 字号一改就得改四处，
   而且很容易漏掉某一个（漏掉的那个页面标题就会比别人小一号）。

   字号只取两档：手机 22、桌面 44（都来自 index.css 的七档层级）。
   中间不塞 30、36 这种「差一点」的档位 —— 层级靠字重和颜色对比，不靠连续放大。 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <h1 className="font-heading text-title font-semibold tracking-tight text-balance sm:text-display">
          {title}
        </h1>
      </div>
      {subtitle && (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      )}
    </header>
  )
}
