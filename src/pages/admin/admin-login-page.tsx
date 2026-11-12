/* 后台登录页。

流程：填用户名密码 → 提交 → 调 POST /api/auth/login → 成功则存 token 并进后台。

几个新手容易踩的点，代码里都已经处理了：
  1. 表单要用 <form onSubmit>，这样直接按回车也能提交（不是只能点按钮）
  2. 提交中要禁用按钮，否则连点五下会发五个请求
  3. 密码错误时后端回 401，这**不是**崩了，是正常业务结果 —— 要在页面上显示出来
  4. 已经登录的人不该再看到登录表单（否则两个状态并存，容易出怪事）
*/

import { useState, type FormEvent } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { siteContent } from "@/config/site"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useAuth } from "@/lib/auth-context"

const admin = siteContent.ui.admin

export function AdminLoginPage() {
  useDocumentTitle(admin.loginTitle)

  const { isLoggedIn, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /* 登录成功后回到「你本来想去的地方」。
     location.state 是 RequireAuth 塞进来的（见 require-auth.tsx），
     直接打开 /admin/login 时它是 null，那就去 /admin。 */
  const from = (location.state as { from?: string } | null)?.from ?? "/admin"

  /* 已经登录了还来看登录页 → 直接送进后台。
     放在所有 hook 之后才 return，这是 React 的硬规则：
     hook 的调用次数在每次渲染里必须一致，不能被 if 跳过。 */
  if (isLoggedIn) {
    return <Navigate replace to={from} />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault() // 阻止浏览器默认的「整页刷新式提交」，否则登录态还没存住页面就跳走了
    if (submitting) return

    setError(null)
    setSubmitting(true)

    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (caught) {
      /* 这里的错误文案来自后端，比如「用户名或密码不对，请重新输入」。
         用 instanceof 判断而不是直接读 message：catch 到的可能是任何类型的抛出物。 */
      setError(caught instanceof Error ? caught.message : admin.loginFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative z-10 flex min-h-svh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-(--layout-gutter-sm) py-12 sm:px-(--layout-gutter)">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col gap-3">
            <span className="flex items-center gap-2.5">
              <span aria-hidden="true" className="brand-dot" />
              <span className="font-mono text-xs tracking-tight text-muted-foreground">
                {admin.pathLabel}
              </span>
            </span>
            <h1 className="font-heading text-title font-semibold tracking-tight">
              {admin.loginTitle}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {admin.loginSubtitle}
            </p>
          </div>

          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={handleSubmit}
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {admin.usernameLabel}
              </span>
              <Input
                autoComplete="username"
                autoFocus
                name="username"
                onChange={(event) => setUsername(event.target.value)}
                placeholder={admin.usernamePlaceholder}
                required
                value={username}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {admin.passwordLabel}
              </span>
              <Input
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder={admin.passwordPlaceholder}
                required
                type="password"
                value={password}
              />
            </label>

            {/* role="alert"：读屏软件会立刻念出这段，不用等用户摸到那里。
                aria-live 的等效语义由 role="alert" 自带。 */}
            {error && (
              <p
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-note leading-5 text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}

            <Button
              className="mt-1 h-9 w-full"
              disabled={submitting}
              type="submit"
            >
              {submitting ? admin.submitting : admin.submit}
            </Button>
          </form>

          <p className="mt-6 text-xs leading-5 text-faint">
            {admin.loginHint}{" "}
            <Link
              className="link-underline text-brand hover:text-brand-hover"
              to="/"
            >
              {admin.backToSite}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
