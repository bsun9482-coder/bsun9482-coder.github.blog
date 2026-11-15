/* 后台内容区的外框。

为什么后台不用 <Container>：那个是全站版心（最大 1120 + 两侧留白），
给访客页用的。后台左边已经有 220px 的侧栏，再套一层版心会在宽屏上缩成
窄窄一条；而编辑器的「正文 + 预览」两栏在这个宽度下会被挤成缝。
所以后台自己给一套：宽度铺满内容区（上限 1180），内边距 16 / 24。

⚠️ 别在页面里再写一遍这一串类名：
   改内边距要同时改五个页面，漏掉的那个页面一进来就会「比别人贴边」。
*/

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

const ADMIN_SHELL =
  "mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"

export function AdminShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn(ADMIN_SHELL, className)}>{children}</div>
}
