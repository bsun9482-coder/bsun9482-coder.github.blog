import { useCallback, useEffect, useRef, useState } from "react"

import { FeaturedPostCard } from "@/components/profile/profile-article"
import { siteContent } from "@/config/site"
import { prefersReducedMotion } from "@/lib/reveal"
import { fillTemplate } from "@/lib/text"
import type { Post } from "@/types/post"

/* 博客页左栏的文章轮播（第 41 轮，替换原来的「一张精选大卡 + 逐行列表」）。

   为什么手写而不是用 embla（仓库里 ui/carousel 那套）：
   这里只有「整屏平移」一种动作，没有无限循环、没有弹性吸附，
   自己写 30 行就能把无障碍、暂停、触摸判定的语义写清楚，
   引一个库反而要跟它的默认行为拉扯（而且那个组件现在没人引用，正在考虑移除）。

   三条高度约束，改之前先看懂，动一处很容易连带崩掉：
     1. 轮播只占「一张卡」的高度。轨道是 flex，每张 slide 都是 flex:0 0 100%，
        横向排开、竖向不叠加，靠 overflow:hidden 裁掉 100% 开外的部分。
        轨道高度 = 最高的那张 slide，矮的卡靠内部 h-full 拉齐，切换时不跳。
     2. 卡片自己不再 flex-1 —— 富余高度改由下面的标签卡吃掉（TagCloudCard）。
        两边都吃一次会互相撑（第 40 轮实测把 5 篇的行高撑到 1307px）。
     3. 手机上（单列）没有「富余高度」可吃，所以标签卡的 flex-1 只在 ≥880px 生效。

   交互：左右箭头 / 底部指示点 / 4.5s 自动播放（移入、聚焦、拖动时暂停）/
   触摸横向滑动（阈值 40px）。用户开了「减少动态」就完全停掉自动播放与过渡。 */

const ui = siteContent.ui.profile

const AUTOPLAY_MS = 4500
const SWIPE_THRESHOLD = 40

/** 内联 SVG 箭头。用 SVG 而不是图标库：这两个箭头要跟着按钮尺寸缩放，
    独立成一条 path 最省事，也避免为了两个三角图标多引一份图标代码。 */
function ChevronIcon({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      {direction === "prev" ? (
        <path d="M15 18 9 12l6-6" />
      ) : (
        <path d="m9 6 6 6-6 6" />
      )}
    </svg>
  )
}

