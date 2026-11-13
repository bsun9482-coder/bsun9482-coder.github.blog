import { useEffect, useState } from "react"

/* 每秒跳一次的「现在」。
   为什么要单独抽出来：博客页有两处要显示时间 —— hero 右侧的时钟和右下角「实时信息」
   卡里的日期。各写一个 setInterval 会有两个定时器、两次每秒重渲染，而且两处的
   秒数可能差一拍（看着像卡住了）。收成一个 hook，谁用谁拿同一个 now。

   ⚠️ 只用来「显示时间」，别拿它驱动业务逻辑：它每 1000ms 就变一次，
   挂进依赖数组等于每秒重算一遍。 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}
