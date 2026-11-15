/* 后台的外壳：左边一条固定侧边栏，右边是「细栏 + 内容区」。

为什么后台不复用 SiteLayout（访客那套带导航和页脚的版式）？
  两个页面服务的是两种人：
    · 访客页：需要「首页 / 文章 / 项目 / 日记」导航，需要页脚
    · 后台：只需要「去哪个模块」和「怎么退出」。
  访客导航放在后台会误导（点一下就离开后台了），页脚在工具页里也纯属噪音。
  所以后台自带一层壳，但配色、圆角、字号全部沿用同一套令牌 —— 看着还是同一个站。

为什么从「顶部横导航」改成「左侧竖侧栏」（第 46 轮）：
  顶部那条横栏在手机上只有 350px 出头，四个模块名 + 标题 + 退出登录挤一行，
  窄一点就得横向滚才看得全。竖过来之后，模块列表的宽度是固定的 220px，
  和屏幕宽度无关；而且「返回站点 / 退出登录」这类低频动作能沉到底部，
  不再跟模块抢同一行。

⚠️ 侧栏是 `sticky` 而不是 `fixed`：
  fixed 会脱流，右侧内容区得自己补一个 220px 的左边距 —— 移动端一旦忘了改，
  主内容就会钻到侧栏底下（溢出截图里最常见的那种）。sticky 仍然占位，
  内容区是紧挨着它的兄弟节点，窄屏侧栏一藏，内容自然占满整行。
  滚动上仍是「侧栏不跟着走」：sticky top-0 的容器高度等于视口高。

⚠️ 侧栏和抽屉共用同一个 <AdminSidebar>：
  两处各写一份的话，「新加一个模块」必然只改一处 —— 另一处（通常是手机上的）
  就悄悄少一项。传 onNavigate 是为了抽屉点完能自动关上。
*/

import { Suspense, useState } from "react"
import {
  ArrowUpRight,
  FileText,
  Images,
  LayoutGrid,
  LogOut,
  Menu,
  NotebookPen,
} from "lucide-react"
import { Link, Outlet, useLocation, useNavigate } from "react-router"

import { PageLoading } from "@/components/system/page-loading"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { siteContent } from "@/config/site"
import { useAuth } from "@/lib/auth-context"
import { useSiteProfile } from "@/lib/site-profile-hook"
import { cn } from "@/lib/utils"

const admin = siteContent.ui.admin

/* ---------------- 模块清单 ----------------
   一处定义，侧栏、抽屉、内容区标题、页面文档标题全从这里取。
   以前这四件事散在三个地方（导航数组、每个页面自己的 useDocumentTitle、
   以及一个手写的 if 链），加一个模块要改四处，漏一处就会出现
   「侧栏亮着但标题写着上一页」。 */
type AdminModule = {
  id: "dashboard" | "posts" | "journal" | "album"
  to: string
  label: string
  title: string
  hint: string
  icon: typeof LayoutGrid
}

const ADMIN_MODULES: AdminModule[] = [
  {
    id: "dashboard",
    to: "/admin/dashboard",
    label: admin.navDashboard,
    title: admin.dashboardTitle,
    hint: admin.navDashboardHint,
    icon: LayoutGrid,
  },
  {
    id: "posts",
    to: "/admin",
    label: admin.navPosts,
    title: admin.postsTitle,
    hint: admin.navPostsHint,
    icon: FileText,
  },
  {
    id: "journal",
    to: "/admin/journal",
    label: admin.navJournal,
    title: admin.journalTitle,
    hint: admin.navJournalHint,
    icon: NotebookPen,
  },
  {
    id: "album",
    to: "/admin/album",
    label: admin.navAlbum,
    title: admin.albumTitle,
    hint: admin.navAlbumHint,
    icon: Images,
  },
]

/* 当前在哪个模块。
   为什么不用 NavLink 的 isActive：它按「地址前缀」判断，而 /admin/posts/new
   既不等于 /admin 也不算 /admin/journal，两个都不亮 —— 待在新建页上却看不到
   自己在哪个模块，很别扭。这里自己判一次，规则更好读：
   **在 /admin/dashboard 下就是工作台，/admin/journal 下是日记，/admin/album 下是相册，
   其余都算文章**（/admin、/admin/posts/new、/admin/posts/x/edit 都归文章）。

   顺序有讲究：/admin 是另外三个的前缀，所以必须先排除掉它们，
   否则任何地址都算「文章」。 */
