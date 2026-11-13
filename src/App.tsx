import { Suspense, lazy, useEffect } from "react"
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router"

import { AdminLayout } from "@/components/admin/admin-layout"
import { AuthProvider } from "@/components/admin/auth-provider"
import { RequireAuth } from "@/components/admin/require-auth"
import { SiteAmbience } from "@/components/layout/site-ambience"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { ScrollProgress } from "@/components/layout/scroll-progress"
import { ErrorBoundary } from "@/components/system/error-boundary"
import { PageLoading } from "@/components/system/page-loading"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useEscapeBack } from "@/hooks/use-escape-back"
import { AdminLoginPage } from "@/pages/admin/admin-login-page"
import { AlbumPage } from "@/pages/album-page"
import { HomePage } from "@/pages/home-page"
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

/* 后台的两个页面也必须拆包 —— 理由和上面两个不一样，但后果更严重：
   Markdown 编辑器（@uiw/react-md-editor）连带它依赖的一堆东西有 1.2MB 左右。
   不拆的话，**每个来看博客的访客**打开首页就得先下载完这个编辑器，
   而他一辈子都不会进后台。实测主包会从 591KB 涨到 1828KB。
   拆出去之后，只有真的进 /admin 才会下载它。
   （后台本身还要先过 RequireAuth，未登录根本走不到这一步。） */
const AdminPostsPage = lazy(() =>
  import("@/pages/admin/admin-posts-page").then((m) => ({
    default: m.AdminPostsPage,
  }))
)
const AdminPostFormPage = lazy(() =>
  import("@/pages/admin/admin-post-form-page").then((m) => ({
    default: m.AdminPostFormPage,
  }))
)
/* 日记管理也拆包：它和文章列表一样属于「只有作者会看」的页面，
   没有任何理由让访客下载它的代码。 */
const AdminJournalPage = lazy(() =>
  import("@/pages/admin/admin-journal-page").then((m) => ({
    default: m.AdminJournalPage,
  }))
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
      {/* AuthProvider 必须在 BrowserRouter 里面：它要用 useNavigate 做「401 就跳登录页」，
          而 useNavigate 只有被 Router 包住才有值。 */}
      <AuthProvider>
        <Routes>
          {/* ---------- 后台：两条路由都不套 SiteLayout ----------
              登录页是独立的（没有顶栏，没登录的人不该看到「退出登录」）；
              列表页外面套两层：RequireAuth 查登录态，AdminLayout 给顶栏 + 内容区。
              嵌套 Route 的写法：父级只给 element 不给 path，子级负责实际路径，
              子页面渲染在 AdminLayout 的 <Outlet /> 里。 */}
          <Route element={<AdminLoginPage />} path="/admin/login" />
          <Route
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route element={<AdminPostsPage />} path="/admin" />
            {/* 新建和编辑共用同一个页面组件 AdminPostFormPage：
                「是新建还是编辑」不靠两个页面区分，靠地址里有没有 :slug 判断。
                两条路由都写出来，是因为它们要求的需求不一样 ——
                /posts/new 不能有 slug，/posts/:slug/edit 必须有。 */}
            <Route element={<AdminPostFormPage />} path="/admin/posts/new" />
            <Route
              element={<AdminPostFormPage />}
              path="/admin/posts/:slug/edit"
            />
            {/* 日记只有一条后台路由：列表 + 输入区都在同一个页面里，
                不区分「新建」和「编辑」（见 admin-journal-page.tsx 顶部说明）。 */}
            <Route element={<AdminJournalPage />} path="/admin/journal" />
          </Route>

          <Route element={<SiteLayout />}>
            <Route element={<HomePage />} path="/" />
            <Route element={<ProfilePage />} path="/profile" />
            <Route element={<WorksPage />} path="/works" />
            <Route element={<ResourcesPage />} path="/resources" />
            <Route element={<ArticlePage />} path="/resources/:slug" />
            <Route element={<JournalPage />} path="/journal" />
            {/* 相册只从首页入口和博客页的相册卡进，不占顶部导航 ——
                导航五项已经够用，再加一项会把「文章 / 项目 / 日记」稀释掉。
                第 42 轮从 /gallery 改名 /album（带分类筛选和灯箱）；
                旧地址保留一条重定向：首页入口以前指向它，收藏夹里也可能有。 */}
            <Route element={<AlbumPage />} path="/album" />
            <Route element={<Navigate replace to="/album" />} path="/gallery" />
            <Route element={<NotFoundRoute />} path="*" />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
