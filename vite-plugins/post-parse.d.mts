/* post-parse.mjs 的类型声明。
   实现是原生 ESM（为了能被 node 直接跑），所以类型得手写一份。
   只声明消费方真正用到的形状 —— 完整 mdast 类型没必要引进来。 */

/** mdast 节点：只描述我们用到的字段 */
export type TocNode = {
  type?: string
  depth?: number
  value?: string
  position?: { start: { line: number }; end: { line: number } }
  children?: TocNode[]
}

/** 目录条目：level 只会是 2 或 3（见 collectHeadings） */
export type TocEntry = { id: string; title: string; level: 2 | 3 }

export type FrontmatterSplit =
  | { found: false; data?: undefined; error?: undefined }
  | { found: true; data: unknown; error?: undefined }
  | { found: true; data?: undefined; error: unknown }

export declare const FRONTMATTER_PATTERN: RegExp

/** 拆出文件开头的 frontmatter，不抛异常（三种结果见 FrontmatterSplit） */
export declare function splitFrontmatter(raw: string): FrontmatterSplit

/** 去掉 markdown 记号，只留可读文本 */
export declare function stripMarkdown(value: string): string

/** 解析成 mdast（同步，不进 rehype/recma） */
export declare function parseArticle(raw: string): TocNode

/** 标题的纯文本（对齐渲染侧 hast-util-to-string 的口径） */
export declare function headingText(node: TocNode): string

/** 收集 h2 / h3（跳过脚注区），塞进 out */
export declare function collectHeadings(node: TocNode, out: TocNode[]): void

/** 目录：id 用 GithubSlugger，和正文锚点同一口径 */
export declare function getTableOfContents(raw: string): TocEntry[]

/** 阅读时长（分钟），中文按字、西文按词，每 300 计一分钟，最少 1 */
export declare function getReadingMinutes(raw: string): number
