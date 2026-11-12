import { useDeferredValue, useMemo, useState } from "react"
import { BookOpen, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react"

import { ArticleCard } from "@/components/article/article-card"
import { Reveal } from "@/components/fx/reveal"
import { TiltCard } from "@/components/fx/tilt-card"
import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { pageNameOf, siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { usePosts } from "@/hooks/use-posts"
import { staggerDelay } from "@/lib/reveal"
import { fillTemplate } from "@/lib/text"

/* 「全部」是筛选条的第一项，也是「没选任何分类」的哨兵值 —— 文案进配置，值本身不变 */
const ALL_CATEGORIES = siteContent.ui.resources.allCategories

export function ResourcesPage() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES)
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())

  useDocumentTitle(pageNameOf("/resources"))

  /* 文章现在来自 GET /api/posts（不再是打包时扫出来的 MDX 清单）。
     好处：后台一发文章，这里刷新就能看到，不用重新构建部署。
     代价：要处理「还没回来 / 回来了但是空 / 请求失败」这三种以前不存在的情况。 */
  const { state, retry } = usePosts()

  /* 没拿到数据时当成空数组参与计算，但不能因此显示「暂无文章」——
     那是「确实没有」的意思，和「还在加载」是两回事，文案必须分开。
     这里包一层 useMemo 不是为了省算力，而是为了让下面几个 useMemo 的依赖
     在「加载中 → 加载完成」之外的重渲染里保持同一个引用（否则每次渲染都是
     一个新的 []，缓存全失效，等于没缓存）。 */
  const allPosts = useMemo(
    () => (state.status === "ready" ? state.posts : []),
    [state]
  )

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    allPosts.forEach((post) => {
      counts.set(post.category, (counts.get(post.category) ?? 0) + 1)
    })
    return [ALL_CATEGORIES, ...counts.keys()]
  }, [allPosts])

  const filteredPosts = useMemo(
    () =>
      allPosts.filter(
        (post) =>
          (activeCategory === ALL_CATEGORIES ||
            post.category === activeCategory) &&
          (deferredQuery.length === 0 ||
            post.searchText.includes(deferredQuery))
      ),
    [allPosts, activeCategory, deferredQuery]
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
        {/* ---------- 状态一：还在加载 ----------
            用骨架而不是一句「加载中」：骨架把卡片占据的位置先占好，
            数据到了之后页面不会整体跳一下。 */}
        {state.status === "loading" && (
          <div
            aria-busy="true"
            className="grid gap-4 md:grid-cols-2"
            role="status"
          >
            {[0, 1].map((index) => (
              <div
                className="rounded-xl border border-border bg-card p-6"
                key={index}
              >
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-12" />
                </div>
                <Skeleton className="mt-4 h-6 w-3/4" />
                <Skeleton className="mt-4 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-5/6" />
                <Skeleton className="mt-6 h-3 w-32" />
              </div>
            ))}
            <span className="sr-only">{siteContent.ui.resources.loading}</span>
          </div>
        )}

        {/* ---------- 状态二：加载失败 ----------
            必须给重试入口：后端没开、网络抖一下，都是点一下就能好的事。
            把后端返回的原话也显示出来（比如「连不上后端…」），
            否则用户只知道坏了、不知道坏在哪。 */}
        {state.status === "error" && (
          <TiltCard className="py-12 text-center" tilt={false}>
            <CardContent>
              <p className="font-mono text-xs text-faint">ERROR</p>
              <h3 className="mt-2 text-base font-medium">
                {siteContent.ui.resources.loadFailed}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {state.message}
              </p>
              <Button className="mt-5" onClick={retry} variant="outline">
                <RefreshCwIcon aria-hidden="true" />
                {siteContent.ui.resources.retry}
              </Button>
            </CardContent>
          </TiltCard>
        )}

        {/* ---------- 状态三：拿到了数据 ---------- */}
        {state.status === "ready" && (
          <>
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
                    {allPosts.length === 0
                      ? siteContent.ui.resources.emptyResources
                      : siteContent.ui.resources.noResults}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {allPosts.length === 0
                      ? siteContent.ui.resources.emptyResourcesDescription
                      : siteContent.ui.resources.noResultsDescription}
                  </p>
                  {allPosts.length > 0 && (
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
          </>
        )}
      </section>
    </Container>
  )
}
