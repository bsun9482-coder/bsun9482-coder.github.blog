import { mdxComponents } from "@/components/article/mdx-components"
import { cn } from "@/lib/utils"
import type { MDXComponents } from "mdx/types"
import type { ComponentProps } from "react"

/* 日记正文的排版：在文章那套 mdxComponents 上做减法。
   文章段落是 my-5 + 18px 行高 8，放进 680px 宽的卡片里会显得又松又散；
   日记是一小段话，块间距收到 12px、字号 15px，靠外层 [&>*+*]:mt-3 统一给间距，
   所以这里所有块级元素一律 my-0 —— 间距只在一个地方定义，不会两处打架。

   whitespace-pre-line 是「保留换行」的落点：MDX 把单个换行解析成文本里的 \n，
   HTML 默认把它折成空格；pre-line 会保留 \n、继续折叠多余空格，
   于是作者在 mdx 里怎么断行，卡片里就怎么断行，不用每行结尾敲两个空格。 */

function Paragraph({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "my-0 leading-7 whitespace-pre-line text-foreground/85",
        className
      )}
      {...props}
    />
  )
}

function Heading2({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("my-0 text-base font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

function Heading3({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn("my-0 text-[15px] font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

function UnorderedList({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul className={cn("my-0 list-disc space-y-1 pl-5", className)} {...props} />
  )
}

function OrderedList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      className={cn("my-0 list-decimal space-y-1 pl-5", className)}
      {...props}
    />
  )
}

function ListItem({ className, ...props }: ComponentProps<"li">) {
  return <li className={cn("my-0 leading-7", className)} {...props} />
}

function Blockquote({ className, ...props }: ComponentProps<"blockquote">) {
  return (
    <blockquote
      className={cn("my-0 border-l-2 pl-4 text-muted-foreground", className)}
      {...props}
    />
  )
}

export const journalMdxComponents: MDXComponents = {
  ...mdxComponents,
  blockquote: Blockquote,
  h2: Heading2,
  h3: Heading3,
  li: ListItem,
  ol: OrderedList,
  p: Paragraph,
  ul: UnorderedList,
}
