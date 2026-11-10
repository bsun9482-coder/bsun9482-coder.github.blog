import * as React from "react"

import { Card } from "@/components/ui/card"
import { handleSpotlightLeave, handleSpotlightMove } from "@/lib/spotlight"
import { handleTiltLeave, handleTiltMove } from "@/lib/tilt"
import { cn } from "@/lib/utils"

/* 「会跟着鼠标动」的卡片：3D 倾斜 + 聚光灯 + 流动边光。
   为什么单独一层、而不是塞进 ui/card.tsx：
   components/ui/ 的隐含契约是「可以整个从 shadcn 重新生成/升级的层」，它不该依赖
   本站的 lib/ 和视觉规格；而且特效一旦写在 Card 里，每个用到卡的地方都会默认带上，
   不想要的地方只能一个个传 tilt={false} 关掉。
   放在这里之后：Card 是纯的，要不要特效在调用点一眼可见。
   —— 正文里的提示框（mdx 的 Note）就用纯 Card，它不需要鼠标特效。 */
type TiltCardProps = React.ComponentProps<typeof Card> & {
  /** 鼠标跟随倾斜开关 */
  tilt?: boolean
  /** 聚光灯 + 边光开关，默认跟随 tilt —— 关掉倾斜通常也不想留一团跟着鼠标的光 */
  fx?: boolean
}

export function TiltCard({
  tilt = true,
  fx = tilt,
  className,
  onPointerMove,
  onPointerLeave,
  onPointerCancel,
  ...props
}: TiltCardProps) {
  return (
    <Card
      className={cn(fx && "card-fx", className)}
      onPointerCancel={(event) => {
        onPointerCancel?.(event)
        if (fx) handleSpotlightLeave(event)
        if (tilt) handleTiltLeave(event)
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        if (fx) handleSpotlightLeave(event)
        if (tilt) handleTiltLeave(event)
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event)
        /* 先写坐标再倾斜：spotlight 读的是倾斜前的干净矩形（见 lib/spotlight.ts）。 */
        if (fx) handleSpotlightMove(event)
        if (tilt) handleTiltMove(event)
      }}
      {...props}
    />
  )
}
