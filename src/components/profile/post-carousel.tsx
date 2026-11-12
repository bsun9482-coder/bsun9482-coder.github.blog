import { useCallback, useEffect, useRef, useState } from "react"
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
} from "lucide-react"
import { Link } from "react-router"

import { siteContent } from "@/config/site"
import { formatPostDate } from "@/lib/post-date"
import { fillTemplate } from "@/lib/text"
import { cn } from "@/lib/utils"
import type { Post } from "@/types/post"

/* 博客页的「最新文章」轮播。
   为什么自己写而不用 components/ui/carousel（那个是 embla，已经装了的依赖）：
   这一块只要「一张一张换、能循环、能自动播」，embla 的拖拽弹道、实时跟随手感都用不上，
   反而要多背一层 API 和一次 resize 计算。手写版就是「一个 index + 一条 translateX」。

   结构（三层）：
     region（可聚焦，收键盘/触摸/悬停事件）
       └ relative
           ├ overflow-hidden rounded-2xl    ← 只裁「幻灯片」这一条
           │   └ flex track                 ← 唯一会动的东西：translateX(-index * 100%)
           └ 两个圆形箭头（绝对定位，钉在卡片左右两侧）
       └ 计数器 + 指示点（在卡片外面，不随 track 滑动）

   ⚠️ 箭头是 overflow-hidden 那层的**兄弟**，不是子节点 —— 放进去会被裁掉半截。
   ⚠️ 不显示的那几张同时加 inert：它们只是被推出视口，DOM 里还占着 Tab 顺序，
      不加的话键盘能 Tab 到一个看不见的链接上。 */

const AUTOPLAY_MS = 5000
const SWIPE_THRESHOLD = 45

/* 取模并保证非负：向左从 0 退到 -1 时要变成 count - 1，不能得到 -1。
   JS 的 % 对负数返回负值，所以要用 ((i % n) + n) % n 这一套。 */
function wrap(index: number, count: number) {
  if (count === 0) return 0
  return ((index % count) + count) % count
}

/* 跟随系统的「减少动态效果」。用 matchMedia 监听而不是读一次：
   用户中途改设置时轮播要立刻停下自动播放，不必刷新页面。 */
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setReduced(query.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  return reduced
}

