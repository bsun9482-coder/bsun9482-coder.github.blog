import { useEffect, useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function HomePage() {
  useDocumentTitle(siteContent.ui.header.home)

  const [visible, setVisible] = useState(prefersReducedMotion)

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

  /* 依次淡入：头像 0ms → 标题 200ms → 副标题 400ms，只动 opacity / transform。 */
  const rise = (delayMs: number) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0px)" : "translateY(24px)",
    transition: `opacity 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms, transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`,
  })

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-24 text-center">
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
    </div>
  )
}
