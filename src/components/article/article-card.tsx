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
import { formatPostDate } from "@/lib/posts"
import type { Post } from "@/types/post"

type ArticleCardProps = {
  post: Post
}

export function ArticleCard({ post }: ArticleCardProps) {
  return (
    <Card className="group relative gap-4 transition-colors hover:ring-foreground/20">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{post.category}</Badge>
          {post.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
        <CardTitle className="text-xl leading-snug sm:text-2xl">
          <Link
            className="outline-none after:absolute after:inset-0 focus-visible:underline"
            to={`/resources/${post.slug}`}
          >
            {post.title}
          </Link>
        </CardTitle>
        <CardDescription className="text-sm leading-6">
          {post.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="sr-only">打开资料：{post.title}</CardContent>
      <CardFooter className="justify-between border-t-0 bg-transparent pt-0 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDaysIcon className="size-3.5" />
            {formatPostDate(post.date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3Icon className="size-3.5" />
            {post.readingMinutes} 分钟阅读
          </span>
        </div>
        <ArrowUpRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </CardFooter>
    </Card>
  )
}
