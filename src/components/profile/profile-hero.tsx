import { MapPinIcon } from "lucide-react"

import { TiltCard } from "@/components/fx/tilt-card"
import { PersonName } from "@/components/person-name"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CardContent } from "@/components/ui/card"
import { siteContent } from "@/config/site"
import { posts } from "@/lib/posts"

/* 博客页顶部那张「个人资料卡」：头像 + 名字 + 城市 + 一句话简介 + 统计。
   —— 从 pages/profile-page.tsx 拆出来的，页面那一层只负责排版与入场动画。

   统计只留下「文章」一项（它有真实数据源：posts.length）。
   原来的「说说 / 照片」两项没有数据，只能渲染一个短横线 —— 那是空占位，
   现在整块去掉，等真有数据再回来。
   同理删掉了右下角两个「永久 disabled」的图标按钮：点了没反应比不显示更糟。

   内边距比常规卡大（手机 28px、桌面 36px）：只改卡片的 --card-spacing 一处，
   子节点不用各自再写一遍内边距。
   ⚠️ 注释里别写裸的类名（比如间距类）：Tailwind 会连注释一起扫，
   扫到就生成一条没人用的规则，产物白白变大。 */
export function ProfileHero() {
  return (
    <TiltCard className="h-full [--card-spacing:--spacing(7)] sm:[--card-spacing:--spacing(9)]">
      <CardContent className="flex h-full flex-col">
        <div className="flex items-start gap-5 sm:gap-6">
          <Avatar className="size-16 shrink-0 ring-1 ring-border sm:size-20">
            <AvatarImage
              alt={siteContent.person.name}
              src={siteContent.person.avatarUrl}
            />
            <AvatarFallback className="text-2xl">
              {siteContent.person.avatarInitial}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-title font-semibold tracking-tight text-balance sm:text-display">
              <PersonName />
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPinIcon className="size-4" />
              {siteContent.person.location}
            </p>
          </div>
        </div>

        <p className="mt-5 text-base leading-7 text-muted-foreground">
          {siteContent.person.introduction}
        </p>

        <div className="mt-auto flex items-end gap-3 pt-8">
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {posts.length}
          </p>
          <p className="pb-1 text-xs text-muted-foreground">
            {siteContent.ui.profile.statArticles}
          </p>
        </div>
      </CardContent>
    </TiltCard>
  )
}
