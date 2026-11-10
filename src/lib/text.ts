/* 文案占位符填充。
   配置里的计数文案写成 "共 {count} 篇" 这种带占位符的整句，而不是在组件里用
   字符串拼接 —— 中文语序一调就得改 JSX，占位符方案只改 site.ts。
   占位符找不到对应值时替换成空串（不抛错：少一条文案不该让整页白屏）。 */
export function fillTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined ? "" : String(value)
  })
}
