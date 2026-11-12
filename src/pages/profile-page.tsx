import { Link, useLocation } from "react-router"

import { Reveal } from "@/components/fx/reveal"
import { TiltCard } from "@/components/fx/tilt-card"
import { Container } from "@/components/layout/container"
import { StatusBar } from "@/components/layout/status-bar"
import { MusicCard } from "@/components/profile/music-card"
import { PostCarousel } from "@/components/profile/post-carousel"
import { ProfileHero } from "@/components/profile/profile-hero"
import { CardContent } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { musicPlaylist, pageNameOf, siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useEnterTransition } from "@/hooks/use-enter-transition"
import { posts } from "@/lib/posts"
import { prefersReducedMotion } from "@/lib/reveal"
import { cn } from "@/lib/utils"

/* 博客页：只负责「把几块内容摆上来」和入场动画。
   具体内容各有自己的组件：
     components/profile/profile-hero.tsx   头像 / 名字 / 统计
     components/profile/music-card.tsx     音乐卡（曲目表为空时整张不渲染）
     components/profile/post-carousel.tsx  「最新文章」轮播
   本文件保留：左右两栏布局、状态轮播卡、底部时间天气横条。

   ⚠️ 这一页原来的「歌词条」已删除：它没有数据源，永远只能显示一句「暂无歌词」，
   属于空占位。等 musicPlaylist 里出现带歌词的曲目时，再按 MusicTrack 的 TODO 重新做。

   ⚠️ 空模块一律不渲染，而不是画一个「暂无」：
   曲目为空 ⇒ 顶部只剩资料卡（单栏撑满）、最新文章为空 ⇒ 整块不出现。 */
export function ProfilePage() {
  useDocumentTitle(pageNameOf("/profile"))

  /* 从首页「关于我」进来时带 fromHome 标记 ⇒ 播一次内容淡入上浮；
     其他入口（导航点「博客」/ 浏览器后退 / 直接开 /profile）不带标记 ⇒ 不播。
     双 rAF 的细节在 hooks/use-enter-transition.ts 里（与首页共用同一份）。 */
  const location = useLocation()
  const fromHome = location.state?.fromHome === true
  const entered = useEnterTransition(fromHome && !prefersReducedMotion())

  /* 有没有音乐决定顶栏是两栏还是一栏 —— 不靠 MusicCard 自己返回 null，
     否则 2fr/1fr 的网格会留一个空格子。 */
  const hasMusic = musicPlaylist.length > 0

  return (
    <Container
      className="flex flex-col gap-(--section-gap) py-10 sm:py-14"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 600ms ease 100ms, transform 600ms ease 100ms",
      }}
    >
      {/* 顶部资料卡（+ 音乐卡）：这两张是一个视觉块，内部间距保持 16px，
          不与区块间的 72px 混为一谈。 */}
      <div className={cn("grid gap-4", hasMusic && "lg:grid-cols-[2fr_1fr]")}>
        <ProfileHero />
        {hasMusic && <MusicCard />}
      </div>

      {/* 轮播状态卡：箭头定位到卡片外侧（负偏移），所以卡片本身要去掉 overflow-hidden
          让箭头露出来；轮播内容由 CarouselContent 自带的 overflow-hidden 兜住，不会溢出圆角。 */}
      <Reveal delay={120}>
        <TiltCard className="overflow-visible [--card-spacing:--spacing(7)] sm:[--card-spacing:--spacing(9)]">
          <Carousel opts={{ loop: true }}>
            <CarouselContent>
              {siteContent.profileSlides.map((slide) => (
                <CarouselItem key={slide.eyebrow}>
                  <CardContent>
                    <p className="font-mono text-xs tracking-[0.18em] text-faint uppercase">
                      {slide.eyebrow}
                    </p>
                    <h2 className="mt-3 text-title font-semibold tracking-tight">
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

      {/* 最新文章：没有文章时整块不渲染（不留「暂无文章」的卡）。
          卡片列表换成了轮播：一屏一篇、能自动播 / 箭头 / 点 / 键盘 / 手势切 —— 逻辑在
          components/profile/post-carousel.tsx 里，这里只给数据（posts 已按日期降序）。 */}
      {posts.length > 0 && (
        <section aria-labelledby="latest-posts" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2
              className="text-title font-semibold tracking-tight"
              id="latest-posts"
            >
              {siteContent.ui.profile.latestPosts}
            </h2>
            <Link
              className="link-underline text-sm whitespace-nowrap text-brand hover:text-brand-hover"
              to="/resources"
            >
              {siteContent.ui.profile.viewAll}
            </Link>
          </div>

          <Reveal delay={120}>
            <PostCarousel posts={posts} />
          </Reveal>
        </section>
      )}

      {/* 时间天气横条 */}
      <StatusBar />
    </Container>
  )
}
