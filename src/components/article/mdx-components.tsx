import { InfoIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { MDXComponents } from "mdx/types"
import type { ComponentProps, ReactNode } from "react"

type NoteProps = {
  children: ReactNode
  title?: string
}

function Note({ children, title = "提示" }: NoteProps) {
  return (
    <Card className="my-6 gap-3 border-primary/20 bg-primary/5">
      <CardHeader className="flex-row items-center gap-2 pb-0">
        <InfoIcon className="size-4 text-primary" />
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-7 text-muted-foreground [&>p]:m-0">
        {children}
      </CardContent>
    </Card>
  )
}

function Heading2({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "mt-12 scroll-mt-24 border-b pb-3 text-2xl font-semibold tracking-tight first:mt-0",
        className
      )}
      {...props}
    />
  )
}

function Heading3({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "mt-8 scroll-mt-24 text-xl font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

export const mdxComponents: MDXComponents = {
  Note,
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground",
        className
      )}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "my-6 border-l-2 pl-5 text-muted-foreground italic",
        className
      )}
      {...props}
    />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn(
        "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em]",
        className
      )}
      {...props}
    />
  ),
  h2: Heading2,
  h3: Heading3,
  img: ({ className, alt = "", ...props }) => (
    <img
      alt={alt}
      className={cn("my-8 rounded-xl border", className)}
      loading="lazy"
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("my-2 pl-1", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn("my-5 list-decimal space-y-1 pl-6", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn("my-5 leading-8 text-foreground/85", className)}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="my-7 overflow-x-auto rounded-xl border">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border-t px-4 py-3", className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn("bg-muted/50 px-4 py-3 text-left font-medium", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-5 list-disc space-y-1 pl-6", className)} {...props} />
  ),
}
