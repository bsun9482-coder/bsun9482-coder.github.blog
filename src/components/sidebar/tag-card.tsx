import { TagIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { siteContent } from "@/config/site"
import { getTagItems } from "@/lib/tags"
import { cn } from "@/lib/utils"

/* TODO: 后续接入标签筛选 —— 按标签过滤资料列表，或跳到 /resources?tag=<label>。
   当前只做展示，所以点击先留空（真接的时候这里要收 label 参数）。 */
function handleTagClick() {}

export function TagCard() {
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
          {tags.map((tag) => (
            <button
              className="flex w-full min-w-0 items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-sm text-muted-foreground transition-[background-color,border-color,box-shadow] hover:border-glow-blue/40 hover:bg-primary/10 hover:text-foreground hover:shadow-[0_0_10px_color-mix(in_oklab,var(--glow-blue)_25%,transparent)]"
              key={tag.label}
              onClick={handleTagClick}
              type="button"
            >
              <span
                aria-hidden="true"
                className={cn("h-2 w-2 shrink-0 rounded-sm", tag.dot)}
              />
              <span className="min-w-0">{tag.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
