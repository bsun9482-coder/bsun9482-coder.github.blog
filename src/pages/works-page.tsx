import { FolderGit2Icon } from "lucide-react"

import { Container } from "@/components/layout/container"
import { Card, CardContent } from "@/components/ui/card"
import { pageNameOf, siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"

export function WorksPage() {
  useDocumentTitle(pageNameOf("/works"))

  return (
    <Container className="py-10 sm:py-16">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <FolderGit2Icon aria-hidden="true" className="size-8 text-primary" />
          <h1 className="text-3xl font-bold">{pageNameOf("/works")}</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          {siteContent.ui.works.subtitle}
        </p>
      </div>

      <section aria-labelledby="works-list" className="mt-10">
        <h2 className="sr-only" id="works-list">
          {siteContent.ui.works.listTitle}
        </h2>
        <Card className="border-dashed py-16 text-center">
          <CardContent>
            <FolderGit2Icon className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-5 text-lg font-medium">
              {siteContent.ui.works.emptyTitle}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {siteContent.ui.works.emptyDescription}
            </p>
          </CardContent>
        </Card>
      </section>
    </Container>
  )
}
