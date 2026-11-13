import { MapPinIcon } from "lucide-react"

import { PersonName } from "@/components/person-name"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { siteContent } from "@/config/site"
import { useNow } from "@/hooks/use-now"
import { formatClock, formatDayLabel } from "@/lib/clock"
import { fillTemplate } from "@/lib/text"

/* 博客页顶部的通栏 hero：头像 / 名字 + Agent 标签 / 一句话简介 / 城市与篇数，
   右侧是「开放工作机会」标签和实时时钟。
   —— 第 40 轮从「卡片」改成「通栏」：原先它被塞在 2fr/1fr 的网格里，右边永远
   空着一块（音乐卡的曲目表是空的），整页第一眼看到的是一个半宽的白盒子。

   几处刻意的写法：
   · 渐变环用外层 <span> 的 2px padding 画，不写 box-shadow 环 —— 阴影环在不同
     缩放比下会糊，padding 画出来的是实打实的 2px。
   · 时钟和「实时信息」卡共用 useNow()，两处秒数永远同步。
   · 文章数由父组件传（GET /api/posts 的篇数），加载中给 null 显示短横线 ——
     不是「暂无」，是「还不知道」。 */
export function ProfileHero({ articleCount }: { articleCount: number | null }) {
  const now = useNow()
  const ui = siteContent.ui.profile

  return (
    <header className="relative overflow-hidden rounded-xl border border-border bg-linear-to-br from-brand/10 via-card to-card">
      {/* 右上角一团淡蓝光：纯装饰。blur 之后只是让渐变「有方向」，
          不会变成一块看得见边界的色斑。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-12 size-56 rounded-full bg-brand/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-7 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-9 sm:py-9">
        {/* 左：头像 + 名字 + 简介 */}
        <div className="flex min-w-0 items-start gap-4 sm:gap-6">
          {/* 渐变环：外层 2px 蓝紫渐变，内层给头像套一圈卡片色（白）的 ring，
              两道环之间留出白缝，头像不会和渐变糊在一起。 */}
          <span className="to-brand-2 shrink-0 rounded-full bg-linear-to-br from-brand p-[2px]">
            <Avatar className="size-16 ring-2 ring-card sm:size-20">
              <AvatarImage
                alt={siteContent.person.name}
                src={siteContent.person.avatarUrl}
              />
              <AvatarFallback className="text-2xl">
                {siteContent.person.avatarInitial}
              </AvatarFallback>
            </Avatar>
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="font-heading text-title font-semibold tracking-tight text-balance sm:text-display">
                <PersonName />
              </h1>
              {/* Agent 标签比常规 Badge 高一档（h-6 / text-xs）：
                  旁边是 44px 的大标题，5px 高的小标签会显得像误触。 */}
              <Badge className="h-6 border-brand/25 bg-brand/10 px-2 font-mono text-xs font-medium tracking-[0.14em] text-brand uppercase">
                {ui.agentTag}
              </Badge>
            </div>

            <p className="mt-2.5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              {siteContent.person.introduction}
            </p>

            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-faint">
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon aria-hidden="true" className="size-3.5" />
                {siteContent.person.location}
              </span>
              <span aria-hidden="true">·</span>
              {/* aria-busy：读屏器在加载阶段会念「忙碌」，比等一个短横线更清楚 */}
              <span aria-busy={articleCount === null} className="tabular-nums">
                {articleCount === null
                  ? "—"
                  : fillTemplate(ui.articleCount, { count: articleCount })}
              </span>
            </p>
          </div>
        </div>

        {/* 右：「开放工作机会」+ 时钟。手机竖排靠左，桌面靠右。 */}
        <div className="flex shrink-0 flex-col gap-3 sm:items-end sm:gap-2.5">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand/20 bg-card/80 px-3 py-1 text-xs font-medium text-brand">
            {/* 品牌蓝的点：外圈 ping 只在允许动效时出现（motion-safe），
                开了「减少动态」就只剩一个静止的实心点。 */}
            <span aria-hidden="true" className="relative flex size-1.5">
              <span className="absolute inset-0 rounded-full bg-brand opacity-60 motion-safe:animate-ping" />
              <span className="relative size-1.5 rounded-full bg-brand" />
            </span>
            {ui.openToWork}
          </span>
          <div>
            <p className="font-mono text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
              {formatClock(now)}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-faint sm:text-right">
              {formatDayLabel(now)}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
