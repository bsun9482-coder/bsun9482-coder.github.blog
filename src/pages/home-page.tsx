import { useCallback, useEffect, useRef, useState } from "react"
import {
  ChevronDownIcon,
  PenLineIcon,
  SparklesIcon,
  TerminalIcon,
  UserIcon,
} from "lucide-react"
import { Link } from "react-router"

import { PersonName } from "@/components/person-name"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"

/* 「正在进行」屏的两张卡。图标是组件，留在组件里；文案统一从 siteContent 取。 */
const FOCUS_ITEMS = [
  { icon: TerminalIcon, ...siteContent.ui.home.focus.python },
  { icon: SparklesIcon, ...siteContent.ui.home.focus.ai },
]

/* 「最近在写」屏的卡片 */
const WRITING_CARD = {
  icon: PenLineIcon,
  ...siteContent.ui.home.writingCard,
}

/* 各屏滚动 reveal 统一时长与缓动 */
const REVEAL_DURATION = 950
const REVEAL_DISTANCE = 32
const REVEAL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

/* 屏「算进入视口」的判定阈值：可见高度占自身高度的比例。
   IntersectionObserver 的回调和挂载时的同步兜底共用这一个值 ——
   两处各写一份就会出现「回调说进了、兜底说没进」的抖动。 */
const REVEAL_THRESHOLD = 0.45

/* 首屏阶梯：头像 → 名字 → tagline */
const HERO_AVATAR_DURATION = 1000
const HERO_NAME_DELAY = 400
const HERO_NAME_DURATION = 800
const HERO_TAGLINE_DELAY = 700

/* 「正在进行」两张卡依次弹入 */
const CARD_BASE_DELAY = 180
const CARD_STAGGER = 250

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

const HOME_MOTION_CSS = `
@keyframes home-chevron-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(10px); }
}
.home-chevron-float { animation: home-chevron-float 2.4s ease-in-out infinite; }

/* 入场元素只动 transform / opacity，提前提层，避免低端机掉帧 */
.home-motion { will-change: transform, opacity; }

@media (prefers-reduced-motion: reduce) {
  .home-chevron-float { animation: none; }
  .home-motion { transition: none !important; will-change: auto; }
}
`

/* 入场效果统一为 translateY + opacity fade-in（不用 clip-path，低端机上更稳） */
function riseIn(
  visible: boolean,
  delayMs = 150,
  distance = REVEAL_DISTANCE,
  duration = REVEAL_DURATION
) {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0px)" : `translateY(${distance}px)`,
    // 入场只动 opacity / transform（节奏不变）；额外补一条 box-shadow 300ms，
    // 否则卡片的 hover:ring / hover:shadow 发光会被这条行内 transition 盖掉、
    // 变成瞬间跳变（行内样式优先级高于样式表里的 transition-[box-shadow] duration-300）。
    transition: `opacity ${duration}ms ${REVEAL_EASING} ${delayMs}ms, transform ${duration}ms ${REVEAL_EASING} ${delayMs}ms, box-shadow 300ms ease 0ms`,
  }
}

