/* 日记列表的数据获取：加载中 / 成功 / 失败 三种状态。

和 use-posts.ts 是同一个模子（那边的注释把「为什么用状态机而不是三个布尔」讲透了）。
两处唯一的不同：日记没有「单篇」概念，所以没有 use-post 那种 missing 状态。

为什么单独写一个 hook 而不是塞进 use-posts？
  两者的数据类型、接口地址、排序字段都不同；混在一个 hook 里会变成
  「返回一个 union，调用方还得判断这是文章还是日记」，得不偿失。
*/

import { useCallback, useEffect, useState } from "react"

import { fetchJournals } from "@/lib/api-journals"
import type { Journal } from "@/types/journal"

export type JournalsState =
  | { status: "loading" }
  | { status: "ready"; journals: Journal[] }
  | { status: "error"; message: string }

export function useJournals() {
  const [state, setState] = useState<JournalsState>({ status: "loading" })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetchJournals()
      .then((journals) => {
        if (!cancelled) setState({ status: "ready", journals })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "日记没加载出来",
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const retry = useCallback(() => {
    setState({ status: "loading" })
    setReloadKey((key) => key + 1)
  }, [])

  return { state, retry }
}
