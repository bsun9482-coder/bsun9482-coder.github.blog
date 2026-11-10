import { Skeleton } from "@/components/ui/skeleton"
import { siteContent } from "@/config/site"

/* 懒加载页面的占位：只在「页面代码还在下载」的这一小段时间出现。
   故意做得克制 —— 几条灰条 + 读屏提示，不搞转圈动画（闪一下就没的东西，
   动画反而更晃眼）。 */
export function PageLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6" role="status">
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="mt-6 h-4 w-full" />
      <Skeleton className="mt-3 h-4 w-11/12" />
      <Skeleton className="mt-3 h-4 w-2/3" />
      <span className="sr-only">{siteContent.ui.page.loading}</span>
    </div>
  )
}
