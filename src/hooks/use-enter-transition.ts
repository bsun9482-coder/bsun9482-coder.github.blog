import { useEffect, useState } from "react"

/* 「先画一帧隐藏态、再翻到进入态」的通用入场开关。
   为什么非要绕两个 requestAnimationFrame：
   如果挂载时就以进入态渲染，浏览器第一次绘制看到的就是终态，没有起点，
   过渡自然不会发生（CSS transition 需要「值发生变化」才触发）。
   所以要先把隐藏态真的画上去（第一个 rAF 的回调在绘制前执行，第二个 rAF
   的回调落在下一次绘制前，此时隐藏态已经上屏），再改状态，过渡才看得见。
   直接 setTimeout(0) 不行：它不保证在绘制之后。

   用法：给「要不要播」的条件，拿到「现在是不是已经进入」
     const entered = useEnterTransition(fromHome)
     <div style={{ opacity: entered ? 1 : 0 }} />
   条件为 false（比如用户开了「减少动态效果」，或者不是从首页翻页进来的）
   时，直接以进入态开始 —— 内容正常显示，不播动画。

   ⚠️ 这是踩过坑的写法，别再在页面里手抄一份；抄一份就多一处改漏的地方。 */
export function useEnterTransition(animate: boolean) {
  /* 不播动画时初始就是「已进入」，否则初始为隐藏态 */
  const [entered, setEntered] = useState(!animate)

  useEffect(() => {
    /* 条件后来变成 true 的情况也算：只要还没进入，就补一次入场。
       entered 已在 true 时直接退出，不会反复翻状态。 */
    if (!animate || entered) return

    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true))
    })

    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [animate, entered])

  return entered
}
