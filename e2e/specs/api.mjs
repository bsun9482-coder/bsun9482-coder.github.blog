/* 接口层：登录 → 上传 → 缩略图 → 列表 → 分类筛选 → 删除。
 *
 * 这一组不需要浏览器，所以它既能在本地跑，也能指向线上跑（只读部分是安全的，
 * 但整组会真的写一条再删掉，所以线上只用 specs/live.mjs，不跑这一组）。
 *
 * 重点验的是「一张照片其实是两个文件」这件事有没有做对：
 * 上传要生成缩略图、删除要两个都删干净、任何一步失败都不能留下孤儿文件。
 */

import { makeTestPng } from "../lib/png.mjs"

export const id = "api"
export const name = "接口层（登录 / 上传 / 缩略图 / 删除）"

/** 从 WebP 字节头里读出宽高。三种编码方式都得认，否则换个参数就解析不出。 */
function readWebpSize(buf) {
  if (
    buf.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buf.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null
  }
  const fourcc = buf.subarray(12, 16).toString("ascii")
  const body = 20 // 12 + 四字节类型 + 四字节长度

  if (fourcc === "VP8 ") {
    /* 有损：帧标签(3) + 起始码 0x9d 0x01 0x2a(3) + 宽(2)高(2)，宽高各 14 位 */
    const width = buf.readUInt16LE(body + 6) & 0x3fff
    const height = buf.readUInt16LE(body + 8) & 0x3fff
    return { width, height, lossless: false }
  }
  if (fourcc === "VP8L") {
    /* 无损：0x2f 之后是 14 位宽 + 14 位高，各减 1 */
    const b = buf.subarray(body)
    const width = 1 + (((b[2] & 0x3f) << 8) | b[1])
    const height =
      1 + (((b[4] & 0x0f) << 10) | (b[3] << 2) | ((b[2] & 0xc0) >> 6))
    return { width, height, lossless: true }
  }
  if (fourcc === "VP8X") {
    /* 扩展格式：标志位(4) 之后是 24 位「宽 - 1」和 24 位「高 - 1」 */
    const width = 1 + buf.readUIntLE(body + 4, 3)
    const height = 1 + buf.readUIntLE(body + 7, 3)
    return { width, height, lossless: false }
  }
  return null
}

export async function run({ check, api }) {
  /* ---------------- 登录 ---------------- */
  const wrong = await api.loginWithWrongPassword()
  check("A1", "密码错误回 401（不是 500）", wrong === 401, `status=${wrong}`)

  const auth = await api.login()
  check("A2", "正确密码能换到 token", !!auth.token, `status=${auth.status}`)

  /* ---------------- 上传 ---------------- */
  const png = makeTestPng(800, 600)
  const up = await api.upload(png, { title: "e2e 缩略图", category: "日常" })
  check("A3", "上传返回 201", up.status === 201, `status=${up.status}`)
  if (up.status !== 201) return // 后面全靠这条记录，没有就不硬撑

  const photo = up.body
  check(
    "A4",
    "响应里有 thumb_url，且指向 _thumb.webp",
    typeof photo.thumb_url === "string" &&
      photo.thumb_url.endsWith("_thumb.webp"),
    String(photo.thumb_url)
  )
  check(
    "A5",
    "url 仍是原图（不含 _thumb）",
    typeof photo.url === "string" && !photo.url.includes("_thumb"),
    String(photo.url)
  )

  /* ---------------- 缩略图本体 ---------------- */
  const thumb = await api.download(photo.thumb_url)
  check(
    "A6",
    "缩略图能下载（200）",
    thumb.status === 200,
    `status=${thumb.status}`
  )
  const size = readWebpSize(thumb.bytes)
  check("A7", "缩略图真的是 WebP", size !== null, fourccOf(thumb.bytes))
  check(
    "A8",
    "缩略图宽 = 480（等比缩高）",
    size?.width === 480,
    String(size?.width)
  )
  check(
    "A9",
    "缩略图高按 800×600 等比（应约 360）",
    Math.abs((size?.height ?? 0) - 360) <= 1,
    String(size?.height)
  )
  check(
    "A10",
    "缩略图体积不到原图 1/3（这才是它存在的理由）",
    thumb.bytes.length * 3 < png.length,
    `原图 ${(png.length / 1024).toFixed(0)}KB → 缩略图 ${(thumb.bytes.length / 1024).toFixed(1)}KB`
  )

  /* ---------------- 列表与筛选 ---------------- */
  const all = await api.list()
  check(
    "A11",
    "列表接口 200 且是数组",
    all.status === 200 && Array.isArray(all.body)
  )
  const found = (all.body || []).find((p) => p.id === photo.id)
  check(
    "A12",
    "列表里能查到刚传的这张，且带 thumb_url",
    !!found?.thumb_url,
    String(found?.thumb_url)
  )

  const other = await api.list("这个名字肯定没有")
  check(
    "A13",
    "分类是「精确匹配」：查不存在的分类回 0 条",
    Array.isArray(other.body) && other.body.length === 0,
    `count=${other.body?.length}`
  )

  const sameCategory = await api.list("日常")
  check(
    "A14",
    "按 日常 筛选能查到它",
    (sameCategory.body || []).some((p) => p.id === photo.id),
    `count=${sameCategory.body?.length}`
  )

  /* ---------------- 删除 ---------------- */
  const delStatus = await api.remove(photo.id)
  check("A15", "删除返回 200", delStatus === 200, `status=${delStatus}`)
  check("A16", "删除后详情 404", (await api.getPhoto(photo.id)) === 404)
  const thumbAfter = await api.download(photo.thumb_url)
  check(
    "A17",
    "删除后缩略图地址也 404（文件真的没了）",
    thumbAfter.status === 404,
    `status=${thumbAfter.status}`
  )
}

function fourccOf(buf) {
  if (buf.subarray(0, 4).toString("ascii") !== "RIFF") return "不是 RIFF 容器"
  return buf.subarray(12, 16).toString("ascii")
}
