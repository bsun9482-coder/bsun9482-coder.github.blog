/* 读全站作者资料的唯一入口。
   单独一个文件是为了让 site-profile-context.tsx 只导出组件
   （react-refresh 规则：组件文件导出 hook 会导致热更新整页刷新）。 */

import { useContext } from "react"

import { SiteProfileContext, type SiteProfile } from "@/lib/site-profile"

/** 页面里不要直接 import siteContent.person —— 那是兜底数据源，不是真相。 */
export function useSiteProfile(): SiteProfile {
  return useContext(SiteProfileContext)
}
