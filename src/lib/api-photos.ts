/* 相册的接口层：后端原样 PhotoOut → 页面用的 Photo。

   和 lib/api-posts.ts 是同一套分工：**只有这一层知道后端字段叫什么**，
   页面只认下面的 Photo。这样后端哪天把 sort_order 改名，改这一个文件就够。

   后端字段（snake_case）与页面字段（camelCase）的对应：
     sort_order → sortOrder
     created_at → createdAt
     url        → url（后端算好的相对地址，例如 /uploads/photos/3f2b9c.webp）

   为什么 url 不在这里拼：后端已经按「磁盘目录 → 网址前缀」的对应关系算好了，
   前端再拼一次就等于把这个映射抄了两份，改目录时一定漏一处。 */

import { api } from "@/lib/api"

/** 后端 GET/POST /api/photos 返回的一项（原样）。 */
export type ApiPhoto = {
  id: number
  title: string
  category: string
  sort_order: number
  created_at: string
  url: string
}

/** 页面里用的形状。 */
export type Photo = {
  id: number
  title: string
  category: string
  sortOrder: number
  createdAt: string
  /** 图片地址，已经能直接塞进 <img src>（同源相对路径） */
  url: string
}

export function toPhoto(record: ApiPhoto): Photo {
  return {
    id: record.id,
    title: record.title ?? "",
    category: record.category ?? "",
    sortOrder: record.sort_order ?? 0,
    createdAt: record.created_at ?? "",
    url: record.url ?? "",
  }
}

/** 相册列表。读接口是公开的，用 getPublic（不带 token）——
    带着 token 反而有个坑：token 过期时访客会被一路送到 /admin/login。

    category 不传（或传空串）= 全部；传了就只返回该分类。
    ⚠️ 筛选在**后端**做（SQL 的 WHERE），不是拉全量回来前端筛：
       现在相册只有几十张，两者没区别；但这是唯一能撑到几百张的写法，
       而代价只是一行 query string。 */
export async function getPhotos(category = ""): Promise<Photo[]> {
  const trimmed = category.trim()
  /* 必须 encodeURIComponent：分类是中文（日常/风景），
     不编码的话有些代理会把它当非法字符拦掉，或者把中文解成乱码。 */
  const query = trimmed ? `?category=${encodeURIComponent(trimmed)}` : ""
  const records = await api.getPublic<ApiPhoto[]>(`/api/photos${query}`)
  return records.map(toPhoto)
}

/** 单张详情。后台要「按 id 拿回刚写的那条」时用得上；
    前台相册不需要 —— 列表里已经带全了字段，再请求一次纯属多跑一趟网络。 */
export async function getPhoto(id: number): Promise<Photo> {
  return toPhoto(await api.getPublic<ApiPhoto>(`/api/photos/${id}`))
}

/** 上传一张。file 是 File 对象；三个描述字段留空也行，后端有默认值。 */
export async function uploadPhoto(
  file: File,
  fields: { title: string; category: string; sortOrder: number }
): Promise<Photo> {
  const form = new FormData()
  form.append("file", file)
  form.append("title", fields.title)
  form.append("category", fields.category)
  form.append("sort_order", String(fields.sortOrder))

  /* 走 api.upload 而不是 api.post：FormData 的 Content-Type 必须由浏览器自己
     生成（里面带 boundary），手写会直接 400。这条 api.ts 里已经踩过。 */
  return toPhoto(await api.upload<ApiPhoto>("/api/photos", form))
}

/** 改标题 / 分类 / 排序号。只传你要改的字段，没传的后端不动。 */
export async function updatePhoto(
  id: number,
  patch: { title?: string; category?: string; sortOrder?: number }
): Promise<Photo> {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title
  if (patch.category !== undefined) body.category = patch.category
  if (patch.sortOrder !== undefined) body.sort_order = patch.sortOrder

  return toPhoto(await api.put<ApiPhoto>(`/api/photos/${id}`, body))
}

/** 删一张：后端会把记录和磁盘文件一起删掉。 */
export async function deletePhoto(id: number): Promise<void> {
  await api.delete(`/api/photos/${id}`)
}
