import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  CloudIcon,
  CloudLightningIcon,
  CloudRainIcon,
  CloudSnowIcon,
  CloudSunIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { siteContent } from "@/config/site"

type WeatherLocation = {
  latitude: number
  longitude: number
  name: string
}

type WeatherData = {
  relativeHumidity: number
  temperature: number
  weatherCode: number
}

type WeatherPresentation = {
  description: string
  icon: LucideIcon
}

type GeocodingResult = WeatherLocation & {
  country_code?: string
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
  54: { description: "小雨", icon: CloudRainIcon },
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
  if (!value || typeof value !== "object" || !("current" in value)) {
    return false
  }

  const current = value.current
  return (
    !!current &&
    typeof current === "object" &&
    "temperature_2m" in current &&
    typeof current.temperature_2m === "number" &&
    "relative_humidity_2m" in current &&
    typeof current.relative_humidity_2m === "number" &&
    "weather_code" in current &&
    typeof current.weather_code === "number"
  )
}

function isWeatherLocation(value: unknown): value is WeatherLocation {
  if (!value || typeof value !== "object") return false

  return (
    "name" in value &&
    typeof value.name === "string" &&
    "latitude" in value &&
    typeof value.latitude === "number" &&
    "longitude" in value &&
    typeof value.longitude === "number"
  )
}

function getInitialLocation(): WeatherLocation {
  try {
    const storedLocation = localStorage.getItem(siteContent.weather.storageKey)
    if (storedLocation) {
      const parsedLocation: unknown = JSON.parse(storedLocation)
      if (isWeatherLocation(parsedLocation)) return parsedLocation
    }
  } catch {
    // Fall back to the configured location when storage is unavailable or invalid.
  }

  return siteContent.weather.defaultLocation
}

function createForecastUrl(location: WeatherLocation) {
  const url = new URL(siteContent.weather.forecastApiUrl)
  url.searchParams.set("latitude", String(location.latitude))
  url.searchParams.set("longitude", String(location.longitude))
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,weather_code"
  )
  url.searchParams.set("timezone", "Asia/Shanghai")
  return url.toString()
}

function getGeocodingResults(value: unknown): GeocodingResult[] {
  if (!value || typeof value !== "object" || !("results" in value)) return []
  if (!Array.isArray(value.results)) return []

  return value.results.filter(
    (result): result is GeocodingResult =>
      isWeatherLocation(result) &&
      (!("country_code" in result) || typeof result.country_code === "string")
  )
}

export function WeatherCard() {
  const [location, setLocation] = useState<WeatherLocation>(getInitialLocation)
  const [locationInput, setLocationInput] = useState(location.name)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [hasError, setHasError] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [isLocating, setIsLocating] = useState(false)
  const searchControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadWeather() {
      try {
        const response = await fetch(createForecastUrl(location), {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Weather request failed")

        const data: unknown = await response.json()
        if (!isWeatherResponse(data)) throw new Error("Invalid weather data")

        setWeather({
          relativeHumidity: data.current.relative_humidity_2m,
          temperature: data.current.temperature_2m,
          weatherCode: data.current.weather_code,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setHasError(true)
      }
    }

    void loadWeather()
    return () => controller.abort()
  }, [location])

  useEffect(() => {
    if (!searchError) return
    const timeoutId = window.setTimeout(() => setSearchError(""), 2000)
    return () => window.clearTimeout(timeoutId)
  }, [searchError])

  useEffect(() => {
    return () => searchControllerRef.current?.abort()
  }, [])

  async function handleLocationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = locationInput.trim()
    if (!query) return

    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    setSearchError("")
    setIsLocating(true)

    try {
      const url = new URL(siteContent.weather.geocodingApiUrl)
      url.searchParams.set("name", query)
      url.searchParams.set("count", "5")
      url.searchParams.set("language", "zh")
      url.searchParams.set("format", "json")

      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error("Location request failed")

      const data: unknown = await response.json()
      const results = getGeocodingResults(data)
      const nextLocation =
        results.find((result) => result.country_code === "CN") ?? results[0]

      if (!nextLocation) {
        setSearchError(siteContent.ui.sidebar.cityNotFound)
        return
      }

      const savedLocation: WeatherLocation = {
        name: nextLocation.name,
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
      }
      try {
        localStorage.setItem(
          siteContent.weather.storageKey,
          JSON.stringify(savedLocation)
        )
      } catch {
        // The selected location still works for this session without storage.
      }
      setLocationInput(savedLocation.name)
      setHasError(false)
      setLocation(savedLocation)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setSearchError(siteContent.ui.sidebar.cityNotFound)
    } finally {
      if (!controller.signal.aborted) setIsLocating(false)
    }
  }

  const presentation = WEATHER_BY_CODE[weather?.weatherCode ?? -1] ?? {
    description: siteContent.ui.sidebar.unknownWeather,
    icon: CloudIcon,
  }
  const WeatherIcon = presentation.icon

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <form
          className="flex items-center gap-2"
          onSubmit={handleLocationSubmit}
        >
          <Input
            aria-label={siteContent.ui.sidebar.locationInputPlaceholder}
            className="min-w-0"
            onChange={(event) => setLocationInput(event.target.value)}
            placeholder={siteContent.ui.sidebar.locationInputPlaceholder}
            value={locationInput}
          />
          <Button
            disabled={isLocating}
            size="sm"
            type="submit"
            variant="outline"
          >
            {siteContent.ui.sidebar.locate}
          </Button>
        </form>
        {searchError ? (
          <p className="text-xs text-destructive">{searchError}</p>
        ) : null}

        {hasError ? (
          <p className="text-sm text-muted-foreground">
            {siteContent.ui.sidebar.weatherUnavailable}
          </p>
        ) : weather ? (
          <>
            <div className="flex items-center justify-between">
              <WeatherIcon className="size-5 text-muted-foreground" />
            </div>
            <p className="text-4xl font-semibold tracking-tight">
              {Math.round(weather.temperature)}°
            </p>
            <p className="text-sm text-muted-foreground">
              {presentation.description} · {siteContent.ui.sidebar.humidity}{" "}
              {Math.round(weather.relativeHumidity)}%
            </p>
          </>
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
