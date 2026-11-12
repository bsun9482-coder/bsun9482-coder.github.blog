/* 文章列表（后台）。

数据来源是 GET /api/posts?include_drafts=true —— 也就是 FastAPI 从 SQLite 里读出来的那批，
**不是** src/content 里的 MDX 文件。两者是不同的数据源，现在还没打通，
所以这里看到的条数可能和 /resources 页面不一样，这是正常的。

这条列表和公开列表的区别只有一个：多带了 ?include_drafts=true。
后端规定「只有登录的人传这个参数才有效果」，所以游客拿到的永远是已发布的那几篇。

四种状态必须分开处理，少一个就会出现「白屏且不知道为什么」：
    加载中 → 什么都不说，用户会以为卡死了
    出错   → 说清原因 + 给一个重试入口（网络抖动时最有用）
    空     → 说清「库里确实没有」，而不是让人怀疑是不是坏了
    有数据 → 表格 + 每行的编辑 / 删除
*/

import { useEffect, useState } from "react"
import { FileText, Plus, RefreshCw } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router"

import { Container } from "@/components/layout/container"
import { PageHeader } from "@/components/layout/page-header"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { api } from "@/lib/api"
import { fillTemplate } from "@/lib/text"
import type { AdminPost } from "@/types/admin"

const admin = siteContent.ui.admin

/* 一个状态机就表达了三件事，比三个各自独立的 useState（loading / error / data）
   更难写出「既在加载又有错误」这种自相矛盾的组合。 */
type LoadState =
  | { status: "loading" }
  | { status: "ready"; posts: AdminPost[] }
  | { status: "error"; message: string }

