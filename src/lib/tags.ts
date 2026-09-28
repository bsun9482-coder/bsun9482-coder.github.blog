import { posts } from "@/lib/posts"
import type { Post } from "@/types/post"

/* 预设冷色板：蓝 → 紫 → 青 → 粉 → 绿 → 橙。
   存的是 Tailwind 类名，对应的颜色令牌定义在 src/index.css
   （--glow-blue / --glow-purple / --tag-cyan / --tag-pink / --tag-green / --tag-orange）。
   加色、删色、换顺序都只改这一个数组，标签卡片会自动跟着变。
   注意：**必须存完整类名**（"bg-tag-cyan"），不能拼（"bg-" + 变量）——
   Tailwind 是靠扫描源码里的字面量生成工具类的，拼出来的类名不会被生成。 */
const TAG_PALETTE = [
  "bg-glow-blue",
  "bg-glow-purple",
  "bg-tag-cyan",
  "bg-tag-pink",
  "bg-tag-green",
  "bg-tag-orange",
] as const

export type TagItem = {
  label: string
  dot: string
}

/* 从文章 frontmatter 的 tags 里提取全部标签并去重。
   顺序 = 首次出现的顺序，而 posts 已按日期倒序，所以"最近写的那篇"的标签排在最前面。
   用 Set 去重是保序的，比 reduce 成对象再取 keys 更直观，也天然吃掉了空字符串之类的重复。 */
export function collectTags(source: readonly Post[] = posts): string[] {
  return [...new Set(source.flatMap((post) => post.tags))]
}

/* 按索引在色板里循环取色。
   取模前先归一化，这样理论上传入负数或超大索引也不会取到 undefined。 */
export function tagColorAt(index: number): string {
  const size = TAG_PALETTE.length
  return TAG_PALETTE[((index % size) + size) % size]
}

/* 标签卡片要的数据：文案 + 圆点颜色类名。
   颜色不写死映射，纯粹由"在去重后的列表里排第几"决定 —— 标签增减时只是重新着色，
   不需要维护任何 标签→颜色 的表格。 */
export function getTagItems(source: readonly Post[] = posts): TagItem[] {
  return collectTags(source).map((label, index) => ({
    label,
    dot: tagColorAt(index),
  }))
}
