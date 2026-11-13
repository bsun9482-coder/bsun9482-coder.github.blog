import { siteContent } from "@/config/site"

/* 时间的两种显示格式。原先写在 components/layout/status-bar.tsx 里，
   第 40 轮那条横条拆成右侧卡片，hero 也要显示时钟 —— 共用一份，
   免得「左上角 10:36:44、右下角 10:36:43」这种差一拍的观感。

   ⚠️ 秒要 padStart(2)：不补零的话 10:36:4 会跳一下宽度，
   等宽字体也救不了 —— 数字位数变了。 */

export function formatClock(date: Date) {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return `${h}:${m}:${s}`
}

/** 「11/11 周三」。周几取配置里的 weekdays，按 getDay() 的 0~6 索引。 */
export function formatDayLabel(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const { weekdays, weekdayPrefix } = siteContent.ui.live
  return `${m}/${d} ${weekdayPrefix}${weekdays[date.getDay()]}`
}
