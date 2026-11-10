import { useDeferredValue, useMemo, useState } from "react"
import { BookOpen, SearchIcon, XIcon } from "lucide-react"

import { ArticleCard } from "@/components/article/article-card"
import { Reveal } from "@/components/fx/reveal"
import { TiltCard } from "@/components/fx/tilt-card"
import { Container } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { pageNameOf, siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { posts } from "@/lib/posts"
import { staggerDelay } from "@/lib/reveal"
import { fillTemplate } from "@/lib/text"

/* 「全部」是筛选条的第一项，也是「没选任何分类」的哨兵值 —— 文案进配置，值本身不变 */
const ALL_CATEGORIES = siteContent.ui.resources.allCategories

export function ResourcesPage() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES)
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
          (deferredQuery.length === 0 ||
            post.searchText.includes(deferredQuery))
      ),
    [activeCategory, deferredQuery]
  )

  return (
    <Container className="py-10 sm:py-16">
      <section>
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <BookOpen
              aria-hidden="true"
              className="size-7 text-muted-foreground"
            />
            <h1 className="text-3xl font-semibold tracking-tight">
              {pageNameOf("/resources")}
            </h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            {siteContent.ui.resources.subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-2 sm:flex-row sm:items-center">
          <div
            aria-label={siteContent.ui.resources.filterLabel}
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
              aria-label={siteContent.ui.resources.searchLabel}
              className="pr-9 pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={siteContent.ui.resources.searchPlaceholder}
              type="search"
              value={query}
            />
            {query && (
              <Button
                aria-label={siteContent.ui.resources.clearSearch}
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

        <p className="mt-4 font-mono text-xs text-faint tabular-nums">
          {deferredQuery.length > 0
            ? fillTemplate(siteContent.ui.resources.matchedCount, {
                query: query.trim(),
                count: filteredPosts.length,
              })
            : fillTemplate(siteContent.ui.resources.totalCount, {
                count: filteredPosts.length,
              })}
        </p>

        {filteredPosts.length > 0 ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {filteredPosts.map((post, index) => (
              /* 外层包壳负责入场（0 / 100 / 200 错落）；用 grid 让里面的卡片照旧等高撑满，
                 这样加了一层 DOM 也不会让两列的卡片高度参差。 */
              <Reveal
                className="grid"
                delay={staggerDelay(index)}
                key={post.slug}
              >
                <ArticleCard post={post} />
              </Reveal>
            ))}
          </div>
        ) : (
          <TiltCard className="mt-4 py-12 text-center">
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
                  {siteContent.ui.resources.clearFilters}
                </Button>
              )}
            </CardContent>
          </TiltCard>
        )}
      </section>
    </Container>
  )
}
