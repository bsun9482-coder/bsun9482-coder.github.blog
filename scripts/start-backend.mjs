// 一键启动本地后端（FastAPI）。开完浏览器直接访问 http://127.0.0.1:8000/docs
//
// 为什么要有这个脚本：
//   后端是 Python，前端是 Node，两套环境各管各的。手敲 uvicorn 得先 cd 到 backend、
//   还得记住是哪个 python 装了依赖，换台机器/换个人就容易踩空。
//   这里把这些固定动作收成一条命令：npm run backend
//
// 用法：
//   npm run backend              # 默认 127.0.0.1:8000，改代码自动重启
//   npm run backend -- --port 9000
//   npm run backend -- --no-reload
//
// 想指定别的 python 解释器：先设环境变量 PYTHON=你的python路径

import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import net from "node:net"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const backendDir = join(root, "backend")

// ---------------------------------------------------------------- 参数
const argv = process.argv.slice(2)

function readFlag(name, fallback) {
  const i = argv.indexOf(name)
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback
}

const port = Number(readFlag("--port", process.env.PORT || 8000))
const host = readFlag("--host", "127.0.0.1")
const reload = !argv.includes("--no-reload")

// ---------------------------------------------------------------- 找 python
// 顺序：显式指定的 > 这台机器上装了依赖的那个 > PATH 里的 python
function pickPython() {
  const candidates = [
    process.env.PYTHON,
    // WorkBuddy 托管的隔离环境（这台机器上依赖就是装在这里的）
    "C:/Users/39906/.workbuddy/binaries/python/envs/default/Scripts/python.exe",
    "python",
  ].filter(Boolean)

  for (const c of candidates) {
    if (c === "python") return c // 交给 PATH 去解析
    if (existsSync(c)) return c
  }
  return "python"
}

// ---------------------------------------------------------------- 端口占用检查
// 端口被占时 uvicorn 会直接抛一堆 traceback，不如提前说人话
function checkPort(p) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once("error", () => resolve(false))
    srv.once("listening", () => srv.close(() => resolve(true)))
    srv.listen(p, "127.0.0.1")
  })
}

const free = await checkPort(port)
if (!free) {
  console.error(`\n端口 ${port} 已经被占用了。`)
  console.error(
    "要么先关掉占用的进程，要么换个端口：npm run backend -- --port 8001\n"
  )
  process.exit(1)
}

// ---------------------------------------------------------------- 启动
const python = pickPython()
const args = [
  "-m",
  "uvicorn",
  "main:app",
  "--host",
  host,
  "--port",
  String(port),
  ...(reload ? ["--reload"] : []),
]

console.log("本地后端启动中…")
console.log(`  解释器  ${python}`)
console.log(`  目录    ${backendDir}`)
console.log(`  接口根  http://${host}:${port}/api`)
console.log(`  文档页  http://${host}:${port}/docs      ← 在浏览器打开这个`)
console.log(`  另一种  http://${host}:${port}/redoc     ← 同一份文档的阅读版`)
console.log("按 Ctrl+C 停止。\n")

const child = spawn(python, args, { cwd: backendDir, stdio: "inherit" })

child.on("error", (e) => {
  console.error(`\n启动失败：${e.message}`)
  console.error("大概率是这个 python 没装依赖，先跑一次：")
  console.error("  pip install -r backend/requirements.txt\n")
  process.exit(1)
})

child.on("exit", (code) => {
  process.exit(code ?? 0)
})

// Ctrl+C 时把子进程一起收掉，别留个 uvicorn 在后台占着端口
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill()
    process.exit(0)
  })
}
