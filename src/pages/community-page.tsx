import { MessagesSquareIcon } from "lucide-react"

import { Container } from "@/components/layout/container"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { pageNameOf, siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"

export function CommunityPage() {
  useDocumentTitle(pageNameOf("/community"))

  return (
    <Container className="py-10 sm:py-16">
      <header className="max-w-3xl">
        <Badge variant="outline">{siteContent.ui.community.badge}</Badge>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
          {siteContent.ui.community.title}
        </h1>
        <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">
          {siteContent.ui.community.description}
        </p>
      </header>

      <section aria-labelledby="community-content" className="mt-10">
        <h2 className="sr-only" id="community-content">
          {siteContent.ui.community.contentTitle}
        </h2>
        <Card className="border-dashed py-16 text-center">
          <CardContent>
            <MessagesSquareIcon className="mx-auto size-10 text-muted-foreground" />
            <h3 className="mt-5 text-lg font-medium">
              {siteContent.ui.community.emptyTitle}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {siteContent.ui.community.emptyDescription}
            </p>
          </CardContent>
        </Card>
      </section>
    </Container>
  )
}
