import { FolderKanbanIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useDocumentTitle } from "@/hooks/use-document-title"

export function WorksPage() {
  useDocumentTitle("作品")

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="max-w-3xl">
        <Badge variant="outline">PORTFOLIO</Badge>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
          作品
        </h1>
        <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">
          用来展示完成的项目、实验和其他创作。当前先保留页面结构，作品内容稍后添加。
        </p>
      </header>

      <section aria-labelledby="works-list" className="mt-10">
        <h2 className="sr-only" id="works-list">
          作品列表
        </h2>
        <Card className="border-dashed py-16 text-center">
          <CardContent>
            <FolderKanbanIcon className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-5 text-lg font-medium">暂无作品</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              后续添加作品时，这里会展示作品名称、简介、状态和访问入口。
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
