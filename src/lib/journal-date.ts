/* 日记的日期显示 —— 从 lib/journal.ts 里搬出来的两个小函数。

为什么要搬？
  lib/journal.ts 顶部有一句 `import.meta.glob("/content/journal/*.mdx", { eager: true })`，
  意思是「把目录下所有日记的 MDX 都打进包里」。
  以前卡片组件从那个文件里取 formatJournalDate，于是整包日记（连同那个 glob）
  就被一起拖进主包 —— 而日记现在已经改从接口读了，这些 MDX 一个字节都不该再进主包。
  所以「格式化日期」这种纯函数单独放一个文件，谁用谁引，不牵出数据源。
*/

/** 2026-11-09 → 2026.11.09（等宽字体下比短横线更容易扫读） */
export function formatJournalDate(date: string) {
  return date.replaceAll("-", ".")
}

/** 2026-11-09 → 周日。日期非法时返回空串，调用方决定要不要显示。 */
export function formatJournalWeekday(date: string) {
  const parsed = new Date(`${date}T00:00:00`)

  return Number.isNaN(parsed.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(parsed)
}
