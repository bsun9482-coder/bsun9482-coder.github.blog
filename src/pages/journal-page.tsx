import { NotebookPen } from "lucide-react"

import { Reveal } from "@/components/fx/reveal"
import { JournalEntryCard } from "@/components/journal/journal-entry-card"
import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
import { pageNameOf, siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { journalEntries } from "@/lib/journal"
import { staggerDelay } from "@/lib/reveal"

/* /journal：一页看完所有日记，不设详情路由。
   布局＝居中窄栏（680px）+ 左侧一条贯穿竖线 + 每则一个品牌色描边圆点。
   圆点在 li 里绝对定位，竖线在 ol 里绝对定位一次贯穿到底 ——
   不要给每条日记单独画一截线，条目多的时候接缝会露馅。
   没有日记时只留页头（不再画一张「还没有日记」的空卡）。 */

export function JournalPage() {
  useDocumentTitle(pageNameOf("/journal"))

  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <section className="mx-auto flex w-full max-w-[680px] flex-col gap-6">
        <div className="flex flex-col gap-3">
          <PageHeader
            icon={NotebookPen}
            subtitle={siteContent.ui.journal.subtitle}
            title={pageNameOf("/journal")}
          />
          {journalEntries.length > 0 && (
            <p className="font-mono text-xs text-faint tabular-nums">
              {journalEntries.length} {siteContent.ui.journal.countSuffix}
            </p>
          )}
        </div>

        {journalEntries.length > 0 && (
          <ol className="relative">
            {/* 竖线：从第一颗圆点上方一点，到最后一条下方一点 */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-4 bottom-4 left-[7px] w-px bg-border"
            />
            {journalEntries.map((entry, index) => (
              <li className="relative pb-5 pl-9 last:pb-0" key={entry.slug}>
                {/* 圆点：15px + 2px 品牌蓝描边，中心落在竖线上（left 7px + 半线宽） */}
                <span
                  aria-hidden="true"
                  className="absolute top-[18px] left-0 size-[15px] rounded-full border-2 border-brand bg-background"
                />
                {/* 入场放在包壳上：卡片自身有 hover 过渡，两套 transition 会互相覆盖 */}
                <Reveal delay={staggerDelay(index)}>
                  <JournalEntryCard entry={entry} />
                </Reveal>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Container>
  )
}
