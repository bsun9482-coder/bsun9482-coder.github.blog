/* 日记的两种形状 —— 和文章一样，接口原样 vs 页面展示分清楚。

为什么还要分 ApiJournal / Journal 两个？
  后端返回的字段叫 created_at（带时分秒的字符串），页面要的是 date（"2026-11-09"）
  和可选的心情。中间这次转换只写一遍（lib/api-journals.ts 的 toJournal），
  页面就永远不用碰后端的字段名。

字段来源：后端 schemas.JournalRead（见 backend/schemas.py）。
*/

/** 接口原样：GET /api/journals 返回的每一条 */
export type ApiJournal = {
  id: number
  content: string
  mood: string | null
  /** 形如 "2026-11-09T12:00:00"（服务器本地时间，不带时区标记） */
  created_at: string
}

/* 展示用。注意 mood 是**可选**而不是 `string | null`：
   页面到处写 `entry.mood && <Badge>`，把 null 归一成 undefined 能少一种要判的状态。 */
export type Journal = {
  id: number
  /** 纯文本正文，空行分段；不做 Markdown 渲染（日记就是几句话，不上排版） */
  content: string
  mood?: string
  /** YYYY-MM-DD，从 created_at 截出来 */
  date: string
  /** 原始时间戳，排序/调试时可能用得上 */
  createdAt: string
}

/** 新建 / 编辑时提交给后端的东西（字段对应 schemas.JournalCreate / JournalUpdate）。
    sentiment 没有「必填」：mood 可以留空，接口会自动存成 null。 */
export type JournalInput = {
  content: string
  mood: string | null
}
