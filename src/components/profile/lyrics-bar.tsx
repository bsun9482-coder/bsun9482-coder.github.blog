import { Music as MusicIcon } from "lucide-react"

import { siteContent } from "@/config/site"

/* 博客页的「歌词展示栏」：夹在顶部两张卡与轮播卡之间的一条细横条。
   极简风下不用深色胶囊 —— 白底 + 1px 描边 + 等宽小字，和正文区一个调子。
   当前 musicPlaylist 为空、也还没有歌词数据，所以中间只展示占位文案。
   TODO(歌词): 接上真实歌词后在这里实现——
     ① 跟随音频播放进度逐行切换（拿 <audio> 的 currentTime 去匹配每行的时间戳）；
     ② 当前句高亮，并在句尾追加一个闪烁的打字光标；
     ③ 歌词数据来自 site.ts 的 musicPlaylist[].lyrics（字段位置见 MusicTrack 的 TODO）。 */
export function LyricsBar() {
  return (
    <div
      aria-label={siteContent.ui.lyricsBar.regionLabel}
      className="flex items-center gap-4 rounded-xl border border-border bg-muted/60 px-4 py-3"
      role="status"
    >
      {/* 左侧装饰：5 个小圆点 */}
      <span aria-hidden="true" className="flex shrink-0 items-center gap-1.5">
        {Array.from({ length: 5 }, (_, index) => (
          <span className="size-1.5 rounded-full bg-faint/50" key={index} />
        ))}
      </span>

      {/* 中间：歌词文字。当前没有歌词 → 占位；未来在这里渲染「当前句 + 闪烁打字光标」 */}
      <p className="flex-1 truncate text-center font-mono text-xs text-muted-foreground">
        {siteContent.ui.lyricsBar.empty}
      </p>

      {/* 右侧：音乐图标 */}
      <MusicIcon aria-hidden="true" className="size-4 shrink-0 text-faint" />
    </div>
  )
}
