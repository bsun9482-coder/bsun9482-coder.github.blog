import { useEffect, useState } from "react"
import {
  BookOpenIcon,
  ExternalLinkIcon,
  MapPinIcon,
  Music as MusicIcon,
  Music2Icon,
  PlayIcon,
} from "lucide-react"
import { Link, useLocation } from "react-router"

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
    <Card>
      <CardContent className="flex h-full flex-col p-6">
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
    </Card>
  )
}

/* 歌词展示栏：夹在顶部卡片与轮播卡之间的一条细横条。
   极简风下不再用深色胶囊 —— 白底 + 1px 描边 + 等宽小字，和正文区一个调子。
   当前 musicPlaylist 为空、也还没有歌词数据，所以中间只展示占位文案。
   TODO(歌词): 接上真实歌词后在这里实现——
     ① 跟随音频播放进度逐行切换（拿 <audio> 的 currentTime 去匹配每行的时间戳）；
     ② 当前句高亮，并在句尾追加一个闪烁的打字光标；
     ③ 歌词数据来自 site.ts 的 musicPlaylist[].lyrics（字段位置见 MusicTrack 的 TODO）。 */
function LyricsBar() {
  return (
    <div
      aria-label={siteContent.ui.lyricsBar.regionLabel}
      className="flex items-center gap-4 rounded-[10px] border border-border bg-muted/60 px-4 py-3"
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

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function ProfilePage() {
  useDocumentTitle(pageNameOf("/profile"))

  /* 从首页「下滑翻页」进来时带上 fromHome 标记 ⇒ 播一次内容淡入上浮；
     其他入口（导航点「博客」/ 浏览器后退 / 直接开 /profile）不带标记 ⇒ 不播。
     reduced-motion 下也跳过。
     ⚠️ 原来的「黑幕淡出」已删除：白底站点上闪一层黑幕非常突兀，
     入场只保留内容层的 opacity + translateY（时长沿用原来的 600ms / 100ms 延迟）。 */
  const location = useLocation()
  const animate = location.state?.fromHome === true && !prefersReducedMotion()
  /* 不播时直接初始为「已进入」，内容正常显示 */
  const [entered, setEntered] = useState(!animate)

  useEffect(() => {
    if (!animate || entered) return

    /* 双 rAF：先以隐藏态画首帧，再翻到进入态 —— 否则状态变更会和首帧合并成同一次绘制，
       过渡被吃掉（与首页入场同款写法）。 */
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true))
    })

    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [animate, entered])

  return (
    <Container
      className="py-10 sm:py-16"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 600ms ease 100ms, transform 600ms ease 100ms",
      }}
    >
      <div className="mx-auto max-w-none space-y-5">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          {/* 个人信息卡 */}
          <Card>
            <CardContent className="flex h-full flex-col p-7 sm:p-9">
              <div className="flex items-start gap-6">
                <Avatar className="size-20 shrink-0 ring-1 ring-border">
                  <AvatarImage
                    alt={siteContent.person.name}
                    src={siteContent.person.avatarUrl}
                  />
                  <AvatarFallback className="text-3xl">
                    {siteContent.person.avatarInitial}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
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
                    <p className="font-mono text-3xl font-semibold tabular-nums">
                      {posts.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {siteContent.ui.profile.statArticles}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-3xl font-semibold text-muted-foreground tabular-nums">
                      —
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {siteContent.ui.profile.statMoments}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-3xl font-semibold text-muted-foreground tabular-nums">
                      —
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {siteContent.ui.profile.statPhotos}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* TODO: 外部链接入口（暂未定目标地址，先留空） */}
                  <Button
                    aria-label="外部链接"
                    className="size-10"
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
                    className="size-10"
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
        <Card className="overflow-visible">
          <Carousel opts={{ loop: true }}>
            <CarouselContent>
              {siteContent.profileSlides.map((slide) => (
                <CarouselItem key={slide.eyebrow}>
                  <CardContent className="p-7 sm:p-9">
                    <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
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
            {/* 箭头在卡片外侧：偏移量随容器内边距收放。
                手机屏幕太窄，任何"外侧"位置都会压住文字或顶出视口 —— 直接隐藏，靠手势滑动。 */}
            <CarouselPrevious className="-left-2 hidden sm:-left-4 sm:flex lg:-left-8" />
            <CarouselNext className="-right-2 hidden sm:-right-4 sm:flex lg:-right-8" />
          </Carousel>
        </Card>

        {/* 最新文章 */}
        <section aria-labelledby="latest-posts">
          <div className="mb-4 flex items-baseline justify-between px-1">
            <h2
              className="text-xl font-semibold tracking-tight"
              id="latest-posts"
            >
              最新文章
            </h2>
            <Link
              className="link-underline text-sm text-brand hover:text-brand-hover"
              to="/resources"
            >
              查看全部 →
            </Link>
          </div>

          {posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post, index) => (
                <div
                  className="animate-in duration-500 fill-mode-backwards fade-in slide-in-from-bottom-3 motion-reduce:animate-none"
                  key={post.slug}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <ArticleCard post={post} />
                </div>
              ))}
            </div>
          ) : (
            <Card className="border-dashed py-10 text-center">
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
