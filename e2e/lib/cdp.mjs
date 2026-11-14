/* 真浏览器的最小驱动：起一个无头 Chrome，用原生 CDP 说话，零依赖。
 *
 * 为什么不用 Playwright/Puppeteer：
 *   这两个都要下载一份自己的浏览器（几百 MB）。而本机已经有 Chrome，
 *   CDP 就是 Chrome 自带的调试协议 —— 用 node 内置的 WebSocket 连上去即可。
 *   代价是选择器、等待这些要自己写，好处是 `npm i` 不多装任何东西。
 *
 * ⚠️ 一次只能开一个 Chrome 实例（同一个调试端口）。并行跑两个探针会互相抢端口，
 *    现象是「no response」。要并行就各自换一个 port。
 */

import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 本机 Chrome 的位置。找不到就返回 null，由调用方决定是跳过还是报错。 */
export function findChrome() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    path.join(
      process.env.LOCALAPPDATA || "",
      "Google/Chrome/Application/chrome.exe"
    ),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ]
  return candidates.find((p) => p && fs.existsSync(p)) || null
}

function connect(wsUrl, events = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const pending = new Map()
    let seq = 0

    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data)
      /* 没有 id 的是事件推送（不是我们的请求回包）→ 交给订阅者 */
      if (msg.id === undefined) {
        events[msg.method]?.(msg.params)
        return
      }
      const slot = pending.get(msg.id)
      if (!slot) return
      pending.delete(msg.id)
      if (msg.error) slot.reject(new Error(msg.error.message))
      else slot.resolve(msg.result)
    })

    ws.addEventListener("error", reject)
    ws.addEventListener("open", () =>
      resolve({
        send(method, params = {}) {
          const id = ++seq
          return new Promise((res, rej) => {
            const timer = setTimeout(
              () => rej(new Error(`CDP 超时：${method}`)),
              20000
            )
            pending.set(id, {
              resolve: (v) => {
                clearTimeout(timer)
                res(v)
              },
              reject: (e) => {
                clearTimeout(timer)
                rej(e)
              },
            })
            ws.send(JSON.stringify({ id, method, params }))
          })
        },
        close: () => ws.close(),
      })
    )
  })
}

/**
 * 起浏览器并连上它。返回的对象里除了 cdp 原语，还有几个「页面级」的小工具。
 *
 * @param {object} options
 * @param {string} options.baseUrl 前端地址，例如 http://127.0.0.1:5173
 * @param {number} [options.port]  调试端口，并行跑时要各自不同
 * @param {number} [options.width]
 * @param {number} [options.height]
 */
export async function launchBrowser({
  baseUrl,
  port = 9338,
  width = 1440,
  height = 900,
}) {
  const chrome = findChrome()
  if (!chrome) throw new Error("找不到 Chrome，无法跑浏览器断言")

  const userDir = path.join(os.tmpdir(), `blog-e2e-${process.pid}-${port}`)
  fs.rmSync(userDir, { recursive: true, force: true })
  fs.mkdirSync(userDir, { recursive: true })

  const proc = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      `--window-size=${width},${height}`,
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDir}`,
      "about:blank",
    ],
    { stdio: "ignore", detached: false }
  )

  let wsUrl = null
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
        (r) => r.json()
      )
      const page = targets.find((t) => t.type === "page")
      wsUrl = page?.webSocketDebuggerUrl || null
    } catch {
      /* 还没起来，继续等 */
    }
    if (!wsUrl) await sleep(250)
  }
  if (!wsUrl) {
    proc.kill()
    throw new Error("无头 Chrome 的调试端口没起来")
  }

  /* 收集页面侧的报错：断言全绿但控制台在报错，等于「跑通了但坏了」。 */
  const pageErrors = []
  const cdp = await connect(wsUrl, {
    "Runtime.exceptionThrown": (params) => {
      pageErrors.push(params?.exceptionDetails?.text || "未知异常")
    },
    "Log.entryAdded": (params) => {
      if (params?.entry?.level === "error") pageErrors.push(params.entry.text)
    },
  })

  await cdp.send("Page.enable")
  await cdp.send("Runtime.enable")
  await cdp.send("DOM.enable")
  await cdp.send("Log.enable").catch(() => {})
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  })

  async function evalJs(expression) {
    const r = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.text || "页面里表达式报错")
    }
    return r.result.value
  }

  /**
   * 轮询直到表达式为真。**不 sleep 固定时长** ——
   * 本机快慢不定，写死 1 秒的等待要么白等、要么偶发失败。
   */
  async function waitFor(expression, { timeout = 15000, label = "" } = {}) {
    const deadline = Date.now() + timeout
    let lastError = null
    while (Date.now() < deadline) {
      try {
        const value = await evalJs(expression)
        if (value) return value
      } catch (e) {
        lastError = e // 页面正在切换时上下文会失效，忽略这次
      }
      await sleep(120)
    }
    throw new Error(
      `等待超时：${label || expression}${lastError ? `（最后一次错误：${lastError.message}）` : ""}`
    )
  }

  /** 导航并在 SPA 挂载完成后再返回（main 有子节点）。 */
  async function go(pathname) {
    await cdp.send("Page.navigate", { url: baseUrl + pathname })
    await waitFor(`!!document.querySelector("main")?.children.length`, {
      label: `main 挂载 ${pathname}`,
    })
  }

  /** 给隐藏的 file input 塞文件（CDP 是按 DOM 节点操作的，得先拿到 nodeId）。 */
  async function setFileInputFiles(selector, files) {
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 })
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector,
    })
    if (!nodeId) throw new Error(`找不到文件输入框：${selector}`)
    await cdp.send("DOM.setFileInputFiles", { nodeId, files })
  }

  async function close() {
    try {
      cdp.close()
    } catch {
      /* 已经断了 */
    }
    proc.kill()
    /* ⚠️ Chrome 不保证 kill 之后立刻释放 user-data-dir：里面几个 sqlite
       文件还握着句柄，立刻删会 EBUSY 抛异常。等一下再带重试地删，
       删不掉就算了（系统临时目录自己会清）—— 千万别让清理动作把测试结论吞掉。 */
    await sleep(800)
    try {
      fs.rmSync(userDir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 300,
      })
    } catch {
      /* 留着不管 */
    }
  }

  return { cdp, evalJs, waitFor, go, setFileInputFiles, pageErrors, close }
}
