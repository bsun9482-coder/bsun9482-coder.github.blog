/* 卡片 3D 跟随倾斜：光标在卡里的位置 → 两个小角度，卡片朝光标那一侧微微抬起。
   为什么写在 JS 里、而且是 inline style：
   ① 纯 CSS 的 :hover 只知道"进没进"，拿不到鼠标在卡内的相对位置；
   ② 卡片上已经有 transition-[box-shadow]（card.tsx）和 transition-colors（article-card.tsx），
      Tailwind v4 的 utilities 层会盖掉 @layer components 里的规则，CSS 写 transition 会被压掉；
      inline 优先级最高，且复位后会把 inline 清空，不影响原有过渡；
   ③ 不 setState：每帧 setState 会让 9 张卡反复重渲染。 */

import type { PointerEvent as ReactPointerEvent } from "react"

const MAX_TILT_DEG = 5
const PERSPECTIVE_PX = 1200
const FOLLOW_MS = 80
const RESET_MS = 420

/* 量矩形要在卡片还没歪的时候量：倾斜后 getBoundingClientRect 会把旋转后的外接框算进去，
   每帧重算会越算越偏。所以进卡第一次移动时缓存，离开时丢弃。 */
const rectCache = new WeakMap<HTMLElement, DOMRect>()

let hoverMq: MediaQueryList | null = null
let reduceMq: MediaQueryList | null = null

/* 触屏（没有 hover / 粗指针）不倾斜；系统开了"减少动态效果"也不倾斜。
   两个 MQL 只建一次，但每次都读 matches —— 用户中途改系统设置也能立刻生效。 */
function tiltEnabled() {
  hoverMq ??= window.matchMedia("(hover: hover) and (pointer: fine)")
  reduceMq ??= window.matchMedia("(prefers-reduced-motion: reduce)")
  return hoverMq.matches && !reduceMq.matches
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(-1, value))
}

export function handleTiltMove(event: ReactPointerEvent<HTMLElement>) {
  const el = event.currentTarget
  /* 按住鼠标（拖拽、选中文字、拖轮播）时不倾斜，否则会和拖拽抢手感。 */
  if (event.buttons !== 0 || !tiltEnabled()) return

  const rect = rectCache.get(el) ?? el.getBoundingClientRect()
  rectCache.set(el, rect)
  if (!rect.width || !rect.height) return

  const x = clampUnit(((event.clientX - rect.left) / rect.width - 0.5) * 2)
  const y = clampUnit(((event.clientY - rect.top) / rect.height - 0.5) * 2)

  el.style.transition = `transform ${FOLLOW_MS}ms linear`
  el.style.transform = `perspective(${PERSPECTIVE_PX}px) rotateX(${(y * MAX_TILT_DEG).toFixed(2)}deg) rotateY(${(-x * MAX_TILT_DEG).toFixed(2)}deg)`
  el.style.zIndex = "1"
}

export function handleTiltLeave(event: ReactPointerEvent<HTMLElement>) {
  const el = event.currentTarget
  rectCache.delete(el)
  if (!el.style.transform) return

  el.style.transition = `transform ${RESET_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
  /* 存下 id：帧被饿死时（后台标签页 / 空闲无重绘）rAF 会迟到，
     可能在 finish() 之后才跑，把 transform 又写回 "none"，留下脏 inline。
     【执行窗口偏离工单 2 行，已在台账报备】 */
  const rafId = requestAnimationFrame(() => {
    el.style.transform = "none"
  })

  let timer = 0
  const finish = () => {
    cancelAnimationFrame(rafId)
    el.style.transition = ""
    el.style.transform = ""
    el.style.zIndex = ""
    el.removeEventListener("transitionend", onEnd)
    window.clearTimeout(timer)
  }
  function onEnd(event: TransitionEvent) {
    if (event.propertyName === "transform") finish()
  }
  el.addEventListener("transitionend", onEnd)
  /* 兜底：用户中途切到"减少动态效果"，或浏览器吞了 transitionend。 */
  timer = window.setTimeout(finish, RESET_MS + 80)
}
