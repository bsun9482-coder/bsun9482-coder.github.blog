import { useDeferredValue, useMemo, useState } from "react"
import { BookOpenIcon, SearchIcon, SparklesIcon, XIcon } from "lucide-react"

import { ArticleCard } from "@/components/article/article-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { posts } from "@/lib/posts"

export function ResourcesPage() {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())

  useDocumentTitle("资料")

  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          deferredQuery.length === 0 || post.searchText.includes(deferredQuery)
      ),
    [deferredQuery]
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="rounded-3xl border bg-card px-6 py-10 sm:px-10 sm:py-14">
        <div className="max-w-3xl">
          <Badge className="mb-5" variant="outline">
            <SparklesIcon data-icon="inline-start" />
            Python · AI · 前端
          </Badge>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-6xl">
            资料库
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            整理学习过程中值得反复查阅的背景、步骤、示例和常见错误。
          </p>
        </div>
      </section>

      <section
        aria-labelledby="knowledge-overview"
        className="mt-6 grid gap-3 sm:grid-cols-2"
      >
        <h2 className="sr-only" id="knowledge-overview">
          资料库概览
        </h2>
        <Card size="sm">
          <CardHeader className="flex-row items-center gap-2">
            <BookOpenIcon className="size-4 text-muted-foreground" />
            <CardTitle>{posts.length} 份资料</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader className="flex-row items-center gap-2">
            <SparklesIcon className="size-4 text-muted-foreground" />
            <CardTitle>持续更新</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="pt-16">
        <div className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">RESOURCES</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              最近资料
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              按发布时间倒序排列，共 {filteredPosts.length} 份结果。
            </p>
          </div>

          <div className="relative w-full sm:max-w-sm">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="搜索资料"
              className="pr-9 pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、标签或正文…"
              type="search"
              value={query}
            />
            {query && (
              <Button
                aria-label="清除搜索"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setQuery("")}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <XIcon />
              </Button>
            )}
          </div>
        </div>

        {filteredPosts.length > 0 ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {filteredPosts.map((post) => (
              <ArticleCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <Card className="mt-6 py-12 text-center">
            <CardContent>
              <SearchIcon className="mx-auto mb-4 size-8 text-muted-foreground" />
              <h3 className="text-lg font-medium">
                {posts.length === 0
                  ? siteContent.ui.resources.emptyResources
                  : siteContent.ui.resources.noResults}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {posts.length === 0
                  ? siteContent.ui.resources.emptyResourcesDescription
                  : siteContent.ui.resources.noResultsDescription}
              </p>
              {posts.length > 0 && (
                <Button
                  className="mt-5"
                  onClick={() => setQuery("")}
                  variant="outline"
                >
                  清除搜索
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