export function HomePage() {
  useDocumentTitle(siteContent.ui.header.home)

  const [reducedMotion] = useState(prefersReducedMotion)
  /* 首屏 Hero 的入场动画：首帧必须先按隐藏态渲染，挂载后再翻到可见态，
     过渡才会真的跑起来 —— 直接用可见态初始化等于没有动画。
     初始值只看降级开关，不用任何模块级标记：StrictMode 会双挂载，
     第一次挂载把标记置 true 之后，第二次挂载的初始值就读到 true、直接跳过动画，
     表现就是「刷新后动画时有时无」。现在每次挂载都从隐藏态开始，重播走下面的 key。 */
  const [heroRevealed, setHeroRevealed] = useState(prefersReducedMotion)
  /* 重播计数器，只用来给首屏 section 换 key，见 replayHero */
  const [heroRun, setHeroRun] = useState(0)
  const [revealed, setRevealed] = useState<number[]>(() =>
    prefersReducedMotion() ? [1, 2, 3] : []
  )

  const rootRef = useRef<HTMLDivElement>(null)

  /* 重播首屏入场：翻回隐藏态，同时换 key 把那几个元素整块重挂载。
     只翻状态、不换 key 不行 —— 元素还在，transition 会真的反向播一遍
     （先滑下去淡出、再滑上来），看着像闪了一下。重挂载出来的新元素一出生就是隐藏态，
     下一帧翻到可见态，动画干净地重播。降级时直接给可见态，不播。

     只重播首屏，后面三屏的 revealed 故意不动：observer 揭开一屏就把它 unobserve 了，
     而 observer 本身只在挂载时建一次，重置回隐藏态就再也没人来揭开，会永久卡在隐藏态。 */
  const replayHero = useCallback(() => {
    setHeroRevealed(prefersReducedMotion())
    setHeroRun((run) => run + 1)
  }, [])

  /* 双 rAF：等首帧（隐藏态）真的画上去之后再翻状态。
     只等一帧的话，状态变更会和首帧合并成同一次绘制，过渡被吃掉、动画根本不播。
     StrictMode 下第一次挂载的 rAF 会被 cleanup 取消，第二次挂载重新调度，照常播。
     heroRun 也要进依赖：重播时若 heroRevealed 本来就是隐藏态，状态没变化，
     不重新调度就会一直停在隐藏态。 */
  useEffect(() => {
    if (heroRevealed) return

    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setHeroRevealed(true))
    })

    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [heroRevealed, heroRun])

  /* 挂载时统一回顶部，而且是瞬时归位。不能只靠 App.tsx 的 ScrollManager：
     它按 [hash, pathname] 归零时走的也是 window.scrollTo({ top: 0 })，而 html 上有全站
     scroll-smooth（index.css）—— 那是一次平滑滚动。从内容页切回首页时用户会先落在上一页的
     滚动位置（通常是第二三屏），再「滑」上来，首屏入场动画就在这段滑动里播完了。
     所以必须显式写 behavior: "instant"（只有 "auto" 才会去读 scroll-behavior）；
     同一次 commit 里它比 ScrollManager 晚执行，会把那次平滑滚动直接打断。
     浏览器的滚动还原已由 index.html 的 manual 接管，这里不依赖它，但也不指望它 ——
     manual 是否覆盖刷新由浏览器实现决定。 */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [])

  /* pageshow 是唯一能覆盖「bfcache 恢复」的时机：
     - bfcache 恢复：整页是解冻而不是重新加载，React 不会重新挂载，heroRevealed 还停在
       可见态，滚动位置也被还原 —— 表现就是「直接落在第二三屏 + 首屏动画不播」。
     - 刷新：manual 是否压得住浏览器自己的滚动还原由实现决定，压不住时这里再兜一次
       （先后顺序同样由实现决定，不能断言谁先谁后）。
     归位同样要 behavior: "instant"，理由见上面那个挂载 effect。
     重播只在 persisted 时做：正常加载时挂载逻辑已经播过，再播一次会看着像闪。 */
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      window.scrollTo({ top: 0, behavior: "instant" })

      if (event.persisted) replayHero()
    }

    window.addEventListener("pageshow", handlePageShow)

    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [replayHero])

  /* 整屏吸附设在滚动容器（<html>）上，卸载时还原。
     滚动条的隐藏已由 index.css 全局处理，这里不再重复。
     首页不渲染页脚，所以 4 屏正好铺满文档高度，最后一个吸附点就是页面底部。 */
  useEffect(() => {
    const html = document.documentElement
    const previousSnap = html.style.scrollSnapType

    html.style.scrollSnapType = "y mandatory"

    return () => {
      html.style.scrollSnapType = previousSnap
    }
  }, [])

  /* 首屏由黑幕回调驱动，不参与视口观察；其余屏进入视口揭开一次后立即 unobserve，
     所以回调次数有上界（= 被观察的屏数），不会在滚动过程中反复触发 */
  useEffect(() => {
    if (reducedMotion) return

    const root = rootRef.current
    if (!root) return

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>('[data-screen]:not([data-screen="0"])')
    )

    const markRevealed = (target: Element) => {
      const index = Number(target.getAttribute("data-screen"))
      setRevealed((previous) =>
        previous.includes(index) ? previous : [...previous, index]
      )
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          markRevealed(entry.target)
          observer.unobserve(entry.target)
        })
      },
      { threshold: REVEAL_THRESHOLD }
    )

    sections.forEach((section) => observer.observe(section))

    /* 同步兜底：挂上 observer 之后立刻量一次，已经在视口里的屏当场揭开，
       不等 observer 那次异步回调。
       判定口径必须和 observer 的 threshold 完全一致（可见高度 / 自身高度）——
       两处各写一份就会出现「回调说进了、兜底说没进」的抖动。

       现实里它基本命中不了：上面那个挂载 effect 会把滚动位置瞬时归零，而 effect 按声明顺序
       同步执行，跑到这里时视口里只剩首屏，首屏又在下面被 :not([data-screen="0"]) 排除掉了。
       留着是为了兜两种情况 —— 有人把归零 effect 挪到 observer 之后，或某个引擎不认
       behavior: "instant"。万一命中，markRevealed 幂等、unobserve 一个还没派发回调的目标
       也没有副作用，所以留着的成本是零。 */
    const viewportHeight = window.innerHeight
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect()
      if (rect.height <= 0) return

      const visible = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
      if (visible / rect.height < REVEAL_THRESHOLD) return

      markRevealed(section)
      observer.unobserve(section)
    })

    return () => observer.disconnect()
  }, [reducedMotion])

  const isRevealed = (index: number) =>
    index === 0 ? heroRevealed : revealed.includes(index)

  return (
    <>
      <style>{HOME_MOTION_CSS}</style>

      <div className="relative" ref={rootRef}>
        {/* key 绑重播计数器：换 key = 首屏整块重挂载，入场动画才能干净地重播（见 replayHero） */}
        <section
          key={heroRun}
          className="flex min-h-svh snap-start flex-col items-center justify-center px-4 pt-24 pb-16 text-center"
          data-screen="0"
        >
          <Avatar
            className="home-motion mx-auto size-40 ring-2 ring-primary/20"
            style={riseIn(heroRevealed, 0, 40, HERO_AVATAR_DURATION)}
          >
            <AvatarImage
              alt={siteContent.person.name}
              src={siteContent.person.avatarUrl}
            />
            <AvatarFallback className="text-5xl">
              {siteContent.person.avatarInitial}
            </AvatarFallback>
          </Avatar>
          <h1
            className="home-motion mt-8 text-4xl font-semibold tracking-tight sm:text-5xl"
            style={riseIn(heroRevealed, HERO_NAME_DELAY, 40, HERO_NAME_DURATION)}
          >
            <PersonName />
          </h1>

          <p
            className="home-motion mt-6 text-base text-muted-foreground"
            style={riseIn(heroRevealed, HERO_TAGLINE_DELAY)}
          >
            {siteContent.tagline}
          </p>

          <ChevronDownIcon
            aria-hidden="true"
            className="home-chevron-float mt-16 size-6 text-muted-foreground"
          />
        </section>

        <section
          className="flex min-h-svh snap-start flex-col justify-center px-4 pt-24 pb-16 sm:px-6"
          data-screen="1"
        >
          <div className="mx-auto w-full max-w-3xl">
            <p
              className="home-motion text-xs font-medium tracking-[0.2em] text-primary"
              style={riseIn(isRevealed(1), 0)}
            >
              ABOUT
            </p>
            <h2
              className="home-motion mt-4 text-4xl font-semibold tracking-tight sm:text-6xl"
              style={riseIn(isRevealed(1), 80)}
            >
              {siteContent.ui.home.aboutTitle}
            </h2>
            {/* 与「正在进行」同一套三层结构（图标 → 标题 → 描述）与同一套毛玻璃：
                复用 Card / CardHeader / CardTitle / CardDescription，样式唯一来源在 ui/card.tsx，
                所以三张卡不可能漂移。Card 自己的 className 与那两张卡逐字符相同 —— 间距一律交给
                外层 wrapper（「正在进行」是交给栅格容器），卡片本身只带 .home-motion。
                只剩一张卡，所以不加 stagger。 */}
            <div className="mt-8">
              <Card
                className="home-motion"
                size="sm"
                style={riseIn(isRevealed(1), CARD_BASE_DELAY)}
              >
                <CardHeader>
                  <UserIcon
                    aria-hidden="true"
                    className="mb-1 size-5 text-muted-foreground"
                  />
                  <CardTitle>{siteContent.ui.home.aboutTitle}</CardTitle>
                  <CardDescription>
                    死磕 Python 和 AI，出身寒微不是耻辱。
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
            <Link
              className="home-motion mt-8 inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground shadow-[0_0_15px_color-mix(in_oklab,var(--glow-blue)_30%,transparent)] hover:shadow-[0_0_22px_color-mix(in_oklab,var(--glow-blue)_50%,transparent)]"
              style={riseIn(isRevealed(1), 400)}
              to="/profile"
            >
              进入博客
            </Link>
          </div>
        </section>

        <section
          className="flex min-h-svh snap-start flex-col justify-center px-4 pt-24 pb-16 sm:px-6"
          data-screen="2"
        >
          <div className="mx-auto w-full max-w-3xl">
            <p
              className="home-motion text-xs font-medium tracking-[0.2em] text-primary"
              style={riseIn(isRevealed(2), 0)}
            >
              NOW
            </p>
            <h2
              className="home-motion mt-4 text-4xl font-semibold tracking-tight sm:text-6xl"
              style={riseIn(isRevealed(2), 80)}
            >
              {siteContent.ui.home.nowTitle}
            </h2>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {FOCUS_ITEMS.map((item, index) => (
                <Card
                  key={item.title}
                  className="home-motion"
                  size="sm"
                  style={riseIn(
                    isRevealed(2),
                    CARD_BASE_DELAY + index * CARD_STAGGER
                  )}
                >
                  <CardHeader>
                    <item.icon
                      aria-hidden="true"
                      className="mb-1 size-5 text-muted-foreground"
                    />
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
            <Link
              className="home-motion mt-8 inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground shadow-[0_0_15px_color-mix(in_oklab,var(--glow-blue)_30%,transparent)] hover:shadow-[0_0_22px_color-mix(in_oklab,var(--glow-blue)_50%,transparent)]"
              style={riseIn(isRevealed(2), 600)}
              to="/works"
            >
              进入作品
            </Link>
          </div>
        </section>

        <section
          className="flex min-h-svh snap-start flex-col justify-center px-4 pt-24 pb-16 sm:px-6"
          data-screen="3"
        >
          <div className="mx-auto w-full max-w-3xl">
            <p
              className="home-motion text-xs font-medium tracking-[0.2em] text-primary"
              style={riseIn(isRevealed(3), 0)}
            >
              WRITING
            </p>
            <h2
              className="home-motion mt-4 text-4xl font-semibold tracking-tight sm:text-6xl"
              style={riseIn(isRevealed(3), 80)}
            >
              {siteContent.ui.home.writingTitle}
            </h2>

            {/* 保留两列栅格：只剩一张卡时它仍占第一列，位置与宽度和原来一致（不是居中） */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <Card
                className="home-motion"
                size="sm"
                style={riseIn(isRevealed(3), CARD_BASE_DELAY)}
              >
                <CardHeader>
                  <WRITING_CARD.icon
                    aria-hidden="true"
                    className="mb-1 size-5 text-muted-foreground"
                  />
                  <CardTitle>{WRITING_CARD.title}</CardTitle>
                  <CardDescription>{WRITING_CARD.description}</CardDescription>
                </CardHeader>
              </Card>
            </div>
            <Link
              className="home-motion mt-8 inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground shadow-[0_0_15px_color-mix(in_oklab,var(--glow-blue)_30%,transparent)] hover:shadow-[0_0_22px_color-mix(in_oklab,var(--glow-blue)_50%,transparent)]"
              style={riseIn(isRevealed(3), 400)}
              to="/resources"
            >
              进入资料
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
