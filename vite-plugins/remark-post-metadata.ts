import GithubSlugger from "github-slugger"
import { parse as parseYaml } from "yaml"

type Frontmatter = {
  title: string
  description: string
  date: string
  category: string
  tags: string[]
  draft?: boolean
}

function cleanHeading(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+#+\s*$/, "")
    .trim()
}

function stripMarkdown(value: string) {
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

function getTableOfContents(rawContent: string) {
  const slugger = new GithubSlugger()
  const headings: Array<{ id: string; title: string; level: 2 | 3 }> = []
  const headingPattern = /^(#{2,3})\s+(.+)$/gm

  for (const match of rawContent.matchAll(headingPattern)) {
    const title = cleanHeading(match[2])
    if (!title) continue

    headings.push({
      id: slugger.slug(title),
      title,
      level: match[1].length as 2 | 3,
    })
  }

  return headings
}

function getReadingMinutes(rawContent: string) {
  const content = stripMarkdown(rawContent)
  const chineseCharacters = content.match(/[\u3400-\u9fff]/g)?.length ?? 0
  const latinWords = content.match(/[a-zA-Z0-9_]+/g)?.length ?? 0

  return Math.max(1, Math.ceil((chineseCharacters + latinWords) / 300))
}

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
  const match = rawContent.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  const frontmatter: unknown = match ? parseYaml(match[1]) : undefined

  assertFrontmatter(frontmatter, path)

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
