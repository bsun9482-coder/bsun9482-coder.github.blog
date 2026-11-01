/* 滚动入场的底层：只碰 DOM，不涉及 React —— 组件壳在 components/fx/reveal.tsx。
   拆开是为了满足 react-refresh 规则（一个组件文件只导出组件）。 */

/** 0 / 100 / 200 循环，给列表做错落。 */
export function staggerDelay(index: number) {
  return (index % 3) * 100
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/* 隐藏态不写死在 CSS 里：先给元素补 .reveal-armed 才变隐藏，进视口再补 .is-revealed。
   这样没有 JS / 观察器不可用 / 用户要求减少动态时，元素保持「正常显示」。 */
export function attachReveal(el: HTMLElement, delay: number) {
  if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) {
    return () => {}
  }

  el.style.setProperty("--reveal-delay", `${delay}ms`)
  el.classList.add("reveal-armed")

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add("is-revealed")
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
