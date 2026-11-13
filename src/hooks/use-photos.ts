/* 相册照片的数据获取：加载中 / 成功 / 失败 三态，外加一份「数据里出现过哪些分类」。

和 use-journals.ts 是同一个模子，区别是数据源（/api/photos）、按分类取，以及多返回一个分类表。

**分类筛选为什么走后端、不走本地过滤**（第 43 轮定下来的）：
  本地过滤的前提是「全量已经在手里」。现在之所以成立，只是因为相册只有几十张；
  一旦到几百张，要么一次拖几百张图（用户等不起），要么改回分页 ——
  那时本地过滤会直接失效，等于重写。走后端一行 `?category=` 就够，容量上限交给服务器。
  代价是切分类多一次网络往返，所以切换期间必须明确显示加载态，不能让人以为「没图」。

**「切换中」怎么判断 —— 不靠 effect 清状态，靠数据自带出处**：
  ready 状态里记着 `category`，也就是「这批照片是哪次请求回来的」。
  页面只要比较 `state.category !== 当前点的按钮`，就知道手上这份数据是不是已经过期。
  为什么要绕这一下：在 effect 体里同步 setState({loading}) 会被 React 当成级联渲染
  （eslint 的 react-hooks/set-state-in-effect 直接报错），而「派生」是不需要任何副作用的。

**分类表为什么也在这里算**：
  后台允许自由填分类（敲个「宠物」就等于新建），前台如果只写死「日常/学习/风景」，
  那些照片就会静默消失 —— 看不见还不报错，是最难查的一类 bug。
  而分类表必须来自**全量**（不能来自「日常」那一批，那只含一个分类），
  所以只在 `category === ""` 那次请求里登记；切到具体分类时不动它，
  否则按钮会一抖一抖地消失。这样整页不多花一次请求 —— 就是「全部」那一次。

**为什么博客页的相册入口卡也走这个 hook**：
  它只要 4 张缩略图，看似可以写死。但那样「后台传了图、博客页那张卡还是老图」
  会变成一个没人说得清的 bug；多一次几 KB 的公开请求，换「一眼都对」更划算。
*/

import { useCallback, useEffect, useState } from "react"

import { getPhotos } from "@/lib/api-photos"
import type { Photo } from "@/lib/api-photos"

export type PhotosState =
  | { status: "loading" }
  /* category 是「这批数据属于哪次请求」，空串＝全部。页面靠它判断数据是否已过期。 */
  | { status: "ready"; photos: Photo[]; category: string }
  | { status: "error"; message: string; category: string }

/** 去重 + 去空 + 排序。中文分类用 `sort()` 是「按码位」，不是拼音序 ——
    这里只需要顺序固定（按钮不跳来跳去），不追求语感。 */
function uniqueCategories(photos: Photo[]): string[] {
  return [
    ...new Set(photos.map((photo) => photo.category.trim()).filter(Boolean)),
  ].sort()
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index])
}

/**
 * @param category 分类名；空串（默认）表示全部。变化时重新请求。
 * @returns state 三态 / categories 全量里出现过的分类 / retry 重试
 */
export function usePhotos(category = "") {
  const [state, setState] = useState<PhotosState>({ status: "loading" })
  const [categories, setCategories] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    /* cancelled 挡住「切得快时，上一个请求晚到把新结果盖掉」这种经典竞态：
       切到「日常」再切回「全部」，两个请求先后返回，晚到的可能反而是旧的。 */
    let cancelled = false

    getPhotos(category)
      .then((photos) => {
        if (cancelled) return
        setState({ status: "ready", photos, category })
        /* 只有「全部」这次能当分类表用：具体分类的返回里只有一个分类。 */
        if (category === "") {
          setCategories((previous) => {
            const next = uniqueCategories(photos)
            return sameList(previous, next) ? previous : next
          })
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "照片没加载出来",
          category,
        })
      })

    return () => {
      cancelled = true
    }
  }, [category, reloadKey])

  const retry = useCallback(() => {
    setState({ status: "loading" })
    setReloadKey((key) => key + 1)
  }, [])

  return { state, categories, retry }
}
