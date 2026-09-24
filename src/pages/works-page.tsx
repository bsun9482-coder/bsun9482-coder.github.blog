import { FolderKanbanIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"

export function WorksPage() {
  useDocumentTitle(siteContent.ui.works.title)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="max-w-3xl">
        <Badge variant="outline">{siteContent.ui.works.badge}</Badge>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
          {siteContent.ui.works.title}
        </h1>
        <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">
          {siteContent.ui.works.description}
        </p>
      </header>

      <section aria-labelledby="works-list" className="mt-10">
        <h2 className="sr-only" id="works-list">
          作品列表
        </h2>
        <Card className="border-dashed py-16 text-center">
          <CardContent>
            <FolderKanbanIcon className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-5 text-lg font-medium">
              {siteContent.ui.works.emptyTitle}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {siteContent.ui.works.emptyDescription}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
