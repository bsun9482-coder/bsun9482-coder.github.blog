import { FileQuestionIcon } from "lucide-react"
import { Link } from "react-router"

import { TiltCard } from "@/components/fx/tilt-card"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { siteContent } from "@/config/site"
import { cn } from "@/lib/utils"

type NotFoundPageProps = {
  compact?: boolean
}

export function NotFoundPage({ compact = false }: NotFoundPageProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl items-center px-(--layout-gutter-sm) py-16 sm:px-(--layout-gutter)",
        !compact && "min-h-[65vh]"
      )}
    >
      <TiltCard className="w-full py-12 text-center">
        <CardContent>
          <FileQuestionIcon className="mx-auto mb-5 size-10 text-faint" />
          <p className="font-mono text-xs tracking-widest text-faint">404</p>
          <h1 className="mt-2 text-title font-semibold tracking-tight">
            {siteContent.ui.notFound.title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {siteContent.ui.notFound.description}
          </p>
          <Button asChild className="mt-6">
            <Link to="/">{siteContent.ui.notFound.backHome}</Link>
          </Button>
        </CardContent>
      </TiltCard>
    </div>
  )
}
