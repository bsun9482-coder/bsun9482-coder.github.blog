/* 浏览器层：后台上传 → 前台相册显示 → 分类筛选 → 灯箱 → 个人页卡片 → 删除。
 *
 * 为什么这条链路非要用真浏览器：
 *   「上传成功」不等于「页面能看见」。中间还有三段只有浏览器能验的东西 ——
 *   隐藏的 <input type="file"> 能不能被程序塞进文件、React 的 onChange 有没有触发、
 *   列表刷完之后 <img> 到底解码成功没有（naturalWidth > 0）。
 *   HTTP 客户端全都看不见。
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { makeTestPng } from "../lib/png.mjs"

export const id = "album-ui"
export const name = "浏览器：后台上传 → 前台相册 → 灯箱 → 删除"
export const viewport = { width: 1440, height: 900 }

/** 等某张图「解码完成」再读 src / naturalWidth。
 *  ⚠️ 必须先判 img.complete：图没下完时 naturalWidth 就是 0，
 *  直接读会把「还在加载」误判成「加载失败」。 */
const IMG_READY = (selector) => `(() => {
  const img = document.querySelector(${JSON.stringify(selector)})
  if (!img || !img.complete) return null
  return { src: img.getAttribute("src") || "", width: img.naturalWidth }
})()`

/** 在相册网格里按图片地址找那张图（返回图，或 null）。 */
const gridImgOf = (name) => `(() => {
  const img = [...document.querySelectorAll("main ul img")].find((i) =>
    (i.getAttribute("src") || "").includes(${JSON.stringify(name)})
  )
  if (!img || !img.complete) return null
  return { src: img.getAttribute("src"), width: img.naturalWidth }
})()`

