/* 日期显示：把 "2026-11-02" 变成「2026年11月2日」。

   为什么单独一个文件？
   原来这个函数住在 lib/posts.ts 里，而那个文件顶部 import 了
   `virtual:post-metadata`（构建期扫出来的 MDX 清单）。只要有人从它里面
   拿一下 formatPostDate，整个 MDX 清单就会被拖进包里 ——
   以后前台改从接口取文章时，卡片组件不该再和 MDX 有任何牵连。
   挪出来之后两边都能用，谁也不用为了一行日期格式化去背一整个数据源。 */

export function formatPostDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`))
}
