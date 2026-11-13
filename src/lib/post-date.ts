/* 日期显示：把 "2026-11-02" 变成「2026年11月2日」。

   为什么单独一个文件？
   这个函数原来住在 lib/posts.ts 里，而那个文件顶部 import 了
   `virtual:post-metadata`（构建期扫 MDX 得出的文章清单）。只要有人引一下
   formatPostDate，整个清单就会被拖进包里 —— 卡片组件不该为了一个日期格式化
   去背一整个数据源。挪出来之后谁都能用。
   （第 38 轮 lib/posts.ts 和 virtual 模块都删了，这条理由变成历史，
     但「纯函数不依赖数据源」这个写法保留。） */

export function formatPostDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`))
}
