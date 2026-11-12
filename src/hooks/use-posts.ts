/* 文章列表的数据获取：加载中 / 成功 / 失败 三种状态。

为什么用一个状态机对象，而不是三个 useState（loading / error / posts）？
  三个布尔值能拼出八种组合，其中五种是自相矛盾的
  （比如 loading=true 同时 error 有值：到底该显示转圈还是显示错误？）。
  用一个带 status 的对象，这种矛盾在类型上就不存在。

⚠️ 为什么不写成「组件自己去 fetch」？
  列表页（/resources）和博客页（/profile）都要这份数据。
  各写一遍的结果是：两处的排序、过滤、错误提示迟早不一样。
  取数据这件事收在一个 hook 里，两个页面只是渲染方式不同。
*/

import { useCallback, useEffect, useState } from "react"

import { describePostError, fetchPublishedPosts } from "@/lib/api-posts"
import type { Post } from "@/types/post"

export type PostsState =
  | { status: "loading" }
  | { status: "ready"; posts: Post[] }
  | { status: "error"; message: string }

export function usePosts() {
  const [state, setState] = useState<PostsState>({ status: "loading" })
  /* 「重试」就是把它 +1，effect 依赖它就会重新跑一次。
     为什么不在 effect 里同步 setState({status:"loading"})：
     新版 React 的规则（eslint-plugin-react-hooks 的 set-state-in-effect）不允许，
     会多渲染一轮。初始状态本来就是 loading，重试时在点击回调里切。 */
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    /* cancelled：组件卸载后迟到的响应不能再 setState（React 会报内存泄漏警告），
       更要紧的是——用户已经离开这一页了，别拿旧数据把新页面盖掉。 */
    let cancelled = false

    fetchPublishedPosts()
      .then((posts) => {
        if (!cancelled) setState({ status: "ready", posts })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: describePostError(error) })
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
