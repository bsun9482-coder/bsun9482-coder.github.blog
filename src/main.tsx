import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

/* Markdown 编辑器的样式必须在这里引两遍 —— 一份给「编辑框」，一份给「预览区」。
   为什么是两份：@uiw/react-md-editor 的编辑区样式（markdown-editor.css）里
   并没有预览区要用的 .wmde-markdown 排版规则，那套规则在
   @uiw/react-markdown-preview 自己的 markdown.css 里。只引第一份的话，
   右边预览出来的标题/列表/代码块会全是「没样式的裸文字」。 */
import "@uiw/react-md-editor/markdown-editor.css"
import "@uiw/react-markdown-preview/markdown.css"

import "./index.css"
import App from "./App.tsx"

/* 注意：history.scrollRestoration = "manual" 放在 index.html 的 <head> 内联脚本里，
   不在这个文件 —— 它必须比入口模块更早执行，理由见那里的注释。 */

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
