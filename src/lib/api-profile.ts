/* 站点资料（作者名片）的接口层：后端 ProfileOut → 页面用的 Profile。

   和 lib/api-photos.ts 是同一套分工：**只有这一层知道后端字段叫什么**，
   页面只认下面的 Profile。后端哪天把 updated_at 改名、或者头像地址前缀换了，
   改这一个文件就够。

   三个接口（对应 backend/routers/profile.py）：
     GET  /api/profile          读：公开（访客页那块「关于我」也用它）
     PUT  /api/profile          改文字：🔒 需登录
     POST /api/profile/avatar   传头像：🔒 需登录，multipart

   ⚠️ 地址是 `/api/profile`，不是 `/api/profiles`。
      整张表永远只有 id=1 那一行（站长自己的资料），所以没有列表、没有 id 参数 ——
      写成复数会在调用点暗示「这里有一堆」，而实际上取哪一条都没有选择余地。

   ⚠️ 放进 src/lib 而不是新建 src/api：本站所有接口封装都在 lib/api-*.ts 里
      （api-posts / api-journals / api-photos），唯一的 HTTP 出口是 lib/api.ts。
      多开一个目录会让「后端字段名只在这一层出现」这条边界出现两个执行地点。
*/

import { api } from "@/lib/api"

/** 后端 GET/PUT /api/profile 返回的对象（原样）。
 *  avatarUrl 是**后端算出来的**（不是库里的列），没设过头像时是 null。 */
export type ApiProfile = {
  id: number
  name: string
  subtitle: string | null
  bio: string | null
  location: string | null
  updated_at: string
  avatarUrl: string | null
}

/** 页面里用的形状：可选文字统一成空串，判空只写一次。 */
export type Profile = {
  id: number
  name: string
  subtitle: string
  bio: string
  location: string
  /** 原始时间戳（后端本地时间字符串），要显示就自己 slice(0, 16) */
  updatedAt: string
  /** 把后端给的相对地址原样带上（/uploads/avatars/xxx.png）。
   *  **不兜底成站点默认头像** —— 那是表现层的事，由页面自己决定「没有头像时长什么样」。
   *  后端刻意返回 null 而不是 /avatar.jpg，见 schemas.ProfileOut 的注释。 */
  avatarUrl: string | null
}

/** 要提交的四个字段。null 表示「清空这一项」。 */
export type ProfileInput = {
  name?: string
  subtitle?: string | null
  bio?: string | null
  location?: string | null
}

export function toProfile(record: ApiProfile): Profile {
  return {
    id: record.id,
    name: record.name ?? "",
    subtitle: record.subtitle ?? "",
    bio: record.bio ?? "",
    location: record.location ?? "",
    updatedAt: record.updated_at ?? "",
    avatarUrl: record.avatarUrl || null,
  }
}

/** 读资料。公开接口 → 用 getPublic（不带 token）。
 *
 *  为什么不带 token：这份资料访客也要读。带着 token 有个真实的坑 ——
 *  token 过期时 401 会被当成「登录过期」处理，访客会被一路送回 /admin/login，
 *  而他根本没账号（lib/api.ts 里 getPublic 的注释讲过同一件事）。 */
export async function getProfile(): Promise<Profile> {
  return toProfile(await api.getPublic<ApiProfile>("/api/profile"))
}

/** 改文字资料。只传你要改的字段，没传的后端不动（PUT 用的是 exclude_unset）。
 *
 *  空串怎么处理：后端 schema 会把 "" 统一变成 null（见 ProfileUpdate._empty_to_none），
 *  所以「把签名删干净再保存」= 传空串 = 库里存 null = 前台不显示。这里不用自己转 null。
 *
 *  唯一的例外是 name：后端 name 传 null 等于「这次不改」（名字是必填的），
 *  传空串会撞 min_length=1 回 422。所以页面那边得先判「名字不空」再提交。 */
export async function updateProfile(input: ProfileInput): Promise<Profile> {
  const body: Record<string, unknown> = {}
  if (input.name !== undefined) body.name = input.name
  if (input.subtitle !== undefined) body.subtitle = input.subtitle
  if (input.bio !== undefined) body.bio = input.bio
  if (input.location !== undefined) body.location = input.location

  return toProfile(await api.put<ApiProfile>("/api/profile", body))
}

/** 传头像。返回的是**更新后的整个资料对象**，所以调用方直接拿返回值换预览即可，
 *  不用再补一次 getProfile。
 *
 *  ⚠️ 表单字段名必须是 "file"（后端 upload_avatar 的形参名就是 file）。
 *  ⚠️ 走 api.upload 而不是 api.post：FormData 的 Content-Type 必须由浏览器生成
 *     （里面带 boundary），手写会直接 400。 */
export async function uploadAvatar(file: File): Promise<Profile> {
  const form = new FormData()
  form.append("file", file)
  return toProfile(await api.upload<ApiProfile>("/api/profile/avatar", form))
}
