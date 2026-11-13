import { ImagesIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { AlbumLightbox } from "@/components/album/album-lightbox"
import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { albumImages, type AlbumCategoryId } from "@/lib/album"

/* /album：相册页。页头 → 分类筛选 → 正方形网格 → 灯箱。

   三个决定，改之前先看：
   1. 筛选是**本地状态**，不进 URL。相册就 30 张图、四个分类，
      把 ?cat=daily 写进地址栏只会让返回键多出四条历史记录。
   2. 灯箱的索引基于**筛选后的数组**，不是原数组 —— 在「风景」分类里点第 3 张，
      左右切换应该只在风景里走。所以切分类时要把灯箱关掉，
      否则索引会指向另一批图（看着像点错了）。
   3. 网格用 minmax(220px, 1fr) 的 auto-fill：视口变宽时自动多一列，
      不用为每个断点写一遍列数；手机上锁死 2 列（220px 在 390 宽下只能放一列）。
   文案全部走 siteContent.ui.album。 */

const ui = siteContent.ui.album

/** 筛选条的顺序：全部在最前，其余按「看得最多的排前面」。 */
const FILTERS: { id: "all" | AlbumCategoryId; label: string }[] = [
  { id: "all", label: ui.categories.all },
  { id: "daily", label: ui.categories.daily },
  { id: "study", label: ui.categories.study },
  { id: "scenery", label: ui.categories.scenery },
]

export function AlbumPage() {
  useDocumentTitle(ui.title)

  /* 注意：这里**不要**再调 useEscapeBack() —— App 已经在全局挂了一个
     （EscapeToBack，首页也生效）。再挂一个，一次 ESC 会执行两次 navigate(-1)。
     灯箱打开时全局那个会主动让行，靠的是灯箱上的 role=dialog + data-state=open，
     见 hooks/use-escape-back.ts 里那条 OPEN_OVERLAY_SELECTOR。 */

  const [filter, setFilter] = useState<"all" | AlbumCategoryId>("all")
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const visible = useMemo(
    () =>
      filter === "all"
        ? albumImages
        : albumImages.filter((image) => image.cat === filter),
    [filter]
  )

  const lightboxOpen = openIndex !== null && visible.length > 0

  return (
    <Container className="flex flex-col gap-8 py-10 sm:gap-10 sm:py-16">
      <div className="flex flex-col gap-3">
        <PageHeader icon={ImagesIcon} subtitle={ui.subtitle} title={ui.title} />
        <p className="font-mono text-xs text-faint tabular-nums">
          {albumImages.length} {ui.countSuffix}
        </p>
      </div>

      {/* 分类筛选：四个胶囊按钮，当前项品牌蓝。
          aria-pressed 而不是 aria-current —— 这是一组开关，不是位置指示。 */}
      <div
        aria-label={ui.filtersLabel}
        className="flex flex-wrap gap-2"
        role="group"
      >
        {FILTERS.map((item) => {
          const active = filter === item.id
          return (
            <button
              aria-pressed={active}
              className={`h-10 rounded-full border px-4 text-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                active
                  ? "border-brand bg-brand font-medium text-white"
                  : "border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground"
              }`}
              key={item.id}
              onClick={() => {
                setFilter(item.id)
                /* 换分类就关灯箱：索引是相对 visible 的，留着会指到别的图上。 */
                setOpenIndex(null)
              }}
              type="button"
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            {filter === "all" ? ui.empty : ui.emptyFiltered}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {filter === "all" ? ui.emptyHint : ui.emptyFilteredHint}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 min-[680px]:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4">
          {visible.map((image, index) => (
            <li key={image.id}>
              {/* 按钮而不是 <a>：它打开的是灯箱，不跳转。
                  整块可点，热区就是一个正方格（远大于 44px）。 */}
              <button
                aria-label={image.cap}
                className="group relative block w-full overflow-hidden rounded-xl border border-border bg-secondary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                onClick={() => setOpenIndex(index)}
                type="button"
              >
                <img
                  alt=""
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  decoding="async"
                  /* 前 8 张立即加载（首屏两行），其余滚到再下。 */
                  loading={index < 8 ? "eager" : "lazy"}
                  src={image.thumb}
                />
                {/* hover / 键盘聚焦时浮出说明；手机上不 hover，所以底条只做装饰性渐隐。 */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-8 text-left text-xs text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                >
                  {image.cap}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightboxOpen && (
        <AlbumLightbox
          images={visible}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNext={() =>
            setOpenIndex((current) =>
              current === null ? null : (current + 1) % visible.length
            )
          }
          onPrev={() =>
            setOpenIndex((current) =>
              current === null
                ? null
                : (current - 1 + visible.length) % visible.length
            )
          }
        />
      )}
    </Container>
  )
}
