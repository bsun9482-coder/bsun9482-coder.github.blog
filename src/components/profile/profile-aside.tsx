import { ProfileAlbumCard } from "@/components/profile/profile-album-card"
import { Card, CardContent } from "@/components/ui/card"
import { siteContent } from "@/config/site"
import { useNow } from "@/hooks/use-now"
import { useWeather } from "@/hooks/use-weather"
import { formatDayLabel } from "@/lib/clock"

/* 博客页右栏（第 42 轮重排）：今日说说 → 相册入口 → 实时信息。

   抽成一个组件的原因：它们共用同一份「现在」（时钟 + 天气），
   各写一遍就要各起一个 setInterval、各发一次天气请求。

   等高分工（重要，改之前先看）：
   grid 的 align-items: stretch 把两栏拉成一样高，右栏的富余高度由**相册卡**吃
   （flex-1，缩略图跟着变大，越撑越好看）。今日说说和实时信息都保持自然高度 ——
   它们只有一两行字，撑高只会在卡内吊出一片空白。
   ⚠️ 实时信息**不要**再加 mt-auto / flex-1：加了会把富余从相册卡手里抢走，
      那张卡被拉到 470px 上下（第 40 轮实测）。 */
export function ProfileAside() {
  const now = useNow()
  const { location, weather, hasError, presentation } = useWeather()
  const WeatherIcon = presentation.icon

  const ui = siteContent.ui.profile
  const live = siteContent.ui.live

  const humidityText = hasError
    ? live.weatherUnavailable
    : weather
      ? `${live.humidity} ${Math.round(weather.relativeHumidity)}%`
      : "—"
  const temperatureText =
    hasError || !weather ? "--°" : `${Math.round(weather.temperature)}°`

  return (
    <>
      {/* 1. 今日说说：左侧一条品牌蓝竖线 + 衬线体。
          衬线体是全站唯一的例外（首页那句引言也在用），一眼就能和正文区分开。 */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
            {ui.quoteLabel}
          </p>
          <blockquote className="border-l-2 border-brand pl-4 font-serif text-base leading-7 text-foreground">
            {ui.quoteText}
          </blockquote>
        </CardContent>
      </Card>

      {/* 2. 相册入口：2×2 缩略图，整卡可点，右栏唯一吃富余高度的卡。 */}
      <ProfileAlbumCard />

      {/* 3. 实时信息：天气 / 湿度 / 日期。数据源是 useWeather + useNow，
          自然高度、不拉伸（理由见文件顶部）。 */}
      <Card>
        <CardContent className="flex flex-col gap-5">
          <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
            {ui.liveLabel}
          </p>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
                <WeatherIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="truncate">{presentation.description}</span>
              </span>
              <span className="shrink-0 font-mono text-2xl font-semibold tabular-nums">
                {temperatureText}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3 font-mono text-[11px] text-faint">
              <span>
                {location.name} · {humidityText}
              </span>
              <span className="tabular-nums">{formatDayLabel(now)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
