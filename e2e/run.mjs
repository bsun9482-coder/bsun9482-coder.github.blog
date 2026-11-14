#!/usr/bin/env node
/* e2e 的统一入口：按顺序跑选中的 spec，一条一条打印，最后给一个总数和退出码。
 *
 * 用法：
 *   node e2e/run.mjs                 本地全套（接口 + 浏览器 + 移动端）
 *   node e2e/run.mjs --live          线上只读巡检
 *   node e2e/run.mjs api mobile      只跑某几个
 *
 * 注意：本地这套会**真的往库里写一张照片再删掉**（要验上传/缩略图/删除，
 * 不写就验不了）。所以它只跑本地；线上那条只读。
 */

import * as apiSpec from "./specs/api.mjs"
import * as albumUiSpec from "./specs/album-ui.mjs"
import * as mobileSpec from "./specs/mobile.mjs"
import * as liveSpec from "./specs/live.mjs"

import { createApi } from "./lib/api.mjs"
import { createChecker } from "./lib/check.mjs"
import { launchBrowser } from "./lib/cdp.mjs"

const LOCAL_SPECS = [apiSpec, albumUiSpec, mobileSpec]
const LIVE_SPECS = [liveSpec]

const argv = process.argv.slice(2)
const isLive = argv.includes("--live")
const picked = argv.filter((a) => !a.startsWith("--"))

const suite = isLive ? LIVE_SPECS : LOCAL_SPECS
const specs = picked.length ? suite.filter((s) => picked.includes(s.id)) : suite

if (!specs.length) {
  console.error(`没有匹配的 spec。可选：${suite.map((s) => s.id).join(" / ")}`)
  process.exit(1)
}

const env = {
  baseUrl:
    process.env.BASE_URL ||
    (isLive ? "https://learnailab.cn" : "http://127.0.0.1:5173"),
  apiUrl:
    process.env.API_URL ||
    (isLive ? "https://learnailab.cn" : "http://127.0.0.1:8000"),
  user: process.env.ADMIN_USER || "admin",
  /* ⚠️ 密码**故意没有默认值**。这个仓库是公开的，
     把管理员口令写成代码里的默认值，等于把线上后台的钥匙一起发布出去
     （而且登录接口目前没有失败次数限制）。所以必须由环境变量传。 */
  pass: process.env.ADMIN_PASS || "",
}

if (!env.pass) {
  console.error(
    [
      "缺少管理员密码。请用环境变量传（不要把密码写进任何文件）：",
      "",
      "  bash / Git Bash:      ADMIN_PASS='你的密码' node e2e/run.mjs",
      "  PowerShell:           $env:ADMIN_PASS='你的密码'; node e2e/run.mjs",
    ].join("\n")
  )
  process.exit(1)
}

const api = createApi({ apiUrl: env.apiUrl, user: env.user, pass: env.pass })

console.log(
  [
    `\n目标：${env.baseUrl}`,
    `接口：${env.apiUrl}`,
    `用例：${specs.map((s) => s.id).join("、")}`,
    "",
  ].join("\n")
)

let failures = 0
for (const [index, spec] of specs.entries()) {
  const checker = createChecker()
  console.log(`\n--------- ${spec.name} ---------`)

  let browser = null
  try {
    if (spec.viewport) {
      browser = await launchBrowser({
        baseUrl: env.baseUrl,
        port: 9338 + index, // 每个 spec 一个端口，别抢
        width: spec.viewport.width,
        height: spec.viewport.height,
      })
    }
    await spec.run({ check: checker.check, browser, api, env })
  } catch (e) {
    /* spec 中途崩了（选择器找不到、等超时）也要记成失败，
       而不是让整个 runner 静默退出 —— 否则 CI 里看不出是「跑挂了」还是「没跑」 */
    checker.check(`${spec.id}-crash`, `spec 执行中断：${e.message}`, false)
  } finally {
    if (browser) await browser.close()
  }

  failures += checker.summarize(spec.name)
}

console.log(`\n=========================================`)
console.log(failures ? `失败 ${failures} 条` : "全部通过")
process.exit(failures ? 1 : 0)
