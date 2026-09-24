/* 作者名字的展示拆分。site.ts 里 `person.name` 是一整串「主名字（敬称）」，
   拆法只在这里实现一次，首页 Hero、博客侧栏卡片共用同一份逻辑，
   页面里不要各自写正则或下标去切名字。 */

const HONORIFIC_OPEN = "（"
const HONORIFIC_CLOSE = "）"

/**
 * 把「主名字（敬称）」拆成两段。只有名字以全角右括号结尾、
 * 且括号前面还有内容时才算敬称；否则整串都视为主名字。
 */
export function splitPersonName(fullName: string) {
  if (!fullName.endsWith(HONORIFIC_CLOSE)) {
    return { honorific: "", primary: fullName }
  }

  const openIndex = fullName.lastIndexOf(HONORIFIC_OPEN)
  if (openIndex <= 0) {
    return { honorific: "", primary: fullName }
  }

  return {
    honorific: fullName.slice(openIndex),
    primary: fullName.slice(0, openIndex),
  }
}
