import { MapPinIcon } from "lucide-react"

import { TiltCard } from "@/components/fx/tilt-card"
import { PersonName } from "@/components/person-name"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CardContent } from "@/components/ui/card"
import { siteContent } from "@/config/site"

/* 博客页顶部那张「个人资料卡」：头像 + 名字 + 城市 + 一句话简介 + 统计。
   —— 从 pages/profile-page.tsx 拆出来的，页面那一层只负责排版与入场动画。

   统计只留下「文章」一项。
   ⚠️ 这个数字现在由父组件传进来（来自 GET /api/posts 的篇数），
   不再是 `posts.length` —— 那个 posts 是构建期扫 MDX 得到的清单，
   后台新发的文章不在里面。混用两种数据源的结果是：列表里 3 篇、角标写 2 篇。
   父组件在加载中传 null，这里显示一个短横线（不是「暂无」，是「还不知道」）。

   内边距比常规卡大（手机 28px、桌面 36px）：只改卡片的 --card-spacing 一处，
   子节点不用各自再写一遍内边距。
   ⚠️ 注释里别写裸的类名（比如间距类）：Tailwind 会连注释一起扫，
   扫到就生成一条没人用的规则，产物白白变大。 */
export function ProfileHero({ articleCount }: { articleCount: number | null }) {
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
          <p
            aria-busy={articleCount === null}
            className="font-mono text-2xl font-semibold tabular-nums"
          >
            {articleCount === null ? "—" : articleCount}
          </p>
          <p className="pb-1 text-xs text-muted-foreground">
            {siteContent.ui.profile.statArticles}
          </p>
        </div>
      </CardContent>
    </TiltCard>
  )
}
