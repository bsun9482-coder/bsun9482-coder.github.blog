/* 断言小工具：一份结果清单 + 一行一条的打印 + 最后的汇总与退出码。
 *
 * 为什么自己写一个而不是引 vitest/node:test：
 *   这套测试有一半是「开真浏览器点页面」，流程长、状态共享（上传的那张照片
 *   要一路带到删除那步）。用断言库反而要绕回全局变量，不如老老实实
 *   收集结果、最后统一判总数 —— 而且零依赖，`npm i` 不需要多装任何东西。
 *
 * ⚠️ 参数顺序是 (id, 说明, 是否通过, 附加信息)，不是 (说明, 是否通过)。
 *    第 44 轮踩过一次：写成 check('U1', '登录成功', true) 时，
 *    「登录成功」被当成 ok 传进去 —— 非空字符串恒为真，那条断言永远是 PASS。
 *   所以这里参数取名字，并在 ok 不是布尔时直接抛错，让这类手滑当场炸掉。
 */

export function createChecker() {
  const results = []

  function check(id, label, ok, detail) {
    if (typeof ok !== "boolean") {
      throw new Error(
        `断言 ${id} 的第三个参数必须是布尔值，收到 ${typeof ok}：` +
          `参数顺序是 (id, 说明, 是否通过, 附加信息)`
      )
    }
    results.push({ id, label, ok, detail })
    const tail = detail === undefined || detail === "" ? "" : `  — ${detail}`
    console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${label}${tail}`)
  }

  return {
    check,
    results,
    /** 打印汇总并返回「失败条数」，runner 用它决定进程退出码。 */
    summarize(title = "") {
      const failed = results.filter((r) => !r.ok)
      const head = title ? `\n===== ${title}  ` : "\n===== "
      console.log(
        `${head}${results.length - failed.length}/${results.length} PASS =====`
      )
      if (failed.length) {
        console.log(
          "FAILED:",
          failed.map((f) => `${f.id} ${f.label}`).join(" | ")
        )
      }
      return failed.length
    },
  }
}
