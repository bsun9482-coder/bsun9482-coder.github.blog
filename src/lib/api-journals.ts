/* 前台日记的数据源：从 FastAPI 取，转成页面用得上的形状。

和文章那一层（lib/api-posts.ts）是同一个套路，只是更短：
  后端给           { id, content, mood: string|null, created_at: "2026-11-09T12:00:00" }
  页面要           { id, content, mood?: string, date: "2026-11-09", createdAt }

为什么日期直接 slice(0, 10) 就行，不用算时区？
  因为后端存的就是**服务器本地时间**（见 models.Journal 上的注释）：
  你在北京时间 00:30 写，库里记的就是 00:30，截前 10 位正好是「今天」。
  如果当初按 UTC 存，这里就得先加 8 小时再截，那就是另一个坑了。
*/

import { api } from "@/lib/api"
import type { ApiJournal, Journal } from "@/types/journal"

export function toJournal(record: ApiJournal): Journal {
  const createdAt = record.created_at ?? ""

  /* 心情去掉首尾空白；空串归一成 undefined —— 后端其实已经清过一遍，
     这里再清一次是防御性的：以后有人换了个后端实现，前台不该跟着裂。 */
  const mood = (record.mood ?? "").trim()

  return {
    id: record.id,
    content: record.content ?? "",
    mood: mood === "" ? undefined : mood,
    date: createdAt.slice(0, 10),
    createdAt,
  }
}

/* 列表：后端已经按时间倒序排好，
   这里再排一次是为了「万一后端换了排序也别把时间线搞乱」——成本只有几毫秒。 */
export async function fetchJournals(): Promise<Journal[]> {
  const records = await api.getPublic<ApiJournal[]>("/api/journals")
  return records
    .map(toJournal)
    .sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
    )
}
