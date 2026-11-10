import { ArrowUpRightIcon, CalendarDaysIcon, Clock3Icon } from "lucide-react"
import { Link } from "react-router"
import type { MouseEvent as ReactMouseEvent } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { siteContent } from "@/config/site"
import { formatPostDate } from "@/lib/posts"
import type { Post } from "@/types/post"

type ArticleCardProps = {
  post: Post
}

export function ArticleCard({ post }: ArticleCardProps) {
  /* 高光圆心：把光标相对卡片的坐标写进 --mx / --my（带 px）。
     不走 useState —— mousemove 一秒能来上百次，setState 会把整张卡
     （含摘要文本）重渲染一遍，纯属浪费；style.setProperty 只改一个自定义属性，
     不触发 React 渲染，浏览器自己合并到下一帧。
     ⚠️ 卡片本身有 3D 倾斜（lib/tilt.ts 会写 inline transform），
     getBoundingClientRect 拿到的是倾斜后的包围盒，圆心会差几个像素 ——
     视觉上看不出来，但别再拿它当「精确坐标」用。 */
  const handleGlowMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`)
    el.style.setProperty("--my", `${event.clientY - rect.top}px`)
  }

  return (
    <Card
      /* [&::before]:hidden 关掉 .card-fx 自带的那层聚光灯（420px / 8% / 70% 淡出）。
         为什么不是「再叠一层」：两层 8% 叠起来中心约 15.7%，白底会发灰，
         和「极简专业」相冲。这层新的（520px / 42%）就是它的替代，
         流动边光（.card-fx::after）保持不动。
         isolate 是给下面 -z-10 的高光层兜底用：负 z 的元素要有个层叠上下文
         才不会掉到卡片白底后面（.card-fx 本来也有 isolation，这里写明白）。 */
      className="group relative isolate gap-5 overflow-hidden p-6 [&::before]:hidden"
      onMouseMove={handleGlowMove}
    >
      {/* 1. 鼠标跟随高光：圆心跟着 --mx/--my 跑，默认透明，hover 才显形。
          pointer-events-none 必须留，否则这层会把标题链接的点击吃掉。
          z-10 的反面是 -z-10：它要压在卡片白底之上、文字之下。 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
        style={{
          background:
            "radial-gradient(520px circle at var(--mx, 50%) var(--my, 0%), color-mix(in srgb, var(--brand) 8%, transparent), transparent 42%)",
        }}
      />

      {/* 4. 顶部渐变发丝线：左右淡出，中间品牌蓝，hover 时浮现。
          ⚠️ 必须写 top-0 / inset-x-0，不能为了「盖住描边」改成 -top-px：
          overflow:hidden 的裁切边界是**内边距盒**（不是边框盒），
          挪到描边上等于整条被裁掉，实测开/关两种状态像素完全一样（Δ=0）。
          所以它只能落在描边内侧第一行 —— 看着是「顶边下面浮起一道蓝光」。 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--brand) 55%, transparent), transparent)",
        }}
      />

      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* 3. 分类用品牌淡底（三件套一起换：底、字、描边），
              和后面透明底的标签拉开层级 —— 全页仍然只有这一个强调蓝。
              色值走 --brand 令牌（= #2563eb），别在这里写死 hex。 */}
          <Badge
            variant="secondary"
            className="border-brand/25 bg-brand/10 text-brand"
          >
            {post.category}
          </Badge>
          {post.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="ghost">
              {tag}
            </Badge>
          ))}
        </div>
        <CardTitle className="text-xl leading-snug font-bold sm:text-2xl">
          <Link
            className="transition-colors outline-none group-hover:text-brand after:absolute after:inset-0 focus-visible:underline"
            to={`/resources/${post.slug}`}
          >
            {post.title}
          </Link>
        </CardTitle>
        {/* line-clamp-2 只管「最多两行」，不管「至少两行」：摘要短一行的卡
            内容会整体上移 24px，同一行的日期栏就对不齐。min-h 固定按两行占位。 */}
        <CardDescription className="line-clamp-2 min-h-[3rem] text-sm leading-6">
          {post.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="sr-only">
        {siteContent.ui.article.openLabel}：{post.title}
      </CardContent>
      {/* 卡片根节点 p-6 的 padding-bottom 会被 card.tsx 的
          has-data-[slot=card-footer]:pb-0 压成 0（footer 在场时的既定行为），
          所以这里**不能**再叠 -mb-6 —— 那会把 footer 推到卡片底边外 24px，
          被 overflow:hidden 裁掉（实测箭头图标被削掉 2px）。底部留白由 pb-5 承担。 */}
      <CardFooter className="-mx-6 mt-1 justify-between border-t-0 bg-transparent px-6 pt-4 pb-5 font-mono text-[11px] text-faint">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDaysIcon className="size-3.5" />
            {formatPostDate(post.date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3Icon className="size-3.5" />
            {post.readingMinutes} {siteContent.ui.article.minutesSuffix}
          </span>
        </div>
        {/* 2. 箭头：hover 时朝右上「走出去」半格并变品牌蓝。
            位移用 motion-safe: 包住而不是 motion-reduce: 覆盖 —— 两条规则抢同一个
            translate 属性时，谁生效取决于样式表顺序；motion-safe 让「减少动态」下
            这两条工具类压根不存在，不赌顺序。 */}
        <ArrowUpRightIcon className="size-4 transition group-hover:text-brand motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-reduce:transition-none" />
      </CardFooter>
    </Card>
  )
}
