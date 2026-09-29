import { TagIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { siteContent } from "@/config/site"
import { getTagItems } from "@/lib/tags"
import { cn } from "@/lib/utils"

type TagCardProps = {
  /* 当前选中的标签，null = 不筛（显示全部） */
  selectedTag: string | null
  /* 点未选中的标签 → 传该标签；点已选中的标签 → 传 null（取消选中） */
  onSelectTag: (tag: string | null) => void
}

export function TagCard({ selectedTag, onSelectTag }: TagCardProps) {
  const tags = getTagItems()

  /* 没有文章、或所有文章都没打过标签时，整张卡片不渲染 ——
     不占位、也不显示"暂无标签"的空态。 */
  if (tags.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TagIcon className="size-4 text-muted-foreground" />
          {siteContent.ui.sidebar.tagsTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 两列；窄屏（< sm）在左侧栏里放不下两列时由外层 aside 的宽度决定，实测无换行 */}
        <div className="grid grid-cols-2 gap-2">
          {tags.map((tag) => {
            const isSelected = tag.label === selectedTag

            return (
              <button
                aria-pressed={isSelected}
                /* 选中 / 未选中各是一套完整类名，不做拼接（Tailwind 只认源码里的字面量）。
                   选中：glow-blue 实色描边 + primary/20 底 + foreground 字 + 外发光；
                   未选中：沿用原来的边框与 hover 高亮。 */
                className={cn(
                  "flex w-full min-w-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-[background-color,border-color,box-shadow,color]",
                  isSelected
                    ? "border-glow-blue bg-primary/20 text-foreground shadow-[0_0_12px_color-mix(in_oklab,var(--glow-blue)_45%,transparent)]"
                    : "border-border/60 text-muted-foreground hover:border-glow-blue/40 hover:bg-primary/10 hover:text-foreground hover:shadow-[0_0_10px_color-mix(in_oklab,var(--glow-blue)_25%,transparent)]"
                )}
                key={tag.label}
                onClick={() => onSelectTag(isSelected ? null : tag.label)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn("h-2 w-2 shrink-0 rounded-sm", tag.dot)}
                />
                <span className="min-w-0">{tag.label}</span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
