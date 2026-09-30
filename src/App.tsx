import { useEffect } from "react"
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router"

import { NeuralBackground } from "@/components/layout/neural-background"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { useEscapeBack } from "@/hooks/use-escape-back"
import { ArticlePage } from "@/pages/article-page"
import { CommunityPage } from "@/pages/community-page"
import { HomePage } from "@/pages/home-page"
import { NotFoundPage } from "@/pages/not-found-page"
import { ProfilePage } from "@/pages/profile-page"
import { ResourcesPage } from "@/pages/resources-page"
import { WorksPage } from "@/pages/works-page"

function ScrollManager() {
  const { hash, pathname } = useLocation()

  useEffect(() => {
    if (hash) {
      requestAnimationFrame(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView()
      })
      return
    }

    window.scrollTo({ top: 0 })
  }, [hash, pathname])

  return null
}

function EscapeToBack() {
  useEscapeBack()

  return null
}

/* 暗色赛博 AI 风格的固定背景，全部塞在这一层里（fixed / z-0 / pointer-events-none），
   前景内容由 SiteLayout 的 z-10 盖在上面。从下往上依次是：
   呼吸网格 → 三团漂移光斑 → 粒子画布 → （仅首页）扫描光带。 */
function SiteBackground() {
  const { pathname } = useLocation()
  /* 扫描光带只在首页出现，其余路由不挂 */
  const isHome = pathname === "/"

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="cyber-grid absolute inset-0" />
      <div className="cyber-blob cyber-blob-blue -top-40 -left-40" />
      <div className="cyber-blob cyber-blob-purple -right-40 -bottom-40" />
      {/* 第三团更小的紫光斑，居中偏下；用 left 计算而不是 -translate-x-1/2，
          因为 transform 已经被漂移动画占着，加了会被动画覆盖掉 */}
      <div className="cyber-blob cyber-blob-purple-soft bottom-24 left-[calc(50%-13rem)]" />
      <NeuralBackground />
      {isHome && (
        <div className="cyber-scan absolute inset-x-0 top-0 h-[200px]" />
      )}
    </div>
  )
}

function SiteLayout() {
  const { pathname } = useLocation()
  /* 首页是整屏吸附式落地页，最后一屏自己收尾 —— 不挂页脚，页面滚到底就是最后那一屏。
     其余路由（作品 / 资料 / 社区 / 关于 / 文章 / 404）照旧渲染 SiteFooter。 */
  const withFooter = pathname !== "/"

  return (
    <div className="relative z-10 flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      {withFooter && <SiteFooter />}
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <SiteBackground />
      <ScrollManager />
      <EscapeToBack />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route element={<HomePage />} path="/" />
          <Route element={<ProfilePage />} path="/profile" />
          <Route element={<WorksPage />} path="/works" />
          <Route element={<ResourcesPage />} path="/resources" />
          <Route element={<CommunityPage />} path="/community" />
          <Route element={<ArticlePage />} path="/resources/:slug" />
          <Route element={<NotFoundPage />} path="*" />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
