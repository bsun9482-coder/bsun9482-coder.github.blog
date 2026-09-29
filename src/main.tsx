import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"

/* 注意：history.scrollRestoration = "manual" 放在 index.html 的 <head> 内联脚本里，
   不在这个文件 —— 它必须比入口模块更早执行，理由见那里的注释。 */

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
