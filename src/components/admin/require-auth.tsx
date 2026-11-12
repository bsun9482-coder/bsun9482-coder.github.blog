/* 路由守卫：进 /admin 之前先检查「你登录了吗」。

用法是把它套在需要保护的页面外面：

    <Route element={<RequireAuth><AdminLayout /></RequireAuth>}>
      <Route element={<AdminPostsPage />} path="/admin" />

为什么叫「守卫」：它在页面渲染**之前**就做了判断。
没登录时它不渲染页面，而是直接返回一个 <Navigate>（等于「换个地址」），
所以受保护的页面连一帧都不会出现在未登录用户眼前。

⚠️ 它是纯前端守卫，只能挡住「走界面」的人，挡不住直接调接口的人。
   真正的安全边界在后端：写接口都有 Depends(get_current_user) 把关。
   前端守卫的作用是「别让人看到一堆报错」，不是「安全」。
*/

import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router"

import { useAuth } from "@/lib/auth-context"

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth()
  const location = useLocation()

  if (!isLoggedIn) {
    /* 两个细节：
       · state 里记住「你本来想去哪」，登录成功后可以直接送你回去
       · replace 而不是普通跳转：不往浏览历史里塞新记录。
         否则用户点「后退」会回到刚才那个进不去的页面，又被弹回来，来回死循环。 */
    return (
      <Navigate replace state={{ from: location.pathname }} to="/admin/login" />
    )
  }

  return <>{children}</>
}
