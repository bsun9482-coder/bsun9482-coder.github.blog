import { Suspense, lazy, useEffect } from "react"
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router"

import { SiteAmbience } from "@/components/layout/site-ambience"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { ScrollProgress } from "@/components/layout/scroll-progress"
import { ErrorBoundary } from "@/components/system/error-boundary"
import { PageLoading } from "@/components/system/page-loading"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useEscapeBack } from "@/hooks/use-escape-back"
import { HomePage } from "@/pages/home-page"
import { GalleryPage } from "@/pages/gallery-page"
import { JournalPage } from "@/pages/journal-page"
import { NotFoundPage } from "@/pages/not-found-page"
import { ProfilePage } from "@/pages/profile-page"
import { ResourcesPage } from "@/pages/resources-page"

/* 两个页面按需下载：文章详情（带整篇 MDX 正文与目录解析）和项目页。
   为什么值得拆：主包会被「进站第一屏根本用不到的代码」撑大，而首屏只认
   下载速度。拆出去之后，进站不点文章就不下载这些。
   ⚠️ 拆包的代价是「chunk 没下载下来就白屏」，所以外面必须有 ErrorBoundary
   （见 SiteLayout）—— 这两件事要一起做，单做前者只会把风险放大。 */
const ArticlePage = lazy(() =>
  import("@/pages/article-page").then((m) => ({ default: m.ArticlePage }))
)
const WorksPage = lazy(() =>
  import("@/pages/works-page").then((m) => ({ default: m.WorksPage }))
)

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

/* 404 也要有页面标题：直接用 <NotFoundPage /> 当路由元素的话，
   这个页面组件本身不设标题（它还有个嵌在文章页里的 compact 用法，
   在那里抢标题会盖掉文章标题）。所以在这里包一层，只在「独立成页」时设。 */
function NotFoundRoute() {
  useDocumentTitle(siteContent.ui.notFound.title)

  return <NotFoundPage />
}

function SiteLayout() {
  const { pathname } = useLocation()

  return (
    <div className="relative z-10 flex min-h-svh flex-col">
      {/* 背景氛围：绝对定位、负 z、不占流。必须是这个容器的子元素 ——
          容器带 z-10 已建立层叠上下文，-z-10 才会落在「容器之上、内容之下」这一层。 */}
      <SiteAmbience />
      {/* 顶部 3px 滚动进度条：fixed + z-120，压过 header(z-40) 与博客页黑幕(z-100)。 */}
      <ScrollProgress />
      <SiteHeader />
      <main className="flex-1">
        {/* key=pathname：换路由就重建兜底层，错误状态不会粘在后续页面上。
            Suspense 在里层：它只管「页面 chunk 还没到」的那一小段，
            兜底层只管「真的崩了」。 */}
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      {/* 页脚挂在 main 之后：main 是 flex-1，内容不够高时页脚自然贴在一屏底部，
          内容超过一屏时它就是最后一块，紧跟正文。首页以前的整屏吸附已去掉，
          所以首页也照常挂页脚。 */}
      <SiteFooter />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <EscapeToBack />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route element={<HomePage />} path="/" />
          <Route element={<ProfilePage />} path="/profile" />
          <Route element={<WorksPage />} path="/works" />
          <Route element={<ResourcesPage />} path="/resources" />
          <Route element={<ArticlePage />} path="/resources/:slug" />
          <Route element={<JournalPage />} path="/journal" />
          {/* 相册只从首页入口进，不占顶部导航 —— 导航五项已经够用，
              再加一项会把「文章 / 项目 / 日记」这三个主入口稀释掉。 */}
          <Route element={<GalleryPage />} path="/gallery" />
          <Route element={<NotFoundRoute />} path="*" />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
