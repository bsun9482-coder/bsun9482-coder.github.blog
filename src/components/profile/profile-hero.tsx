import { ExternalLinkIcon, MapPinIcon, Music2Icon } from "lucide-react"

import { TiltCard } from "@/components/fx/tilt-card"
import { PersonName } from "@/components/person-name"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { siteContent } from "@/config/site"
import { posts } from "@/lib/posts"

/* 博客页顶部那张「个人资料卡」：头像 + 名字 + 城市 + 一句话简介，
   底部一行三个统计数字和两个图标按钮。
   —— 从 pages/profile-page.tsx 拆出来的，页面那一层只负责排版与入场动画。

   统计数字里只有「文章」是真的（posts.length），另外两项没有数据源，
   固定渲染短横线，不假装有数字。

   内边距比常规卡大（手机 28px、桌面 36px）：只改卡片的 --card-spacing 一处，
   子节点不用各自再写一遍内边距。
   ⚠️ 注释里别写裸的类名（比如间距类）：Tailwind 会连注释一起扫，
   扫到就生成一条没人用的规则，产物白白变大。 */
export function ProfileHero() {
  return (
    <TiltCard className="[--card-spacing:--spacing(7)] sm:[--card-spacing:--spacing(9)]">
      <CardContent className="flex h-full flex-col">
        <div className="flex items-start gap-6">
          <Avatar className="size-20 shrink-0 ring-1 ring-border">
            <AvatarImage
              alt={siteContent.person.name}
              src={siteContent.person.avatarUrl}
            />
            <AvatarFallback className="text-3xl">
              {siteContent.person.avatarInitial}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              <PersonName />
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPinIcon className="size-4" />
              {siteContent.person.location}
            </p>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {siteContent.person.introduction}
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between pt-8">
          <div className="flex items-center gap-8 sm:gap-10">
            <div>
              <p className="font-mono text-3xl font-semibold tabular-nums">
                {posts.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {siteContent.ui.profile.statArticles}
              </p>
            </div>
            <div>
              <p className="font-mono text-3xl font-semibold text-muted-foreground tabular-nums">
                —
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {siteContent.ui.profile.statMoments}
              </p>
            </div>
            <div>
              <p className="font-mono text-3xl font-semibold text-muted-foreground tabular-nums">
                —
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {siteContent.ui.profile.statPhotos}
              </p>
            </div>
          </div>

          {/* 右下角两个入口都还没接：外链没有目标地址、音乐没有播放页。
              先 disabled 置灰 —— 位置留着（日后接上直接放开），但「点了没反应」
              这种死交互比不显示更糟：用户会以为页面坏了，而不是以为功能还没做。
              ⚠️ 别用空的 onClick 假装能点。 */}
          <div className="flex items-center gap-2.5">
            {/* TODO: 外部链接入口（定下地址后：换成 <a href> 并去掉 disabled） */}
            <Button
              aria-label={siteContent.ui.profile.externalLink}
              className="size-10"
              disabled
              size="icon"
              variant="ghost"
            >
              <ExternalLinkIcon className="size-4" />
            </Button>
            {/* TODO: 音乐入口（接上音乐页/播放器后去掉 disabled） */}
            <Button
              aria-label={siteContent.ui.profile.music}
              className="size-10"
              disabled
              size="icon"
              variant="ghost"
            >
              <Music2Icon className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </TiltCard>
  )
}
