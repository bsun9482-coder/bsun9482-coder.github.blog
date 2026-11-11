import {
  BookOpen,
  FolderGit2,
  Images,
  NotebookPen,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { Link } from "react-router"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/* 首页那排功能入口卡。
   图标与配色按 href 匹配 —— 这里只放「表现」，文案在 config/site.ts 的
   ui.home.entries 里（那才是唯一来源）。
   ⚠️ 颜色类必须写成完整字符串：Tailwind 扫的是字面量，拼字符串拼不出规则。
   ⚠️ 五个入口用五个淡色方块，但都只是「淡底 + 同色系深图标」：
   实底彩色方块会把首屏变成色卡，和全站「只有一个强调蓝」的调子打架。 */
const ENTRY_LOOK: Record<string, { icon: LucideIcon; tile: string }> = {
  "/resources": { icon: BookOpen, tile: "bg-[#eff5ff] text-[#1d4ed8]" },
  "/works": { icon: FolderGit2, tile: "bg-[#f4f0ff] text-[#6d28d9]" },
  "/journal": { icon: NotebookPen, tile: "bg-[#eafaf3] text-[#047857]" },
  "/gallery": { icon: Images, tile: "bg-[#fff4e8] text-[#b45309]" },
  "/profile": { icon: UserRound, tile: "bg-[#fdf0f5] text-[#be185d]" },
}

/* 配置里新增了入口、这里还没配色时用中性灰兜底 —— 少了这条，新入口会连图标都没有 */
const FALLBACK_LOOK: { icon: LucideIcon; tile: string } = {
  icon: BookOpen,
  tile: "bg-secondary text-muted-foreground",
}

export function HomeEntryCard({
  href,
  label,
  description,
}: {
  href: string
  label: string
  description: string
}) {
  const look = ENTRY_LOOK[href] ?? FALLBACK_LOOK
  const Icon = look.icon

  return (
    /* 整卡可点：Card 自带 .card-lift（hover 上浮 4px + 阴影加深），
       减少动态时由 index.css 里的 media query 取消位移，这里不用另写。
       h-full 让同一行里说明文字长短不一的卡片高度一致。 */
    <Link
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      to={href}
    >
      <Card
        className="h-full gap-0 transition-colors group-hover:border-foreground/20"
        size="sm"
      >
        <CardContent className="flex h-full flex-col gap-3">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              look.tile
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {/* 说明固定占两行高：一行和两行的卡并排时，下面的留白不会一高一低 */}
          <span className="line-clamp-2 min-h-10 text-note leading-5 text-muted-foreground">
            {description}
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
