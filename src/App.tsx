import { useEffect } from "react"
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router"

import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
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

function SiteLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
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
