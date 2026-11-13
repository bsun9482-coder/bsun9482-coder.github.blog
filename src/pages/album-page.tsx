import { ImagesIcon, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"

import { AlbumLightbox } from "@/components/album/album-lightbox"
import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { usePhotos } from "@/hooks/use-photos"
import { toAlbumImages } from "@/lib/album"
import type { Photo } from "@/lib/api-photos"

/* /album：相册页。页头 → 分类筛选 → 正方形网格 → 灯箱。

   数据来自后端 /api/photos（后台 /admin/album 上传的那些），不再是仓库里的写死清单。

   五个决定，改之前先看：
   1. **筛选走后端**：点「日常」就是重新请求 ?category=日常，不是把全量拉回来再 filter。
      见 hooks/use-photos.ts 顶部：本地过滤只是「现在数据少」的巧合，撑不住以后。
   2. 「切换中」用**派生**判断，不用 effect 清状态：把 data 自带的 category 和当前
      点的分类比一下就知道手上这份是不是旧的，不同就先显示骨架。
      （在 effect 里同步 setState({loading}) 会被 React 判为级联渲染，lint 直接报错。）
   3. 分类按钮 = 三个常规分类（日常/学习/风景）+「全部」，**再加数据里出现的其它分类**。
      后半截很重要：后台能填自由分类（敲个「宠物」就等于新建），
      只写死三项的话，那些照片就永远在页面上消失 —— 看不见还不报错，最难查。
   4. 灯箱的索引基于**当前列表**，不是全量 —— 在「风景」里点第 3 张，
      左右切换就在风景里走。所以切分类时要把灯箱关掉，否则索引会指向另一批图。
   5. 网格用 minmax(220px, 1fr) 的 auto-fill：视口变宽自动多一列，
      不用为每个断点写一遍列数；手机上锁死 2 列（220px 在 390 宽下只能放一列）。
   文案全部走 siteContent.ui.album。 */

const ui = siteContent.ui.album

/** 三个常规分类：固定出现，即使此刻一张图都没有。
    为什么固定而不是「有图才显示」：常来的访客会记得「这里有日常/学习/风景」，
    某个分类恰好空了就少一个按钮，会让人以为改版了。 */
const BASE_CATEGORIES: string[] = [
  ui.categories.daily,
  ui.categories.study,
  ui.categories.scenery,
]

/* 模块级空数组：不能写成 `settled ? state.photos : []` —— 那个 [] 每次渲染
   都是新引用，会让下面的 useMemo 每帧重算（eslint 也会报 exhaustive-deps）。 */
const EMPTY_PHOTOS: Photo[] = []

const GRID =
  "grid grid-cols-2 gap-3 min-[680px]:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4"

/* 骨架格：8 个方块，两行起步，和真加载完的首屏数量差不多，
   图进来时不会「突然长高一大截」。 */
function AlbumGridSkeleton() {
  return (
    <div aria-busy="true" className={GRID}>
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="aspect-square w-full rounded-xl" key={index} />
      ))}
    </div>
  )
}

export function AlbumPage() {
  useDocumentTitle(ui.title)

  /* 注意：这里**不要**再调 useEscapeBack() —— App 已经在全局挂了一个
     （EscapeToBack，首页也生效）。再挂一个，一次 ESC 会执行两次 navigate(-1)。
     灯箱打开时全局那个会主动让行，靠的是灯箱上的 role=dialog + data-state=open，
     见 hooks/use-escape-back.ts 里那条 OPEN_OVERLAY_SELECTOR。 */

  /* "" 代表「全部」。用空串而不是 "all"，是为了让它能直接当「不带参数」用。 */
  const [filter, setFilter] = useState("")
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const { state, categories, retry } = usePhotos(filter)

  /* 手上这份数据是不是当前这个筛选的（见文件头第 2 条）。
     界面上「骨架 / 错误 / 网格」三选一，只看这三个布尔，别在别处再判断 status。 */
  const settled = state.status === "ready" && state.category === filter
  const failed = state.status === "error" && state.category === filter
  const pending = !settled && !failed

  const photos = settled ? state.photos : EMPTY_PHOTOS
  const visible = useMemo(() => toAlbumImages(photos), [photos])
  const lightboxOpen = openIndex !== null && visible.length > 0

  /* 数据里出现过的「非常规」分类（后台自由填的那些），排在三个常规分类后面 */
  const extraCategories = categories.filter(
    (name) => !BASE_CATEGORIES.includes(name)
  )

  const filters = [
    { id: "", label: ui.categories.all },
    ...BASE_CATEGORIES.map((name) => ({ id: name, label: name })),
    ...extraCategories.map((name) => ({ id: name, label: name })),
  ]

  return (
    <Container className="flex flex-col gap-8 py-10 sm:gap-10 sm:py-16">
      <div className="flex flex-col gap-3">
        <PageHeader icon={ImagesIcon} subtitle={ui.subtitle} title={ui.title} />
        <p className="font-mono text-xs text-faint tabular-nums">
          {settled ? `${photos.length} ${ui.countSuffix}` : ui.loading}
        </p>
      </div>

      {/* 分类筛选：胶囊按钮，当前项品牌蓝。
          aria-pressed 而不是 aria-current —— 这是一组开关，不是位置指示。
          **当前项的高亮立刻生效**（filter 是本地 state），只是下面网格会先变成骨架：
          点击到出图之间必须有个「在读了」的信号，否则用户会以为这个分类是空的。
          切分类时顺手关灯箱（原因见文件头第 4 条）。 */}
      <div
        aria-label={ui.filtersLabel}
        className="flex flex-wrap gap-2"
        role="group"
      >
        {filters.map((item) => {
          const active = filter === item.id
          return (
            <button
              aria-pressed={active}
              className={`h-10 rounded-full border px-4 text-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                active
                  ? "border-brand bg-brand font-medium text-white"
                  : "border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground"
              }`}
              key={item.id || "all"}
              onClick={() => {
                if (item.id === filter) return
                setFilter(item.id)
                setOpenIndex(null)
              }}
              type="button"
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {pending && <AlbumGridSkeleton />}

      {failed && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm leading-6 text-destructive" role="alert">
            {ui.loadFailed}：{state.message}
          </p>
          <Button onClick={retry} size="sm" type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            {ui.retry}
          </Button>
        </div>
      )}

      {settled &&
        (visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">
              {filter ? ui.emptyFiltered : ui.empty}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {filter ? ui.emptyFilteredHint : ui.emptyHint}
            </p>
          </div>
        ) : (
          <ul className={GRID}>
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
        ))}

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