export function PostCarousel({ posts }: { posts: Post[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = useReducedMotion()
  /* 手指按下的横坐标 + 最后一次移动到的横坐标。
     两个都用 ref 不用 state：它们只参与手势判定，不该触发重渲染。
     为什么要记「最后一次移动」：部分浏览器（以及合成事件里）touchend 的
     changedTouches 给的还是按下时的那个点，只看它等于「永远没滑过」；
     拿 touchmove 记到的位置兜底，阈值判断才可靠。 */
  const touchStartX = useRef<number | null>(null)
  const touchLastX = useRef<number | null>(null)

  const count = posts.length

  const go = useCallback(
    (delta: number) => setIndex((current) => wrap(current + delta, count)),
    [count]
  )

  const jumpTo = useCallback(
    (target: number) => setIndex(wrap(target, count)),
    [count]
  )

  /* 自动播放。
     用 setTimeout 而不是 setInterval，且把 index 放进依赖里：
     · index 一变（自动或手动）⇒ 这个 effect 重跑 ⇒ 旧计时器被清掉、重新数 5 秒
       ——「手动切换后重置计时」就是这么来的，不用额外维护一个 resetKey；
     · 悬停时 paused 为真 ⇒ 直接不排计时器，等于暂停；离开时 effect 重跑 ⇒ 重新数满 5 秒；
     · 开了「减少动态」或只有一篇文章 ⇒ 根本不启动。 */
  useEffect(() => {
    if (reduced || paused || count <= 1) return

    const timer = window.setTimeout(() => {
      setIndex((current) => wrap(current + 1, count))
    }, AUTOPLAY_MS)

    return () => window.clearTimeout(timer)
  }, [index, paused, reduced, count])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      go(-1)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      go(1)
    }
  }

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    /* 多指（缩放）时不算滑动 */
    const x = event.touches.length === 1 ? event.touches[0].clientX : null
    touchStartX.current = x
    touchLastX.current = x
  }

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return
    touchLastX.current = event.touches[0].clientX
  }

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartX.current
    const last = touchLastX.current
    touchStartX.current = null
    touchLastX.current = null
    if (start === null) return

    /* 优先取 touchend 报的终点，拿不到就退回 touchmove 记的最后一个位置 */
    const end = event.changedTouches[0]?.clientX ?? last
    if (typeof end !== "number") return

    const delta = end - start
    /* 小于阈值当误触：手指轻微抖动不该翻页 */
    if (Math.abs(delta) < SWIPE_THRESHOLD) return

    go(delta < 0 ? 1 : -1)
  }

  /* 没有文章时整块不渲染（和页面上其他空模块一个规矩） */
  if (count === 0) return null

  const { ui } = siteContent
  const counter = `${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`

  return (
    <div
      aria-label={ui.profile.carouselLabel}
      aria-roledescription={ui.profile.carouselRole}
      className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      role="region"
      tabIndex={0}
    >
      <div className="relative">
        {/* 裁切层：只包住幻灯片。箭头是它的兄弟，所以不会被裁。 */}
        <div className="overflow-hidden rounded-2xl">
          <div
            className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {posts.map((post, i) => (
              <div
                aria-label={fillTemplate(ui.profile.carouselSlideLabel, {
                  index: i + 1,
                  total: count,
                })}
                aria-roledescription={ui.profile.carouselSlideRole}
                className="w-full min-w-full shrink-0"
                inert={i !== index}
                key={post.slug}
                role="group"
              >
                {/* 每张幻灯片自己是一张白卡：
                    桌面两列（左内容 / 右大序号），手机单列且序号缩到 36px 排在最前。
                    h-full 让高度取最高那张，切换时卡片不会忽高忽低。 */}
                <article className="grid h-full gap-4 rounded-2xl border border-border bg-card p-7 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-10 sm:p-9">
                  <span
                    aria-hidden="true"
                    className="font-mono text-4xl leading-none font-semibold text-brand/20 tabular-nums select-none sm:col-start-2 sm:row-start-1 sm:text-7xl"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 sm:col-start-1 sm:row-start-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[11px] tracking-wide text-brand">
                        {post.category}
                      </span>
                      {post.tags.slice(0, 3).map((tag) => (
                        <span
                          className="rounded-full bg-brand/5 px-2.5 py-1 font-mono text-[11px] text-brand/80"
                          key={tag}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <h3 className="mt-3 text-xl leading-snug font-semibold tracking-tight sm:text-title">
                      <Link
                        className="text-foreground transition-colors outline-none hover:text-brand focus-visible:underline"
                        to={`/resources/${post.slug}`}
                      >
                        {post.title}
                      </Link>
                      <span className="sr-only">
                        （{ui.article.openLabel}）
                      </span>
                    </h3>

                    <p className="mt-2 line-clamp-3 text-sm leading-7 text-muted-foreground sm:text-base">
                      {post.description}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-faint">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDaysIcon className="size-3.5" />
                        {formatPostDate(post.date)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3Icon className="size-3.5" />
                        {post.readingMinutes} {ui.article.minutesSuffix}
                      </span>
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>

        {count > 1 && (
          <>
            {/* 箭头钉在卡片两侧：往外套 -20px（手机）/ -24px（桌面），
                一半压在卡上、一半悬在外面 —— 既不挡住文字，也不顶出视口
                （手机版心左边距正好 20px，负偏移刚好用到这段留白）。
                手机 44px、桌面 48px；两个都 ≥ 44px 热区。 */}
            <button
              aria-label={ui.profile.carouselPrev}
              className="absolute top-1/2 -left-5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-pop transition-colors hover:border-brand/40 hover:text-brand focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none sm:-left-6 sm:size-12"
              onClick={() => go(-1)}
              type="button"
            >
              <ChevronLeftIcon
                aria-hidden="true"
                className="size-4 sm:size-5"
              />
            </button>
            <button
              aria-label={ui.profile.carouselNext}
              className="absolute top-1/2 -right-5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-pop transition-colors hover:border-brand/40 hover:text-brand focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none sm:-right-6 sm:size-12"
              onClick={() => go(1)}
              type="button"
            >
              <ChevronRightIcon
                aria-hidden="true"
                className="size-4 sm:size-5"
              />
            </button>
          </>
        )}
      </div>

      {/* 计数 + 指示点。放在裁切层外面：它们不该跟着 track 一起滑走。
          指示点按钮给到 44px 见方的热区，视觉上只有中间那颗小点；当前点拉成胶囊。 */}
      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="font-mono text-xs text-faint tabular-nums">
            {counter}
          </span>
          <div className="flex items-center">
            {posts.map((post, i) => (
              <button
                aria-current={i === index ? "true" : undefined}
                aria-label={fillTemplate(ui.profile.carouselDotLabel, {
                  index: i + 1,
                })}
                className="group flex size-11 items-center justify-center"
                key={post.slug}
                onClick={() => jumpTo(i)}
                type="button"
              >
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none",
                    i === index
                      ? "w-6 bg-brand"
                      : "w-1.5 bg-border group-hover:bg-muted-foreground/40"
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
