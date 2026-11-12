/* 滚动入场的底层：只碰 DOM，不涉及 React —— 组件壳在 components/fx/reveal.tsx。
   拆开是为了满足 react-refresh 规则（一个组件文件只导出组件）。 */

/** 0 / 100 / 200 循环，给列表做错落。 */
export function staggerDelay(index: number) {
  return (index % 3) * 100
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/* 隐藏态写在 CSS 的 .reveal 里（不在 JS 里补），这里只负责「进视口补 in」。
   三种情况直接补 in，保证内容一定看得见：
   · 没有 IntersectionObserver（老浏览器 / 环境不提供）；
   · 用户开了「减少动态」（CSS 里也会直接显示，这里是双保险）；
   · 元素本来就在视口里 —— 观察器第一帧就会回调，走正常路径。 */
export function attachReveal(el: HTMLElement, delay: number) {
  el.style.setProperty("--reveal-delay", `${delay}ms`)

  if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) {
    el.classList.add("in")
    return () => {}
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add("in")
        /* 只播一次：触发后立刻注销这个元素，列表滚动时不再回调。 */
        observer.unobserve(entry.target)
      }
    },
    /* 阈值取小一点：比一屏还高的元素（比如轮播卡）露一点也算进入。 */
    { threshold: 0.06, rootMargin: "0px 0px -6% 0px" }
  )
  observer.observe(el)

  return () => observer.disconnect()
}
