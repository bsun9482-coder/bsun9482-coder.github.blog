import { PlayIcon } from "lucide-react"

import { TiltCard } from "@/components/fx/tilt-card"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { musicPlaylist, siteContent } from "@/config/site"

/* 博客页那张「音乐卡」。
   ⚠️ 曲目表为空时**整张卡不渲染** —— 以前这里画一个灰圆盘 + 「暂无播放列表」，
   那是纯占位；现在没有内容就不摆出来，等 public/music/ 里真有 mp3、site.ts 里补了
   曲目，它才会出现（那时也不用再改这个文件）。
   TODO: 接真实音频播放器（<audio> + 播放/暂停状态）。 */
export function MusicCard() {
  const firstTrack = musicPlaylist[0]
  if (!firstTrack) return null

  return (
    <TiltCard className="h-full">
      <CardContent className="flex h-full flex-col">
        <div className="flex items-center gap-4">
          <div className="size-16 shrink-0 rounded-full bg-secondary" />
          <div className="min-w-0">
            <span className="inline-block rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs tracking-tight text-muted-foreground">
              {siteContent.ui.musicCard.badge}
            </span>
            <p className="mt-1.5 truncate text-base font-semibold">
              {firstTrack.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {firstTrack.artist}
            </p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-center pt-4">
          {/* 还没有接播放器：按钮存在但不可用，等 <audio> 接上再放开 */}
          <Button
            aria-label={siteContent.ui.musicCard.play}
            className="size-12 rounded-full"
            disabled
            size="icon"
          >
            <PlayIcon className="size-5" />
          </Button>
        </div>
      </CardContent>
    </TiltCard>
  )
}