function activeModuleId(pathname: string): AdminModule["id"] {
  if (pathname.startsWith("/admin/dashboard")) return "dashboard"
  if (pathname.startsWith("/admin/journal")) return "journal"
  if (pathname.startsWith("/admin/album")) return "album"
  return "posts"
}

/* 页面标题（浏览器标签页上那个）。
   为什么在这里算而不交给每个页面：标题和侧栏高亮必须是同一个判断，
   两处各写一遍迟早会不一致（比如编辑页明明属于文章，标签却写「管理后台」）。 */
function pageTitle(pathname: string): string {
  const base = ADMIN_MODULES.find(
    (item) => item.id === activeModuleId(pathname)
  )!.title

  /* 新建 / 编辑是文章的下一级页面，标题要带上，否则三个页面标签长得一样，
     开两个标签就分不清哪个是新建哪个是编辑。 */
  if (pathname === "/admin/posts/new") return `${admin.formTitleNew} · ${base}`
  if (/^\/admin\/posts\/[^/]+\/edit$/.test(pathname)) {
    return `${admin.formTitleEdit} · ${base}`
  }
  return base
}

/* ---------------- 侧栏本体 ----------------
   白底 + 右侧 1px 描边。刻意**不用深色**：全站只有首页那张「当前专注」是深色块，
   后台套一块深色侧栏会让整个站看起来像两个产品。
   高度用 h-full 而不是 h-svh：它被放进两个不同容器（sticky 的 aside / 抽屉），
   自己定高度只会在其中一种里出错。 */
/* 当前项的高亮：浅蓝底 + 品牌蓝文字。
   ⚠️ 底色写 `bg-[#eff6ff]` 而不是 `bg-brand/8`：
      Tailwind v4 的透明度修饰符输出的是 `oklab(... / 0.08)` 这种颜色，
      而 `color-mix` 混出来的值**未必等于** `#eff6ff` —— 页面上看着差不多，
      但它就不再是「淡蓝 #eff6ff」这个具体色号了（设计稿给的就是 hex）。
      写死 hex 还能让 Banner 的渐变起点和这里用同一个色，浅色系统一。
   ⚠️ hover 底色用 `#f4f4f5`（= --secondary）而不是 `bg-muted`（#fafafa）：
      #fafafa 在白底上几乎看不出来，鼠标移上去像没反应。 */
const NAV_ACTIVE = "bg-[#eff6ff] font-medium text-brand"
const NAV_IDLE =
  "text-muted-foreground hover:bg-secondary hover:text-foreground"
const NAV_BASE =
  "flex min-h-11 items-center gap-2.5 rounded-[7px] px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand/20"

function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const { username, logout } = useAuth()
  const navigate = useNavigate()
  const profile = useSiteProfile()

  const current = activeModuleId(pathname)

  function handleLogout() {
    /* 顺序无所谓，但两件事都要做：
       ① logout() 清 localStorage 并让 Context 变成「未登录」
       ② navigate 换地址。
       其实只做 ① 也行 —— 外层的 RequireAuth 发现未登录会自动把人送去登录页。
       这里显式写 ② 是为了「点完立刻走」，不让人盯着一个正在消失的页面。 */
    onNavigate?.()
    logout()
    navigate("/admin/login", { replace: true })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---- 顶部：站点名（取接口里的 name，不写死） ---- */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span aria-hidden="true" className="brand-dot shrink-0" />
        <span className="flex min-w-0 flex-col">
          {/* truncate：名字可能有十几个字（比如「旺仔冰子（恩师萧氏）」），
              不截断会把 220px 的侧栏撑开、右边描边跟着歪。 */}
          <span className="truncate font-heading text-sm leading-tight font-semibold tracking-tight">
            {profile.name}
          </span>
          <span className="truncate font-mono text-[11px] leading-tight text-faint">
            {profile.subtitle || admin.brandRole}
          </span>
        </span>
      </div>

      {/* ---- 模块列表 ---- */}
      <nav
        aria-label={admin.sidebarLabel}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1"
      >
        {ADMIN_MODULES.map((item) => {
          const active = item.id === current
          const Icon = item.icon

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(NAV_BASE, active ? NAV_ACTIVE : NAV_IDLE)}
              key={item.id}
              onClick={onNavigate}
              title={item.hint}
              to={item.to}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ---- 底部：返回站点 / 退出登录 ---- */}
      <div className="flex flex-col gap-1 border-t border-border px-2 py-3">
        {/* 账号那一行。手机上这里也会出现（抽屉里），所以不隐藏 ——
            登录了哪个号是用户该随时看得见的信息。 */}
        {username && (
          <p
            className="flex items-center gap-1.5 truncate px-2.5 pb-1 font-mono text-[11px] leading-5 text-faint"
            title={admin.signedInAs}
          >
            <span className="truncate">{username}</span>
          </p>
        )}

        {/* 返回站点：<a> 而不是 <Link>，并且是新标签打开。
            理由：后台是「工作现场」，去前台看效果通常还要回来继续改；
            用 SPA 跳转会把后台这一页的状态（比如刚填了一半的表单）冲掉。 */}
        <a
          className={cn(NAV_BASE, NAV_IDLE)}
          href="/"
          onClick={onNavigate}
          rel="noreferrer"
          target="_blank"
        >
          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{admin.backToSite}</span>
        </a>

        {/* 退出登录用普通按钮而不是链接：它不改变地址（是清登录态），
            语义上是个动作。热区同样给到 44px。 */}
        <button
          className={cn(NAV_BASE, NAV_IDLE, "text-left")}
          onClick={handleLogout}
          type="button"
        >
          <LogOut aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{admin.logout}</span>
        </button>
      </div>
    </div>
  )
}

