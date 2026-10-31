import { ListTreeIcon } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { siteContent } from "@/config/site"
import { cn } from "@/lib/utils"
import type { TableOfContentsItem } from "@/types/post"

type TableOfContentsProps = {
  items: TableOfContentsItem[]
}

export function TableOfContents({ items }: TableOfContentsProps) {
  if (items.length === 0) return null

  return (
    <nav
      aria-label={siteContent.ui.article.tocTitle}
      className="rounded-[10px] border border-border p-4"
    >
      <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-wide text-faint uppercase">
        <ListTreeIcon className="size-3.5" />
        {siteContent.ui.article.tocTitle}
      </p>
      <ScrollArea className="max-h-[calc(100vh-10rem)]">
        <ol className="space-y-0.5 border-l border-border pr-3 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item.id}>
              <a
                className={cn(
                  "-ml-px block border-l border-transparent px-3 py-1.5 transition-colors hover:border-foreground/30 hover:text-foreground",
                  item.level === 3 && "pl-6"
                )}
                href={`#${item.id}`}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ol>
      </ScrollArea>
    </nav>
  )
}
