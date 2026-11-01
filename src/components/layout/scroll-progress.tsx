import { useEffect, useRef } from "react"

/* 顶部滚动进度条：固定 3px 蓝条，宽度 = 已滚 / 可滚。

   性能上的两个要点：
   ① scroll 监听必须 passive —— 否则浏览器要等 JS 跑完才敢滚，页面会有"黏手"感；
   ② 回调里不直接改样式，而是打一个 rAF 标记：滚动事件一秒能来上百次，
      每帧最多写一次 width，剩下的合并掉。
   宽度照规格直接写 width（而不是 scaleX）：这条是 fixed 定位、无兄弟节点，
   改宽度只影响它自己，不会牵着别人重排。 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ticking = false

    const update = () => {
      ticking = false
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - window.innerHeight
      /* 内容不足一屏时 scrollable ≤ 0，直接归零，别算出负数宽度。 */
      const ratio =
        scrollable > 0
          ? Math.min(1, Math.max(0, window.scrollY / scrollable))
          : 0
      const bar = barRef.current
      if (bar) bar.style.width = `${(ratio * 100).toFixed(2)}%`
    }

    const schedule = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", schedule, { passive: true })
    /* 窗口变高变矮、内容高度变化都会让百分比失真，跟着重算一次。 */
    window.addEventListener("resize", schedule, { passive: true })

    return () => {
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [])

  return (
    <div aria-hidden="true" className="scroll-progress">
      <div className="scroll-progress__bar" ref={barRef} />
    </div>
  )
}
