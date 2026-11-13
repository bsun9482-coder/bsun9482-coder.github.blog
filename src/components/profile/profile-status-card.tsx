import { Card, CardContent } from "@/components/ui/card"
import { siteContent } from "@/config/site"

/* 「此刻状态」卡：正在学习 / 最近完成 / 接下来，三行靠分隔线切开。

   第 42 轮从左栏挪出来：左栏现在是「轮播 → 此刻状态 → 标签云」，
   这样左栏三段都是内容，右栏留给「今日说说 / 相册 / 实时信息」这些轻信息。
   单独成文件是因为它已经不属于右栏那组了（那个文件叫 aside）。

   不用轮播：三条信息本来就该一眼看完，一次只露一条反而要多等。 */
export function ProfileStatusCard() {
  const ui = siteContent.ui.profile

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
          {ui.statusLabel}
        </p>
        <dl className="divide-y divide-border">
          {siteContent.profileStatus.map((item) => (
            <div className="py-3 first:pt-0 last:pb-0" key={item.label}>
              <dt className="text-xs font-medium text-foreground">
                {item.label}
              </dt>
              <dd className="mt-1 text-sm leading-6 text-muted-foreground">
                {item.detail}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