/* ---------------- 内容区顶部细栏 ----------------
   一条 56px 的细栏：左边是「管理后台 / 模块名」（手机上再配一个汉堡），右边是用户名 + 退出。

   ⚠️ 左边写**面包屑**而不是单纯模块名：
      每个页面正文里已经有一个大标题（PageHeader 的 h2，比如「文章管理」），
      细栏再写一遍「文章管理」，同一屏上它就出现两次，看着像渲染错了。
      改成「管理后台 / 文章管理」：细栏说明「你在哪」，正文明说「这一页是什么」，
      两者不重复，还能一眼看出层级。
   ⚠️ 工作台例外：它正文里没有 PageHeader（Banner 就是标题），
      所以细栏直接显示「工作台」，不加前缀 —— 那一页是最上层，没有层级可讲。 */
function AdminTopbar({
  title,
  breadcrumb,
  onOpenMenu,
  username,
  onLogout,
}: {
  title: string
  breadcrumb: string | null
  onOpenMenu: () => void
  username: string | null
  onLogout: () => void
}) {
  return (
    <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-sm sm:px-6">
      {/* 汉堡只在 ≤1024px 出现：一个 220px 的侧栏 + 编辑器（正文 + 预览两栏）
          在 1024 以下会挤成一条缝，所以这个宽度以下改成「抽屉 + 全宽内容」。 */}
      <Button
        aria-label={admin.sidebarOpen}
        className="size-11 shrink-0 lg:hidden [&_svg]:size-5"
        onClick={onOpenMenu}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Menu />
      </Button>

      <p className="flex min-w-0 flex-1 items-baseline gap-1.5">
        {breadcrumb && (
          <>
            <span className="hidden shrink-0 text-xs text-faint sm:inline">
              {breadcrumb}
            </span>
            {/* 分隔斜杠单独一个元素并 aria-hidden：读屏软件不该念「斜杠」 */}
            <span
              aria-hidden="true"
              className="hidden shrink-0 text-xs text-faint sm:inline"
            >
              /
            </span>
          </>
        )}
        <span
          className="min-w-0 truncate font-heading text-sm font-semibold tracking-tight"
          data-slot="admin-topbar-title"
        >
          {title}
        </span>
      </p>

      {username && (
        <span
          className="hidden shrink-0 font-mono text-[11px] text-faint sm:inline"
          title={admin.signedInAs}
        >
          {username}
        </span>
      )}

      <Button
        aria-label={admin.logout}
        className="h-9 shrink-0 gap-1.5 px-2.5"
        onClick={onLogout}
        type="button"
        variant="ghost"
      >
        <LogOut aria-hidden="true" className="size-4" />
        {/* 桌面显示文字，手机上只留图标（图标能认出来，字会挤掉标题） */}
        <span className="hidden sm:inline">{admin.logout}</span>
      </Button>
    </div>
  )
}

