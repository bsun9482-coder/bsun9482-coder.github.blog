/* 全站唯一的 HTTP 出口。所有调后端的请求都走这里，好处是「三件事只做一次」。

------------------------------------------------------------- 一、前端怎么调后端？

浏览器里发一个请求，本质就三样东西：
    方法   GET（取） / POST（新建） / PUT（改） / DELETE（删）
    地址   http://127.0.0.1:8000/api/posts
    数据   放请求体（body）里，通常是 JSON

原生写法是 fetch(url, { method, headers, body })，但每个地方都手写会重复三件事：
    ① 拼后端地址  ② 加登录凭证  ③ 处理错误
所以统一收在这个文件里，页面只写 `api.get<Post[]>("/api/posts")` 这样的意图。

------------------------------------------------------------- 二、token 是什么？

你登录时后端回了一串很长的字符串（147 个字符），那就是 token。
它相当于一张**写上你名字和过期时间的通行证**，后端用密钥给它盖了章（签名）。

为什么请求必须带 Authorization 头？
因为 HTTP 本身是「无记忆」的 —— 你上一个请求登录过，下一个请求它完全不记得是谁。
所以每个请求都得自己出示一次通行证，格式是国际惯例：

    Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIs...

`Bearer` 是个英文单词（持有者），中间一个空格，后面跟 token。少了这个前缀，
后端不认（我们后端会回一句「还没登录」）。

------------------------------------------------------------- 三、地址为什么是 /api 开头的相对路径？

开发时前端跑在 5173 端口、后端跑在 8000 端口。浏览器有一条铁律叫「同源策略」：
**不同端口 = 不同来源**，前端直接请求 8000 会被浏览器拦下来（这就是「跨域」）。

老办法是让后端开 CORS 白名单放行；我们的办法更省事 ——
在 vite.config.ts 里配一条代理：凡是 `/api` 开头的请求，开发服务器替你转发到 8000。
在浏览器眼里，请求始终是发给 5173 自己的，压根不算跨域。

所以这里 API_BASE 默认是空字符串，最终地址就是 `/api/posts`。
以后真部署到服务器，只要让 nginx 把 /api 反代到后端，这段代码一个字都不用改；
如果后端在别的域名，就设一个 VITE_API_BASE 环境变量指过去。
*/

import { clearSession, readToken } from "@/lib/auth-storage"

const API_BASE: string = import.meta.env.VITE_API_BASE ?? ""

/* 带状态码的错误。
   为什么不用 class ApiError extends Error：这个仓库开了 erasableSyntaxOnly
   （只允许「编译后能原样擦掉」的 TS 语法），用普通 Error 挂一个字段最省事。 */
export type ApiError = Error & { status: number }

function fail(message: string, status: number): never {
  const error = new Error(message) as ApiError
  error.status = status
  throw error
}

/* 「登录失效了怎么办」由上层决定。
   api.ts 不认识路由，也不该认识 —— 它只负责在 401 时喊一声，
   由 AuthProvider 注册的回调去清登录态 + 跳登录页。 */
/* 「连不上后端」时该去查什么 —— 开发和线上的答案完全不同，所以分开写。
   为什么值得分：这条文案是给「出问题的人」看的。线上如果还写「检查 127.0.0.1:8000」，
   人会去自己电脑上找那个端口（根本没有），而真正该看的是服务器上的服务和 nginx。
   一句误导比没有提示更费时间。 */
const OFFLINE_HINT = import.meta.env.DEV
  ? "① FastAPI 是否在 127.0.0.1:8000 运行（cd backend && uvicorn main:app --reload）；" +
    "② 改过 vite.config.ts 之后必须重启 dev server，代理才生效；" +
    "③ 请求路径是否以 /api 开头"
  : "① 服务器上的后端是否在跑（systemctl status blog-backend）；" +
    "② nginx 是否把 /api 转发到了 127.0.0.1:8000（sudo nginx -T | grep -A5 'location /api'）；" +
    "③ 浏览器地址栏是 https，后端也必须是 https 可达，不能混着 http 请求"

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

function handleUnauthorized(): void {
  clearSession()
  if (unauthorizedHandler) {
    unauthorizedHandler()
    return
  }
  // 兜底：还没挂上 Provider（比如页面刚加载）时，直接用最粗暴但一定有效的办法
  window.location.replace("/admin/login")
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  /* 是否带上 token。默认带。
     唯一要传 false 的是「登录接口」—— 它本来就没有 token，
     而且密码输错时后端也回 401。如果照常当「登录过期」处理，
     你会看到「登录失败 → 立刻被弹回登录页」的死循环，还看不到错误提示。 */
  auth?: boolean
}

