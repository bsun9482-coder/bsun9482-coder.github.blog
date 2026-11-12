/* 上传图片这件事里「和网络无关」的那一半：先自己查一遍，再交给后端。

分两层校验，各管一件事（这个分工很重要，不是重复劳动）：

  前端这一层（本文件 checkImageFile）
    管**体验**：文件一选就立刻告诉你「太大了」，不用等 5 秒网络往返。
    但它拦不住坏人 —— 浏览器里的代码谁都能改，改几行就能跳过这段。

  后端那一层（backend/images.py）
    管**安全**：不管前端说了什么，它自己看文件内容判断。
    这是唯一算数的关卡。

  一句话总结：前端的校验是「礼貌」，后端的校验是「门锁」。
  只装门锁会让人撞一下才回头，只讲礼貌等于没锁门。
*/

import { api } from "@/lib/api"

/* 5 MB。这个数字必须和后端 images.MAX_UPLOAD_BYTES 保持一致。
   为什么不从后端读？为了省一次请求 —— 一个数字写两处，代价是改的时候要记得两边都改。
   真要做到「只有一处」，得让后端提供一个 /api/config 之类的接口把限额吐给前端，
   对现在这个规模属于过度设计，先记着这个取舍。 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/* accept 的值给 <input type="file"> 用。
   ⚠️ 它不是「保险」：用户可以在这句话之外随手改文件后缀，
      所以真正判断还是靠后端看文件头。它只是让系统的选文件对话框
      默认只显示这几种图，少让人选错。 */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif"

/* 后端 POST /api/upload 的原样回执（字段名是后端的 snake_case）。 */
export type UploadedImage = {
  filename: string
  url: string
  size: number
  content_type: string
  original_name: string
}

/* 前端自己否掉的理由。用「代号」而不是直接写中文，
   是因为这套代码里所有给人看的文案都集中在 src/config/site.ts —— 组件负责把代号翻成人话。 */
export type ImageRejectionCode = "empty" | "too-large" | "not-image"

export type ImageRejection = {
  code: ImageRejectionCode
  /* 文件名。让文案能说出「到底哪一张」，拖进来五个文件时尤其重要。 */
  name: string
  /* 只在 too-large 时有值：已经排好版的体积文案，例如 "6.2 MB"。 */
  size?: string
}

/* 把字节数说成人话：2400000 → "2.3 MB"。
   （和后端 images.human_size 各写一份，因为两边语言不同，没法共用。） */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function checkImageFile(file: File): ImageRejection | null {
  if (file.size === 0) {
    return { code: "empty", name: file.name }
  }

  /* 先看大小：大文件的检查最省钱（浏览器本来就知道字节数，不用读内容）。 */
  if (file.size > MAX_IMAGE_BYTES) {
    return { code: "too-large", name: file.name, size: formatBytes(file.size) }
  }

  /* 再看类型。file.type 是浏览器**按扩展名猜**的（.jpg → image/jpeg），
     所以这个判断只能算「粗筛」：
       · 传 .txt/.pdf/.exe → 立刻拒绝，不用发请求
       · 传一张把 .webp 改名成 .jpg 的图 → 这里会放行，由后端看文件头抓出来
     file.type 为空是正常的（有些系统 / 某些后缀给不出类型），这种也放行交给后端。 */
  if (file.type && !IMAGE_ACCEPT.split(",").includes(file.type)) {
    return { code: "not-image", name: file.name }
  }

  return null
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  /* FormData 就是 multipart/form-data 这份表单的「内存版」：
       字段名 file  ←→  文件字节 + 文件名 + 类型
     字段名必须和后端 upload_image(file: UploadFile = File(...)) 的参数名一致，
     写成 image 后端就收不到东西（回 422「file：Field required」）。 */
  const form = new FormData()
  form.append("file", file)

  /* 走统一的出口：它会带上 Authorization 头（这是「必须登录才能上传」的落地点），
     也会把后端的错误对象翻成一句中文。 */
  return api.upload<UploadedImage>("/api/upload", form)
}

/* 图片在正文里的写法：![描述](地址)
   · 方括号里是 alt 文案（图加载不出来时显示的、读屏软件念出来的）
   · 圆括号里是地址。这里用 /uploads/xxx.jpg 这种**站内相对地址**，
     好处是开发（5173 经代理）和生产（同域 nginx）都不用改一个字。 */
export function toMarkdownImage(image: UploadedImage): string {
  /* alt 里出现 ] 会把 ![...] 提前闭合，出现换行会把这个语法截断，
     所以这两个字符换成空格。这不是洁癖 —— 编辑器的 markdown 解析器是真的会崩。 */
  const alt = image.original_name.replace(/[[\]\r\n]/g, " ").trim() || "图片"
  return `![${alt}](${image.url})`
}
