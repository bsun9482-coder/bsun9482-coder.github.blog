/* 单篇文章的数据获取：加载中 / 成功 / 不存在 / 失败。

「不存在」为什么要单独一个状态，不和「失败」合并？
  因为这两件事对用户的意义完全不同：
    · 不存在（404）→ 地址打错了，或者文章被删了。重试一百次也没用，
      该给的是「返回文章列表」。
    · 失败（网络断了 / 后端没开 / 500）→ 重试是有意义的，该给的是「重试」按钮。
  合并成一句「加载失败」会让用户对着一个永远好不了的 404 一直点重试。
*/

import { useCallback, useEffect, useState } from "react"

import type { ApiError } from "@/lib/api"
import { describePostError, fetchPostBySlug } from "@/lib/api-posts"
import type { ArticleDetail } from "@/types/post"

export type PostState =
  | { status: "loading" }
  | { status: "ready"; post: ArticleDetail }
  | { status: "missing" }
  | { status: "error"; message: string }

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "status" in error &&
    (error as ApiError).status === 404
  )
}

export function usePost(slug: string) {
  /* ⚠️ 状态里必须带上「这是哪个 slug 的结果」。
     否则从 /resources/a 点到 /resources/b 时，会在 b 的请求回来之前
     先显示 a 的正文（同一篇文章挂两个地址的错觉）。
     带上 slug 之后，slug 一换，下面的 state 立刻算作 loading，
     不需要在 effect 里同步 setState（那是被 lint 规则禁止的写法）。 */
  const [entry, setEntry] = useState<{ slug: string; state: PostState }>(
    () => ({
      slug,
      state: { status: "loading" },
    })
  )
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetchPostBySlug(slug)
      .then((post) => {
        if (!cancelled) setEntry({ slug, state: { status: "ready", post } })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setEntry({
          slug,
          state: isNotFound(error)
            ? { status: "missing" }
            : { status: "error", message: describePostError(error) },
        })
      })

    return () => {
      cancelled = true
    }
  }, [slug, reloadKey])

  const state: PostState =
    entry.slug === slug ? entry.state : { status: "loading" }

  const retry = useCallback(() => {
    setEntry({ slug, state: { status: "loading" } })
    setReloadKey((key) => key + 1)
  }, [slug])

  return { state, retry }
}
