/* 登录态存在哪里 —— 只做一件事：读写浏览器本地的那张小抽屉（localStorage）。

为什么必须存到 localStorage 而不是普通变量？
  React 里的普通变量（useState）活在内存里，**刷新页面就没了**。
  你登录完按一下 F5 就要重新登录，这显然不行。localStorage 是浏览器提供的
  「硬盘上的小抽屉」，关掉标签页、重启浏览器都还在，除非你手动清。

那为什么不干脆存密码？
  localStorage 里的东西任何脚本都读得到，而且永久保存。密码一旦躺进去，
  等于把钥匙挂在门上。存 token 就安全得多：
    · token 是服务器签发的，本身不是密码，改一个字签名就废
    · 它有保质期（60 分钟），过期自动失效
    · 最坏情况别人拿了你的 token，也只能在有效期内动你这一站的数据
  这就是「用有期限的通行证代替身份证」的思路。

两个 key 都带 bsun:admin: 前缀，避免和别的东西撞名（同一个域名下 key 是共享的）。
所有 DOM API 都用 try/catch 包住：Safari 无痕模式下 localStorage 会直接抛异常，
包住之后最差是「这次登录记不住」，而不是整页白屏。
*/

const TOKEN_KEY = "bsun:admin:token"
const USERNAME_KEY = "bsun:admin:username"

export type StoredSession = {
  token: string
  username: string
}

export function readSession(): StoredSession | null {
  try {
    const token = window.localStorage.getItem(TOKEN_KEY)
    if (!token) return null
    return {
      token,
      username: window.localStorage.getItem(USERNAME_KEY) ?? "",
    }
  } catch {
    return null
  }
}

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function writeSession(session: StoredSession): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, session.token)
    window.localStorage.setItem(USERNAME_KEY, session.username)
  } catch {
    /* 存不进去就算了：这一次会话仍然可用，只是刷新后要重新登录。 */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(USERNAME_KEY)
  } catch {
    /* 同上，忽略。 */
  }
}