export function AdminLayout() {
  const { pathname } = useLocation()
  const { username, logout } = useAuth()
  const navigate = useNavigate()
  /* 抽屉的开关。移动端点汉堡打开，点任意链接或遮罩自动关。 */
  const [menuOpen, setMenuOpen] = useState(false)

  const title = pageTitle(pathname)
  /* 面包屑只在非工作台页面出现（见 AdminTopbar 顶部那条说明）。 */
  const breadcrumb =
    activeModuleId(pathname) === "dashboard" ? null : admin.title

  function handleLogout() {
    logout()
    navigate("/admin/login", { replace: true })
  }

  return (
    /* min-h-svh 而不是 h-svh：内容比屏幕高时整页滚动，侧栏靠 sticky 粘住；
       z-10 是因为 index.css 里 ::selection / ambience 那类全局层都在这之下。 */
    <div className="relative z-10 flex min-h-svh bg-background">
      {/* ---- 桌面侧栏（固定 220px，不随主内容滚动） ----
          宽度的断点用 lg（1024px）：这一档以下交给抽屉。
          ⚠️ 只写 w-[220px] 一个值，别写 w-56 —— 那是 224px，
              和需求里的 220 差 4px，量出来对不上。 */}
      <aside className="sticky top-0 hidden h-svh w-[220px] shrink-0 border-r border-border bg-background lg:block">
        <AdminSidebar />
      </aside>

      {/* ---- 移动端抽屉 ----
          Sheet 自带遮罩、Esc 关闭、焦点锁在当前层里；
          side="left" 让它从左边滑出，和桌面侧栏的位置一致（换了屏幕不会「跳边」）。
          p-0 + 去掉自带关闭按钮：那份关闭按钮用的是 size-7 的小圆点，
          侧栏里已经有「返回站点 / 退出」，再顶一个 × 显得碎；
          关闭方式保留三种（点遮罩、按 Esc、点任意导航项）。
          ⚠️ 宽度必须写 `w-[270px]!`（带 !）：
              ui/sheet.tsx 里自带 `data-[side=left]:w-3/4`，两条都是 utilities 层、
              优先级一样，谁在后面谁赢 —— 实测不写 ! 时抽屉永远是 281px（375 的 3/4），
              写死的 270 被吃掉。 */}
      <Sheet onOpenChange={setMenuOpen} open={menuOpen}>
        <SheetContent
          className="w-[270px]! max-w-[85vw] gap-0 p-0"
          onOpenAutoFocus={(event) => {
            /* 默认会把焦点交给「第一个可聚焦元素」，而抽屉里第一个是顶部那块
               站点名（不是可聚焦的），实际落到的是……最后一个按钮（退出登录）——
               于是抽屉一打开，最底下那个「退出登录」带着一圈蓝框亮在那儿，
               看着像「已经选中了要退出」。
               改成聚焦当前模块那一项：既符合「你在这儿」的语义，
               键盘用户按 Tab 也能顺着往下走。 */
            event.preventDefault()
            /* currentTarget 的类型是 EventTarget，得先确认它真是元素再查。 */
            const root = event.currentTarget
            const current =
              root instanceof HTMLElement
                ? root.querySelector("[aria-current=page]")
                : null
            if (current instanceof HTMLElement) current.focus()
          }}
          showCloseButton={false}
          side="left"
        >
          {/* 标题给读屏软件用（Sheet 要求有 Title，否则控制台会警告）。
              视觉上藏起来 —— 侧栏顶部那块「站点名」已经说明了这是哪儿。 */}
          <SheetHeader className="sr-only">
            <SheetTitle>{admin.sidebarMenuTitle}</SheetTitle>
            <SheetDescription>{admin.sidebarMenuDescription}</SheetDescription>
          </SheetHeader>
          <AdminSidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ---- 右侧：细栏 + 内容 ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          breadcrumb={breadcrumb}
          onLogout={handleLogout}
          onOpenMenu={() => setMenuOpen(true)}
          title={title}
          username={username}
        />

        {/* ⚠️ min-w-0 是防溢出的关键：这个 div 是 flex 子项，默认 min-width:auto
            会被内容里最宽的那个元素（比如文章编辑器的两栏预览）撑开，
            于是手机上整页能左右拖。加了 min-w-0 才会老老实实按父宽收缩。 */}
        <main className="min-w-0 flex-1">
          {/* 后台的子页面是「按需下载」的（见 App.tsx 里那段 lazy 的说明），
              所以要有兜底：chunk 还在路上时先显示加载中，而不是空白一片。
              兜底层放在这一层，五个后台路由共用一份，不用每个路由各写一遍。 */}
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