export function AdminPostsPage() {
  useDocumentTitle(admin.postsTitle)

  const location = useLocation()
  const navigate = useNavigate()

  const [state, setState] = useState<LoadState>({ status: "loading" })
  /* 点「重试」时把它 +1，effect 依赖它就会重新跑一次。 */
  const [reloadKey, setReloadKey] = useState(0)

  /* 保存 / 删除之后跳回本页，路由会带一条 notice（见另一处 navigate 的 state）。
     存进本地 state 是为了让它「显示一次」，而不是每次刷新都跳出来。 */
  const [notice, setNotice] = useState<string | null>(
    () => (location.state as { notice?: string } | null)?.notice ?? null
  )
  const [actionError, setActionError] = useState<string | null>(null)

  /* 待删除的那篇文章。它不为空 = 确认框打开。
     用一个对象而不是布尔值，这样确认框里能直接显示标题。 */
  const [pendingDelete, setPendingDelete] = useState<AdminPost | null>(null)

  useEffect(() => {
    let cancelled = false

    /* ⚠️ 这里刻意**不**写 setState({status:"loading"})。
       新版的 React 规则禁止在 effect 里同步 setState（会多渲染一轮），
       而且初始 state 本来就是 loading、重试时也已经在点击处切好了。 */
    api
      .get<AdminPost[]>("/api/posts?include_drafts=true")
      .then((posts) => {
        if (cancelled) return
        setState({ status: "ready", posts })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setState({
          status: "error",
          message: caught instanceof Error ? caught.message : admin.loadFailed,
        })
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  /* 把 history 里的 state 清掉：否则用户刷新页面，那条「已保存」提示会再弹一次，
     看着像又保存了一遍。清完之后提示仍留在本地 state 里，不影响这一次显示。 */
  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

  function refresh() {
    setActionError(null)
    setState({ status: "loading" })
    setReloadKey((key) => key + 1)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const target = pendingDelete

    setPendingDelete(null) // 先关掉确认框，别让用户盯着一个卡住的弹窗
    setActionError(null)

    try {
      await api.delete(`/api/posts/${encodeURIComponent(target.slug)}`)
      setNotice(fillTemplate(admin.deleted, { title: target.title }))
      /* 删完重新拉一次列表，而不是在本地数组里删掉那一行 ——
         前者和后端真实状态一定一致，后者只是「看起来对」。 */
      setState({ status: "loading" })
      setReloadKey((key) => key + 1)
    } catch (caught) {
      setActionError(
        `${admin.deleteFailed}：${caught instanceof Error ? caught.message : ""}`
      )
    }
  }

  const draftCount =
    state.status === "ready"
      ? state.posts.filter((post) => post.is_draft).length
      : 0

  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          icon={FileText}
          subtitle={admin.postsSubtitle}
          title={admin.postsTitle}
        />
        {/* asChild：把 Button 的样式套到 <Link> 上，语义仍然是「链接」而不是按钮
            （能右键新标签打开、能被读屏念成导航）。 */}
        <Button asChild>
          <Link to="/admin/posts/new">
            <Plus aria-hidden="true" />
            {admin.newPost}
          </Link>
        </Button>
      </div>

      {notice && (
        <div
          className="flex items-start justify-between gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3"
          role="status"
        >
          <p className="text-sm leading-6 text-foreground">{notice}</p>
          {/* aria-label 给读屏用（一个「×」会被念成「乘号」），
              图形本身 aria-hidden，避免被重复朗读。 */}
          <Button
            aria-label={admin.dismissNotice}
            onClick={() => setNotice(null)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <span aria-hidden="true">×</span>
          </Button>
        </div>
      )}

      {actionError && (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-6 text-destructive"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {state.status === "loading" && (
        <p aria-busy="true" className="font-mono text-xs text-faint">
          {admin.loading}
        </p>
      )}

      {state.status === "error" && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm leading-6 text-destructive" role="alert">
            {admin.loadFailed}：{state.message}
          </p>
          <Button onClick={refresh} size="sm" type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            {admin.retry}
          </Button>
        </div>
      )}

      {state.status === "ready" && state.posts.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <FileText
            aria-hidden="true"
            className="mx-auto mb-4 size-8 text-muted-foreground"
          />
          <h2 className="text-base font-medium">{admin.empty}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {admin.emptyDescription}
          </p>
        </div>
      )}

      {state.status === "ready" && state.posts.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="font-mono text-xs text-faint tabular-nums">
            {draftCount > 0
              ? fillTemplate(admin.countWithDrafts, {
                  total: state.posts.length,
                  drafts: draftCount,
                })
              : `${admin.totalPrefix} ${state.posts.length} ${admin.countSuffix}`}
          </p>

          {/* 手机上表格会超出屏幕，用 overflow-x-auto 让它横向滚动，
              而不是把列挤成一坨看不清。表格本身给一个最小宽度兜底。 */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th
                      className="px-4 py-2.5 font-medium text-muted-foreground"
                      scope="col"
                    >
                      {admin.colTitle}
                    </th>
                    <th
                      className="px-4 py-2.5 font-medium text-muted-foreground"
                      scope="col"
                    >
                      {admin.colCategory}
                    </th>
                    <th
                      className="px-4 py-2.5 font-medium text-muted-foreground"
                      scope="col"
                    >
                      {admin.colStatus}
                    </th>
                    <th
                      className="px-4 py-2.5 font-medium text-muted-foreground"
                      scope="col"
                    >
                      {admin.colPublishedAt}
                    </th>
                    <th
                      className="px-4 py-2.5 text-right font-medium text-muted-foreground"
                      scope="col"
                    >
                      {admin.colActions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {state.posts.map((post) => (
                    <tr
                      className="transition-colors hover:bg-muted/40"
                      key={post.id}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {post.title}
                        </div>
                        {/* slug 用等宽字体、浅色：它是给机器看的，不该抢标题的注意力 */}
                        <div className="mt-0.5 font-mono text-xs text-faint">
                          {post.slug}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {post.category}
                      </td>
                      <td className="px-4 py-3">
                        {/* 草稿用浅字徽标、已发布用深字徽标 ——
                            整页只有一个强调蓝，状态区分靠字重不靠颜色。 */}
                        <Badge variant={post.is_draft ? "outline" : "default"}>
                          {post.is_draft
                            ? admin.statusDraft
                            : admin.statusPublished}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground tabular-nums">
                        {post.published_at ?? admin.dateUnset}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button asChild size="xs" variant="outline">
                            <Link
                              to={`/admin/posts/${encodeURIComponent(post.slug)}/edit`}
                            >
                              {admin.edit}
                            </Link>
                          </Button>
                          <Button
                            className="text-destructive hover:text-destructive"
                            onClick={() => setPendingDelete(post)}
                            size="xs"
                            type="button"
                            variant="ghost"
                          >
                            {admin.delete}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 删除确认框。open 由 pendingDelete 决定：
          有值就打开，关掉（Esc / 点遮罩 / 取消）就把它清空。 */}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        open={pendingDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{admin.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingDelete
              ? fillTemplate(admin.deleteBody, { title: pendingDelete.title })
              : ""}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{admin.deleteCancel}</AlertDialogCancel>
            {/* 故意不用 AlertDialogAction：那个组件自带「主按钮」样式（黑色），
                而删除应该是红的。自己放一个 destructive 按钮，样式才对得上。 */}
            <Button onClick={confirmDelete} type="button" variant="destructive">
              {admin.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Container>
  )
}
