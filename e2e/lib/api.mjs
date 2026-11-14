/* 接口层的小客户端：登录、列表、上传、删除。
 *
 * 为什么不复用 src/lib/api-photos.ts：
 *   那份是给浏览器用的（依赖 localStorage 里的 token、走前端的 baseURL 规则）。
 *   测试要站在「外部客户端」的位置上验接口，正好顺便证明「这个 API 不是
 *   只有自家前端能调」—— 一份独立的实现比共享代码更能发现接口契约的问题。
 */

export function createApi({ apiUrl, user, pass }) {
  async function login() {
    const res = await fetch(`${apiUrl}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: user, password: pass }),
    })
    const body = await res.json().catch(() => ({}))
    return { status: res.status, token: body.access_token, body }
  }

  /** 故意用错的密码登一次 —— 用来验「401 而不是 500」。每次跑一次，不会锁账号。 */
  async function loginWithWrongPassword() {
    const res = await fetch(`${apiUrl}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: user,
        password: "definitely-not-it",
      }),
    })
    return res.status
  }

  async function list(category = "") {
    const query = category ? `?category=${encodeURIComponent(category)}` : ""
    const res = await fetch(`${apiUrl}/api/photos${query}`)
    return { status: res.status, body: await res.json().catch(() => null) }
  }

  async function upload(
    bytes,
    { filename = "e2e.png", title = "e2e", category = "日常" } = {}
  ) {
    const token = await login().then((r) => r.token)
    const form = new FormData()
    form.append("file", new Blob([bytes], { type: "image/png" }), filename)
    form.append("title", title)
    form.append("category", category)
    const res = await fetch(`${apiUrl}/api/photos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    return { status: res.status, body: await res.json().catch(() => null) }
  }

  async function remove(id) {
    const token = await login().then((r) => r.token)
    const res = await fetch(`${apiUrl}/api/photos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.status
  }

  async function getPhoto(id) {
    const res = await fetch(`${apiUrl}/api/photos/${id}`)
    return res.status
  }

  /** 下载一个地址的字节，顺便拿到 content-type。判「是不是真 WebP」靠魔数，不靠头。 */
  async function download(url) {
    const res = await fetch(`${apiUrl}${url}`, { cache: "no-store" })
    const buf = Buffer.from(await res.arrayBuffer())
    return {
      status: res.status,
      bytes: buf,
      type: res.headers.get("content-type"),
    }
  }

  return {
    login,
    loginWithWrongPassword,
    list,
    upload,
    remove,
    getPhoto,
    download,
  }
}
