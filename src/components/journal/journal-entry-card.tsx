import { JournalBody } from "@/components/journal/journal-body"
import { Badge } from "@/components/ui/badge"
import { formatJournalDate, formatJournalWeekday } from "@/lib/journal-date"
import type { Journal } from "@/types/journal"

/* 一则日记 = 时间线上的一个节点 + 一张轻卡片。
   卡片自己不做位移/hover 抬升（.card-lift 那套留给文章列表），
   只让边框与阴影微微变蓝 —— 日记是"翻看"的场景，不是"点进去"的入口。

   数据从哪来：以前 entry.Content 是构建期编译好的 MDX 组件，
   现在 entry.content 是一段纯文本（来自 GET /api/journals），交给 JournalBody 分段。
   这也是为什么这个组件不再 import journal-mdx-components —— 那套映射是给 MDX 用的。 */

type JournalEntryCardProps = {
  entry: Journal
}

export function JournalEntryCard({ entry }: JournalEntryCardProps) {
  const weekday = formatJournalWeekday(entry.date)

  return (
    <article className="rounded-xl border border-border bg-card px-4 py-4 transition-[border-color,box-shadow] duration-200 hover:border-brand/45 hover:shadow-[0_8px_24px_color-mix(in_srgb,var(--brand)_8%,transparent)] motion-reduce:transition-none sm:px-5">
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <time
          className="font-mono text-xs tracking-tight text-faint tabular-nums"
          dateTime={entry.date}
        >
          {formatJournalDate(entry.date)}
        </time>
        {weekday && (
          <span className="font-mono text-xs text-faint">{weekday}</span>
        )}
        {entry.mood && (
          <Badge
            className="border-brand/25 bg-brand/10 text-brand"
            variant="ghost"
          >
            {entry.mood}
          </Badge>
        )}
      </header>

      {/* 块间距只在这一层给：里面的段落全部 no margin，避免两套间距叠加 */}
      <div className="mt-2.5 text-base [&>*+*]:mt-3">
        <JournalBody content={entry.content} />
      </div>
    </article>
  )
}
