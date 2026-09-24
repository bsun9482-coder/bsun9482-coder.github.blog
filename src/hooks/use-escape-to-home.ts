import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router"

import { isEditableTarget } from "@/lib/dom"

const HOME_PATH = "/"

/* Dialog / Sheet（shadcn 这两者底层都是 Radix Dialog）打开时 ESC 的第一职责是关掉它。
   实测打开状态下内容节点带 role="dialog" + data-state="open"，<body> 会挂 data-scroll-locked。
   注意时序：Radix 在 document 上收 ESC，我们在 window 上收（document 先冒泡到 window），
   但 React 的状态更新要等当前任务结束才提交，所以此刻浮层仍在 DOM 里 —— 这个判断抓得住。 */
const OPEN_OVERLAY_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'

/**
 * 全局监听 ESC，静默跳回首页。不做任何 UI 提示。
 * 以下情况让行：正在输入、有浮层要关、已经在首页、带修饰键、长按重复。
 */
export function useEscapeToHome() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

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

      /* 正在搜索 / 输入时按 ESC 不跳转 */
      if (
        isEditableTarget(document.activeElement) ||
        isEditableTarget(event.target)
      ) {
        return
      }

      if (document.querySelector(OPEN_OVERLAY_SELECTOR)) {
        return
      }

      /* 已经在首页就不 push 同路径历史，否则"后退"键会像坏的 */
      if (pathname === HOME_PATH) {
        return
      }

      navigate(HOME_PATH)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [navigate, pathname])
}
