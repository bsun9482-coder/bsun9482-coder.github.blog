/* 登录态的「发动机」：AuthProvider 组件。

职责就三件事：
  1. 开局从 localStorage 读出登录态（所以刷新页面不掉登录）
  2. 提供 login / logout 两个动作
  3. 告诉 api 层「收到 401 时该做什么」

第 3 点值得多说一句：api.ts 不认识路由，它没法自己跳页。
所以我们在这里把自己的一段函数交给它 —— 这叫「回调」。
以后任何请求返回 401，api 层就会调用这段函数，于是清登录态 + 跳登录页一气呵成，
不用每个页面各自写一遍。
*/

import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"

import type { LoginResponse } from "@/types/admin"
import { api, setUnauthorizedHandler } from "@/lib/api"
import { AuthContext, type AuthContextValue } from "@/lib/auth-context"
import {
  clearSession,
  readSession,
  writeSession,
  type StoredSession,
} from "@/lib/auth-storage"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()

  /* 用「函数式初始化」：这段只在组件第一次挂载时跑一次，
     不会每次重渲染都去读一遍硬盘。 */
  const [session, setSession] = useState<StoredSession | null>(() =>
    readSession()
  )

  /* 把「401 之后怎么办」注册给 api 层。
     useEffect 而不是直接写在组件体里：注册是副作用，
     而且要先解注册（返回的清理函数），否则组件卸载后还留着一个悬空引用。 */
  useEffect(() => {
    const handleUnauthorized = () => {
      setSession(null)
      navigate("/admin/login", { replace: true })
    }

    setUnauthorizedHandler(handleUnauthorized)
    return () => setUnauthorizedHandler(null)
  }, [navigate])

  /* 进站时先确认这张通行证还有效。
     为什么需要这一步：文章列表用的 GET /api/posts 是**公开**接口，
     你拿一个过期 token 去调它，它照样返回 200 —— 于是页面看起来一切正常，
     直到你点「新建」才突然被 401 打回来，那时候人会以为是新功能坏了。
     用一个必须登录的接口（/api/auth/me）探一下，token 过期就立刻弹回登录页，
     问题出现在最该出现的地方。
     请求失败不用 catch 里做处理：401 已经被 api 层统一接管（清登录态 + 跳页）。 */
  const token = session?.token ?? null

  useEffect(() => {
    if (!token) return
    void api.get<{ username: string }>("/api/auth/me").catch(() => {
      /* 401 已由 setUnauthorizedHandler 处理；网络错误也只是让这次探测失败，
         不该把用户踢下线（可能是后端刚重启了一下）。 */
    })
  }, [token])

  const login = useCallback(async (username: string, password: string) => {
    /* 注意这里用的是 api.login（auth: false）：
       登录请求不该带旧 token，也不该把「密码错」的 401 当成「登录过期」，
       否则会「报错 → 清登录态 → 跳登录页 → 再报错」绕圈。 */
    const response = await api.login<LoginResponse>("/api/auth/login", {
      username,
      password,
    })

    const next: StoredSession = {
      token: response.access_token,
      username: response.username,
    }
    writeSession(next) // 先落盘，再改状态：刷新页面时能读到
    setSession(next)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  /* useMemo 包一层：只有登录态变了才生成新对象，
     否则每次父组件重渲染都会让所有用到 useAuth 的组件跟着重渲染。 */
  const value = useMemo<AuthContextValue>(
    () => ({
      token: session?.token ?? null,
      username: session?.username ?? null,
      isLoggedIn: session !== null,
      login,
      logout,
    }),
    [session, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
