import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  /* 标签 = #f4f4f5 浅灰底 + 等宽小字（规格里明确要求 mono）+ 圆角 5px。
     静态元素：不加 hover、不加过渡 —— 标签不可点，动了反而误导。
     分类与标签的区分靠「深字 / 浅字 + 有无描边」，不靠颜色，
     这样整页只有一个强调蓝，信息层级不会被色块打散。 */
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[5px] border border-border px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium tracking-tight whitespace-nowrap focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-secondary text-foreground",
        secondary: "bg-secondary text-foreground",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
        /* 标签统一 #f4f4f5 底（规格要求）；分类与标签的区分从「实底 / 描边」
           改成「深字 / 浅字 + 有无描边」—— 底色一致后层级靠文字色承载，
           整页依然只有一个强调蓝。 */
        outline:
          "border-transparent bg-secondary text-muted-foreground [a]:hover:text-foreground",
        ghost: "border-transparent bg-transparent text-muted-foreground",
        link: "link-underline border-transparent bg-transparent text-brand",
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
