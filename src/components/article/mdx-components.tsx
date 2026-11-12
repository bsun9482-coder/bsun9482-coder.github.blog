import { InfoIcon } from "lucide-react"

import { ProseTable } from "@/components/article/prose"
import { proseClass } from "@/components/article/prose-class"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { siteContent } from "@/config/site"
import { cn } from "@/lib/utils"
import type { MDXComponents } from "mdx/types"
import type { ComponentProps, ReactNode } from "react"

/* 这一份是「构建期 MDX」正文的组件映射。
   类名不在这里写死，全部来自 components/article/prose-class.ts ——
   运行时 react-markdown 那条路用的是同一份字典，两边排版不会各走各的。 */

type NoteProps = {
  children: ReactNode
  title?: string
}

/* Note 是 MDX 时代的自定义组件（`<Note title="…">…</Note>`）。
   react-markdown 不认识 JSX 组件，所以这个只对老 MDX 文章有效。
   现有两篇正式文章都没用到它 —— 留着是为了以后写新 MDX 时还能用。 */
function Note({
  children,
  title = siteContent.ui.article.noteDefaultTitle,
}: NoteProps) {
  return (
    <Card className="my-6 gap-3 bg-muted/40 shadow-none">
      <CardHeader className="flex-row items-center gap-2 pb-0">
        <InfoIcon className="size-4 text-muted-foreground" />
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-7 text-muted-foreground [&>p]:m-0">
        {children}
      </CardContent>
    </Card>
  )
}

function Heading2({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn(proseClass.h2, className)} {...props} />
}

function Heading3({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn(proseClass.h3, className)} {...props} />
}

export const mdxComponents: MDXComponents = {
  Note,
  /* 标题锚点（rehype-autolink-headings 生成的 <a href="#…">）也走这个组件。
     不区分处理的话，h2/h3 会整段变成蓝色带下划线的"链接"，标题层级全乱 ——
     所以纯锚点链接只继承文字色、不加下划线，只有真正的正文外链才套蓝色。 */
  a: ({ className, href, ...props }) =>
    href?.startsWith("#") ? (
      <a className="text-inherit no-underline" href={href} {...props} />
    ) : (
      <a className={cn(proseClass.a, className)} href={href} {...props} />
    ),
  blockquote: ({ className, ...props }) => (
    <blockquote className={cn(proseClass.blockquote, className)} {...props} />
  ),
  code: ({ className, ...props }) => (
    <code className={cn(proseClass.code, className)} {...props} />
  ),
  h2: Heading2,
  h3: Heading3,
  img: ({ className, alt = "", ...props }) => (
    <img
      alt={alt}
      className={cn(proseClass.img, className)}
      loading="lazy"
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn(proseClass.li, className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn(proseClass.ol, className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn(proseClass.p, className)} {...props} />
  ),
  table: ProseTable,
  td: ({ className, ...props }) => (
    <td className={cn(proseClass.td, className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th className={cn(proseClass.th, className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn(proseClass.ul, className)} {...props} />
  ),
}
