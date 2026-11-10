import { useEffect, useState } from "react"
import { BookOpenIcon } from "lucide-react"
import { Link, useLocation } from "react-router"

import { ArticleCard } from "@/components/article/article-card"
import { Reveal } from "@/components/fx/reveal"
import { TiltCard } from "@/components/fx/tilt-card"
import { Container } from "@/components/layout/container"
import { StatusBar } from "@/components/layout/status-bar"
import { LyricsBar } from "@/components/profile/lyrics-bar"
import { MusicCard } from "@/components/profile/music-card"
import { ProfileHero } from "@/components/profile/profile-hero"
import { CardContent } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { pageNameOf, siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { posts } from "@/lib/posts"
import { staggerDelay } from "@/lib/reveal"

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/* 博客页：只负责「把几块内容摆上来」和入场动画。
   具体内容各有自己的组件：
     components/profile/profile-hero.tsx   头像 / 名字 / 统计 + 两个图标按钮
     components/profile/music-card.tsx     音乐占位卡
     components/profile/lyrics-bar.tsx     歌词横条
   本文件保留：左右两栏布局、轮播卡、「最新文章」列表、底部时间天气横条。 */
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
          <ProfileHero />
          <MusicCard />
        </div>

        {/* 歌词展示栏：只夹在「顶部卡片」与「轮播卡」之间 */}
        <LyricsBar />

        {/* 轮播状态卡：箭头定位到卡片外侧（负偏移），所以卡片本身要去掉 overflow-hidden
            让箭头露出来；轮播内容由 CarouselContent 自带的 overflow-hidden 兜住，不会溢出圆角。
            外层 Reveal 只负责滚动入场（延迟 200ms，排在两张顶部卡之后）。 */}
        <Reveal delay={200}>
          <TiltCard className="overflow-visible [--card-spacing:--spacing(7)] sm:[--card-spacing:--spacing(9)]">
            <Carousel opts={{ loop: true }}>
              <CarouselContent>
                {siteContent.profileSlides.map((slide) => (
                  <CarouselItem key={slide.eyebrow}>
                    <CardContent>
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
          </TiltCard>
        </Reveal>

        {/* 最新文章 */}
        <section aria-labelledby="latest-posts">
          <div className="mb-4 flex items-baseline justify-between px-1">
            <h2
              className="text-xl font-semibold tracking-tight"
              id="latest-posts"
            >
              {siteContent.ui.profile.latestPosts}
            </h2>
            <Link
              className="link-underline text-sm text-brand hover:text-brand-hover"
              to="/resources"
            >
              {siteContent.ui.profile.viewAll}
            </Link>
          </div>

          {posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post, index) => (
                <Reveal delay={staggerDelay(index)} key={post.slug}>
                  <ArticleCard post={post} />
                </Reveal>
              ))}
            </div>
          ) : (
            <TiltCard className="border-dashed py-10 text-center">
              <CardContent>
                <BookOpenIcon className="mx-auto size-8 text-muted-foreground" />
                <h3 className="mt-4 font-medium">
                  {siteContent.ui.resources.emptyResources}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {siteContent.ui.profile.emptyPostsHint}
                </p>
              </CardContent>
            </TiltCard>
          )}
        </section>

        {/* 时间天气横条 */}
        <StatusBar />
      </div>
    </Container>
  )
}
