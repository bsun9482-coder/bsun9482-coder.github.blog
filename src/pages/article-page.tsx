import { Suspense } from "react"
import { ArrowLeftIcon, CalendarDaysIcon, Clock3Icon } from "lucide-react"
import { Link, useParams } from "react-router"

import { mdxComponents } from "@/components/article/mdx-components"
import { TableOfContents } from "@/components/article/table-of-contents"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { formatPostDate, getPostBySlug } from "@/lib/posts"
import { NotFoundPage } from "@/pages/not-found-page"

export function ArticlePage() {
  const { slug = "" } = useParams()
  const post = getPostBySlug(slug)

  useDocumentTitle(post ? post.title : "资料不存在")

  if (!post) {
    return <NotFoundPage compact />
  }

  const { Content } = post

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Button asChild className="-ml-2" variant="ghost">
        <Link to="/resources">
          <ArrowLeftIcon data-icon="inline-start" />
          返回资料列表
        </Link>
      </Button>

      <div className="mt-7 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
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
            <h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {post.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
              {post.description}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDaysIcon className="size-4" />
                {formatPostDate(post.date)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3Icon className="size-4" />
                {post.readingMinutes} 分钟阅读
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
                  <span className="sr-only">正在加载资料</span>
                </div>
              }
            >
              <Content components={mdxComponents} />
            </Suspense>
          </div>
        </article>

        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <TableOfContents items={post.tableOfContents} />
        </aside>
      </div>
    </div>
  )
}
