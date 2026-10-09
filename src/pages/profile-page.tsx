import {
  BookOpenIcon,
  ExternalLinkIcon,
  MapPinIcon,
  Music as MusicIcon,
  Music2Icon,
  PlayIcon,
} from "lucide-react"
import { Link } from "react-router"

import { ArticleCard } from "@/components/article/article-card"
import { Container } from "@/components/layout/container"
import { StatusBar } from "@/components/layout/status-bar"
import { PersonName } from "@/components/person-name"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { musicPlaylist, pageNameOf, siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { posts } from "@/lib/posts"

/* 音乐播放器占位卡 */
function MusicPlaceholderCard() {
  /* 点击播放 musicPlaylist 第一首；列表为空或 src 无效时置灰。
     TODO: 接真实音频播放器（<audio> + 播放/暂停状态），当前 musicPlaylist 为空，先静态展示。 */
  const firstTrack = musicPlaylist[0]
  const canPlay = Boolean(firstTrack?.src)

  return (
    <Card className="rounded-3xl">
      <CardContent className="flex h-full flex-col p-6">
        <div className="flex items-center gap-4">
          <div className="size-16 shrink-0 rounded-full bg-muted/60" />
          <div className="min-w-0">
            <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-primary">
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
            className="size-14 rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_color-mix(in_oklab,var(--glow-purple)_45%,transparent)] hover:bg-primary/90 hover:shadow-[0_0_32px_color-mix(in_oklab,var(--glow-purple)_60%,transparent)] disabled:shadow-none"
            disabled={!canPlay}
            size="icon"
          >
            <PlayIcon className="size-6" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* 歌词展示栏：夹在顶部卡片与轮播卡之间的一条深色胶囊。
   当前 musicPlaylist 为空、也还没有歌词数据，所以中间只展示占位文案。
   TODO(歌词): 接上真实歌词后在这里实现——
     ① 跟随音频播放进度逐行切换（拿 <audio> 的 currentTime 去匹配每行的时间戳）；
     ② 当前句高亮，并在句尾追加一个闪烁的打字光标；
     ③ 歌词数据来自 site.ts 的 musicPlaylist[].lyrics（字段位置见 MusicTrack 的 TODO）。 */
function LyricsBar() {
  return (
    <div
      aria-label={siteContent.ui.lyricsBar.regionLabel}
      className="flex items-center gap-4 rounded-2xl bg-slate-900/85 px-5 py-4 shadow-[0_8px_32px_color-mix(in_oklab,var(--glow-purple)_18%,transparent)] ring-1 ring-white/10 backdrop-blur-md"
      role="status"
    >
      {/* 左侧装饰：5 个小圆点 */}
      <span aria-hidden="true" className="flex shrink-0 items-center gap-1.5">
        {Array.from({ length: 5 }, (_, index) => (
          <span className="size-1.5 rounded-full bg-white/30" key={index} />
        ))}
      </span>

      {/* 中间：歌词文字。当前没有歌词 → 占位；未来在这里渲染「当前句 + 闪烁打字光标」 */}
      <p className="flex-1 text-center text-sm font-medium text-white/60">
        {siteContent.ui.lyricsBar.empty}
      </p>

      {/* 右侧：音乐图标 */}
      <MusicIcon aria-hidden="true" className="size-4 shrink-0 text-white/40" />
    </div>
  )
}

export function ProfilePage() {
  useDocumentTitle(pageNameOf("/profile"))

  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto max-w-none space-y-5">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            {/* 个人信息卡 */}
            <Card className="rounded-3xl">
              <CardContent className="flex h-full flex-col p-7 sm:p-9">
                <div className="flex items-start gap-6">
                  <Avatar className="size-20 shrink-0 ring-2 ring-primary/20">
                    <AvatarImage
                      alt={siteContent.person.name}
                      src={siteContent.person.avatarUrl}
                    />
                    <AvatarFallback className="text-3xl">
                      {siteContent.person.avatarInitial}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                      <PersonName />
                    </h1>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPinIcon className="size-4" />
                      {siteContent.person.location}
                    </p>
                    <p className="mt-4 text-base leading-7 text-muted-foreground">
                      {siteContent.person.introduction}
                    </p>
                  </div>
                </div>

                <div className="mt-auto flex items-end justify-between pt-8">
                  <div className="flex items-center gap-8 sm:gap-10">
                    <div>
                      <p className="text-3xl font-bold text-primary">{posts.length}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {siteContent.ui.profile.statArticles}
                      </p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-tag-pink">—</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {siteContent.ui.profile.statMoments}
                      </p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-destructive">—</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {siteContent.ui.profile.statPhotos}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* TODO: 外部链接入口（暂未定目标地址，先留空） */}
                    <Button
                      aria-label="外部链接"
                      className="size-10 rounded-full"
                      onClick={() => {
                        /* TODO: 跳转外部链接 */
                      }}
                      size="icon"
                      variant="ghost"
                    >
                      <ExternalLinkIcon className="size-4" />
                    </Button>
                    {/* TODO: 音乐入口（暂未接音乐页/播放器） */}
                    <Button
                      aria-label="音乐"
                      className="size-10 rounded-full"
                      onClick={() => {
                        /* TODO: 打开音乐 */
                      }}
                      size="icon"
                      variant="ghost"
                    >
                      <Music2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 音乐占位卡 */}
            <MusicPlaceholderCard />
          </div>

        {/* 歌词展示栏：只夹在「顶部卡片」与「轮播卡」之间 */}
        <LyricsBar />

        {/* 轮播状态卡：箭头定位到卡片外侧（负偏移），所以卡片本身要去掉 overflow-hidden
            让箭头露出来；轮播内容由 CarouselContent 自带的 overflow-hidden 兜住，不会溢出圆角。 */}
        <Card className="overflow-visible rounded-3xl">
          <Carousel opts={{ loop: true }}>
            <CarouselContent>
              {siteContent.profileSlides.map((slide) => (
                <CarouselItem key={slide.eyebrow}>
                  <CardContent className="p-7 sm:p-9">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
                      {slide.eyebrow}
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold">
                      {slide.title}
                    </h2>
                    <p className="mt-2 text-base leading-7 text-muted-foreground">
                      {slide.description}
                    </p>
                  </CardContent>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="-left-8" />
            <CarouselNext className="-right-8" />
          </Carousel>
        </Card>

        {/* 最新文章 */}
        <section aria-labelledby="latest-posts">
          <div className="mb-4 flex items-baseline justify-between px-1">
            <h2 className="text-xl font-semibold tracking-tight" id="latest-posts">
              最新文章
            </h2>
            <Link to="/resources" className="text-sm text-primary hover:underline">
              查看全部 →
            </Link>
          </div>

          {posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post, index) => (
                <div
                  className="animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards duration-500 motion-reduce:animate-none"
                  key={post.slug}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <ArticleCard post={post} />
                </div>
              ))}
            </div>
          ) : (
            <Card className="rounded-3xl border-dashed py-10 text-center">
              <CardContent>
                <BookOpenIcon className="mx-auto size-8 text-muted-foreground" />
                <h3 className="mt-4 font-medium">
                  {siteContent.ui.profile.emptyResources}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {siteContent.blog.latestResources}
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* 时间天气横条 */}
        <StatusBar />
      </div>
    </Container>
  )
}
