import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDownIcon, ListTreeIcon } from "lucide-react"

import { siteContent } from "@/config/site"
import { groupIdOf, groupTocItems } from "@/lib/toc"
import { cn } from "@/lib/utils"
import type { TableOfContentsItem } from "@/types/post"

type TableOfContentsProps = {
  items: TableOfContentsItem[]
  title?: string
}

/* 左栏目录：顶部「当前教程 + 文章标题」，下面按章分组，可折叠，滚动时高亮当前章/节。
   - 高亮用 scroll 监听（passive + rAF 合并），不用 IntersectionObserver：
     目录要的是「视口顶部往上最近的那个标题」，observer 只能告诉你谁进来了。
   - 展开跟着高亮走：跨章时才把 open 重置成「当前章」，不在同一章里反复覆盖，
     这样用户在这一章里手动多开一章不会被立刻收回。 */
export function TableOfContents({ items, title }: TableOfContentsProps) {
  const groups = useMemo(() => groupTocItems(items), [items])
  const [active, setActive] = useState(items[0]?.id ?? "")
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set<string>())
  const ticking = useRef(false)
  const lastGroup = useRef("")
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    /* ⚠️ 正文是按需加载的独立 chunk，首帧时标题还没进 DOM。
       所以标题列表不能只在 effect 开头算一次 —— 那样会算出空数组、直接放弃，
       正文加载完之后再也没人把滚动监听接上（表现为高亮永远停在第一章、章节也不展开）。
       改成「用到时再解析，解析成功就缓存」。 */
    let headings: { id: string; el: HTMLElement }[] = []

    const resolveHeadings = () => {
      if (headings.length > 0) return headings
      headings = items
        .map((item) => ({ id: item.id, el: document.getElementById(item.id) }))
        .filter(
          (entry): entry is { id: string; el: HTMLElement } => entry.el !== null
        )
      return headings
    }

    const update = () => {
      ticking.current = false

      const resolved = resolveHeadings()
      if (resolved.length === 0) return

      /* 标题滚过 140px（大概在 sticky 头部下沿）就算「已到达」。 */
      let current = resolved[0].id
      for (const heading of resolved) {
        if (heading.el.getBoundingClientRect().top - 140 <= 0)
          current = heading.id
        else break
      }

      setActive(current)

      const groupId = groupIdOf(groups, current)
      if (groupId && groupId !== lastGroup.current) {
        lastGroup.current = groupId
        setOpen(new Set([groupId]))
      }
    }

    const schedule = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(update)
    }

    schedule()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)

    /* 正文 chunk 落地的那一刻补算一次，补完立刻断开，不留长驻观察者。 */
    const observer = new MutationObserver(() => {
      if (resolveHeadings().length === 0) return
      observer.disconnect()
      schedule()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [groups, items])

  /* 目录本身比可视区高，当前高亮要一直留在可视区内。
     只在**目录自己的滚动容器**里挪 scrollTop —— 别用 scrollIntoView：
     它会连 window 一起滚，跟外面的 scroll 监听互相点火。
     滚动目标取「章」而不是「节」：只把节滚进来时，它的章标题会被推出去，
     看起来像高亮停在一个没有归属的条目上。 */
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const link = [...scroller.querySelectorAll("a")].find(
      (anchor) => anchor.getAttribute("href") === `#${active}`
    )
    if (!link) return

    const item = link.closest("li")
    /* 节的 <li> 外面还套着该章的 <li>，往上找一层就是章。 */
    const target = item?.parentElement?.closest("li") ?? item
    if (!target) return

    const targetRect = target.getBoundingClientRect()
    const boxRect = scroller.getBoundingClientRect()
    if (targetRect.top < boxRect.top) {
      scroller.scrollTop -= boxRect.top - targetRect.top + 8
    } else if (targetRect.bottom > boxRect.bottom) {
      scroller.scrollTop += targetRect.bottom - boxRect.bottom + 8
    }
  }, [active, open])

  if (items.length === 0) return null

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <nav
      aria-label={siteContent.ui.article.tocTitle}
      className="rounded-[10px] border border-border p-4"
    >
      <p className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-faint uppercase">
        <ListTreeIcon className="size-3.5" />
        {siteContent.ui.article.tocKicker}
      </p>
      {title ? (
        <p className="mt-2 line-clamp-2 text-sm leading-6 font-medium text-foreground">
          {title}
        </p>
      ) : null}

      {/* 不用 ScrollArea：它只给 max-h 时内部视口会按内容高度撑开、被外层裁掉，
          scrollTop 改不动（实测 scrollHeight === clientHeight === 5658），
          章节一多下面几章就点不到了。普通 overflow-y-auto 才真的能滚。
          全站已隐藏滚动条，所以视觉上仍然是干净的。 */}
      <div
        ref={scrollerRef}
        className="mt-4 max-h-[calc(100vh-16rem)] overflow-y-auto overscroll-contain pr-1"
      >
        <ol className="space-y-0.5 text-sm text-muted-foreground">
          {groups.map((group) => {
            const hasChildren = group.children.length > 0
            const isOpen = open.has(group.id)
            const chapterActive = active === group.id
            const inside = group.children.some((child) => child.id === active)

            return (
              <li key={group.id}>
                <div className="flex items-start gap-1">
                  <a
                    className={cn(
                      "-ml-px block flex-1 rounded-r-[4px] border-l border-transparent py-1.5 pr-1 pl-3 leading-6 transition-colors hover:border-foreground/30 hover:text-foreground",
                      (chapterActive || inside) &&
                        "border-brand font-medium text-foreground"
                    )}
                    href={`#${group.id}`}
                  >
                    {group.title}
                  </a>
                  {hasChildren ? (
                    <button
                      aria-expanded={isOpen}
                      aria-label={group.title}
                      className="mt-1 shrink-0 rounded-[4px] p-1 text-faint transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => toggle(group.id)}
                      type="button"
                    >
                      <ChevronDownIcon
                        className={cn(
                          "size-3.5 transition-transform duration-200",
                          isOpen && "rotate-180"
                        )}
                      />
                    </button>
                  ) : null}
                </div>

                {hasChildren && isOpen ? (
                  <ol className="mt-0.5 mb-1 space-y-0.5 border-l border-border pl-3 text-[13px]">
                    {group.children.map((child) => (
                      <li key={child.id}>
                        <a
                          className={cn(
                            "block rounded-[4px] px-2 py-1 leading-5 transition-colors hover:bg-muted hover:text-foreground",
                            active === child.id &&
                              "bg-muted font-medium text-foreground"
                          )}
                          href={`#${child.id}`}
                        >
                          {child.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
