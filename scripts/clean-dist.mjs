/* 构建前先自己清空 dist。
   起因：vite build 的 emptyOutDir 在 Windows 上偶发卡死 —— 进程停在
   「✓ N modules transformed」之后不往下走（实测卡 3~7 分钟），
   而同样的删除动作用 node 的 rmSync 只要 1.6 秒就能做完。
   与其赌它每次都能顺利删，不如把这一步挪到构建之前自己干：
   dist 已经是空的，emptyOutDir 就退化成空操作，卡住的条件直接不存在。

   多次重试是为了躲开「上一秒还在被扫描/占用」的瞬时锁，
   最后仍然失败就抛出真实错误码，不要静默吞掉。 */
import { rmSync } from "node:fs"

const target = new URL("../dist/", import.meta.url)

try {
  rmSync(target, {
    recursive: true,
    force: true,
    maxRetries: 6,
    retryDelay: 80,
  })
} catch (error) {
  console.error(`[clean] 清空 dist 失败：${error.code ?? error.message}`)
  console.error(
    "[clean] 可能仍有进程占着 dist（比如 vite preview），关掉后重试。"
  )
  process.exit(1)
}

console.log("[clean] dist 已清空")
