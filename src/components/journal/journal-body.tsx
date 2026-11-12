/* 日记正文的渲染 —— 只做一件事：把纯文本切成段落。

为什么不上 Markdown（文章那套 react-markdown）？
  日记的定位是「两三句话」，后台也只给一个多行输入框。
  给它上一整套 Markdown，就带来两个负担：
    · 用户会开始期待「我写的 **加粗** 应该生效」，而日记里其实用不上；
    · 多引一份渲染逻辑，以后改文章排版时又多一处要对齐的地方。
  所以这里只认一个规则 —— **空行分段**（和以前写 .mdx 时的手感一致）。

为什么段落里还要 whitespace-pre-line？
  有人习惯在同一段里换行（不打空行）。保留单换行，看起来才和他敲的一样；
  如果直接交给 HTML，换行会被压成一个空格，读起来变成挤在一起的一大坨。
*/

export function JournalBody({ content }: { content: string }) {
  /* 连续多个空行只切一次；首尾空白先去掉，避免出现空的 <p>（会多出一段空隙） */
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  return (
    <>
      {paragraphs.map((text, index) => (
        /* 索引当 key：日记正文是纯文本、不会重排也不会被插入删除，
           用内容当 key 反而在内容里有重复段落时会撞车。 */
        <p className="whitespace-pre-line" key={index}>
          {text}
        </p>
      ))}
    </>
  )
}
