import { useSiteProfile } from "@/lib/site-profile-hook"
import { splitPersonName } from "@/lib/person"

/* 全站展示作者名字统一用它。主名字跟随所在标题的字号与颜色，
   敬称按主名字的 0.6 倍缩放并改用 muted-foreground；侧栏小卡片里 0.6 倍会小到看不清，
   所以给一个 12px 的下限。页面里不要再自己拼一次名字。

⚠️ 数据来自 useSiteProfile()（GET /api/profile，全站只请求一次），
   不再读 siteContent.person —— 否则在工作台改了名字，页头不会变。
   接口没回来或失败时它给的已经是 site.ts 里的兜底名字，所以这里不用判空。

两种排法，由 inline 控制：
  · inline（默认）—— 页头 / 侧栏用：主名字 + 同行的小字敬称，省一行高度
  · 分行        —— 博客页 hero 用：主名字一行，副标题小字另起一行（要求它是「名字下方」） */
export function PersonName({ inline = true }: { inline?: boolean }) {
  const { name, subtitle } = useSiteProfile()
  /* 名字和敬称可能已经被后端拆成两个字段（name / subtitle），也可能整串塞在 name 里
     （比如站长直接把「旺仔冰子（恩师萧氏）」写进了名字框）。
     两种情况都要排得对，所以先按 splitPersonName 再拆一次：
       - 已经拆过 → 拆不出来，整串当主名字，副标题用 subtitle
       - 没拆过   → 拆出来，副标题用拆出来的那段（此时 subtitle 通常也是空的） */
  const { honorific, primary } = splitPersonName(name)
  const suffix = honorific || subtitle

  if (inline) {
    return (
      <>
        {primary}
        {suffix ? (
          <span className="text-[max(0.6em,0.75rem)] font-normal text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </>
    )
  }

  return (
    <>
      {primary}
      {suffix ? (
        <span className="mt-1.5 block text-note leading-snug font-normal text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </>
  )
}
