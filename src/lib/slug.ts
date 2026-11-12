/* slug 的小工具。

slug 是什么？
  就是地址里代替标题的那一小段英文，例如
      /resources/my-first-post
                └── 这一段就是 slug ──┘
  为什么不直接用标题？因为标题里有中文、空格、标点，放进网址要转义成
  %E4%B8%AD%E6%96%87 这种一长串，既难念也难看。所以给每篇文章起一个短名。

后端的规定（见 backend/schemas.py）：只能用英文、数字、- 和 _。
所以下面这个正则和它保持一致 —— 前端先拦一次，用户不用等服务器回 422 才知道。

⚠️ 中文标题转不出英文 slug。
   "我的第一篇博客" 里没有一个 a-z0-9，转换结果会是空字符串。
   这是有意的：与其瞎编一串拼音/乱码，不如让用户自己填一个记得住的
   （my-first-post 这类）。界面上会提示他这件事。
*/

export const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // 非英数字一律换成连字符（中文、空格、标点全在这一步被替换掉）
    .replace(/-{2,}/g, "-") // 连续连字符合成一个
    .replace(/^-+|-+$/g, "") // 掐掉首尾的连字符
    .slice(0, 80) // 别让 slug 长到没法看
}
