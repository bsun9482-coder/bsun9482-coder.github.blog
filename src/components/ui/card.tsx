import * as React from "react"
import { cn } from "cn"
import { handleSpotlightLeave, handleSpotlightMove } from "@/lib/spotlight"
import { handleTiltLeave, handleTiltMove } from "@/lib/tilt"

function Card({
  className,
  size = "default",
  tilt = true,
  fx = tilt,
  onPointerMove,
  onPointerLeave,
  onPointerCancel,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  /** 鼠标跟随倾斜开关。正文里的提示框（mdx Note）传 false。 */
  tilt?: boolean
  /** 聚光灯 + 边光开关，默认跟随 tilt —— 正文里的卡片不需要鼠标特效。 */
  fx?: boolean
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      onPointerMove={(event) => {
        onPointerMove?.(event)
        /* 先写坐标再倾斜：spotlight 读的是倾斜前的干净矩形（见 lib/spotlight.ts）。 */
        if (fx) handleSpotlightMove(event)
        if (tilt) handleTiltMove(event)
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        if (fx) handleSpotlightLeave(event)
        if (tilt) handleTiltLeave(event)
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event)
        if (fx) handleSpotlightLeave(event)
        if (tilt) handleTiltLeave(event)
      }}
      className={cn(
        /* 极简卡片：白底 + 1px 描边 + 极轻阴影，圆角 10px。
           描边用真 border（不再用 ring）：这一版没有流光/外圈高亮抢位置，border 更直白，
           hover 时只换颜色，不会多出 1px 尺寸。
           hover 三件事：上浮 4px（.card-lift，0.25s）、描边加深、阴影加一层。
           不加渐变、不加发光、不缩放，也不改 padding/尺寸 —— 位移只用 transform，
           不触发重排，相邻卡片不会被顶开。
           .card-fx 是第 12 轮加的鼠标特效（聚光灯 + 流动边光），开关见上面的 fx。 */
        "card-lift group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-[10px] border border-border bg-card py-(--card-spacing) text-sm text-card-foreground shadow-card hover:border-foreground/25 hover:shadow-lift has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-[10px] *:[img:last-child]:rounded-b-[10px]",
        fx && "card-fx",
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
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-[10px] px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
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
        "flex items-center rounded-b-[10px] border-t border-border p-(--card-spacing)",
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
