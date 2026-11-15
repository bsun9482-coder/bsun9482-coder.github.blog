/* 全站作者资料：只放 Provider 组件（hook 在 site-profile-hook.ts）。

⚠️ 为什么要有这一层（而不是每个组件各调一次 getProfile）？
  名字出现在页头、页脚版权、首页小头像、博客页 hero —— 四个地方。
  各自请求一次就是四次 /api/profile，而且**首屏会闪**：先渲染兜底名字，
  几百毫秒后跳成数据库里的名字，一眼就能看出来。
  单例缓存解决「少请求」，Context 解决「少订阅」，兜底解决「加载中不好看」。

⚠️ 和 lib/api-profile.ts 的分工：
   api-profile 只管「怎么调接口」，这一层管「调几次、失败怎么办、全站怎么共享」。
   后台工作台直接用 api-profile（它要拿最新那份、改完能立刻回填）；
   前台用 useSiteProfile()（只要一份稳定的展示数据）。

⚠️ 文件切分（三个文件，缺一不可）：
   site-profile.ts          —— 形状、换算、单例缓存、context 对象（纯 .ts，可测）
   site-profile-context.tsx —— 本文件，只有 Provider 组件
   site-profile-hook.ts     —— useSiteProfile()
   合在一起会被 react-refresh/only-export-components 判红（组件文件不许导出 hook）。 */

import { useEffect, useState, type ReactNode } from "react"

import {
  SiteProfileContext,
  fallbackProfile,
  loadSiteProfileOnce,
  toSiteProfile,
  type SiteProfile,
} from "@/lib/site-profile"

export function SiteProfileProvider({ children }: { children: ReactNode }) {
  /* 初值就是兜底值：首帧就能画出名字和头像，不会出现空白或占位框。 */
  const [profile, setProfile] = useState<SiteProfile>(fallbackProfile)

  useEffect(() => {
    let cancelled = false

    loadSiteProfileOnce()
      .then((fresh) => {
        if (cancelled) return
        setProfile(toSiteProfile(fresh))
      })
      .catch(() => {
        /* 失败就继续用兜底值。这里**不设 error 状态**：
           作者资料读不出来不该让访客看到一条红字 —— 他看到的应该是那个人的名字，
           而不是「加载失败」。想确认接口挂没挂，看网络面板即可。 */
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SiteProfileContext.Provider value={profile}>
      {children}
    </SiteProfileContext.Provider>
  )
}
