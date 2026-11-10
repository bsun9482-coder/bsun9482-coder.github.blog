import {
  getReadingMinutes,
  getTableOfContents,
  splitFrontmatter,
  stripMarkdown,
} from "./post-parse.mjs"

type Frontmatter = {
  title: string
  description: string
  date: string
  category: string
  tags: string[]
  draft?: boolean
}

/* 解析逻辑本身在 post-parse.mjs（体检脚本也用它，口径只有一份）。
   这里只负责两件事：构建期把坏 frontmatter 变成明确的报错，
   以及把「标题 / 描述 / 标签 / 正文」拼成搜索用的一整段文本。 */

/* frontmatter 的硬校验：构建期唯一一次把「文章元数据坏了」变成红色报错的地方。
   —— 写错了不会被静默容忍，否则会一路渲染成页面上缺标题、日期 NaN、标签空白。 */
function assertFrontmatter(
  value: unknown,
  path: string
): asserts value is Frontmatter {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Missing frontmatter in ${path}`)
  }

  const fields = value as Record<string, unknown>
  const requiredStringFields = [
    "title",
    "description",
    "date",
    "category",
  ] as const

  for (const field of requiredStringFields) {
    if (typeof fields[field] !== "string" || fields[field].trim() === "") {
      throw new Error(`Invalid ${field} in ${path}`)
    }
  }

  if (
    !Array.isArray(fields.tags) ||
    fields.tags.some((tag) => typeof tag !== "string" || tag.trim() === "")
  ) {
    throw new Error(`Invalid tags in ${path}`)
  }
}

export function getPostMetadata(rawContent: string, path: string) {
  const { found, data, error } = splitFrontmatter(rawContent)

  /* 两种情况分开报：YAML 语法错和「压根没写」的修法完全不同，
     混成一句「frontmatter 有问题」等于让人自己猜。 */
  if (!found) throw new Error(`Missing frontmatter in ${path}`)
  if (error) throw error

  assertFrontmatter(data, path)
  const frontmatter = data

  const searchableContent = stripMarkdown(rawContent)

  return {
    ...frontmatter,
    readingMinutes: getReadingMinutes(rawContent),
    searchText: [
      frontmatter.title,
      frontmatter.description,
      frontmatter.category,
      ...frontmatter.tags,
      searchableContent,
    ]
      .join(" ")
      .toLocaleLowerCase(),
    tableOfContents: getTableOfContents(rawContent),
  }
}
