import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { useEffect, useRef } from "react"

import { siteContent } from "@/config/site"
import type { AlbumImage } from "@/lib/album"
import { fillTemplate } from "@/lib/text"

/* 相册灯箱：全屏遮罩 + 大图 + 计数 + 左右切换 + 关闭。

   焦点与键盘（这些不是加分项，是「能用」和「不能用」的分界）：
   · 打开时把焦点移到关闭按钮，关闭时还给点开它的那个格子 ——
     不还焦点的话，键盘用户关掉灯箱会掉到页面最顶上，得重新 Tab 一路下来。
   · ESC 关闭、← → 切换。ESC 有两个监听者：这里的和全局的 useEscapeBack
     （那个负责「按 ESC 返回上一页」）。靠 `role="dialog" + data-state="open"`
     让全局的那个主动让行 —— 这是它已经支持的约定，不用改它。
   · 滚动锁：打开期间 body overflow:hidden，否则滚轮会把背后的页面推走。
   · 点遮罩空白处关闭；点图片、按钮、说明文字不关闭（各自 stopPropagation）。

   ⚠️ 计数、按钮名、说明全部走 siteContent.ui.album，别在这里拼中文。 */

const ui = siteContent.ui.album

const BUTTON =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-colors outline-none hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"

export function AlbumLightbox({
  images,
  index,
  onClose,
  onNext,
  onPrev,
}: {
  images: AlbumImage[]
  index: number
  onClose: () => void
  onNext: () => void
  onPrev: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  const image = images[index]
  const total = images.length

  /* 打开时记下「谁把灯箱打开的」，关闭时把焦点还回去。
     只在挂载时跑一次：后续换图不该重设焦点。 */
  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        onPrev()
        return
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        onNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, onNext, onPrev])

  if (!image) return null

  return (
    <div
      aria-label={ui.lightboxLabel}
      aria-modal="true"
      className="fixed inset-0 z-[130] flex flex-col bg-[#0b1220]/93 backdrop-blur-sm"
      data-state="open"
      onClick={onClose}
      role="dialog"
    >
      {/* 顶栏：计数 + 关闭。
         ⚠️ 拦截只挂在「计数」和「关闭按钮」自己身上，不要挂整条顶栏 ——
         顶栏是通栏的，挂整条会把顶栏范围内的空白区域一起吃掉，用户点那里以为
         该关闭、实际没反应（这条曾是探针里唯一挂掉的断言）。 */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p
          aria-live="polite"
          className="font-mono text-xs text-white/70 tabular-nums"
          onClick={(event) => event.stopPropagation()}
        >
          {fillTemplate(ui.counter, { index: index + 1, total })}
        </p>
        <button
          aria-label={ui.close}
          className={BUTTON}
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
          ref={closeRef}
          type="button"
        >
          <XIcon aria-hidden="true" className="size-5" />
        </button>
      </div>

      {/* 图区：左右按钮浮在两侧，图片自己按比例缩到容器里。 */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-2 sm:px-16">
        <button
          aria-label={ui.prev}
          className={`${BUTTON} absolute left-1 z-10 sm:left-6`}
          onClick={(event) => {
            event.stopPropagation()
            onPrev()
          }}
          type="button"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-5" />
        </button>

        <img
          alt={image.cap}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          decoding="async"
          onClick={(event) => event.stopPropagation()}
          src={image.full}
        />

        <button
          aria-label={ui.next}
          className={`${BUTTON} absolute right-1 z-10 sm:right-6`}
          onClick={(event) => {
            event.stopPropagation()
            onNext()
          }}
          type="button"
        >
          <ChevronRightIcon aria-hidden="true" className="size-5" />
        </button>
      </div>

      <p
        className="px-4 pb-5 text-center text-sm text-white/80"
        onClick={(event) => event.stopPropagation()}
      >
        {image.cap}
      </p>
    </div>
  )
}
