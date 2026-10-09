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
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"]
  return `${m}/${d} 周${weekdays[date.getDay()]}`
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
    <div className="flex flex-wrap items-stretch overflow-hidden rounded-3xl bg-card/60 shadow-lg shadow-primary/5 ring-1 ring-glow-blue/15 backdrop-blur-xl">
      {/* 1. 时间：深色底块，大号 tabular-nums */}
      <div className="flex items-center justify-center bg-gradient-to-br from-indigo-950 to-slate-900 px-6 py-5 sm:px-8">
        <span className="text-2xl font-bold tabular-nums tracking-wider text-white sm:text-3xl">
          {formatTime(now)}
        </span>
      </div>

      {/* 2. 天气：图标 + 城市 + 晴 · 湿度 */}
      <div className="flex items-center gap-3 px-6 py-4">
        <WeatherIcon className="size-6 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {location.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasError
              ? siteContent.ui.sidebar.weatherUnavailable
              : `${presentation.description} · ${siteContent.ui.sidebar.humidity} ${weather ? Math.round(weather.relativeHumidity) : "--"}%`}
          </p>
        </div>
      </div>

      {/* 3. 温度：大号数字 */}
      <div className="flex items-center px-6 py-4">
        <span className="text-3xl font-bold text-foreground">
          {hasError ? "--°" : `${weather ? Math.round(weather.temperature) : "--"}°`}
        </span>
      </div>

      {/* 4. 日期：10/09 周五 */}
      <div className="flex items-center px-6 py-4 sm:ml-auto">
        <span className="text-sm text-muted-foreground">{formatDate(now)}</span>
      </div>
    </div>
  )
}
