import { useEffect, useState } from "react"
import {
  CloudIcon,
  CloudLightningIcon,
  CloudRainIcon,
  CloudSnowIcon,
  CloudSunIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react"

import { siteContent } from "@/config/site"

export type WeatherLocation = {
  latitude: number
  longitude: number
  name: string
}

export type WeatherData = {
  relativeHumidity: number
  temperature: number
  weatherCode: number
}

export type WeatherPresentation = {
  description: string
  icon: LucideIcon
}

const WEATHER_BY_CODE: Record<number, WeatherPresentation> = {
  0: { description: "晴", icon: SunIcon },
  1: { description: "多云", icon: CloudSunIcon },
  2: { description: "多云", icon: CloudSunIcon },
  3: { description: "阴", icon: CloudIcon },
  45: { description: "雾", icon: CloudIcon },
  48: { description: "雾", icon: CloudIcon },
  51: { description: "小雨", icon: CloudRainIcon },
  52: { description: "小雨", icon: CloudRainIcon },
  53: { description: "小雨", icon: CloudRainIcon },
  55: { description: "小雨", icon: CloudRainIcon },
  56: { description: "小雨", icon: CloudRainIcon },
  57: { description: "小雨", icon: CloudRainIcon },
  58: { description: "雨", icon: CloudRainIcon },
  59: { description: "雨", icon: CloudRainIcon },
  60: { description: "雨", icon: CloudRainIcon },
  61: { description: "雨", icon: CloudRainIcon },
  62: { description: "雨", icon: CloudRainIcon },
  63: { description: "雨", icon: CloudRainIcon },
  64: { description: "雨", icon: CloudRainIcon },
  65: { description: "雨", icon: CloudRainIcon },
  66: { description: "雨", icon: CloudRainIcon },
  67: { description: "雨", icon: CloudRainIcon },
  71: { description: "雪", icon: CloudSnowIcon },
  72: { description: "雪", icon: CloudSnowIcon },
  73: { description: "雪", icon: CloudSnowIcon },
  74: { description: "雪", icon: CloudSnowIcon },
  75: { description: "雪", icon: CloudSnowIcon },
  76: { description: "雪", icon: CloudSnowIcon },
  77: { description: "雪", icon: CloudSnowIcon },
  80: { description: "阵雨", icon: CloudRainIcon },
  81: { description: "阵雨", icon: CloudRainIcon },
  82: { description: "阵雨", icon: CloudRainIcon },
  95: { description: "雷暴", icon: CloudLightningIcon },
  96: { description: "雷暴", icon: CloudLightningIcon },
  97: { description: "雷暴", icon: CloudLightningIcon },
  98: { description: "雷暴", icon: CloudLightningIcon },
  99: { description: "雷暴", icon: CloudLightningIcon },
}

function isWeatherResponse(value: unknown): value is {
  current: {
    relative_humidity_2m: number
    temperature_2m: number
    weather_code: number
  }
} {
  if (!value || typeof value !== "object" || !("current" in value)) return false
  const c = (value as { current: unknown }).current
  return (
    !!c &&
    typeof c === "object" &&
    "temperature_2m" in c &&
    typeof (c as { temperature_2m: unknown }).temperature_2m === "number" &&
    "relative_humidity_2m" in c &&
    typeof (c as { relative_humidity_2m: unknown }).relative_humidity_2m ===
      "number" &&
    "weather_code" in c &&
    typeof (c as { weather_code: unknown }).weather_code === "number"
  )
}

function getInitialLocation(): WeatherLocation {
  try {
    const stored = localStorage.getItem(siteContent.weather.storageKey)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<WeatherLocation> | null
      /* 三个字段都要验，而且要用 Number.isFinite 而不是 typeof：
       只有 typeof 的话，缓存里存了 null / "abc" / NaN 都能过 —— 于是把
       NaN 坐标发出去，请求必然失败，用户看到的是「天气不可用」，
       查半天才发现是本地缓存坏了。这里不合格就退回默认位置。 */
      if (
        parsed &&
        typeof parsed.name === "string" &&
        parsed.name !== "" &&
        Number.isFinite(parsed.latitude) &&
        Number.isFinite(parsed.longitude)
      ) {
        return parsed as WeatherLocation
      }
    }
  } catch {
    // ignore
  }
  return siteContent.weather.defaultLocation
}

/* 天气取数：位置（本地缓存优先）+ 当前天气，失败置 hasError。供状态栏 / 天气卡共用。 */
export function useWeather() {
  const [location] = useState<WeatherLocation>(getInitialLocation)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const url = new URL(siteContent.weather.forecastApiUrl)
        url.searchParams.set("latitude", String(location.latitude))
        url.searchParams.set("longitude", String(location.longitude))
        url.searchParams.set(
          "current",
          "temperature_2m,relative_humidity_2m,weather_code"
        )
        url.searchParams.set("timezone", "Asia/Shanghai")
        const res = await fetch(url.toString(), { signal: controller.signal })
        if (!res.ok) throw new Error("Weather request failed")
        const data: unknown = await res.json()
        if (!isWeatherResponse(data)) throw new Error("Invalid weather data")
        setWeather({
          relativeHumidity: data.current.relative_humidity_2m,
          temperature: data.current.temperature_2m,
          weatherCode: data.current.weather_code,
        })
        setHasError(false)
      } catch {
        /* ⚠️ 中止不算失败。组件卸载、或位置变化导致重新取数时都会 abort，
           这时置 hasError 会把「本来好好的天气」瞬间显示成「不可用」——
           用户看到的是天气闪一下就变错，日志里也查不出问题。
           请求被主动取消，什么都不用做。 */
        if (controller.signal.aborted) return
        setHasError(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [location])

  const presentation = WEATHER_BY_CODE[weather?.weatherCode ?? -1] ?? {
    description: siteContent.ui.statusBar.unknownWeather,
    icon: CloudIcon,
  }

  return { location, weather, hasError, presentation }
}
