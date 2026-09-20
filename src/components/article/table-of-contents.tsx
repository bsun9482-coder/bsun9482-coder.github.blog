import { ListTreeIcon } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { TableOfContentsItem } from "@/types/post"

type TableOfContentsProps = {
  items: TableOfContentsItem[]
}

export function TableOfContents({ items }: TableOfContentsProps) {
  if (items.length === 0) return null

  return (
    <nav aria-label="资料目录" className="rounded-xl border bg-card p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium">
        <ListTreeIcon className="size-4" />
        资料目录
      </p>
      <ScrollArea className="max-h-[calc(100vh-10rem)]">
        <ol className="space-y-1 pr-3 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item.id}>
              <a
                className={cn(
                  "block rounded-md px-2 py-1.5 transition-colors hover:bg-muted hover:text-foreground",
                  item.level === 3 && "pl-5"
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