export function FeaturedPostCarousel({ posts }: { posts: Post[] }) {
  const total = posts.length

  /* index 只增不减地传，越界在这里折回来 —— 文章数从 3 变成 2 时
     （后台删了一篇、页面轮询刷新），不至于停在一个空白 slide 上。 */
  const [rawIndex, setRawIndex] = useState(0)
  const current = total > 0 ? ((rawIndex % total) + total) % total : 0

  const [paused, setPaused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragX, setDragX] = useState(0)

  const viewportRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  /* 拖动距离另存一份 ref：快速滑动时 pointermove 和 pointerup 可能落在同一批
     更新里，那时读 state 拿到的是上一帧的值，判断就会漏掉这次滑动。 */
  const dragRef = useRef(0)

  const reduced = prefersReducedMotion()
  const hold = paused || dragging

  const go = useCallback(
    (delta: number) => {
      if (total <= 1) return
      setRawIndex((current + delta + total) % total)
    },
    [current, total]
  )

  /* 自动播放。用 setTimeout 而不是 setInterval：每次切换后重新计时，
     用户刚点完指示点不会立刻被「上一轮的残余计时」推走。 */
  useEffect(() => {
    if (total <= 1 || hold || reduced) return
    const timer = window.setTimeout(
      () => setRawIndex((current + 1) % total),
      AUTOPLAY_MS
    )
    return () => window.clearTimeout(timer)
  }, [current, total, hold, reduced])

  /* ---- 触摸滑动：只认 pointerType === "touch" ----
     鼠标拖拽不接管，否则「按住往旁边挪一点再松手」会把点击吞掉，
     卡片上的链接就点不动了。触摸端交给浏览器的是纵向滚动（touch-action: pan-y），
     横向手势留给我们自己判。 */
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" || total <= 1) return
    startRef.current = { x: event.clientX, y: event.clientY }
    dragRef.current = 0
    setDragging(true)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = startRef.current
    if (!start || event.pointerType !== "touch") return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y

    /* 纵向意图优先：手指在上下滑页面时不要跟着横移。
       一旦判成横向，就把位移限制在一屏内 —— 拖过头轨道会露出白边。 */
    if (Math.abs(dx) <= Math.abs(dy)) return

    const width = viewportRef.current?.clientWidth ?? 0
    const clamped = width > 0 ? Math.max(-width, Math.min(width, dx)) : dx
    dragRef.current = clamped
    setDragX(clamped)
  }

  function endDrag() {
    if (!startRef.current) return

    if (Math.abs(dragRef.current) >= SWIPE_THRESHOLD) {
      go(dragRef.current < 0 ? 1 : -1)
    }

    startRef.current = null
    dragRef.current = 0
    setDragX(0)
    setDragging(false)
  }

  const offset = -current * 100

  return (
    <section
      aria-label={ui.carouselLabel}
      aria-roledescription="carousel"
      className="flex flex-col gap-1"
      onBlurCapture={(event) => {
        /* 焦点还在轮播内部（比如从箭头 Tab 到卡片链接）就不要恢复播放。 */
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false)
        }
      }}
      onFocusCapture={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* -mx-1.5 + 每张 slide 自己的 px-1.5：让卡片边缘跟标签卡对齐，
          同时给 hover 上浮（-3px）和投影留出裁切余量。
          ⚠️ 留白必须放在 slide 上、不能放在视口的 padding 里：
          视口有 padding 时，它的可见区域比 slide 宽，下一张卡的左边缘会从
          那圈 padding 里露出来（手机上表现成卡片右侧一条 6px 黑边）。
          slide 自带 padding 就没这个缝 —— 露出的是下一张自己的空白边距。 */}
      <div className="relative -mx-1.5">
        <div
          className="overflow-hidden py-1.5"
          onPointerCancel={endDrag}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          ref={viewportRef}
          style={{ touchAction: "pan-y" }}
        >
          <div
            className={
              dragging
                ? "flex items-stretch"
                : "flex items-stretch transition-transform duration-500 ease-out motion-reduce:transition-none"
            }
            style={{
              transform: `translate3d(calc(${offset}% + ${dragX}px), 0, 0)`,
            }}
          >
            {posts.map((post, index) => {
              const active = index === current
              return (
                <div
                  aria-hidden={!active}
                  aria-label={fillTemplate(ui.carouselSlide, {
                    index: index + 1,
                    total,
                  })}
                  aria-roledescription="slide"
                  /* display:flex + 卡片 w/h:100%：让每张 slide 里的卡片都填满整格，
                     所有 slide 因此等高、图标块等大（规格「feature 用 width/height:100% 填满」）。 */
                  className="flex min-w-0 flex-[0_0_100%] px-1.5"
                  /* inert：非当前的那几张里还有卡片链接，不禁掉的话
                     键盘 Tab 会跑进看不见的幻灯片里。 */
                  inert={!active}
                  key={post.slug}
                  role="group"
                >
                  <FeaturedPostCard index={index} post={post} total={total} />
                </div>
              )
            })}
          </div>
        </div>

        {total > 1 && (
          <>
            {/* 热区 44×44（size-11）；圆形白底压深色块，右侧那张靠边框和投影区分。
                ≤680px 隐藏：手机上卡片只有 350 宽，44px 的圆会直接压在标题上
                （实测盖住「动手搭建」的「动」）。窄屏靠滑动 + 指示点切换就够了。 */}
            <button
              aria-label={ui.carouselPrev}
              className="absolute top-1/2 left-2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors outline-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-[680px]:hidden"
              onClick={() => go(-1)}
              type="button"
            >
              <ChevronIcon direction="prev" />
            </button>
            <button
              aria-label={ui.carouselNext}
              className="absolute top-1/2 right-2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors outline-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-[680px]:hidden"
              onClick={() => go(1)}
              type="button"
            >
              <ChevronIcon direction="next" />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex items-center justify-center">
          {posts.map((post, index) => {
            const active = index === current
            return (
              <button
                aria-current={active ? "true" : undefined}
                aria-label={fillTemplate(ui.carouselGoto, { index: index + 1 })}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                key={post.slug}
                onClick={() => setRawIndex(index)}
                type="button"
              >
                {/* 视觉上是一条 6px 的点，当前项拉成 24px 的品牌蓝长条；
                    可点区域仍是外面那个 44×44 的按钮。 */}
                <span
                  aria-hidden="true"
                  className={`block h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                    active
                      ? "w-6 bg-brand"
                      : "w-1.5 bg-faint hover:bg-muted-foreground"
                  }`}
                />
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
