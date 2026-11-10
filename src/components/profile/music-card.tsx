import { PlayIcon } from "lucide-react"

import { TiltCard } from "@/components/fx/tilt-card"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { musicPlaylist, siteContent } from "@/config/site"

/* 博客页顶部那张「音乐卡」。
   目前 public/music/ 里没有音频、musicPlaylist 是空数组 ⇒ 只渲染占位形态：
   灰色圆盘 + 「暂无播放列表」+ 一个置灰的播放按钮。
   列表为空或第一首没有 src 时按钮置灰，不去假装能播。
   TODO: 接真实音频播放器（<audio> + 播放/暂停状态）。 */
export function MusicCard() {
  const firstTrack = musicPlaylist[0]
  const canPlay = Boolean(firstTrack?.src)

  return (
    <TiltCard>
      <CardContent className="flex h-full flex-col">
        <div className="flex items-center gap-4">
          <div className="size-16 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0">
            <span className="inline-block rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] tracking-tight text-muted-foreground">
              {siteContent.ui.musicCard.badge}
            </span>
            <p className="mt-1.5 truncate text-base font-semibold">
              {siteContent.ui.musicCard.emptyTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {siteContent.ui.musicCard.emptyHint}
            </p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-center pt-4">
          <Button
            aria-label={siteContent.ui.musicCard.play}
            className="size-12 rounded-full"
            disabled={!canPlay}
            size="icon"
          >
            <PlayIcon className="size-5" />
          </Button>
        </div>
      </CardContent>
    </TiltCard>
  )
}
