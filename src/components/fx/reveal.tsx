import { useLayoutEffect, useRef } from "react"

import { attachReveal } from "@/lib/reveal"
import { cn } from "@/lib/utils"

/* 滚动揭示：进入视口时从 opacity 0 + translateY(24px) 过渡到正常态，触发一次就 unobserve。
   类名约定写在 index.css 里：`.reveal` 是隐藏态、`.reveal.in` 是显示态，
   所以这个壳只负责把 `reveal` 类挂上，JS 补 `in`。

   两个刻意的选择：
   ① 用 useLayoutEffect 而不是 useEffect：后者在首次绘制之后才跑，会先闪一下完整内容；
   ② 只做一层包壳，且**不把 reveal 加在 Card 上** —— 卡片自己有
      `transition-property: translate/box-shadow/border-color`（.card-lift），
      两条 transition 会互相覆盖，hover 抬升和入场位移必有一边失效。 */

type RevealProps = React.ComponentProps<"div"> & {
  /** 入场延迟（ms）。列表里用 staggerDelay(i) 取 0 / 100 / 200。 */
  delay?: number
}

export function Reveal({
  delay = 0,
  children,
  className,
  ...props
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    return el ? attachReveal(el, delay) : undefined
  }, [delay])

  return (
    <div className={cn("reveal", className)} ref={ref} {...props}>
      {children}
    </div>
  )
}
