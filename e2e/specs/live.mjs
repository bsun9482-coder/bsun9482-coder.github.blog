/* 线上只读巡检：只发 GET 和一次错误密码的登录，绝不写、绝不删。
 *
 * 为什么要专门有一条「线上」的：
 *   本地全绿但线上挂掉是最常见的事故（nginx 没转发 / 后端没重启 / 图片目录权限不对）。
 *   而线上又不能像本地那样随便传一张删一张 —— 那是在动真实数据。
 *   所以这条只回答一个问题：**现在线上这台，用户能不能正常看图**。
 *
 * 跑法：npm run test:e2e:live
 */

export const id = "live"
export const name = "线上只读巡检"
export const viewport = { width: 1440, height: 900 }

export async function run({ check, browser, api, env }) {
  const { evalJs, waitFor, go } = browser

  check(
    "L1",
    "线上地址是 https",
    env.baseUrl.startsWith("https://"),
    env.baseUrl
  )

  /* ---------------- L2 首页 ---------------- */
  await go("/")
  const home = await evalJs(
    `({ title: document.title.length, mainChildren: document.querySelector("main")?.children.length || 0 })`
  )
  check(
    "L2",
    "首页能打开且 main 有内容",
    home.mainChildren > 0,
    `${home.mainChildren} 个子节点`
  )

  /* ---------------- L3 相册页 ---------------- */
  await go("/album")
  check("L3", "/album 能打开（SPA 路由没坏）", true)

  /* ---------------- L4 接口 ---------------- */
  const list = await api.list()
  check(
    "L4",
    "GET /api/photos 返回 200 + 数组",
    list.status === 200 && Array.isArray(list.body),
    `status=${list.status} count=${list.body?.length}`
  )

  const photos = Array.isArray(list.body) ? list.body : []
  const withThumb = photos.filter((p) => p.thumb_url)
  const badShape = photos.filter(
    (p) =>
      typeof p.url !== "string" ||
      !p.url.includes("/uploads/photos/") ||
      (p.thumb_url !== null && !String(p.thumb_url).endsWith("_thumb.webp"))
  )
  check(
    "L5",
    "每条记录形状正确（url 指向照片目录，thumb_url 要么 null 要么 _thumb.webp）",
    badShape.length === 0,
    badShape.length
      ? `${badShape.length} 条不对`
      : `共 ${photos.length} 条，其中 ${withThumb.length} 条有缩略图`
  )

  /* ---------------- L6 图片真的能取到 ----------------
     ⚠️ 用 node 侧 fetch 且 cache:'no-store'：浏览器可能直接从缓存返回 200，
        那样即使源站文件没了也会显示「通过」，等于什么都没验。 */
  if (photos.length) {
    const first = photos[0]
    const orig = await api.download(first.url)
    check(
      "L6",
      "第一张原图能取到（200）",
      orig.status === 200,
      `${first.url} → ${orig.status}`
    )
    if (first.thumb_url) {
      const thumb = await api.download(first.thumb_url)
      check(
        "L7",
        "第一张缩略图能取到（200）",
        thumb.status === 200,
        `${first.thumb_url} → ${thumb.status}`
      )
      check(
        "L8",
        "缩略图确实比原图小",
        thumb.bytes.length < orig.bytes.length,
        `${(thumb.bytes.length / 1024).toFixed(1)}KB vs ${(orig.bytes.length / 1024).toFixed(0)}KB`
      )
    } else {
      console.log("（跳过 L7/L8：线上这张是老数据，还没有缩略图）")
    }
  } else {
    console.log(
      "（线上相册是空的，跳过 L6/L7/L8；等有照片后这几条才会真正开跑）"
    )
  }

  /* ---------------- L9 未登录不能进后台 ---------------- */
  await go("/admin/album")
  /* ⚠️ 刚 navigate 到 /admin/album 时地址栏就是它 —— React 还没挂载、重定向还没发生。
     必须「先等登录表单出现」再读 pathname（第 43 轮踩过，误判过一次）。 */
  await waitFor(`!!document.querySelector('input[type="password"]')`, {
    label: "登录表单出现（说明被拦下来了）",
  })
  const pathname = await evalJs(`location.pathname`)
  check(
    "L9",
    "未登录访问 /admin/album 被送去登录页",
    pathname === "/admin/login",
    pathname
  )

  /* ---------------- L10 鉴权没被绕过 ---------------- */
  const wrong = await api.loginWithWrongPassword()
  check("L10", "错误密码回 401", wrong === 401, `status=${wrong}`)
}
