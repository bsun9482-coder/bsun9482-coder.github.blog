/* 后台的外壳：一条极简顶栏 + 下面放子页面。

为什么后台不复用 SiteLayout（访客那套带导航和页脚的版式）？
  两个页面服务的是两种人：
    · 访客页：需要「首页 / 文章 / 项目 / 日记」导航，需要页脚
    · 后台：只需要「我是谁」和「怎么退出」。
  访客导航放在后台会误导（点一下就离开后台了），页脚在工具页里也纯属噪音。
  所以后台自带一层壳，但配色、圆角、字号全部沿用同一套令牌 —— 看着还是同一个站。

顶栏用 sticky：往下滚文章列表时它一直贴在顶部，退出登录按钮随时够得着。
不用毛玻璃（本站在第 N 轮明确去掉了），就是纯白底 + 一条 1px 描边。
*/

import { Suspense } from "react"
import { LogOut } from "lucide-react"
import { Link, Outlet, useLocation, useNavigate } from "react-router"

import { Container } from "@/components/layout/container"
import { PageLoading } from "@/components/system/page-loading"
import { Button } from "@/components/ui/button"
import { siteContent } from "@/config/site"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

const admin = siteContent.ui.admin

/* 顶栏的三个模块入口。
   为什么不直接用 NavLink 的 isActive：
   它按「地址前缀」判断，而 /admin/posts/new 既不等于 /admin 也不算 /admin/journal，
   两个都不亮 —— 待在新建页上却看不到自己在哪个模块，很别扭。
   这里自己判一次，规则更好读：**在 /admin/journal 下就是日记，在 /admin/album 下
   就是相册，其余都算文章**。 */
function ModuleNav() {
  const { pathname } = useLocation()
  const onJournal = pathname.startsWith("/admin/journal")
  const onAlbum = pathname.startsWith("/admin/album")
  const onPosts = !onJournal && !onAlbum

  const linkClass = (active: boolean) =>
    cn(
      "rounded-[7px] px-2.5 py-1 text-sm transition-colors",
      active
        ? "bg-muted font-medium text-foreground"
        : "text-muted-foreground hover:text-foreground"
    )

  return (
    <nav aria-label={admin.navLabel} className="flex items-center gap-1">
      <Link
        aria-current={onPosts ? "page" : undefined}
        className={linkClass(onPosts)}
        to="/admin"
      >
        {admin.navPosts}
      </Link>
      <Link
        aria-current={onJournal ? "page" : undefined}
        className={linkClass(onJournal)}
        to="/admin/journal"
      >
        {admin.navJournal}
      </Link>
      <Link
        aria-current={onAlbum ? "page" : undefined}
        className={linkClass(onAlbum)}
        to="/admin/album"
      >
        {admin.navAlbum}
      </Link>
    </nav>
  )
}

export function AdminLayout() {
  const { username, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    /* 顺序无所谓，但两件事都要做：
       ① logout() 清 localStorage 并让 Context 变成「未登录」
       ② navigate 换地址。
       其实只做 ① 也行 —— 外层的 RequireAuth 发现未登录会自动把人送去登录页。
       这里显式写 ② 是为了「点完立刻走」，不让人盯着一个正在消失的页面。 */
    logout()
    navigate("/admin/login", { replace: true })
  }

  return (
    <div className="relative z-10 flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <Container className="flex h-14 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="brand-dot" />
            <span className="font-heading text-sm font-semibold tracking-tight">
              {admin.title}
            </span>
            <span className="hidden font-mono text-xs text-faint sm:inline">
              {admin.pathLabel}
            </span>
            <ModuleNav />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {username && (
              <span
                className="hidden font-mono text-xs text-muted-foreground sm:inline"
                title={admin.signedInAs}
              >
                {username}
              </span>
            )}
            <Button
              onClick={handleLogout}
              size="sm"
              type="button"
              variant="outline"
            >
              <LogOut aria-hidden="true" />
              {admin.logout}
            </Button>
          </div>
        </Container>
      </header>

      <main className="flex-1">
        {/* 后台的子页面是「按需下载」的（见 App.tsx 里那个 lazy 的说明），
            所以要有兜底：chunk 还在路上时先显示加载中，而不是空白一片。
            兜底层放在这一层，三个后台路由共用一份，不用每个路由各写一遍。 */}
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
