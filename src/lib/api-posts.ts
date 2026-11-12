/* 前台的文章数据源：从 FastAPI 取，转成页面用得上的形状。

------------------------------------------------------------- 一、为什么要这一层？

后端返回的是「数据库那一行」（reading_minutes / is_draft / published_at）。
页面要的是「给人看的文章」（readingMinutes / date / tableOfContents）。
差着一层转换。如果让每个页面自己转，就会出现：
  · 列表页忘了按日期排序
  · 详情页把 published_at 的 null 直接丢给日期格式化 → 显示「Invalid Date」
  · 有人用 reading_minutes、有人用 readingMinutes
所以转换只写一次，放在这里。页面只认 `Post`，不碰后端的字段名。

------------------------------------------------------------- 二、为什么要客户端算目录和搜索文本？

以前这些是**构建期**算好的（vite-plugins/post-parse.mjs 在打包时读 MDX 文件）。
现在文章是打开网页时才从数据库来的，构建期根本不知道有哪些文章，
只能等拿到 content 之后在浏览器里算。
口径必须和以前保持一致，否则同一篇文章会出现两种目录/两种搜索命中：
  · 目录 id 用 github-slugger —— 和 rehype-slug 插件是同一个库，
    所以「目录里的 id」和「正文标题的 id」天然对得上，点目录才能跳。
  · 搜索文本去 Markdown 记号的方式照抄 post-parse.mjs 的 stripMarkdown。

------------------------------------------------------------- 三、为什么列表也要 content？

后端 GET /api/posts 会把正文一起返回（没做「列表瘦身」）。
我们正好拿它算「全文搜索」和「阅读时长兜底」，省一次请求。
代价是文章一多，列表响应会变大 —— 以后文章上百篇时，
该让后端加一个不含 content 的列表接口，或者干脆把搜索挪到后端。
现在 5 篇，不值得提前优化。
*/

import GithubSlugger from "github-slugger"

import { api } from "@/lib/api"
import type {
  ApiPost,
  ArticleDetail,
  Post,
  TableOfContentsItem,
} from "@/types/post"

/* 和后端「已发布」的判定保持一致：草稿一律不进前台。
   后端其实已经过滤过一遍了，这里再滤一次是**防御性**的 ——
   万一以后有人给接口加了 include_drafts 参数又忘了收紧，前台的过滤是最后一道闸。 */
export function toPost(record: ApiPost): Post {
  return {
    slug: record.slug,
    title: record.title,
    description: record.description ?? "",
    /* 没定发布日期就用创建日期兜底：卡片上显示「未定」会让排序看起来很怪，
       而 created_at 至少是个真实存在的时间点。 */
    date: (record.published_at ?? record.created_at ?? "").slice(0, 10),
    category: record.category || "未分类",
    tags: Array.isArray(record.tags) ? record.tags : [],
    readingMinutes: record.reading_minutes ?? 1,
    searchText: buildSearchText(record),
    tableOfContents: buildTableOfContents(record.content ?? ""),
  }
}

/* 去掉 Markdown 记号，只留能读的字。用于搜索，以及万一后端没给阅读时长时兜底。
   顺序有讲究：先剥整段（代码块），再去行内记号 ——
   否则代码块里的 # * 会被当成标题和强调处理。 */
export function stripMarkdown(value: string): string {
  return value
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/* 搜索框输入的是小写（resources-page 里 toLocaleLowerCase 过），所以这里也统一小写 */
function buildSearchText(record: ApiPost): string {
  return [
    record.title,
    record.description ?? "",
    record.category ?? "",
    ...(Array.isArray(record.tags) ? record.tags : []),
    stripMarkdown(record.content ?? ""),
  ]
    .join(" ")
    .toLocaleLowerCase()
}

/* 标题文本：把行内记号去掉，只留会显示出来的字。
   必须和 rehype-slug 的取法一致 —— 它取的是「渲染后标题里的文字」，
   行内代码贡献它的值，加粗/斜体只留中间的字，图片不贡献文字。 */
function headingText(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/<[^>]+>/g, "")
    .trim()
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/
const HEADING = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/

/* 从 Markdown 原文里抽 h2 / h3 做目录。
   两个必须做对的地方：

   ① 跳过代码块里的假标题。文章里经常有 ```bash 然后一行 `# 安装依赖`，
      不跳过的话目录里会混进一段命令。
   ② 所有级别的标题都要过一遍 slugger，不能只喂 h2/h3。
      rehype-slug 是对全文所有标题依次编号的（重复的会加 -1、-2），
      我们只算 h2/h3 的话，一旦文中有同名标题，编号就会和正文对不上，
      表现为「点目录跳不动」。所以 h1-h6 全部走一遍，只是只把 h2/h3 收进目录。 */
export function buildTableOfContents(markdown: string): TableOfContentsItem[] {
  const slugger = new GithubSlugger()
  const items: TableOfContentsItem[] = []

  let fence: string | null = null

  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = line.match(FENCE)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fence === null) {
        fence = marker
        continue
      }
      if (fence === marker) {
        fence = null
        continue
      }
      // 换了另一种围栏（``` 里出现 ~~~）：当内容处理，不关闭
      continue
    }
    if (fence !== null) continue

    const heading = line.match(HEADING)
    if (!heading) continue

    const level = heading[1].length
    /* 空标题（`##` 后面什么都没有）slugger 会给出空串，这种没法跳，直接不发号 */
    const text = headingText(heading[2])
    if (!text) continue

    const id = slugger.slug(text)
    if (level === 2 || level === 3) {
      items.push({ id, title: text, level })
    }
  }

  return items
}

/* 一个具体的错误 → 一句人话。给页面上的错误提示用。 */
export function describePostError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "文章加载失败"
}

/* 列表：只要已发布，按发布日期倒序。
   后端本来就按 published_at desc 排好并且过滤了草稿，
   这里再排一次是因为 date 可能在 toPost 里被 created_at 兜底过（顺序会变）。 */
export async function fetchPublishedPosts(): Promise<Post[]> {
  const records = await api.getPublic<ApiPost[]>("/api/posts")
  return records
    .filter((record) => !record.is_draft)
    .map(toPost)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export async function fetchPostBySlug(slug: string): Promise<ArticleDetail> {
  const record = await api.getPublic<ApiPost>(
    `/api/posts/${encodeURIComponent(slug)}`
  )
  return { ...toPost(record), content: record.content ?? "" }
}
