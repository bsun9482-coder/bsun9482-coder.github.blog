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

  /* 视频背景：降级时（prefers-reduced-motion）不自动播放，直接回退到全站背景；
     视频本身加载失败 / 不支持时，也隐藏掉、透出全站背景兜底。 */
  const [reducedMotion] = useState(prefersReducedMotion)
  const [videoFailed, setVideoFailed] = useState(false)

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

      {/* 视频背景层：只在首页挂载（组件卸载即随路由移除），fixed 全屏铺满。
          muted + playsInline + loop 静音循环；降级（prefers-reduced-motion）不自动播放，
          直接回退到全站背景；加载失败 / 不支持时 onError 隐藏本层，同样透出全站背景兜底。 */}
      {!reducedMotion && !videoFailed && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        >
          <video
            ref={(el) => {
              /* React 对 muted 属性的渲染有历史坑（初始不落 DOM），用 ref 兜底确保真静音，
                 否则浏览器会拦截 autoplay。 */
              if (el) el.muted = true
            }}
            src="/videos/home-bg.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="h-full w-full object-cover"
            onError={() => setVideoFailed(true)}
          />
          {/* 暗色遮罩：上下重、中间轻的渐变。
              这里必须用固定深色（black）而不是 bg-background/*：全站已改成浅色主题，
              --background 接近白（oklch 97%），用它盖出来是一层白纱、压不暗，
              视频亮部（云层/高光）会把标题冲淡。深紫黑压暗后，
              配合下面改成亮色的标题/副标题才读得清。 */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/45 to-black/75" />
        </div>
      )}

      <div
        className="relative z-10 flex min-h-[calc(100svh-5rem)] flex-col items-center justify-center px-4 py-24 text-center"
        style={{ opacity: leaving ? 0 : 1, transition: "opacity 300ms ease" }}
      >
        <Avatar className="size-14 ring-2 ring-primary/20" style={rise(0)}>
          <AvatarImage
            alt={siteContent.person.name}
            src={siteContent.person.avatarUrl}
          />
          <AvatarFallback className="text-xl">
            {siteContent.person.avatarInitial}
          </AvatarFallback>
        </Avatar>

        {/* 标题在深色遮罩上，改用高亮度的粉紫渐变（原来的浅蓝/浅粉是给浅底配的，
            压到视频画面上会糊成一片）。 */}
        <h1
          className="mt-6 bg-gradient-to-r from-pink-200 via-fuchsia-200 to-violet-200 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl"
          style={{
            ...rise(200),
            filter:
              "drop-shadow(0 0 24px color-mix(in oklab, var(--glow-purple) 55%, transparent))",
          }}
        >
          {siteContent.ui.home.heroTitle}
        </h1>

        {/* 副标题同理：从浅色主题的 muted-foreground（中灰，压深底会糊）改成亮色 */}
        <p
          className="mt-4 text-base text-white/75"
          style={rise(400)}
        >
          {siteContent.ui.home.heroSubtitle}
        </p>

        <button
          aria-label="向下滚动进入博客"
          className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full p-2 text-white/70 transition-colors hover:text-white"
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
