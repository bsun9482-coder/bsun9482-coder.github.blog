/* 文章详情页。

数据从哪来？（这是这一轮最大的变化）
  以前：打包时把 .mdx 编译成 JS 组件，这一页直接渲染那个组件。
  现在：进页面时按地址里的 slug 调 GET /api/posts/{slug}，拿回一段 Markdown 字符串，
        交给 react-markdown 在浏览器里现场渲染。
  所以「在后台发一篇文章，前台刷新就能看到」——不用重新构建。

页面有四种状态，各自长得不一样（见 hooks/use-post.ts 顶部那段说明）：
  加载中 → 骨架屏（占住位置，数据到了不跳）
  成功   → 正常文章
  不存在 → 「文章不存在」+ 返回列表（重试没用，别给重试按钮）
  失败   → 说清原因 + 重试按钮
*/

import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  Clock3Icon,
  FileQuestionIcon,
  RefreshCwIcon,
} from "lucide-react"
import { Link, useParams } from "react-router"

import { MarkdownContent } from "@/components/article/markdown-content"
import { TableOfContents } from "@/components/article/table-of-contents"
import { Container } from "@/components/layout/container"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { usePost } from "@/hooks/use-post"
import { formatPostDate } from "@/lib/post-date"

const ui = siteContent.ui.article

function BackToList() {
  return (
    <Button asChild className="-ml-2" variant="ghost">
      <Link to="/resources">
        <ArrowLeftIcon data-icon="inline-start" />
        {ui.backToList}
      </Link>
    </Button>
  )
}

/* 加载中：骨架的长度按真实文章的样子来（标签、大标题、摘要、几段正文），
   这样数据到的瞬间页面不会整体往上一跳。 */
function ArticleLoading() {
  return (
    <Container className="py-10 sm:py-14">
      <BackToList />
      <div aria-busy="true" className="mt-8 max-w-3xl" role="status">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
        <Skeleton className="mt-5 h-10 w-4/5" />
        <Skeleton className="mt-5 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-3/4" />
        <Skeleton className="mt-8 h-px w-full" />
        <Skeleton className="mt-8 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-11/12" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-6 h-40 w-full" />
        <span className="sr-only">{ui.loading}</span>
      </div>
    </Container>
  )
}

/* 地址里的 slug 找不到文章：给一个明确的说法和一个出口。
   注意不能「重试」—— 404 是重试一百次也还是 404。 */
function ArticleMissing() {
  return (
    <Container className="py-10 sm:py-14">
      <BackToList />
      <div className="mt-8 rounded-xl border border-border bg-card p-12 text-center">
        <FileQuestionIcon
          aria-hidden="true"
          className="mx-auto mb-5 size-9 text-faint"
        />
        <p className="font-mono text-xs tracking-widest text-faint">404</p>
        <h1 className="mt-2 text-title font-semibold tracking-tight">
          {ui.missingTitle}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {ui.missingDescription}
        </p>
        <Button asChild className="mt-6">
          <Link to="/resources">{ui.backToList}</Link>
        </Button>
      </div>
    </Container>
  )
}

/* 请求失败：网络断了、后端没开、或者后端 500。
   和「不存在」分开，因为这一种重试是有意义的。 */
function ArticleError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <Container className="py-10 sm:py-14">
      <BackToList />
      <div
        className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
        role="alert"
      >
        <h1 className="text-base font-medium">{ui.loadFailed}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        <Button className="mt-5" onClick={onRetry} variant="outline">
          <RefreshCwIcon aria-hidden="true" />
          {ui.retry}
        </Button>
      </div>
    </Container>
  )
}

export function ArticlePage() {
  const { slug = "" } = useParams()
  const { state, retry } = usePost(slug)

  /* 标题要在拿到数据之后才准，所以这里按状态给：加载中显示「正在加载文章」，
     404 显示「文章不存在」。useDocumentTitle 必须无条件调用（Hook 规则），
     所以先把字符串算出来，再在下面分支返回不同界面。 */
  useDocumentTitle(
    state.status === "ready"
      ? state.post.title
      : state.status === "missing"
        ? ui.missingTitle
        : ui.loading
  )

  if (state.status === "loading") return <ArticleLoading />
  if (state.status === "missing") return <ArticleMissing />
  if (state.status === "error") {
    return <ArticleError message={state.message} onRetry={retry} />
  }

  const post = state.post

  return (
    <Container className="py-10 sm:py-14">
      <BackToList />

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* 目录在左栏（窄屏隐藏，靠正文顺序阅读）。
            DOM 里也放最前：键盘 Tab 会先过目录，再进正文，与视觉顺序一致。
            目录条目是从正文 Markdown 里算出来的（lib/api-posts.ts 的
            buildTableOfContents），id 用 github-slugger —— 和 rehype-slug
            生成的标题 id 是同一个算法，所以点得动。 */}
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <TableOfContents items={post.tableOfContents} title={post.title} />
        </aside>

        <article className="min-w-0">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{post.category}</Badge>
              {post.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
            {/* 正文标题 44 / 手机 22，和其他页面的 h1 同一档 */}
            <h1 className="mt-5 font-heading text-title font-semibold tracking-tight text-balance sm:text-display">
              {post.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              {post.description}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4 font-mono text-xs text-faint">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDaysIcon className="size-4" />
                {formatPostDate(post.date)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3Icon className="size-4" />
                {post.readingMinutes} {ui.minutesSuffix}
              </span>
            </div>
          </header>

          <Separator className="my-8" />

          <div className="article-content">
            <MarkdownContent source={post.content} />
          </div>
        </article>
      </div>
    </Container>
  )
}
