/* 运行时渲染 Markdown（文章正文）。

和另一条路（构建期 MDX）的区别，一句话说完：
  · 老办法：打包时就把 .mdx 编译成 JS 组件，打开网页等于「跑一段已经编译好的代码」
  · 新办法：打开网页时先向 FastAPI 要文章正文（一段字符串），
            再在浏览器里现场把它变成页面上的元素

所以这条路上不存在「组件」——Markdown 里写的 `<Note>` 这种自定义组件
不会被识别（react-markdown 只认标准 Markdown + HTML）。
现有两篇正式文章都没用到自定义组件，所以这里只做标准 Markdown 的映射。

插件各自干什么（四行就能看懂）：
  remark-gfm      支持「GitHub 风味」语法：表格、删除线 ~~x~~、任务列表 - [ ]
  rehype-raw      让正文里的原生 HTML 标签也能渲染（文章里有一处 <input>）
  rehype-slug     给每个标题生成 id（目录靠它跳转，必须和 lib/api-posts.ts 用同一个算法）
  rehype-highlight 给代码块上色，靠 class="hljs" 那一套样式
*/

import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import rehypeRaw from "rehype-raw"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"

import { ProseTable } from "@/components/article/prose"
import { proseClass } from "@/components/article/prose-class"
import { cn } from "@/lib/utils"
import type { Components } from "react-markdown"

/* 高亮主题（浅色）。它会把 .hljs 的背景设成白色 —— 我们的代码块底色是浅灰，
   index.css 末尾有一小段把它压回去，见那里的注释。 */
import "highlight.js/styles/github.css"

/* react-markdown 给每个组件的 props 里都塞了一个 `node`（语法树节点），
   直接 {...props} 展开到 DOM 上会变成 node="[object Object]" 并触发 React 警告。
   所以下面每个自定义组件都先把 node 解构掉。 */
const components: Components = {
  a: ({ node: _node, className, href, ...props }) =>
    href?.startsWith("#") ? (
      /* 页内锚点（目录跳转用）：不染色、不加下划线，否则标题会整段变蓝 */
      <a className="text-inherit no-underline" href={href} {...props} />
    ) : (
      <a className={cn(proseClass.a, className)} href={href} {...props} />
    ),

  blockquote: ({ node: _node, className, ...props }) => (
    <blockquote className={cn(proseClass.blockquote, className)} {...props} />
  ),

  /* 行内代码和代码块是同一个标签 <code>，样式却完全不同：
       行内：浅灰底 + 圆角 + 小内边距
       代码块：透明底（底色由外层 <pre> 的容器给）
     怎么区分？带 language-xxx（有语言标注）或 hljs（高亮已经处理过）就是代码块；
     另外「内容里带换行」也一定是代码块 —— 行内代码不可能跨行。
     这个判断不能省：用 CSS 去覆盖的话，行内样式的 bg-muted 是工具类，
     工具类永远压过普通样式（层序问题），改不动。 */
  code: ({ node: _node, className, children, ...props }) => {
    const isBlock =
      Boolean(className?.includes("language-")) ||
      Boolean(className?.includes("hljs")) ||
      (typeof children === "string" && children.includes("\n"))

    return (
      <code
        className={cn("font-mono", !isBlock && proseClass.code, className)}
        {...props}
      >
        {children}
      </code>
    )
  },

  h2: ({ node: _node, className, ...props }) => (
    <h2 className={cn(proseClass.h2, className)} {...props} />
  ),

  h3: ({ node: _node, className, ...props }) => (
    <h3 className={cn(proseClass.h3, className)} {...props} />
  ),

  /* 图片：文章里全用绝对路径 /images/xxx，所以不需要额外拼前缀 */
  img: ({ node: _node, className, alt = "", ...props }) => (
    <img
      alt={alt}
      className={cn(proseClass.img, className)}
      loading="lazy"
      {...props}
    />
  ),

  li: ({ node: _node, className, ...props }) => (
    <li className={cn(proseClass.li, className)} {...props} />
  ),

  ol: ({ node: _node, className, ...props }) => (
    <ol className={cn(proseClass.ol, className)} {...props} />
  ),

  p: ({ node: _node, className, ...props }) => (
    <p className={cn(proseClass.p, className)} {...props} />
  ),

  /* 代码块外壳：圆角 + 描边 + 浅灰底 + 横向滚动。
     padding 给 <pre>，左右内边距留给每一行（highlight.js 的输出是行内 span，不换行）。 */
  pre: ({ node: _node, className, ...props }) => (
    <div className="my-7 overflow-hidden rounded-xl border border-border bg-secondary">
      <pre
        className={cn(
          "overflow-x-auto py-4 font-mono text-[13px] leading-6",
          className
        )}
        {...props}
      />
    </div>
  ),

  table: ProseTable,

  td: ({ node: _node, className, ...props }) => (
    <td className={cn(proseClass.td, className)} {...props} />
  ),

  th: ({ node: _node, className, ...props }) => (
    <th className={cn(proseClass.th, className)} {...props} />
  ),

  ul: ({ node: _node, className, ...props }) => (
    <ul className={cn(proseClass.ul, className)} {...props} />
  ),
}

/* 代码块里每一行都要左右留白，但 <pre> 的 padding 只作用在整块上。
   用 CSS 给 <code> 补内边距最省事（放在 index.css 的 .article-content 里）。 */

export function MarkdownContent({ source }: { source: string }) {
  return (
    <Markdown
      components={components}
      rehypePlugins={[
        rehypeRaw,
        rehypeSlug,
        /* detect:false —— 没写语言标注的代码块不做「猜语言」。
           猜错比不高亮更难看（一段中文会被当成某种语法涂成彩色）。
           ignoreMissing:true —— 语言名写错时安静跳过，不要在控制台刷警告。 */
        [rehypeHighlight, { detect: false, ignoreMissing: true }],
      ]}
      remarkPlugins={[remarkGfm]}
    >
      {source}
    </Markdown>
  )
}
