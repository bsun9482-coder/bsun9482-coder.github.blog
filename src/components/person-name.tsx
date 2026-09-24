import { siteContent } from "@/config/site"
import { splitPersonName } from "@/lib/person"

/* 全站展示作者名字统一用它。主名字跟随所在标题的字号与颜色，
   敬称按主名字的 0.6 倍缩放并改用 muted-foreground；侧栏小卡片里 0.6 倍会小到看不清，
   所以给一个 12px 的下限。页面里不要再自己拼一次名字。 */
export function PersonName() {
  const { honorific, primary } = splitPersonName(siteContent.person.name)

  return (
    <>
      {primary}
      {honorific ? (
        <span className="text-[max(0.6em,0.75rem)] font-normal text-muted-foreground">
          {honorific}
        </span>
      ) : null}
    </>
  )
}
