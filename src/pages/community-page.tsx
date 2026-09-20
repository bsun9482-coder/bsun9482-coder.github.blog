import { MessagesSquareIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useDocumentTitle } from "@/hooks/use-document-title"

export function CommunityPage() {
  useDocumentTitle("社区交流")

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="max-w-3xl">
        <Badge variant="outline">COMMUNITY</Badge>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
          社区交流
        </h1>
        <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">
          用来发布讨论、分享经验和交流问题。当前先保留页面入口和内容结构。
        </p>
      </header>

      <section aria-labelledby="community-content" className="mt-10">
        <h2 className="sr-only" id="community-content">
          社区内容
        </h2>
        <Card className="border-dashed py-16 text-center">
          <CardContent>
            <MessagesSquareIcon className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-5 text-lg font-medium">社区暂未开放</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              后续可以在这里加入话题列表、发布入口和评论功能。
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
