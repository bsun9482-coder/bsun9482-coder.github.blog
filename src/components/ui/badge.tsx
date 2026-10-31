import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  /* 标签 = 浅灰底 + 1px 描边 + 等宽小字（规格里明确要求标签用 mono）。
     不再有彩色底 —— 分类与标签的区分靠「实底 / 描边」而不是颜色，
     这样整页只有一个强调蓝，信息层级不会被色块打散。 */
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium tracking-tight whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-secondary text-foreground",
        secondary: "bg-muted text-muted-foreground",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
        outline:
          "bg-transparent text-muted-foreground [a]:hover:text-foreground",
        ghost: "border-transparent bg-transparent text-muted-foreground",
        link: "border-transparent bg-transparent text-brand hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
