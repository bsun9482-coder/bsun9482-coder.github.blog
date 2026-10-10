import { useDeferredValue, useMemo, useState } from "react"
import { SearchIcon, XIcon } from "lucide-react"

import { ArticleCard } from "@/components/article/article-card"
import { Container } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { pageNameOf, siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { posts } from "@/lib/posts"

const ALL_CATEGORIES = "全部"

export function ResourcesPage() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES)
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())

  useDocumentTitle(pageNameOf("/resources"))

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    posts.forEach((post) => {
      counts.set(post.category, (counts.get(post.category) ?? 0) + 1)
    })
    return [ALL_CATEGORIES, ...counts.keys()]
  }, [])

  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          (activeCategory === ALL_CATEGORIES ||
            post.category === activeCategory) &&
          (deferredQuery.length === 0 || post.searchText.includes(deferredQuery))
      ),
    [activeCategory, deferredQuery]
  )

  return (
    <Container className="py-10 sm:py-16">
      <section>
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-2.5 sm:flex-row sm:items-center">
          <div
            aria-label="按分类筛选"
            className="flex flex-wrap gap-1.5"
            role="group"
          >
            {categories.map((category) => (
              <Button
                key={category}
                aria-pressed={activeCategory === category}
                onClick={() => setActiveCategory(category)}
                size="sm"
                type="button"
                variant={activeCategory === category ? "default" : "ghost"}
              >
                {category}
              </Button>
            ))}
          </div>

          <div className="relative w-full sm:ml-auto sm:w-64">
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

        <p className="mt-4 text-xs text-muted-foreground tabular-nums">
          {deferredQuery.length > 0
            ? `“${query.trim()}” 匹配到 ${filteredPosts.length} 份`
            : `共 ${filteredPosts.length} 份`}
        </p>

        {filteredPosts.length > 0 ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {filteredPosts.map((post) => (
              <ArticleCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <Card className="mt-4 py-12 text-center">
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
                  onClick={() => {
                    setQuery("")
                    setActiveCategory(ALL_CATEGORIES)
                  }}
                  variant="outline"
                >
                  清除筛选条件
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </section>
    </Container>
  )
}
