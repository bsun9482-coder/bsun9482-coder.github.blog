/* 表格组件 —— 两套渲染方式（构建期 MDX / 运行时 react-markdown）共用同一个。

为什么单独拎出来？
  表格要能横向滚动：手机上五列的表格必然超出屏幕。
  而光给 <table> 加 overflow 是不生效的（overflow 只对「本身有尺寸的盒子」有效，
  table 的宽度是被内容撑出来的），必须在外面套一层 div 当「取景框」。

类名在 prose-class.ts，这里只管结构。

⚠️ 为什么要把 node 解构掉？
  react-markdown 会给每个自定义组件的 props 里塞一个 node（语法树节点）。
  原样 {...props} 展开到 DOM 上会变成 node="[object Object]" 并触发 React 警告。
  MDX 那条路不传 node，所以多这一个解构对老文章毫无影响。
*/

import type { ComponentProps, ReactNode } from "react"

export function ProseTable({
  node: _node,
  children,
  className,
  ...props
}: ComponentProps<"table"> & { node?: unknown; children?: ReactNode }) {
  return (
    <div className="my-7 overflow-x-auto rounded-xl border border-border">
      <table className={`w-full text-sm ${className ?? ""}`} {...props}>
        {children}
      </table>
    </div>
  )
}
