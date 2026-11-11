import { Component, type ErrorInfo, type ReactNode } from "react"
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { siteContent } from "@/config/site"

/* 页面级兜底：任何渲染期异常（包括「懒加载的页面 chunk 没下载下来」）
   都落到这里，而不是留下一片白屏。

   为什么只能是 class 组件：React 至今只有 class 的
   getDerivedStateFromError / componentDidCatch 能捕获子树里的渲染错误，
   没有对应的 Hook。这是全站唯一一个 class 组件，不是风格倒退。

   为什么调用方要给它 key={pathname}：
   错误状态是记在组件内部的，不清就会「一旦某页崩了，之后点哪个导航都还是
   错误页」。用路由当 key，换页面即重建，等于自动复位 —— 比在
   componentDidUpdate 里手写 setState 复位更好懂。
   同一条路径重新渲染（不换路由）不会复位，这是对的：真崩了就该停在那儿。 */

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    /* 留一份现场：控制台里能看到组件栈，线上排查时比「白屏」有用得多。 */
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="mx-auto flex w-full max-w-2xl items-center px-4 py-16 sm:px-6">
        <div
          className="w-full rounded-xl border border-border bg-card py-12 text-center shadow-card"
          role="alert"
        >
          <TriangleAlertIcon className="mx-auto mb-5 size-10 text-faint" />
          <h1 className="text-title font-semibold tracking-tight">
            {siteContent.ui.page.errorTitle}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
            {siteContent.ui.page.errorHint}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => window.location.reload()}>
              <RotateCwIcon data-icon="inline-start" />
              {siteContent.ui.page.retry}
            </Button>
            <Button asChild variant="ghost">
              <Link to="/">{siteContent.ui.notFound.backHome}</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
