/* 管理后台用到的数据类型 —— 刻意和后端返回的字段**一一对应**。

为什么不复用 src/types/post.ts 里的 Post？
  那个 Post 是「前台展示用」的形状（title / date / category / summary…），
  是给页面组件消费的；这里是「接口原样返回」的形状。
  两者之间有一次转换（见 lib/api-posts.ts 的 toPost），所以分开定义。

字段来源：后端 schemas.PostRead（见 backend/schemas.py）。
这个类型现在只定义一次，就在 types/post.ts 的 ApiPost —— 前台文章页也用同一个，
避免两份定义各自漂移（漂移了只会得到某个页面读到 undefined）。
*/

import type { ApiPost } from "@/types/post"

export type AdminPost = ApiPost

/* POST /api/auth/login 的返回体 */
export type LoginResponse = {
  access_token: string
  token_type: string
  /* 多少秒后过期 */
  expires_in: number
  username: string
}

/* 新建 / 更新文章时提交给后端的东西。
   和 AdminPost 的差别：这里**没有** id / created_at / updated_at ——
   那三个是服务器自己管的，你传了也会被忽略。
   这份字段顺序和后端 schemas.PostCreate 一一对应。 */
export type AdminPostInput = {
  title: string
  slug: string
  description: string
  content: string
  category: string
  tags: string[]
  reading_minutes: number
  is_draft: boolean
  /* 没定发布日期就传 null（而不是空字符串 ""，后端只认 null） */
  published_at: string | null
}
