/* 登录态的「共享抽屉」：Context。

要解决的问题：好几个地方都得知道「现在登录了没」——
  · 路由守卫：没登录就别让进 /admin
  · 布局右上角：显示当前用户名、退出登录按钮
  · 登录页：已经登录了就别再显示登录表单
如果每个地方各自去 localStorage 读一遍，会出现「一处退出登录了，
另一处的界面还显示着用户名」这种不同步。Context 就是让它们读同一份数据。

这个文件只放「类型 + Context 对象 + 取值 hook」，不放组件（组件在 auth-provider.tsx）。
分开放是有原因的：热更新（改代码不刷新页面）要求一个文件只导出组件，
混着导出 hook 会让 React 每次都整页重载，开发体验变差。
*/

import { createContext, useContext } from "react"

export type AuthContextValue = {
  /* 当前 token，没登录时为 null */
  token: string | null
  /* 当前用户名，用来在右上角显示「admin」 */
  username: string | null
  /* 派生出来的布尔值，比每次写 Boolean(token) 省事，也少出错 */
  isLoggedIn: boolean
  /* 登录：成功返回后就已是登录态；失败会 throw，由调用处显示错误 */
  login: (username: string, password: string) => Promise<void>
  /* 退出：清掉 token 和用户名（界面会跟着变，因为状态变了） */
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)

  if (!value) {
    /* 忘记包 Provider 是最常见的接线错误，与其让页面报「Cannot read property
       of null」，不如直接把原因说清楚。 */
    throw new Error(
      "useAuth 必须在 <AuthProvider> 内部使用 —— 检查 App.tsx 里有没有用 AuthProvider 包住 Routes"
    )
  }

  return value
}