export async function run({ check, browser, api, env }) {
  const { evalJs, waitFor, go, setFileInputFiles } = browser

  /* 上传素材要落到磁盘上：CDP 塞文件按路径来，不能塞内存里的 Buffer */
  const tmpFile = path.join(os.tmpdir(), `blog-e2e-${process.pid}.png`)
  fs.writeFileSync(tmpFile, makeTestPng(800, 600))

  try {
    /* ---------------- B1 登录 ---------------- */
    await go("/admin/login")
    await waitFor(`document.querySelectorAll("input").length >= 2`, {
      label: "登录表单出现",
    })
    await evalJs(`(() => {
      const inputs = [...document.querySelectorAll("input")]
      /* React 受控组件：直接改 .value 不会触发 onChange，
         必须走原生 setter 再手动派发 input 事件 */
      const setValue = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set
        setter.call(el, value)
        el.dispatchEvent(new Event("input", { bubbles: true }))
      }
      setValue(inputs[0], ${JSON.stringify(env.user)})
      setValue(document.querySelector('input[type="password"]') || inputs[1], ${JSON.stringify(env.pass)})
      document.querySelector("form").requestSubmit()
      return true
    })()`)
    /* ⚠️ 等的是 /admin/dashboard，不是 /admin：第 47 轮起登录后的落地页
       改成了工作台（admin-login-page.tsx 的 from 默认值）。这条以前写死 "/admin"，
       于是每次跑都超时 —— 是 spec 没跟上，不是登录坏了。 */
    await waitFor(`location.pathname === "/admin/dashboard"`, {
      label: "登录后落在 /admin/dashboard",
    })
    check("B1", "登录成功并进入后台", true)

    /* ---------------- B2 后台上传 ---------------- */
    /* 先记下「现在库里有哪些 id」，传完再比 —— 这是唯一稳的认领方式。
       不能靠标题认领：后台表单里的标题是用户填的（跑测试时往往是空的），
       也不能靠「列表第一条」：排序规则一改就错。 */
    const beforeIds = new Set(((await api.list()).body || []).map((p) => p.id))

    await go("/admin/album")
    await waitFor(`!!document.querySelector("#album-file-input")`, {
      label: "文件输入框出现",
    })
    await setFileInputFiles("#album-file-input", [tmpFile])

    /* 上传成功的判据不是「按钮转完了」，而是「列表里出现了一张 /uploads/photos/ 的图」——
       后端写库成功、前端刷新列表、图片能访问，三件事全齐了才会有这个元素 */
    const adminImg = await waitFor(
      `(() => {
        const img = [...document.querySelectorAll("main img")].find(
          (i) => (i.getAttribute("src") || "").includes("/uploads/photos/")
        )
        if (!img || !img.complete || !img.naturalWidth) return null
        return img.getAttribute("src")
      })()`,
      { timeout: 30000, label: "上传完成并出现后台卡片图" }
    )
    check("B2", "后台上传成功，卡片图加载出来了", true, adminImg)
    check(
      "B3",
      "后台卡片用的是 _thumb.webp 小图",
      adminImg.includes("_thumb.webp"),
      adminImg
    )

    /* 认领这条记录：新出现的 id 应该正好一个 */
    const after = (await api.list()).body || []
    const fresh = after.filter((p) => !beforeIds.has(p.id))
    if (fresh.length !== 1) {
      throw new Error(`上传后应该多出 1 条记录，实际多出 ${fresh.length} 条`)
    }
    const mine = fresh[0]
    const thumbName = path.basename(mine.thumb_url)
    const origName = path.basename(mine.url)

    /* ---------------- B4 前台相册 ---------------- */
    await go("/album")
    const gridImg = await waitFor(gridImgOf(thumbName), {
      label: "相册网格出现这张图并解码完成",
    })
    check(
      "B4",
      "前台相册网格用的是 _thumb.webp",
      gridImg.src.includes("_thumb.webp"),
      gridImg.src
    )
    check(
      "B5",
      "网格图真实宽度 = 480",
      gridImg.width === 480,
      String(gridImg.width)
    )

    /* ---------------- B6 分类筛选走后端 ----------------
       这张是「日常」。切到「风景」后它必须消失 —— 这说明筛选是后端做的，
       而不是把全量数据留在页面上用 CSS 藏起来。 */
    const clickFilter = (label) => `(() => {
      const btn = [...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === ${JSON.stringify(label)}
      )
      if (!btn) return false
      btn.click()
      return true
    })()`
    check("B6", "找到分类按钮「风景」", await evalJs(clickFilter("风景")))
    await waitFor(`!${gridImgOf(thumbName)}`, {
      timeout: 15000,
      label: "切到风景后这张消失",
    })
    check("B7", "切到「风景」后这张不见了（后端筛选生效）", true)

    await evalJs(clickFilter("全部"))
    await waitFor(gridImgOf(thumbName), { label: "切回全部后这张回来" })
    check("B8", "切回「全部」后又回来了", true)

    /* ---------------- B9 灯箱看原图 ---------------- */
    await evalJs(`(() => {
      const img = [...document.querySelectorAll("main ul img")].find((i) =>
        (i.getAttribute("src") || "").includes(${JSON.stringify(thumbName)})
      )
      img.closest("button").click()
      return true
    })()`)
    const boxImg = await waitFor(
      IMG_READY('[role="dialog"][data-state="open"] img'),
      { label: "灯箱打开且大图解码完成" }
    )
    check(
      "B9",
      "灯箱用的是原图（src 里是原图文件名，不含 _thumb）",
      boxImg.src.includes(origName) && !boxImg.src.includes("_thumb"),
      boxImg.src
    )
    check(
      "B10",
      "灯箱大图宽度 = 原图 800",
      boxImg.width === 800,
      String(boxImg.width)
    )

    /* 点遮罩空白处关闭：灯箱的关闭逻辑挂在 overlay 上，
       这条同时验证「点空白能关」和「点图本身不会关」 */
    await evalJs(`(() => {
      const dialog = document.querySelector('[role="dialog"][data-state="open"]')
      const img = dialog.querySelector("img")
      const r = img.getBoundingClientRect()
      /* 点在图片左侧 20px 处（还在遮罩里，但已经出了图） */
      const x = Math.max(2, r.left - 20)
      const y = r.top + r.height / 2
      dialog.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }))
      return true
    })()`)
    const closed = await waitFor(
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      { timeout: 8000, label: "灯箱关闭" }
    ).then(() => true)
    check("B11", "点遮罩空白处能关掉灯箱", closed)

    /* ---------------- B12 个人页相册卡 ----------------
       这里必须按「我们那张缩略图的文件名」去找，不能随便抓 main 里第一张图：
       本地库里可能还留着别的测试照片，抓到别人的就证明不了任何事。 */
    await go("/profile")
    const cardSrc = await waitFor(
      `(() => {
        const img = [...document.querySelectorAll("main img")].find((i) =>
          (i.getAttribute("src") || "").includes(${JSON.stringify(thumbName)})
        )
        if (!img || !img.complete || !img.naturalWidth) return null
        return img.getAttribute("src")
      })()`,
      { label: "个人页相册卡里出现我们这张的缩略图" }
    )
    check(
      "B12",
      "个人页 2×2 相册卡也用 _thumb.webp",
      cardSrc.includes("_thumb.webp"),
      cardSrc
    )

    /* ---------------- B13 清理 ---------------- */
    check("B13", "删除刚上传的这张", (await api.remove(mine.id)) === 200)

    check(
      "B14",
      "整轮没有页面报错（控制台干净）",
      browser.pageErrors.length === 0,
      browser.pageErrors.slice(0, 3).join(" | ")
    )
  } finally {
    fs.rmSync(tmpFile, { force: true })
  }
}
