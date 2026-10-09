import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { useNavigate } from "react-router"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  50% { transform: translateY(10px); }
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
  /* 翻页淡出：置 true 后整层 opacity → 0（300ms），过渡结束再 navigate。 */
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

    /* 降级：跳过淡出，直接跳转 */
    if (prefersReducedMotion()) {
      navigate("/profile")
      return
    }

    setLeaving(true)
    window.setTimeout(() => navigate("/profile"), 300)
  }, [navigate])

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

  /* 依次淡入：头像 0ms → 标题 200ms → 副标题 400ms，只动 opacity / transform。 */
  const rise = (delayMs: number) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0px)" : "translateY(24px)",
    transition: `opacity 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms, transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`,
  })

  return (
    <>
      <style>{CHEVRON_CSS}</style>

      <div
        className="relative flex min-h-[calc(100svh-5rem)] flex-col items-center justify-center px-4 py-24 text-center"
        style={{ opacity: leaving ? 0 : 1, transition: "opacity 300ms ease" }}
      >
        {/*
          背景图占位：以后要放全屏插画时，把图放进 public/，再在这里加一层绝对定位的
          背景层，类名用 bg-cover bg-center 并把图片路径写进 background-image，然后在其上
          盖一层暗色遮罩（bg-background/60）保证文字可读。
          当前不显示图片，直接透出全站的粒子 / 网格 / 光斑背景（见 App.tsx 的 SiteBackground）。
        */}

        <Avatar className="size-14 ring-2 ring-primary/20" style={rise(0)}>
          <AvatarImage
            alt={siteContent.person.name}
            src={siteContent.person.avatarUrl}
          />
          <AvatarFallback className="text-xl">
            {siteContent.person.avatarInitial}
          </AvatarFallback>
        </Avatar>

        <h1
          className="mt-6 bg-gradient-to-r from-glow-blue to-glow-purple bg-clip-text text-4xl font-bold text-transparent sm:text-5xl"
          style={{
            ...rise(200),
            filter:
              "drop-shadow(0 0 24px color-mix(in oklab, var(--glow-blue) 45%, transparent))",
          }}
        >
          {siteContent.ui.home.heroTitle}
        </h1>

        <p className="mt-4 text-base text-muted-foreground" style={rise(400)}>
          {siteContent.ui.home.heroSubtitle}
        </p>

        <button
          aria-label="向下滚动进入博客"
          className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
          onClick={goProfile}
          type="button"
        >
          <ChevronDownIcon
            aria-hidden="true"
            className="home-chevron-float size-6"
          />
        </button>
      </div>
    </>
  )
}
