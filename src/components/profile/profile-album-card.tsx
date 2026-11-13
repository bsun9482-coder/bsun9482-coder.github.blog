import { ArrowUpRightIcon } from "lucide-react"
import { Link } from "react-router"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { siteContent } from "@/config/site"
import { usePhotos } from "@/hooks/use-photos"
import { fillTemplate } from "@/lib/text"

/* 右栏的相册入口卡：2×2 缩略图 + 整卡链接到 /album。

   为什么这张卡是唯一 flex-1 的：右栏被 grid 拉到和左栏一样高，
   富余高度总得有张卡吃掉。今日说说只有一句引言、实时信息只有两行数据，
   撑高它们只会让中间吊出一片空白；而相册卡撑高＝缩略图变大，是「越高越好看」的那张。
   ⚠️ 所以别再给「实时信息」加 flex-1，也别让左栏的卡加 —— 两处都实测过，
      会把行高撑到内容的两倍（见 profile-page.tsx 顶部说明）。

   图只用前 4 张（接口按排序号返回，前 4 张就是「最想让人先看到的 4 张」）：
   2×2 正好铺满，多一张就变成 3 列或出现半行。取不到 4 张时那格留白 ——
   留白比重复同一张图诚实。

   三种状态各有各的显示，别合并：
   · 读着 → 4 个骨架块。空着会让人以为「相册是空的」。
   · 读到了但没有图 → 虚线占位 +「还没有照片」。**不隐藏整张卡**（见 site.ts 那条注释）。
   · 读失败 → 也不隐藏，格子留空、张数显示「—」。这一栏是装饰性入口，
     为它弹一个错误条会把整页的注意力拽到一个次要卡片上。
   （第 43 轮起数据来自 /api/photos，和相册页同一个 hook：后台传了图，
     这张卡下一次进页面就跟着变，不会出现「页面是新的、卡是旧的」。） */
const PREVIEW_COUNT = 4
const SLOTS = Array.from({ length: PREVIEW_COUNT }, (_, index) => index)

export function ProfileAlbumCard() {
  const ui = siteContent.ui.profile
  const { state } = usePhotos()
  const photos = state.status === "ready" ? state.photos : []
  const preview = photos.slice(0, PREVIEW_COUNT)

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
            {/* 还没读到时显示「— 张」，别显示「0 张」—— 那是在说「相册空的」，
                而事实只是「还没回来」 */}
            {fillTemplate(ui.albumCount, {
              count: state.status === "ready" ? photos.length : "—",
            })}
          </span>
        </div>

        {/* min-h-0：flex 子项默认 min-height:auto，图片会把网格顶出去，
            右侧卡就跟着变高、两栏对不齐了。 */}
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
          {state.status === "loading" &&
            SLOTS.map((slot) => (
              <Skeleton className="h-full w-full rounded-md" key={slot} />
            ))}

          {state.status !== "loading" && preview.length === 0 && (
            /* 占满 2×2 的一格说明：比四个空格子更像「有意为之」 */
            <p className="col-span-2 row-span-2 grid place-items-center rounded-md border border-dashed border-border font-mono text-[11px] text-faint">
              {ui.albumEmptyHint}
            </p>
          )}

          {state.status !== "loading" &&
            preview.map((photo) => (
              <img
                alt={photo.title}
                className="h-full w-full rounded-md border border-border object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                decoding="async"
                key={photo.id}
                loading="lazy"
                src={photo.url}
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
