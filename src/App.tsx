import { useEffect } from "react"
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router"

import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { useEscapeToHome } from "@/hooks/use-escape-to-home"
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

function EscapeToHome() {
  useEscapeToHome()

  return null
}

function SiteLayout() {
  const { pathname } = useLocation()
  /* 首页是整屏吸附式落地页，最后一屏自己收尾 —— 不挂页脚，页面滚到底就是最后那一屏。
     其余路由（作品 / 资料 / 社区 / 关于 / 文章 / 404）照旧渲染 SiteFooter。 */
  const withFooter = pathname !== "/"

  return (
    <div className="flex min-h-svh flex-col">
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
      <ScrollManager />
      <EscapeToHome />
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
