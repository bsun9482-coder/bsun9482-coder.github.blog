import { useEffect } from "react"
import { useNavigate } from "react-router"

import { isEditableTarget } from "@/lib/dom"

const HOME_PATH = "/"

/* Dialog / Sheet（shadcn 这两者底层都是 Radix Dialog）打开时 ESC 的第一职责是关掉它。
   实测打开状态下内容节点带 role="dialog" + data-state="open"，<body> 会挂 data-scroll-locked。
   注意时序：Radix 在 document 上收 ESC，我们在 window 上收（document 先冒泡到 window），
   但 React 的状态更新要等当前任务结束才提交，所以此刻浮层仍在 DOM 里 —— 这个判断抓得住。 */
const OPEN_OVERLAY_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'

/**
 * 全局监听 ESC，静默返回浏览器历史上的上一页 —— 等价于按浏览器的后退键。
 * 不做任何 UI 提示，全站生效：首页也响应，所以「从别的页面进到首页」时按 ESC 能退回来源页。
 * 以下情况让行：正在输入、有浮层要关、带修饰键、长按重复。
 */
export function useEscapeBack() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      /* 别的处理器已经认领了这次 ESC（关弹窗 / 收起下拉）就别抢 */
      if (event.defaultPrevented) {
        return
      }

      /* 正在搜索 / 输入时按 ESC 不返回 */
      if (
        isEditableTarget(document.activeElement) ||
        isEditableTarget(event.target)
      ) {
        return
      }

      if (document.querySelector(OPEN_OVERLAY_SELECTOR)) {
        return
      }

      /* 无历史可退时的兜底：直接打开链接 / 新标签页进来时 history.length 是 1，
         navigate(-1) 既不会报错也不会有任何反应，用户会觉得「ESC 坏了」。
         这个值必须在按下的这一刻读：它反映的是整个标签页的历史条数，站内每次 push 都会 +1，
         挂载时读到的是「刚进本站那一刻」的值，之后的增量它反映不到。

         兜底用 replace 而不是 push：此时本来就没有「上一页」，再 push 一条只是往历史里塞个
         重复项，反而让后续的返回更乱。已经在首页时 replace 到首页对用户是空操作，只是会多
         一次不可见的重渲染。

         已知缺口（刻意不修）：length > 1 但当前已经退到标签页首条时 —— 比如「新标签打开首页 →
         进 /profile → 按浏览器后退回首页」—— navigate(-1) 退不动，按 ESC 没有反应。
         这与浏览器自己的后退键在同一位置的表现一致（它也是灰的），所以不额外兜底。
         需求里备选的「延时 300ms 看 location 没变就 navigate("/")」在这里同样无事可做
         （本来就在首页），还会多一个定时器，可能在下一次导航之后才触发。 */
      if (window.history.length <= 1) {
        navigate(HOME_PATH, { replace: true })
        return
      }

      navigate(-1)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [navigate])
}
