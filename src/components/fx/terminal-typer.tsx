import { useLayoutEffect, useRef, useState } from "react"

import { prefersReducedMotion } from "@/lib/reveal"
import { cn } from "@/lib/utils"

/* 终端打字机：逐字打出 command + result，末尾跟一个闪烁的蓝色光标。

   为什么 DOM 里同时放两份文本：
   · `.terminal-ghost` 是完整句，默认可见 —— 没有 JS / 脚本报错时页面照样读得到；
   · `.terminal-live` 是逐字打的那份，初始为空。
   JS 跑起来后由 useLayoutEffect 给根节点补 `.terminal-typing`，CSS 才把 ghost 换成 live。
   于是「隐藏状态」始终是 JS 加类控制的结果，不写在基础样式里，也不会先闪一句完整文本。
   光标只存在于 live 里，减少动态时 live 不显示 ⇒ 光标自然也不闪。 */
export function TerminalTyper({
  command,
  result,
  className,
  startDelay = 0,
}: {
  command: string
  result: string
  className?: string
  /** 开始打字前的等待（ms）。和首页 hero 里这段的淡入延迟对齐，免得"还没出现就开始打"。 */
  startDelay?: number
}) {
  const full = `${command}\n${result}`
  const rootRef = useRef<HTMLDivElement>(null)
  const [typed, setTyped] = useState("")

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    /* 减少动态：不打字（也就没有光标），CSS 保持展示 ghost 的完整句。 */
    if (prefersReducedMotion()) return

    el.classList.add("terminal-typing")

    let index = 0
    let interval = 0
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        index += 1
        setTyped(full.slice(0, index))
        if (index >= full.length) window.clearInterval(interval)
      }, 55)
    }, startDelay)

    return () => {
      window.clearTimeout(start)
      window.clearInterval(interval)
    }
  }, [full, startDelay])

  return (
    <div
      className={cn(
        "terminal overflow-hidden rounded-xl border border-border bg-secondary",
        className
      )}
      ref={rootRef}
    >
      {/* 终端标题栏：三个灰点保持中性，不加红黄绿的"玩具感" */}
      <div
        aria-hidden="true"
        className="flex items-center gap-1.5 border-b border-border px-3 py-2"
      >
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="size-2 rounded-full bg-foreground/15" />
      </div>

      <pre
        aria-hidden="true"
        className="px-3 py-2.5 font-mono text-[11px] leading-5 whitespace-pre-wrap text-foreground sm:text-xs"
      >
        <span className="terminal-ghost">{full}</span>
        <span className="terminal-live">
          {typed}
          <span className="terminal-caret" />
        </span>
      </pre>
      {/* 读屏用：视觉区整体 aria-hidden，只念这一份完整文本，避免逐字重复播报。 */}
      <span className="sr-only">{full}</span>
    </div>
  )
}
