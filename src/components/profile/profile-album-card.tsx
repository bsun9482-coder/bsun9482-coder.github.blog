import { ArrowUpRightIcon } from "lucide-react"
import { Link } from "react-router"

import { Card, CardContent } from "@/components/ui/card"
import { siteContent } from "@/config/site"
import { albumImages } from "@/lib/album"
import { fillTemplate } from "@/lib/text"

/* 右栏的相册入口卡：2×2 缩略图 + 整卡链接到 /album。

   为什么这张卡是唯一 flex-1 的：右栏被 grid 拉到和左栏一样高，
   富余高度总得有张卡吃掉。今日说说只有一句引言、实时信息只有两行数据，
   撑高它们只会让中间吊出一片空白；而相册卡撑高＝缩略图变大，是「越高越好看」的那张。
   ⚠️ 所以别再给「实时信息」加 flex-1，也别让左栏的卡加 —— 两处都实测过，
      会把行高撑到内容的两倍（见 profile-page.tsx 顶部说明）。

   图只用前 4 张：2×2 正好铺满，多一张就变成 3 列或出现半行。
   取不到 4 张时那格就空着 —— 留白比重复同一张图诚实。 */
const PREVIEW_COUNT = 4

export function ProfileAlbumCard() {
  const ui = siteContent.ui.profile
  const preview = albumImages.slice(0, PREVIEW_COUNT)

  return (
    <Card className="group relative flex flex-1 flex-col">
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
            {/* 链接挂在文字上、用 after 铺满整卡：键盘能 Tab 到，
                中键能新开标签页，比给卡片挂 onClick 规矩。 */}
            <Link
              className="transition-colors outline-none group-hover:text-brand after:absolute after:inset-0 focus-visible:underline"
              to="/album"
            >
              {ui.albumLabel}
            </Link>
            <span className="sr-only">（{ui.albumOpen}）</span>
          </p>
          <span className="font-mono text-[11px] text-faint tabular-nums">
            {fillTemplate(ui.albumCount, { count: albumImages.length })}
          </span>
        </div>

        {/* min-h-0：flex 子项默认 min-height:auto，图片会把网格顶出去，
            右侧卡就跟着变高、两栏对不齐了。 */}
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
          {preview.map((image) => (
            <img
              alt={image.cap}
              className="h-full w-full rounded-md border border-border object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              decoding="async"
              key={image.id}
              loading="lazy"
              src={image.thumb}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 font-mono text-[11px] text-faint">
          <span className="truncate">{ui.albumOpen}</span>
          <ArrowUpRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 transition group-hover:text-brand motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-reduce:transition-none"
          />
        </div>
      </CardContent>
    </Card>
  )
}
