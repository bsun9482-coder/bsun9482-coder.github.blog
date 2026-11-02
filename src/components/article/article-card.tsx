import { ArrowUpRightIcon, CalendarDaysIcon, Clock3Icon } from "lucide-react"
import { Link } from "react-router"

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
  return (
    <Card className="group relative gap-5 p-6">
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{post.category}</Badge>
          {post.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="ghost">
              {tag}
            </Badge>
          ))}
        </div>
        <CardTitle className="text-xl leading-snug font-bold sm:text-2xl">
          <Link
            className="outline-none after:absolute after:inset-0 transition-colors group-hover:text-brand focus-visible:underline"
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
      <CardContent className="sr-only">打开资料：{post.title}</CardContent>
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
        <ArrowUpRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </CardFooter>
    </Card>
  )
}
