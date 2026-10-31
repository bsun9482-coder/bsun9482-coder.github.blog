import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react"
import { Link, useNavigate } from "react-router"

import { Container } from "@/components/layout/container"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { isEditableTarget } from "@/lib/dom"

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/* 底部向下箭头的上下浮动循环动画；降级时停掉浮动（media query 见下方 style） */
const CHEVRON_CSS = `
@keyframes home-chevron-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(8px); }
}
.home-chevron-float { animation: home-chevron-float 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .home-chevron-float { animation: none; }
}
`

export function HomePage() {
  useDocumentTitle(siteContent.ui.header.home)
  const navigate = useNavigate()

  const [visible, setVisible] = useState(prefersReducedMotion)
  /* 退场：置 true 后内容层淡出上移（450ms），过渡结束再 navigate。 */
  const [leaving, setLeaving] = useState(false)
  /* 只有一页、触发一次即跳转，用 ref 挡掉触控板惯性连发的后续 wheel / 连续按键 */
  const navigatingRef = useRef(false)

  useEffect(() => {
    if (visible) return

    /* 双 rAF：等首帧（隐藏态）真的画上去之后再翻状态，否则状态变更会和首帧合并成
       同一次绘制，过渡被吃掉。 */
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setVisible(true))
    })

    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [visible])

  const goProfile = useCallback(() => {
    if (navigatingRef.current) return
    navigatingRef.current = true

    /* 降级：跳过退场，直接跳转（不带 state、不锁滚动） */
    if (prefersReducedMotion()) {
      navigate("/profile")
      return
    }

    setLeaving(true)
    /* 退场动画跑满 450ms 再跳；并把「从首页来」的标记带给博客页，供其播入场动画。 */
    window.setTimeout(
      () => navigate("/profile", { state: { fromHome: true } }),
      450
    )
  }, [navigate])

  /* 退场播放期间锁住页面滚动（防止动画中还能滚），组件卸载（跳转完成后）自动还原。 */
  useEffect(() => {
    if (!leaving) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [leaving])

  /* 监听下滑翻页：滚轮向下 / 手机上滑 / 键盘向下。卸载时全部移除，
     跳转后组件卸载，监听自然消失，不会重复 navigate。 */
  useEffect(() => {
    let touchStartY = 0

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY <= 0) return
      goProfile()
    }

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0
    }

    const onTouchEnd = (event: TouchEvent) => {
      const endY = event.changedTouches[0]?.clientY ?? 0
      if (touchStartY - endY > 50) goProfile()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "ArrowDown" &&
        event.key !== " " &&
        event.key !== "PageDown"
      ) {
        return
      }
      /* 长按连发 / 正在输入时让行 */
      if (event.repeat || isEditableTarget(event.target)) return
      event.preventDefault()
      goProfile()
    }

    window.addEventListener("wheel", onWheel)
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })
    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchend", onTouchEnd)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [goProfile])

  /* 依次淡入：头像 0ms → 标题 120ms → 简介 240ms → 按钮 360ms。
     只动 opacity / transform，不动布局。 */
  const rise = (delayMs: number) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0px)" : "translateY(12px)",
    transition: `opacity 600ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms, transform 600ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`,
  })

  return (
    <>
      <style>{CHEVRON_CSS}</style>

      {/* 白底 hero：左对齐、大标题、一句简介、两个按钮。
          容器高度扣掉 sticky header 的 4rem，保证底部箭头正好落在首屏内。 */}
      <Container className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-center py-20">
        <div
          className="max-w-2xl"
          style={{
            opacity: leaving ? 0 : 1,
            transform: leaving ? "translateY(-8px)" : "translateY(0)",
            transition:
              "opacity 450ms cubic-bezier(0.4, 0, 0.2, 1), transform 450ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <Avatar className="size-14 ring-1 ring-border" style={rise(0)}>
            <AvatarImage
              alt={siteContent.person.name}
              src={siteContent.person.avatarUrl}
            />
            <AvatarFallback className="text-lg">
              {siteContent.person.avatarInitial}
            </AvatarFallback>
          </Avatar>

          <h1
            className="mt-8 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-6xl"
            style={rise(120)}
          >
            {siteContent.ui.home.heroTitle}
          </h1>

          <p
            className="mt-5 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg"
            style={rise(240)}
          >
            {siteContent.ui.home.heroSubtitle}
          </p>

          <div
            className="mt-8 flex flex-wrap items-center gap-3"
            style={rise(360)}
          >
            <Button asChild size="lg">
              <Link to="/resources">
                {siteContent.ui.home.ctaPrimary}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/profile">{siteContent.ui.home.ctaSecondary}</Link>
            </Button>
          </div>
        </div>

        <button
          aria-label="向下滚动进入博客"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-md p-2 text-faint transition-colors hover:text-muted-foreground"
          onClick={goProfile}
          type="button"
        >
          <ChevronDownIcon
            aria-hidden="true"
            className="home-chevron-float size-5"
          />
        </button>
      </Container>
    </>
  )
}
