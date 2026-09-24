import { Separator } from "@/components/ui/separator"
import { siteContent } from "@/config/site"

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
      <Separator />
      <div className="flex flex-col gap-2 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>{siteContent.ui.footer.tagline}</p>
        <p>{siteContent.ui.footer.subtitle}</p>
      </div>
    </footer>
  )
}
