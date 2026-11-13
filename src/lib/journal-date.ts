/* 日记的日期显示 —— 两个纯函数，谁用谁引。

为什么不跟数据源放一起？
  这两个函数当初住在 lib/journal.ts（构建期用 import.meta.glob 收集日记 MDX 的那个文件），
  卡片组件只要引一次日期格式化，就会把整个「日记清单 + MDX 模块」拖进主包。
  所以把它们单独放一个文件：纯函数和「数据从哪来」彻底解绑。
  现在那套 MDX 收集逻辑已经删了（第 38 轮），但这个文件仍然是对的写法 ——
  日期格式化不该知道数据是接口来的还是文件来的。
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
