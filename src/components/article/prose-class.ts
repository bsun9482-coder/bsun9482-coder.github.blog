/* 正文排版的「样式字典」—— 所有正文元素长什么样，只在这一个文件里定义。

为什么要有这个文件？
  正文是「运行时拉接口 + react-markdown」渲染的（components/article/markdown-content.tsx），
  而 react-markdown 的自定义组件是一个个零散的映射函数，很容易写着写着就各写各的
  「段落 16px、行高 8、表格有圆角描边……」。把类名集中在这里，
  以后调整正文样式只改一处，不会出现「这篇文章的表格和那篇不一样」。
  （日记正文不走这套：它只是纯文本分段，样式写在 journal-body.tsx。）

⚠️ 别在这里写组件特有的行为（比如提示卡的图标）。这里只放「长什么样的类名」。

⚠️ 为什么是一个 .ts 而不是跟着表格组件放在 prose.tsx 里？
  因为「热更新友好」这条规矩（react-refresh/only-export-components）要求
  「一个文件只导出组件」。prose.tsx 里既有组件 ProseTable、又有常量，
  改一下类名就会让整页状态被重置，体验很差。常量单独一个文件就没这问题。
*/

export const proseClass = {
  a: "link-underline font-medium text-brand hover:text-brand-hover",
  blockquote: "my-6 border-l-2 pl-5 text-muted-foreground italic",
  /* 行内代码。代码块里的 code 会被下面 CSS 的 `.article-content pre code` 抹平背景 */
  code: "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em]",
  h2: "mt-12 scroll-mt-24 border-b pb-3 text-title font-semibold tracking-tight first:mt-0",
  h3: "mt-8 scroll-mt-24 text-lg font-semibold tracking-tight",
  img: "my-8 rounded-xl border border-border",
  li: "my-2 pl-1",
  ol: "my-5 list-decimal space-y-1 pl-6",
  p: "my-5 leading-8 text-foreground/85",
  td: "border-t border-border px-4 py-3",
  th: "border-b border-border bg-muted/50 px-4 py-3 text-left font-medium",
  ul: "my-5 list-disc space-y-1 pl-6",
} as const
