import { useLayoutEffect, useRef } from "react"

import { attachReveal } from "@/lib/reveal"

/* 滚动入场：进入视口时从 opacity 0 + translateY(22px) 过渡到正常态，触发一次就 unobserve。

   两个刻意的选择：
   ① 用 useLayoutEffect 而不是 useEffect：后者在首次绘制之后才跑，会先闪一下完整内容；
   ② 只做一层包壳，且**不把 .reveal-armed 加在 Card 上** —— 卡片自己有
      `transition-property: transform/box-shadow/border-color`（.card-lift），
      两条 transition 会互相覆盖，hover 抬升和入场位移必有一边失效。 */

type RevealProps = React.ComponentProps<"div"> & {
  /** 入场延迟（ms）。列表里用 staggerDelay(i) 取 0 / 100 / 200。 */
  delay?: number
}

export function Reveal({ delay = 0, children, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    return el ? attachReveal(el, delay) : undefined
  }, [delay])

  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  )
}
