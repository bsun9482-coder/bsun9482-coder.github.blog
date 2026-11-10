import * as React from "react"

import { cn } from "@/lib/utils"

/* 纯卡片：白底 + 1px 描边 + 极轻阴影，圆角 10px。
   ⚠️ 这一层刻意保持「和 shadcn 上游一致、可以直接重新生成」：
   不要在这里 import 本站的 lib/（倾斜、聚光灯之类），也不要挂业务事件。
   需要鼠标特效的卡请用 components/fx/tilt-card.tsx 的 TiltCard；
   正文里的提示框（mdx Note）直接用这个纯 Card。

   描边用真 border（不用 ring）：这一版没有流光/外圈高亮抢位置，border 更直白，
   hover 时只换颜色，不会多出 1px 尺寸。
   hover 三件事：上浮 4px（.card-lift，0.25s）、描边加深、阴影加一层。
   不加渐变、不加发光、不缩放，也不改 padding/尺寸 —— 位移只用 transform，
   不触发重排，相邻卡片不会被顶开。

   ⚠️ --card-spacing 必须有默认值：这个变量以前只在 [data-size=sm] 里定义，
   默认尺寸下 py/px/p/gap 全是「引用了不存在的变量」的无效声明，浏览器按 0 处理
   —— 于是每张卡都得在调用点自己再写一遍内边距，新写一个裸 <Card> 直接贴边。
   ⚠️ 下面这些注释里千万不要写裸的类名（间距类、尺寸类都一样）：
   Tailwind 连注释文字一起扫，扫到就生成一条没人用的规则。
   现在默认 6（24px），size=sm 覆盖成 3（12px）。
   分工：根节点负责上下留白 + 卡片内各块之间的间距，header/content/footer 负责左右留白。 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "card-lift group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl border border-border bg-card py-(--card-spacing) text-sm text-card-foreground shadow-card [--card-spacing:--spacing(6)] hover:border-foreground/25 hover:shadow-lift has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-semibold tracking-tight group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t border-border p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