/* 带 token 的请求头。
   upload 和普通 JSON 请求都要这一段，所以抽出来一份，避免两处各写一遍、
   以后改 token 前缀时漏掉一处。 */
function authHeaders(): Record<string, string> {
  const token = readToken()
  if (!token) {
    // 本地连凭证都没有，不用白跑一趟网络
    handleUnauthorized()
    fail("还没登录，请先登录", 401)
  }
  return { Authorization: `Bearer ${token}` }
}

/* 把响应体解析成 JS 值。
   先读成文本再试 JSON：后端偶尔会回纯文本（比如 500 的堆栈），
   直接 response.json() 会在这种时候再抛一个看不懂的解析错误，把真正的原因盖掉。 */
async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/* 把后端返回的结构翻成人话。
   我们的后端出错时返回的是 {detail: "..."}；
   数据校验失败（422）时多一个 problems 数组，一行一条，拼起来更好读。 */
function describeError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>
    const problems = record.problems
    if (Array.isArray(problems) && problems.length > 0) {
      return problems.join("；")
    }
    if (typeof record.detail === "string" && record.detail) {
      return record.detail
    }
  }
  if (status === 404) return "没有找到这个东西（404）"
  if (status >= 500)
    return `后端出错了（${status}），看一眼 uvicorn 那个窗口的报错`
  return `请求失败（${status}）`
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  if (auth) {
    Object.assign(headers, authHeaders())
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    /* fetch 只在「连不上」时抛异常（断网、后端没启动、转发没配）。
       这里给出最可能的原因，比一句 Failed to fetch 有用得多。 */
    fail(`连不上后端。逐项检查：${OFFLINE_HINT}`, 0)
  }

  const payload = await readPayload(response)

  /* 401 分两种情况，必须区分开：
       · 我们这次带了 token   → token 过期或无效，登录态作废，清掉并跳登录页
       · 我们这次没带 token   → 说明这是登录请求本身，密码错了，只报错不跳转 */
  if (response.status === 401 && auth) {
    handleUnauthorized()
    fail(describeError(payload, 401), 401)
  }

  if (!response.ok) {
    fail(describeError(payload, response.status), response.status)
  }

  return payload as T
}

/* 上传文件专用的出口：唯一的区别是**不设 Content-Type**。
   为什么：multipart/form-data 的 Content-Type 里必须带一段
   `boundary=----WebKitFormBoundaryXXXX` 的分隔符，而这段分隔符是浏览器
   在真正发请求时才生成的。你要是手写一个 "multipart/form-data"，
   boundary 就没了，后端会回一句「解析不了表单」（400）。
   所以这里刻意让浏览器自己填 —— FormData 一进 fetch，它就知道该怎么写。 */
async function requestMultipart<T>(path: string, form: FormData): Promise<T> {
  const headers = authHeaders()

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: form,
    })
  } catch {
    fail(`连不上后端，图片没传上去。逐项检查：${OFFLINE_HINT}`, 0)
  }

  const payload = await readPayload(response)

  if (response.status === 401) {
    handleUnauthorized()
    fail(describeError(payload, 401), 401)
  }

  if (!response.ok) {
    fail(describeError(payload, response.status), response.status)
  }

  return payload as T
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  /* 访客页专用：不带 token，也不把 401 当「登录过期」。
     前台文章是公开内容，带后台凭证既没必要，还会带来一个真实的坑 ——
     token 过期时访客会被一路送到 /admin/login 登录页，而他根本没有账号。
     （登录接口也走 auth:false，所以它和这里共用一个开关。） */
  getPublic: <T>(path: string) =>
    request<T>(path, { method: "GET", auth: false }),
  post: <T>(path: string, body: unknown, auth = true) =>
    request<T>(path, { method: "POST", body, auth }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /* 登录专用：不带旧 token，也不把 401 当「登录过期」。 */
  login: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body, auth: false }),
  /* 传文件。body 是 FormData（浏览器会自动按 multipart 编码）。 */
  upload: <T>(path: string, form: FormData) => requestMultipart<T>(path, form),
}
