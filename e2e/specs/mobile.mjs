/* 移动端（390×844，iPhone 14 逻辑分辨率）：相册页与个人页不能散版。
 *
 * 桌面端绿了不代表手机上就是对的 —— 这里最容易翻车的三件事：
 *   ① 网格在窄屏还硬撑三四列 → 每格 90px，图看不清、点不准；
 *   ② 长标题 / 长分类名把容器撑出去 → 整页能左右拖；
 *   ③ 灯箱那张大图比屏幕还宽 → 右侧被切掉一截。
 *
 * 照片由接口先传一张（不打后台界面，省一半时间），跑完删掉。
 */

import { makeTestPng } from "../lib/png.mjs"

export const id = "mobile"
export const name = "移动端布局（390×844）"
export const viewport = { width: 390, height: 844 }

const TITLE = "e2e-mobile"

export async function run({ check, browser, api }) {
  const { evalJs, waitFor, go } = browser

  const up = await api.upload(makeTestPng(800, 600), {
    title: TITLE,
    category: "日常",
  })
  if (up.status !== 201) throw new Error(`准备数据失败：上传回 ${up.status}`)

  try {
    /* ---------------- M1 网格列数 ---------------- */
    await go("/album")
    const cols = await waitFor(
      `(() => {
        const ul = [...document.querySelectorAll("main ul")].find((u) => u.querySelector("button[aria-label]"))
        if (!ul) return null
        /* 读「实际算出来的列宽」而不是数 class：
           列数可能来自媒体查询，只有 computed style 才是真相 */
        const template = getComputedStyle(ul).gridTemplateColumns
        return template.split(" ").filter(Boolean).length
      })()`,
      { label: "相册网格渲染出来" }
    )
    check("M1", "手机上相册是 2 列", cols === 2, `实际 ${cols} 列`)

    /* ---------------- M2 格子是正方形 ---------------- */
    const box = await waitFor(
      `(() => {
        const btn = document.querySelector("main ul button[aria-label]")
        if (!btn) return null
        const r = btn.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height) }
      })()`,
      { label: "格子量得到尺寸" }
    )
    check(
      "M2",
      "格子是正方形（宽高差 ≤ 1px）",
      Math.abs(box.w - box.h) <= 1,
      `${box.w}×${box.h}`
    )
    check(
      "M3",
      "格子足够大（宽 > 150px，手指点得准）",
      box.w > 150,
      `${box.w}px`
    )

    /* ---------------- M4 没有横向溢出 ---------------- */
    const overflow = await evalJs(
      `({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })`
    )
    check(
      "M4",
      "整页没有横向溢出（scrollWidth ≤ clientWidth）",
      overflow.scroll <= overflow.client,
      `${overflow.scroll} vs ${overflow.client}`
    )

    /* ---------------- M5 灯箱不出屏 ---------------- */
    await evalJs(
      `document.querySelector('button[aria-label="${TITLE}"]').click()`
    )
    const lightbox = await waitFor(
      `(() => {
        const dialog = document.querySelector('[role="dialog"][data-state="open"]')
        const img = dialog?.querySelector("img")
        if (!img || !img.complete || !img.naturalWidth) return null
        const r = img.getBoundingClientRect()
        return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }
      })()`,
      { label: "灯箱图加载完成" }
    )
    check(
      "M5",
      "灯箱大图完整落在屏幕内（左右都没被切）",
      lightbox.left >= 0 && lightbox.right <= overflow.client,
      `left=${lightbox.left} right=${lightbox.right} 屏宽=${overflow.client}`
    )

    /* ---------------- M6 个人页相册卡有 4 张 ---------------- */
    await go("/profile")
    const thumbs = await waitFor(
      `(() => {
        const imgs = [...document.querySelectorAll("main img")].filter((i) =>
          (i.getAttribute("src") || "").includes("/uploads/photos/")
        )
        return imgs.length ? imgs.length : null
      })()`,
      { label: "个人页相册卡出现缩略图" }
    )
    check(
      "M6",
      "个人页相册卡最多 4 张（至少 1 张）",
      thumbs >= 1 && thumbs <= 4,
      `${thumbs} 张`
    )
  } finally {
    await api.remove(up.body.id)
  }
}
