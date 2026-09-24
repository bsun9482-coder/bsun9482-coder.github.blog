import { useCallback, useEffect, useRef, useState } from "react"
import {
  ChevronDownIcon,
  PenLineIcon,
  SparklesIcon,
  TerminalIcon,
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

/* 「正在进行」屏的两张卡 */
const FOCUS_ITEMS = [
  {
    icon: TerminalIcon,
    title: "学 Python",
    description: "从语法到工程，把基础一层层打牢。",
  },
  {
    icon: SparklesIcon,
    title: "玩 AI",
    description: "把模型接进能用的小应用，边做边学。",
  },
]

/* 「最近在写」屏和「第一篇在路上」并排的那张卡 */
const WRITING_CARD = {
  icon: PenLineIcon,
  title: "写博客",
  description: "把踩过的坑整理成可以回看的资料。",
}

/* Preloader 黑屏总时长 = 计数 + 停留 + 滑出 = 1200 + 100 + 700 = 2000ms */
const INTRO_COUNT_DURATION = 1200
const INTRO_HOLD_DURATION = 100
const INTRO_SLIDE_DURATION = 700

/* 各屏滚动 reveal 统一时长与缓动 */
const REVEAL_DURATION = 950
const REVEAL_DISTANCE = 32
const REVEAL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

/* 首屏阶梯：头像 → 名字 → tagline */
const HERO_AVATAR_DURATION = 1000
const HERO_NAME_DELAY = 400
const HERO_NAME_DURATION = 800
const HERO_TAGLINE_DELAY = 700

/* 「正在进行」两张卡依次弹入 */
const CARD_BASE_DELAY = 180
const CARD_STAGGER = 250

/* 模块级标记：每次页面加载重置，所以站内路由切回首页不重播、刷新才重播 */
let introPlayedInThisLoad = false

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
    transition: `opacity ${duration}ms ${REVEAL_EASING} ${delayMs}ms, transform ${duration}ms ${REVEAL_EASING} ${delayMs}ms`,
  }
}

function Intro({
  onReveal,
  onFinish,
}: {
  onReveal: () => void
  onFinish: () => void
}) {
  const [count, setCount] = useState(0)
  const [sliding, setSliding] = useState(false)
  const revealSent = useRef(false)
  const timers = useRef<number[]>([])

  /* 计数用 requestAnimationFrame 驱动：按真实流逝时间算进度，
     后台标签页丢帧时不会像 setInterval 那样越拖越偏，回到前台也不会一次跳一大截 */
  useEffect(() => {
    const startedAt = performance.now()
    let frame = 0

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / INTRO_COUNT_DURATION)
      setCount(Math.round(progress * 100))

      if (progress < 1) {
        frame = requestAnimationFrame(step)
        return
      }

      timers.current.push(
        window.setTimeout(() => {
          setSliding(true)
          if (!revealSent.current) {
            revealSent.current = true
            onReveal()
          }
          timers.current.push(window.setTimeout(onFinish, INTRO_SLIDE_DURATION))
        }, INTRO_HOLD_DURATION)
      )
    }

    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      timers.current.forEach((timer) => window.clearTimeout(timer))
      timers.current = []
    }
  }, [onFinish, onReveal])

  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black"
      style={{
        willChange: "transform",
        transform: sliding ? "translateY(-100%)" : "translateY(0px)",
        transition: `transform ${INTRO_SLIDE_DURATION}ms ease-in-out`,
      }}
    >
      <p className="text-7xl font-bold text-white tabular-nums">{count}</p>
      <p className="text-sm text-white/60">正在把猪脚饭端上来…</p>
    </div>
  )
}

export function HomePage() {
  useDocumentTitle("首页")

  const [reducedMotion] = useState(prefersReducedMotion)
  const [showIntro, setShowIntro] = useState(
    () => !prefersReducedMotion() && !introPlayedInThisLoad
  )
  /* 不播黑幕时（降级 / 站内切回首页）没有 onReveal 可等，Hero 必须直接可见，
     否则会永远停在隐藏态 */
  const [heroRevealed, setHeroRevealed] = useState(() => !showIntro)
  const [revealed, setRevealed] = useState<number[]>(() =>
    prefersReducedMotion() ? [1, 2, 3] : []
  )

  const rootRef = useRef<HTMLDivElement>(null)

  const finishIntro = useCallback(() => {
    introPlayedInThisLoad = true
    setShowIntro(false)
  }, [])

  const revealHero = useCallback(() => {
    setHeroRevealed(true)
  }, [])

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

  /* 黑幕期间锁住滚动，结束后解锁 */
  useEffect(() => {
    const html = document.documentElement
    const previousOverflow = html.style.overflow

    html.style.overflow = showIntro ? "hidden" : previousOverflow

    return () => {
      html.style.overflow = previousOverflow
    }
  }, [showIntro])

  /* 首屏由黑幕回调驱动，不参与视口观察；其余屏进入视口揭开一次后立即 unobserve，
     所以回调次数有上界（= 被观察的屏数），不会在滚动过程中反复触发 */
  useEffect(() => {
    if (reducedMotion) return

    const root = rootRef.current
    if (!root) return

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>('[data-screen]:not([data-screen="0"])')
    )
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const index = Number(entry.target.getAttribute("data-screen"))
          setRevealed((previous) =>
            previous.includes(index) ? previous : [...previous, index]
          )
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.45 }
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [reducedMotion])

  const isRevealed = (index: number) =>
    index === 0 ? heroRevealed : revealed.includes(index)

  return (
    <>
      <style>{HOME_MOTION_CSS}</style>

      {showIntro && <Intro onFinish={finishIntro} onReveal={revealHero} />}

      <div className="relative" ref={rootRef}>
        <section
          className="flex min-h-svh snap-start flex-col items-center justify-center px-4 pt-24 pb-16 text-center"
          data-screen="0"
        >
          <Avatar
            className="home-motion mx-auto size-40 border"
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
            学习日志 · Python 与 AI 知识库
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
              关于我
            </h2>
            <p
              className="home-motion mt-8 max-w-2xl text-lg leading-9 text-muted-foreground"
              style={riseIn(isRevealed(1), 180)}
            >
              死磕 Python 和 AI，出身寒微不是耻辱。
            </p>
            <Link
              className="home-motion mt-8 inline-flex items-center rounded-full bg-foreground px-6 py-2.5 text-sm text-background"
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
              正在进行
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
              className="home-motion mt-8 inline-flex items-center rounded-full bg-foreground px-6 py-2.5 text-sm text-background"
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
              最近在写
            </h2>

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
              <Card
                className="home-motion"
                size="sm"
                style={riseIn(isRevealed(3), CARD_BASE_DELAY + CARD_STAGGER)}
              >
                <CardHeader>
                  <CardTitle>{siteContent.blog.publicResources}</CardTitle>
                  <CardDescription>
                    {siteContent.blog.latestResources}
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
            <Link
              className="home-motion mt-8 inline-flex items-center rounded-full bg-foreground px-6 py-2.5 text-sm text-background"
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
