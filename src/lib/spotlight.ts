/* 卡片聚光灯的坐标来源：把指针相对卡片的坐标写进 CSS 变量 --spot-x / --spot-y。
   为什么不做成 React state：
   ① 每帧 setState 会让 9 张卡反复重渲染，指针一动就是几十次 diff；
   ② 坐标只有一个消费者（伪元素的 radial-gradient 圆心），走 CSS 变量是零成本通道。
   为什么不放在 tilt.ts 里：那边有「触屏/减少动态就整个 return」的早退，
   聚光灯在 reduced-motion 下仍然要跟着指针走（它只是静态光，不参与动画）。 */

import type { PointerEvent as ReactPointerEvent } from "react"

/* 和 tilt.ts 同样的缓存理由：卡片倾斜后 getBoundingClientRect 会把旋转后的
   外接框算进去，每帧重算会越算越偏。进卡第一次移动时缓存，离开时丢弃。 */
const rectCache = new WeakMap<HTMLElement, DOMRect>()

export function handleSpotlightMove(event: ReactPointerEvent<HTMLElement>) {
  /* 触屏上 pointermove 就是手指滑动，既没有 hover 也不该有光斑 —— 直接跳过。 */
  if (event.pointerType === "touch") return

  const el = event.currentTarget
  const rect = rectCache.get(el) ?? el.getBoundingClientRect()
  rectCache.set(el, rect)
  if (!rect.width || !rect.height) return

  /* 写 px 不写百分比：radial-gradient 的半径是固定 420px，圆心也用绝对长度
     才能保证光斑在大卡、小卡上一样大。取整是为了少一点无意义的重绘。 */
  el.style.setProperty("--spot-x", `${Math.round(event.clientX - rect.left)}px`)
  el.style.setProperty("--spot-y", `${Math.round(event.clientY - rect.top)}px`)
}

export function handleSpotlightLeave(event: ReactPointerEvent<HTMLElement>) {
  /* 只丢缓存，不清变量：淡出过程中光斑还停在最后的位置，比「先跳回左上角再淡出」自然。 */
  rectCache.delete(event.currentTarget)
}
