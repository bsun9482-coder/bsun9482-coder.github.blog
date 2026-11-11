import { useDeferredValue, useMemo, useState } from "react"
import { BookOpen, SearchIcon, XIcon } from "lucide-react"

import { ArticleCard } from "@/components/article/article-card"
import { Reveal } from "@/components/fx/reveal"
import { TiltCard } from "@/components/fx/tilt-card"
import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
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
    /* 页头 / 筛选条 / 结果，三段之间的间距交给 flex gap，量走统一的 --section-gap 的
       一半左右 —— 同一页内的区块比跨页的一级区块要近一点，否则筛选条会飘走。 */
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <PageHeader
        icon={BookOpen}
        subtitle={siteContent.ui.resources.subtitle}
        title={pageNameOf("/resources")}
      />

      <section className="flex flex-col gap-4">
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

        <p className="font-mono text-xs text-faint tabular-nums">
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
          /* 桌面两列、移动一列。外层 Reveal 给 grid，卡片才能等高撑满整行 ——
             否则加了一层 DOM 之后两列高度会参差。 */
          <div className="grid gap-4 md:grid-cols-2">
            {filteredPosts.map((post, index) => (
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
          /* 这一块不算空占位：它是「搜索/筛选没有结果」的反馈，
             和「模块还没内容」不是一回事 —— 用户需要知道为什么一片空白。 */
          <TiltCard className="py-12 text-center" tilt={false}>
            <CardContent>
              <SearchIcon className="mx-auto mb-4 size-8 text-muted-foreground" />
              <h3 className="text-base font-medium">
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
