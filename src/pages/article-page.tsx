import { Suspense } from "react"
import { ArrowLeftIcon, CalendarDaysIcon, Clock3Icon } from "lucide-react"
import { Link, useParams } from "react-router"

import { mdxComponents } from "@/components/article/mdx-components"
import { TableOfContents } from "@/components/article/table-of-contents"
import { Container } from "@/components/layout/container"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { formatPostDate, getPostBySlug } from "@/lib/posts"
import { NotFoundPage } from "@/pages/not-found-page"

export function ArticlePage() {
  const { slug = "" } = useParams()
  const post = getPostBySlug(slug)

  useDocumentTitle(post ? post.title : siteContent.ui.article.missingTitle)

  if (!post) {
    return <NotFoundPage compact />
  }

  const { Content } = post

  return (
    <Container className="py-10 sm:py-14">
      <Button asChild className="-ml-2" variant="ghost">
        <Link to="/resources">
          <ArrowLeftIcon data-icon="inline-start" />
          {siteContent.ui.article.backToList}
        </Link>
      </Button>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* 目录在左栏（窄屏隐藏，靠正文顺序阅读）。
            DOM 里也放最前：键盘 Tab 会先过目录，再进正文，与视觉顺序一致。 */}
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
                {post.readingMinutes} {siteContent.ui.article.minutesSuffix}
              </span>
            </div>
          </header>

          <Separator className="my-8" />

          <div className="article-content">
            <Suspense
              fallback={
                <div className="space-y-4" role="status">
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-32 w-full" />
                  <span className="sr-only">
                    {siteContent.ui.article.loading}
                  </span>
                </div>
              }
            >
              <Content components={mdxComponents} />
            </Suspense>
          </div>
        </article>
      </div>
    </Container>
  )
}
