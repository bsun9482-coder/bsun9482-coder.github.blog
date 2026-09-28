import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive/50 aria-invalid:ring-3 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* 主按钮：电光蓝底 + 一圈外发光，hover 时发光增强（base 已有 transition-all） */
        default:
          "bg-primary text-primary-foreground shadow-[0_0_15px_color-mix(in_oklab,var(--glow-blue)_30%,transparent)] hover:bg-primary/90 hover:shadow-[0_0_22px_color-mix(in_oklab,var(--glow-blue)_50%,transparent)]",
        /* outline 上原本还有一条 `aria-expanded:bg-glow-blue/10`，但在暗色主题下**它从来没生效过**：
           它 (`aria-expanded:` 变体) 与 `dark:bg-input/30` 同为 (0,2,0) 特异性，只靠源码顺序决定胜负，
           而实测展开态算出来就是 bg-input/30。删掉 dark: 之后这条路会让它"复活"，展开态颜色会变，
           所以这里把它去掉，保持视觉零变化。若想让展开态真的高亮，把这条加回来即可。 */
        outline:
          "border-input bg-input/30 hover:bg-glow-blue/10 hover:text-foreground aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-glow-blue/10 aria-expanded:bg-glow-blue/10 aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-glow-blue/10 hover:text-foreground aria-expanded:bg-glow-blue/10 aria-expanded:text-foreground",
        destructive:
          "bg-destructive/20 text-destructive hover:bg-destructive/30 focus-visible:border-destructive/40 focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
