import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/* 页面标题区：图标 + 大标题 + 一句副标题。
   抽出来的原因：文章 / 项目 / 日记 / 相册四个页面本来是各写一遍
   「图标 + 大标题 + 一句副标题」各写一遍 —— 字号一改就得改四处，
   而且很容易漏掉某一个（漏掉的那个页面标题就会比别人小一号）。

   字号只取两档：手机 22、桌面 44（都来自 index.css 的七档层级）。
   中间不塞 30、36 这种「差一点」的档位 —— 层级靠字重和颜色对比，不靠连续放大。

   ⚠️ 后台页传 headingLevel={2}：后台的「当前页面」大标题已经在内容区顶部那条细栏里
   （h1），页面里再有第二个 h1 会让读屏软件不知道这一页到底叫什么，
   对 SEO 也是两个主标题。访客页用默认的 h1。
   ⚠️ actions 是给「标题右边放一个主按钮」用的（文章页的「新建文章」）。
      以前那种做法是在页面里套一层 flex 把 PageHeader 和 Button 并排，问题在于：
      传进来的副标题一长，两个子项一起被压窄，按钮会掉到第二行。
      收进来之后由这个组件统一处理换行，五个页面不用各写一遍。 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  headingLevel = 1,
  actions,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  headingLevel?: 1 | 2
  actions?: ReactNode
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2"

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <Heading
          className={
            headingLevel === 1
              ? "font-heading text-title font-semibold tracking-tight text-balance sm:text-display"
              : "font-heading text-title font-semibold tracking-tight text-balance"
          }
        >
          {title}
        </Heading>
        {actions && (
          <div className="ml-auto flex shrink-0 items-center">{actions}</div>
        )}
      </div>
      {subtitle && (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      )}
    </header>
  )
}
