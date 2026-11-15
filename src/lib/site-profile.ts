/* 作者资料的「形状」与它和接口数据之间的换算。纯 .ts，不碰 React ——
   这样 .tsx 那边只留组件和 hook，Fast Refresh 才认（见 site-profile.tsx 顶部）。

为什么拆成两个文件：ESLint 的 react-refresh/only-export-components 规定
「一个文件要么只导出组件，要么就别导出别的」。把 toSiteProfile / 兜底值放这里，
组件文件里就只剩 Provider 和 useSiteProfile，改样式时热更新不会整页刷新。
   这个仓库里 ui/ 目录是关掉这条规则的（第 X 轮的取舍），
   但 lib/ 下没有关 —— 那是刻意的：lib 应该保持「组件与数据分开」。

⚠️ 和 admin-dashboard 那份的区别：那边直接吃 Profile（字段可为 null），
   因为它要回填输入框、要区分「空」和「没填」。前台只要展示，
   所以这里把 null 都归一掉了，页面里不用判空。
*/

import { createContext } from "react"

import { siteContent } from "@/config/site"
import { getProfile, type Profile } from "@/lib/api-profile"

/** 前台展示用的作者资料。字段名和 Profile 一致，但**没有 null**。 */
export type SiteProfile = {
  name: string
  /** 副标题（例如「（恩师萧氏）」）。空串时页面不渲染这一行。 */
  subtitle: string
  /** 签名。空串时页面不渲染那一段。 */
  bio: string
  /** 城市。空串时页面不渲染位置那一项。 */
  location: string
  /** 头像地址。**永远有值**：没上传过头像就是站点自带的 /avatar.jpg */
  avatarUrl: string
  /** 头像加载不出 / 没有头像时显示的单个字 */
  initial: string
  /** true = 还没从接口拿到，正在用兜底值 */
  isFallback: boolean
}

/* 名字与敬称的拆分。规则和 src/lib/person.ts 的 splitPersonName 相同，但那个
   只处理「配置里那一整串」，这里还要处理「接口给的名字可能压根没有敬称」，
   且拆不出来时要整串当名字 —— 一行分支，不值得为它改公共函数。 */
function splitName(fullName: string): { primary: string; honorific: string } {
  if (!fullName.endsWith("）")) return { primary: fullName, honorific: "" }
  const open = fullName.lastIndexOf("（")
  if (open <= 0) return { primary: fullName, honorific: "" }
  return { primary: fullName.slice(0, open), honorific: fullName.slice(open) }
}

/* 单个字：Array.from 按「看得见的字符」切，避免 emoji 被切成半个（会显示成方块）。 */
function firstChar(text: string): string {
  const chars = Array.from(text.trim())
  return chars.length > 0 ? chars[0] : ""
}

/* 兜底值 = site.ts 里那份「写死」的。特意把 person.name 拆成主名字 + 敬称再拼，
   是为了让兜底状态下「名字 / 副标题」的结构也和真实数据一致。
   接口没回来、或者请求失败，全站就是这一份 —— 和上线前看到的一模一样。 */
export function fallbackProfile(): SiteProfile {
  const person = siteContent.person
  const { honorific, primary } = splitName(person.name)

  return {
    name: primary,
    subtitle: honorific,
    bio: person.introduction,
    location: person.location,
    avatarUrl: person.avatarUrl,
    initial: person.avatarInitial || firstChar(primary),
    isFallback: true,
  }
}

/** 接口数据 → 前台展示数据。 */
export function toSiteProfile(profile: Profile): SiteProfile {
  const name = profile.name.trim()
  return {
    name,
    subtitle: profile.subtitle.trim(),
    /* 签名和城市允许为空（后台可以清空）。空着就留空 ——
       「作者说他没话说」和「我们替他补一句」不是一回事，所以不拿默认值顶替。
       页面那边判空后整段不渲染。 */
    bio: profile.bio.trim(),
    location: profile.location.trim(),
    /* ⚠️ 这就是「不裂图」的那一条：后端在没上传过头像时给的是 **null**，
       而前台必须有东西可显示 —— 退回站点自带的 /avatar.jpg（原来写死的那张）。 */
    avatarUrl: profile.avatarUrl || siteContent.person.avatarUrl,
    initial: firstChar(name) || siteContent.person.avatarInitial,
    isFallback: false,
  }
}

/* ---------------- 单例请求 ----------------
   为什么放在这个纯 .ts 里而不是 .tsx 里：模块级可变状态 + 函数导出，
   放在组件文件里会被 react-refresh/only-export-components 拦下（它要求组件文件只导出组件）。
   放这里还有额外好处：这条缓存不依赖 React，谁都能调。

   ⚠️ 失败后要把 promise 清空，否则一次网络抖动会让整个会话永远拿到 rejected。 */
let cached: Promise<Profile> | null = null

/** 取资料：全局只发一次请求，后来者复用同一个 promise。 */
export function loadSiteProfileOnce(): Promise<Profile> {
  if (!cached) {
    cached = getProfile().catch((error: unknown) => {
      /* 清掉缓存：下次挂载会重试。这一次失败由调用方去决定显示兜底。 */
      cached = null
      throw error
    })
  }
  return cached
}

/* ---------------- 共享 context ----------------
   Provider（组件，在 site-profile-context.tsx）和 hook（在 site-profile-hook.ts）
   是两个文件，都得拿到同一个 context 对象 —— 否则 hook 读到的是另一个空 context。

   为什么要拆成三个文件：ESLint 的 react-refresh 规则只允许「组件文件导出组件」，
   同一文件里既导出 <SiteProfileProvider> 又导出 useSiteProfile 会让热更新整页刷新。
   而 `.tsx` 与 `.ts` 只差在 JSX，规则一视同仁 ⇒ 只能把 hook 挪走。

   默认值 = 兜底资料：万一有组件在 Provider 外面调 hook，它也能正常渲染，不会抛错。 */
export const SiteProfileContext = createContext<SiteProfile>(fallbackProfile())
