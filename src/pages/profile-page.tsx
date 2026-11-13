import { useMemo } from "react"
import { useLocation } from "react-router"

import { Container } from "@/components/layout/container"
import { ProfileAside } from "@/components/profile/profile-aside"
import {
  ProfilePostsSkeleton,
  TagCloudCard,
} from "@/components/profile/profile-article"
import { FeaturedPostCarousel } from "@/components/profile/profile-carousel"
import { ProfileHero } from "@/components/profile/profile-hero"
import { ProfileStatusCard } from "@/components/profile/profile-status-card"
import { pageNameOf, siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useEnterTransition } from "@/hooks/use-enter-transition"
import { usePosts } from "@/hooks/use-posts"
import { prefersReducedMotion } from "@/lib/reveal"
import type { Post } from "@/types/post"

/* 博客页（/profile）：通栏 hero + 左右两栏。

   布局只有三层，改版时先看这里再往下读组件：
     1. <ProfileHero>            通栏：头像 / 名字 / 简介 / 开放工作机会 / 时钟
     2. 两栏 grid                左 1fr、右 300px、间距 20px，左右等高（items-stretch）
     3. 左栏轮播 + 状态 + 标签    右栏说说 + 相册 + 实时（文章区没有区块标题、没有「查看全部」）

   为什么左右两栏各自是一个 flex 纵向容器，而不是让所有卡片直接进 grid：
   卡片高度该由内容决定（一张两行字的卡不该被拉成半屏高）。
   等高靠 grid 的 align-items: stretch 把两栏拉齐，而富余高度**只交给一张卡**：
     · 右栏 → 相册入口卡 flex-1（缩略图跟着变大，是唯一越撑越好看的卡）
     · 左栏 → 三张卡全是自然高度（轮播 / 此刻状态 / 标签云）
   ⚠️ 一组里出现两个 flex-1 会互相撑，行高直接翻倍（第 40、41 轮各踩过一次：
      5 篇时行高 1307px）。所以左栏全程不加 flex-1。

   第 41 轮：左栏「精选大卡 + 逐行列表」换成 <FeaturedPostCarousel>（所有文章都是 slides）。
   第 42 轮：此刻状态卡从右栏挪到左栏（轮播下面）；右栏变成 说说 / 相册 / 实时。

   断点取 880px 而不是 lg(1024)：右栏固定 300px，视口再窄一点
   左栏就只剩 500 出头，标题和元信息会挤成两行叠三行。880 是「左栏还有 500」
   的那条线，比 680 的单列下限留了余量。 */

/* 稳定的空数组：加载中/失败时用它占位。
   如果写成 `state.status === "ready" ? state.posts : []`，
   每次渲染都是新引用，下面 useMemo 的依赖次次失效，等于没缓存。 */
const EMPTY_POSTS: Post[] = []

export function ProfilePage() {
  useDocumentTitle(pageNameOf("/profile"))

  /* 从首页「关于我」进来时带 fromHome 标记 ⇒ 播一次内容淡入上浮；
     其他入口（导航点「博客」/ 浏览器后退 / 直接开 /profile）不带标记 ⇒ 不播。
     双 rAF 的细节在 hooks/use-enter-transition.ts 里（与首页共用同一份）。 */
  const location = useLocation()
  const fromHome = location.state?.fromHome === true
  const entered = useEnterTransition(fromHome && !prefersReducedMotion())

  /* 文章来自 GET /api/posts，和 /resources 同一个来源 —— 后台一发文章，
     这一页刷新就能看到。 */
  const { state } = usePosts()
  const posts = state.status === "ready" ? state.posts : EMPTY_POSTS

  /* 标签云：出现次数多的在前，次数相同按字典序 —— 保证顺序稳定。
     不排序的话，Map 的插入顺序跟着文章返回顺序走，后台改一篇文章的标签，
     整片云的排列就会莫名其妙地变。 */
  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const post of posts) {
      for (const tag of post.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
      .map(([tag, count]) => ({ tag, count }))
  }, [posts])

  return (
    <Container
      className="flex flex-col gap-5 py-10 sm:py-14"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 600ms ease 100ms, transform 600ms ease 100ms",
      }}
    >
      {/* 文章数也走接口：加载中传 null（hero 里显示短横线），拿到后才是真数字。 */}
      <ProfileHero
        articleCount={state.status === "ready" ? posts.length : null}
      />

      <div className="grid items-stretch gap-5 min-[880px]:grid-cols-[minmax(0,1fr)_300px]">
        {/* ---------- 左栏：文章 ---------- */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* 三种中间状态分开写，因为处理方式不一样：
              加载中占位、失败说一句、有数据就画卡。
              「加载中」用骨架而不是一行小字 —— 这一块在页面里占一大片，
              先给个空行的话，数据一到整页会跳一下。 */}
          {state.status === "loading" && <ProfilePostsSkeleton />}

          {state.status === "error" && (
            <p className="text-sm text-muted-foreground" role="alert">
              {siteContent.ui.profile.postsLoadFailed}
            </p>
          )}

          {/* 所有文章都进轮播，不再在下面重复列一遍。 */}
          {posts.length > 0 && <FeaturedPostCarousel posts={posts} />}

          {/* 此刻状态：第 42 轮从右栏挪过来的，放轮播下面当「最近在干什么」的补充。 */}
          <ProfileStatusCard />

          {/* 标签云保持自然高度 —— 富余高度归右栏的相册卡。 */}
          {tags.length > 0 && <TagCloudCard tags={tags} />}
        </div>

        {/* ---------- 右栏：今日说说 / 此刻状态 / 实时信息 ---------- */}
        <div className="flex min-w-0 flex-col gap-5">
          <ProfileAside />
        </div>
      </div>
    </Container>
  )
}
