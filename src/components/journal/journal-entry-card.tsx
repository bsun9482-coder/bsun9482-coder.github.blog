import { journalMdxComponents } from "@/components/journal/journal-mdx-components"
import { Badge } from "@/components/ui/badge"
import {
  formatJournalDate,
  formatJournalWeekday,
  type JournalEntry,
} from "@/lib/journal"

/* 一则日记 = 时间线上的一个节点 + 一张轻卡片。
   卡片自己不做位移/hover 抬升（.card-lift 那套留给文章列表），
   只让边框与阴影微微变蓝 —— 日记是"翻看"的场景，不是"点进去"的入口。 */

type JournalEntryCardProps = {
  entry: JournalEntry
}

export function JournalEntryCard({ entry }: JournalEntryCardProps) {
  const { Content } = entry
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

      {/* 块间距只在这一层给：里面的 mdx 元素全部 my-0，避免两套间距叠加 */}
      <div className="mt-2.5 text-base [&>*+*]:mt-3">
        <Content components={journalMdxComponents} />
      </div>
    </article>
  )
}
