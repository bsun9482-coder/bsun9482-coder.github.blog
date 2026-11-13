import { ArrowUpRightIcon, CalendarDaysIcon, Clock3Icon } from "lucide-react"
import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { siteContent } from "@/config/site"
import { formatPostDate } from "@/lib/post-date"
import type { Post } from "@/types/post"

/* 博客页左栏的两种卡：
     FeaturedPostCard  轮播里的单张：左边一块深色「代码」牌，右边标题/描述/元信息
     TagCloudCard      收尾的标签云（按出现次数排序，带计数），两栏时吃掉左栏富余高度

   第 41 轮之前这里是「精选大卡 + 逐行文章列表」，现在列表整段搬进了轮播，
   所以 ProfilePostRow 已删除 —— 留着它会让同一篇文章在页面上出现两次。

   ⚠️ 两张卡都靠 `group relative` + 标题链接上的 `after:absolute after:inset-0`
   让整张卡可点。不要给卡片挂 onClick：那样键盘用户 Tab 不到、中键也没法新开标签页。
   ⚠️ hover 的上浮与泛蓝一律交给 index.css 的 .card-lift，组件里不写 hover:border-* ——
   工具类在 components 层之后，会把 .card-lift 的颜色盖掉。 */

const ui = siteContent.ui.profile

/** 轮播里的单张卡。深色块的底色走 --dark-surface（全站唯一的深色面，和首页专注卡同源）。

    index / total 只用于深色块上那个角标（01、02…）：轮播里每张卡都长得一样，
    没有页码就不知道「这是第几张、还有几张」。
    w-full h-full：slide 是 flex 容器，这张卡负责填满它 —— 所有 slide 因此等高、
    图标块等大，切换时不会一张高一张矮。
    my-auto 仍然保留：卡被拉高时标题和摘要浮到剩余空间的正中间，
    自然高度时不产生任何间距。 */
export function FeaturedPostCard({
  post,
  index,
  total,
}: {
  post: Post
  index: number
  total: number
}) {
  return (
    <Card className="group relative grid h-full w-full gap-0 overflow-hidden p-0 sm:grid-cols-[168px_minmax(0,1fr)]">
      {/* 深色块：手机上是顶部一条横的，桌面变左半边。
          背景渐变与 `</>` 符号是**所有 slide 共用的一套**，写在组件里只此一处 ——
          不要在调用点额外塞样式，否则某一张会跟别人不一样（规格明确要求整齐划一）。
          用 [background-image:...] 而不是 bg-[...] 任意值：前者不依赖猜测
          这个值该落到哪个属性上。 */}
      <div className="relative flex items-center justify-center gap-3 [background-image:linear-gradient(160deg,#1e293b,#0f172a)] px-5 py-5 sm:flex-col sm:gap-3 sm:py-0">
        <span
          aria-hidden="true"
          className="font-mono text-2xl leading-none font-bold tracking-tighter text-(--brand-soft)"
        >
          {"</>"}
        </span>
        <span className="font-mono text-[10px] tracking-[0.24em] text-(--brand-soft) tabular-nums">
          <span className="opacity-90">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="opacity-40">/{String(total).padStart(2, "0")}</span>
        </span>
      </div>

      {/* pr-14（sm 起）：右边那个 44px 的圆形箭头是浮在卡片上的，
          它占掉卡片右侧约 52px。内容不给这个位置让路，描述最后一行的末尾
          就会被盖住（实测 744px 宽时正好压到「网页接入，」的逗号）。 */}
      <div className="flex min-w-0 flex-1 flex-col p-6 sm:pr-14">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className="border-brand/25 bg-brand/10 text-brand"
            variant="secondary"
          >
            {post.category}
          </Badge>
          {post.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="ghost">
              {tag}
            </Badge>
          ))}
        </div>

        {/* my-auto：卡片被撑高时，标题和摘要浮到剩余空间的正中间；
            卡片是自然高度时它不产生任何间距，和普通卡一样。 */}
        <div className="my-auto flex flex-col gap-3 py-4">
          <h2 className="font-heading text-lg leading-snug font-semibold tracking-tight text-balance sm:text-title">
            <Link
              className="transition-colors outline-none group-hover:text-brand after:absolute after:inset-0 focus-visible:underline"
              to={`/resources/${post.slug}`}
            >
              {post.title}
            </Link>
            <span className="sr-only">
              （{siteContent.ui.article.openLabel}）
            </span>
          </h2>

          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            {post.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 font-mono text-xs text-faint">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDaysIcon aria-hidden="true" className="size-3.5" />
              {formatPostDate(post.date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3Icon aria-hidden="true" className="size-3.5" />
              {post.readingMinutes} {siteContent.ui.article.minutesSuffix}
            </span>
          </div>
          <ArrowUpRightIcon
            aria-hidden="true"
            className="size-4 transition group-hover:text-brand motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-reduce:transition-none"
          />
        </div>
      </div>
    </Card>
  )
}

/* 标签云。第 42 轮起是自然高度 —— 富余高度归右栏的相册卡，
   这里再吃一份就会互相撑（两处 flex-1 会把行高顶到内容的两倍以上）。
   所以不再需要居中：卡片高度本来就贴着内容。 */
export function TagCloudCard({
  tags,
}: {
  tags: { tag: string; count: number }[]
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
          {ui.tagCloudLabel}
        </p>
        <div className="flex flex-wrap gap-2">
          {tags.map(({ tag, count }) => (
            <Badge className="h-6 px-2" key={tag} variant="outline">
              {tag}
              <span className="ml-1 text-faint tabular-nums">{count}</span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* 加载中的占位：骨架把位置先占好，数据到了页面不会整体跳一下。
   只画两张 —— 一张对应轮播、一张对应标签云，跟真实布局的块数一致。 */
export function ProfilePostsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5" role="status">
      {[0, 1].map((index) => (
        <div
          className="rounded-xl border border-border bg-card p-6"
          key={index}
        >
          <Skeleton className="h-5 w-20" />
          <Skeleton className="mt-4 h-6 w-3/4" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-5 h-3 w-40" />
        </div>
      ))}
      <span className="sr-only">{ui.postsLoading}</span>
    </div>
  )
}
