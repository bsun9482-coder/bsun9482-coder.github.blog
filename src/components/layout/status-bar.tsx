import { useEffect, useState } from "react"

import { siteContent } from "@/config/site"
import { useWeather } from "@/hooks/use-weather"

function formatTime(date: Date) {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return `${h}:${m}:${s}`
}

function formatDate(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const { weekdays, weekdayPrefix } = siteContent.ui.statusBar
  return `${m}/${d} ${weekdayPrefix}${weekdays[date.getDay()]}`
}

export function StatusBar() {
  const [now, setNow] = useState(() => new Date())
  const { location, weather, hasError, presentation } = useWeather()

  /* 每秒更新时间 */
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const WeatherIcon = presentation.icon

  return (
    /* 极简状态条：白底 + 1px 描边 + 分段竖线，全部等宽字。
       不再用深色渐变块 / 玻璃拟态 / 彩色 ring —— 这一段只是信息，不抢视觉。 */
    <div className="flex flex-wrap items-stretch overflow-hidden rounded-xl border border-border">
      {/* 1. 时间 */}
      <div className="flex items-center px-5 py-4">
        <span className="font-mono text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
          {formatTime(now)}
        </span>
      </div>

      {/* 2. 天气：图标 + 城市 + 晴 · 湿度 */}
      <div className="flex items-center gap-3 border-l border-border px-5 py-4">
        <WeatherIcon className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {location.name}
          </p>
          <p className="font-mono text-xs text-faint">
            {hasError
              ? siteContent.ui.statusBar.weatherUnavailable
              : `${presentation.description} · ${siteContent.ui.statusBar.humidity} ${weather ? Math.round(weather.relativeHumidity) : "--"}%`}
          </p>
        </div>
      </div>

      {/* 3. 温度 */}
      <div className="flex items-center border-l border-border px-5 py-4">
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {hasError
            ? "--°"
            : `${weather ? Math.round(weather.temperature) : "--"}°`}
        </span>
      </div>

      {/* 4. 日期 */}
      <div className="flex items-center border-l border-border px-5 py-4 sm:ml-auto">
        <span className="font-mono text-xs text-faint tabular-nums">
          {formatDate(now)}
        </span>
      </div>
    </div>
  )
}
