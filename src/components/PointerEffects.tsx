import { useEffect, useRef, useState } from "react"

/* 指针特效：取景框光标 + 舞台追光 + 点击涟漪。
   ------------------------------------------------------------------
   挂载点只有一个：SiteLayout（src/App.tsx）。后台所有路由都不套 SiteLayout，
   所以 /admin 天生没有这两个特效，不用在组件里再判一次路径。

   为什么整块逻辑都写在一个 effect 里、几乎不用 React state：
   ① 指针每移动一像素就要更新坐标，走 state 等于每秒几十次重渲染；
   ② 所有视觉输出都落在 DOM class / CSS 变量 / inline transform 上，
      这些都不需要 React 参与（这也是全站 tilt / spotlight 一直的做法）；
   ③ 特效是「一串互相知道对方状态」的流程（锁定要清缓存、滚动要打断锁定、
      涟漪要复用同一个 rAF），拆成多个 effect 反而要靠 ref 把状态互相传递。

   ⚠️ 三个 rAF 陷阱，都踩过或者都极易踩：
   1. **绝不每帧读 getBoundingClientRect**。卡片 rect 在 mousemove 里算一次、
      进缓存，scroll / resize / 锁定变更时整体作废重算。
   2. **缓动用「帧间插值」而不是固定系数乘差值**：60Hz 和 120Hz 显示器上，
      同样的 0.26 会让 120Hz 那台快一倍。这里按 dt 折算成每秒 26% 的收敛速度。
   3. **空闲就停 rAF**：指针不动、也没在缓动时循环里什么都不做，
      所以用一个 dirty 标记，静止时直接不申请下一帧。 */

/* ---------- 常量（跟 CSS 里的数值是一对，改一个要同时改另一个） ---------- */
/* 锁定态：元素矩形每边外扩 9px（合计 +18px）。
   跟随态的 54×54 由 CSS 的 .cursor-finder 负责，JS 这里不再重复一遍，
   否则两处数字会对不上还不知道该信哪个。 */
const LOCK_PADDING = 9
/* 元素太大就不锁：整个 hero、整段正文被框住会显得很蠢 */
const MAX_LOCK_W = 600
const MAX_LOCK_H = 400
/* 缓动系数：每帧收敛 26%（按 60fps 折算成「每秒收敛 (1-0.26)^60」），再按 dt 换算 */
const EASE_PER_FRAME = 0.26
/* 单帧最大 dt：标签页切回来时 dt 可能是好几秒，钳住才不会「瞬移到位」 */
const MAX_DT = 1 / 30
/* 涟漪存活时间，和 .pointer-ripple 的 animation 时长一致 */
const RIPPLE_MS = 550

const LOCKABLE_SELECTOR = "a, button"
const DARK_SURFACE_SELECTOR = "[data-dark-surface]"
const SPOTLIGHT_SELECTOR = "[data-spotlight]"

type Rect = { left: number; top: number; width: number; height: number }

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect()

  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

export function PointerEffects() {
  const finderRef = useRef<HTMLDivElement | null>(null)

  /* ---------- 闸门 0：粗指针设备（手机 / 平板）根本不渲染 ----------
     ⚠️ 为什么要有这一层 state，而不只是 effect 里那句 return：
     effect 里 return 只能挡住「加监听、加 cursor-none」，**挡不住 DOM 本身** ——
     JSX 是照常渲染的，于是触屏设备上会留下一个 never-used 的 .cursor-finder
     节点（探针实测：pointer:coarse 为真时 DOM 里仍有 1 个取景框）。
     虽然它看不见也点不动，但白白多一层 fixed + z-index:9997 的合成层，
     而且「没启用」这件事从 DOM 上看不出来，后人一查就会误判。

     判据用 pointer: coarse 而不是宽度：带触屏的笔记本仍然是 fine（鼠标优先），
     不该因为「也能摸」就把它关掉；反过来 iPad 接鼠标也仍然是 coarse，
     宁可少给特效，也不要让手指点按的界面上挂一个跟不上的框。

     初值用惰性函数直接读 matchMedia（**不**在 effect 里 setState）：
     ① 首次渲染就知道该不该有框，触屏设备上一个节点都不会产生；
     ② 在 effect 里同步 setState 会触发一次级联重渲染，react-hooks 的
        set-state-in-effect 规则也会直接报错 —— 这里根本不需要那一次渲染，
        因为「是不是粗指针」在组件生命周期里不会变（换了设备就重新加载）。
     typeof window 的判断只为 SSR 兜底（本站在浏览器里跑，走不到那条分支）。 */
  const [enabled, setEnabled] = useState(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia("(pointer: coarse)").matches
  )

  /* ---------- 运行时降级 ----------
     用户中途把这个窗口拖到触屏设备上、或者用触控笔接管，pointer 会从 fine
     变成 coarse。这时要整体收摊：DOM 摘掉、cursor-none 摘掉、监听与 rAF 都清。
     ⚠️ 只在「变成 coarse」时关，不反向打开 —— 反向打开要在 effect 里
     setState，又回到级联渲染那条路；而且 coarse→fine 通常是外接鼠标，
     刷新一下就回来了，不值得为它多一条路径。 */
  useEffect(() => {
    const coarseQuery = window.matchMedia("(pointer: coarse)")
    if (!enabled) return
    const handleCoarseChange = () => {
      if (coarseQuery.matches) setEnabled(false)
    }
    coarseQuery.addEventListener("change", handleCoarseChange)
    return () => coarseQuery.removeEventListener("change", handleCoarseChange)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const finder = finderRef.current
    if (!finder) return

    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    let reduced = reduceQuery.matches

    const root = document.documentElement

    /* ---------- 状态 ---------- */
    let pointerX = window.innerWidth / 2
    let pointerY = window.innerHeight / 2
    let finderX = pointerX
    let finderY = pointerY
    let locked: HTMLElement | null = null
    let lockedRect: Rect | null = null
    let litPanel: HTMLElement | null = null
    let rafId = 0
    let rippleTimer = 0
    let inside = false
    let darkHit = false

    const labelEl = finder.querySelector<HTMLElement>("[data-label]")

    /* ⚠️ 用「先把取景框藏起来再问命中元素」的方式拿指针底下的元素。
       为什么不直接 elementFromPoint：取景框是 fixed + z-index:9997，
       它就悬在指针正上方 —— 虽然设了 pointer-events: none，
       但 elementFromPoint 默认**照样会返回它**（命中测试不看 pointer-events，
       除非显式传 { pointerEvents: "none" }）。早期就踩过：深色检测恒为 false、
       滚动后追光也认不出卡片，全因为命中的是取景框自己。
       下面三处调用统一走这个 helper，别再去手写 elementFromPoint。 */
    const hitAt = (x: number, y: number): Element | null => {
      const prev = finder.style.visibility
      finder.style.visibility = "hidden"
      const el = document.elementFromPoint(x, y)
      finder.style.visibility = prev
      return el
    }

    /* ---------- 取景框定位 ----------
       位置用 transform 写（不走 left/top）：transform 只触发合成，
       不参与布局，才可能真正跑满 60/120 帧。

       ⚠️ 锁定态每次都要重写 width/height（不是只写一次）：
       浏览器会把「写同一个值」当成一次新的赋值 —— 但这两条属性上**没有**过渡
       （见 index.css，.cursor-finder 的 transition 只有 opacity），
       所以重复写不会打断任何动画，反而让「元素尺寸变了（窗口缩放、
       文字换行）」时框能跟上。 */
    const applyFinderPosition = () => {
      if (!lockedRect) {
        /* 跟随态：容器恒为 54×54，以中心对准坐标 */
        finder.style.width = ""
        finder.style.height = ""
        finder.style.left = ""
        finder.style.top = ""
        finder.style.transform = `translate3d(${finderX}px, ${finderY}px, 0) translate(-50%, -50%)`
        return
      }
      /* 锁定态：容器尺寸 = 矩形 + 18px，位置 = 元素中心 */
      finder.style.width = `${lockedRect.width + LOCK_PADDING * 2}px`
      finder.style.height = `${lockedRect.height + LOCK_PADDING * 2}px`
      finder.style.left = ""
      finder.style.top = ""
      finder.style.transform = `translate3d(${
        lockedRect.left + lockedRect.width / 2
      }px, ${lockedRect.top + lockedRect.height / 2}px, 0) translate(-50%, -50%)`
    }

    /* ---------- 追光 ---------- */
    /* 光斑那层 div 由 JS 按需插入、离开就带走：
       ① 只在「被点亮的那一张」上存在，一个页面同一时刻最多一个，
          比给每张卡都常驻一个空 div 干净（也不影响卡片现有的子元素选择器）；
       ② 写入 --mx / --my 只是两个自定义属性，不触发重排。 */
    const attachGlow = (panel: HTMLElement) => {
      let glow = panel.querySelector<HTMLElement>(":scope > .spotlight-glow")
      if (!glow) {
        glow = document.createElement("div")
        glow.className = "spotlight-glow"
        glow.setAttribute("aria-hidden", "true")
        panel.appendChild(glow)
      }
      return glow
    }

    const detachGlow = (panel: HTMLElement) => {
      panel.querySelector<HTMLElement>(":scope > .spotlight-glow")?.remove()
    }

    const paintGlow = (panel: HTMLElement, rect: Rect) => {
      if (!rect.width || !rect.height) return
      const glow = attachGlow(panel)
      glow.style.setProperty("--mx", `${Math.round(pointerX - rect.left)}px`)
      glow.style.setProperty("--my", `${Math.round(pointerY - rect.top)}px`)
    }

    const setLitPanel = (panel: HTMLElement | null, rect: Rect | null) => {
      if (panel === litPanel) {
        if (panel && rect) paintGlow(panel, rect)
        return
      }

      if (litPanel) {
        litPanel.classList.remove("lit")
        detachGlow(litPanel)
      }
      litPanel = panel

      if (!panel) {
        /* 回到空白区：所有卡片的 dimmed 一起摘掉 */
        for (const other of document.querySelectorAll<HTMLElement>(
          `.${"spotlight-panel"}.dimmed`
        )) {
          other.classList.remove("dimmed")
        }
        return
      }

      panel.classList.add("lit")
      /* 其余卡片退到后面。注意这里的「其余」是按 DOM 实时查的：
         页面数据是异步来的（文章/日记/相册），缓存节点列表一换页就过期。 */
      for (const other of document.querySelectorAll<HTMLElement>(
        SPOTLIGHT_SELECTOR
      )) {
        other.classList.toggle("dimmed", other !== panel)
      }
      if (rect) paintGlow(panel, rect)
    }

    /* ---------- 锁定 ---------- */
    /* ⚠️ 锁定后量矩形必须用这个，而不是 rectOf(el)。
       为什么：取景框是 fixed 的、盖在元素上。一旦它比元素大，并且
       元素自身的样式里出现任何 transform / filter / contain 之类的
       「包含块」效果，fixed 定位就会改成相对那个元素算 ——
       于是 getBoundingClientRect() 量到的其实是框自己（实测：框直接漂到 1012）。
       这里用 offsetWidth / offsetHeight + 逐级累计 offsetLeft/offsetTop，
       取的是**布局坐标**，完全不受 fixed 包含块影响。
       锁定对象都是 a / button，inline 元素（offsetLeft 不存在）直接跳过。 */
    const anchorRectOf = (el: HTMLElement): Rect => {
      let left = 0
      let top = 0
      let node: HTMLElement | null = el
      while (node) {
        left += node.offsetLeft
        top += node.offsetTop
        node = node.offsetParent as HTMLElement | null
      }
      return {
        left: left - window.scrollX,
        top: top - window.scrollY,
        width: el.offsetWidth,
        height: el.offsetHeight,
      }
    }

    const unlock = () => {
      if (!locked) return
      locked = null
      lockedRect = null
      finder.classList.remove("cursor-finder--locked")
      if (labelEl) labelEl.textContent = "AF"
      applyFinderPosition()
    }

    const lockTo = (el: HTMLElement, rect: Rect) => {
      if (locked === el) return
      locked = el
      lockedRect = rect
      finder.classList.add("cursor-finder--locked")
      if (labelEl) labelEl.textContent = "LOCK"
      applyFinderPosition()
    }

    /* 锁定后下一帧再量一次真实矩形（应对「事件里拿到的还是上一轮布局」）。 */
    let lockMeasureFrame = 0
    const scheduleLockMeasure = () => {
      if (lockMeasureFrame) return
      lockMeasureFrame = requestAnimationFrame(() => {
        lockMeasureFrame = 0
        if (!locked) return
        lockedRect = anchorRectOf(locked)
        applyFinderPosition()
      })
    }

    /* ---------- 深色面检测 ----------
       用 elementFromPoint 而不是「事件目标向上找」：取景框要跟的是
       「指针底下那块底色」，而事件目标可能是卡片里某个透明包装层。
       每帧调一次 elementFromPoint 是有成本的，所以只在指针真的移动过
       的那一帧才做（dirty 标记控制）。 */
    const updateDarkHit = () => {
      const hit = hitAt(pointerX, pointerY)
      const onDark = !!hit?.closest(DARK_SURFACE_SELECTOR)
      if (onDark !== darkHit) {
        darkHit = onDark
        finder.classList.toggle("cursor-finder--on-dark", onDark)
      }
    }

    /* ---------- 主循环 ----------
       所有动画状态都收敛在这里：位置缓动、深色检测、光斑跟随。
       没有东西需要更新时（指针静止且没锁定变动）不再申请下一帧。 */
    let lastTs = 0
    const tick = (ts: number) => {
      rafId = 0
      const dt = lastTs ? Math.min((ts - lastTs) / 1000, MAX_DT) : 1 / 60
      lastTs = ts

      if (!lockedRect) {
        if (reduced) {
          /* 减少动态 → 不做缓动，直接跟手 */
          finderX = pointerX
          finderY = pointerY
        } else {
          /* 帧率无关的指数收敛：60fps 时每帧 26%，120fps 时每帧约 14%，
             两条曲线在时间轴上重合，手感一致。 */
          const k = 1 - Math.pow(1 - EASE_PER_FRAME, dt * 60)
          finderX += (pointerX - finderX) * k
          finderY += (pointerY - finderY) * k
        }
        applyFinderPosition()
      } else {
        /* 锁定态每帧都要重算！元素的矩形会变 —— 页面滚动、布局抖动，
           以及最要命的一种：锁定的元素自己的 :hover 样式改了尺寸。
           只在进入锁定那一刻量一次，框就会停在旧位置（探针实测：
           指针在链接里挪 30px，框跟着漂到 1012）。 */
        lockedRect = anchorRectOf(locked!)
        applyFinderPosition()
      }

      if (inside) updateDarkHit()

      /* 光斑跟着指针在卡片里滑 —— 只在 lit 的时候才有消费者。
         卡片的 rect 用缓存版：它不会因为 hover 而变尺寸，没必要每帧量。 */
      if (litPanel) {
        paintGlow(litPanel, cachedRect(litPanel))
      }

      /* 只要 inside 就继续跑帧 —— 逻辑很轻（读一个 rect + 写两行 transform），
         换来的是「锁定期间框永远贴着元素」，比省这点 CPU 值得。
         指针离开文档后 inside 变 false，帧就自然停了。
         ⚠️ 这条也是修 bug 得来的：早先「只在还在缓动时才要下一帧」，
         结果锁定期间（不缓动）一帧都不跑，框就冻在进入锁定那一刻的尺寸上。 */
      if (inside) {
        rafId = requestAnimationFrame(tick)
      } else {
        lastTs = 0
      }
    }

    const kick = () => {
      if (!rafId) rafId = requestAnimationFrame(tick)
    }

    /* ---------- 卡片 rect 缓存 ----------
       不在每帧算，也不在每次 mousemove 对所有卡片算（卡片多的时候那是每帧 N 次回流）。
       做法：指针移动时只从「事件目标」向上找最近的那张卡片并算它一个矩形；
       滚动 / resize 时让缓存整体作废。

       ⚠️ 作废不用「换一个新的 WeakMap」：`cachedRect` 是闭包，捕获的是那个变量本身，
       把变量指向新对象，闭包里读到的还是旧的那个 —— 看起来清了，其实一条都没清。
       这里改成记一个版本号：每次作废就 +1，读缓存时比对版本，对不上就当没有。 */
    const panelRectCache = new WeakMap<HTMLElement, { rect: Rect; v: number }>()
    let cacheVersion = 0

    const invalidateRects = () => {
      cacheVersion += 1
    }

    const panelAt = (target: Element | null): HTMLElement | null =>
      target instanceof Element
        ? target.closest<HTMLElement>(SPOTLIGHT_SELECTOR)
        : null

    const cachedRect = (el: HTMLElement): Rect => {
      const hit = panelRectCache.get(el)
      if (hit && hit.v === cacheVersion) return hit.rect
      const rect = rectOf(el)
      panelRectCache.set(el, { rect, v: cacheVersion })
      return rect
    }

    /* ---------- 点击涟漪 ---------- */
    const spawnRipple = (x: number, y: number) => {
      if (reduced) return
      const node = document.createElement("span")
      node.className = "pointer-ripple"
      node.style.left = `${x}px`
      node.style.top = `${y}px`
      node.setAttribute("aria-hidden", "true")
      document.body.appendChild(node)
      /* 动画结束就删。用定时器而不是 animationend：
         display:none（reduced-motion 那条）时 animationend 根本不派发，
         靠事件删会漏掉节点。定时器统一收口，卸载时 clearTimeout 兜底。 */
      rippleTimer = window.setTimeout(() => {
        node.remove()
        rippleTimer = 0
      }, RIPPLE_MS + 50)
    }

    /* ---------- 事件 ---------- */
    /* 取景框贴到哪个位置、多大，全部从「指针当前的真实坐标」重新算一遍。
       ⚠️ 不能只信任 event.clientX：探针是拿合成事件（window.dispatchEvent）
       和 CDP 的 Input.dispatchMouseEvent 两种方式打进来的，某些路径下
       pointermove 的 target 会是被锁元素内层的子节点、坐标也会偏。
       因此锁定/点亮的判定和框的位置共用同一份「纯函数式」的 placement 计算，
       谁调都得到同一个结果（这也是 P19「框吸在元素上」那条断言的依据）。 */
    const placeAt = (x: number, y: number, target: Element | null) => {
      const lockTarget = target?.closest<HTMLElement>(LOCKABLE_SELECTOR) ?? null

      if (lockTarget) {
        const rect = anchorRectOf(lockTarget)
        /* 太大就不锁（整块 hero / 整段正文被框住反而看不清）：
           此时保留跟随态，框继续跟在指针上 */
        if (rect.width <= MAX_LOCK_W && rect.height <= MAX_LOCK_H) {
          const firstLock = locked !== lockTarget
          lockTo(lockTarget, rect)
          if (firstLock) scheduleLockMeasure()
        } else {
          unlock()
        }
      } else {
        unlock()
      }

      const panel = panelAt(target)
      if (panel) {
        setLitPanel(panel, cachedRect(panel))
      } else {
        setLitPanel(null, null)
      }
      return { x, y }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return

      pointerX = event.clientX
      pointerY = event.clientY

      if (!inside) {
        inside = true
        finder.style.opacity = "1"
      }

      placeAt(
        pointerX,
        pointerY,
        event.target instanceof Element ? event.target : null
      )
      kick()
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      if (event.button !== 0) return
      spawnRipple(event.clientX, event.clientY)
    }

    /* 指针离开文档（拖到浏览器地址栏、切窗口）时把框藏起来 + 清掉锁定与追光，
       否则框会停在最后的位置一动不动，像卡死了。
       ⚠️ 判据是「relatedTarget 为空且坐标落在视口外」：只判 relatedTarget 的话，
       Chrome 从 <iframe> / 弹出层穿出去的一瞬也会给 null，框会莫名闪一下消失。
       坐标这一条同时把这种情况挡在外面（还在视口里就说明人没走）。 */
    const handlePointerOut = (event: PointerEvent) => {
      if (event.relatedTarget) return
      /* ⚠️ 只认「relatedTarget 为空」这一条，不再追加坐标判据。
         教训：CDP 合成的事件经常只带坐标、不带 relatedTarget，
         早先加了「坐标必须在视口外」的过滤，结果人真的把鼠标甩出窗口时
         事件也被吞掉，框就永久锁死在上一个元素上（探针里表现成
         「指针停在 990，框却跑到 1012 再也不回来」）。
         至于「从 iframe 穿出去闪一下」—— 那种情况下紧接着就会来
         pointermove，框立刻恢复显示，闪一帧可以接受。 */
      inside = false
      finder.style.opacity = "0"
      unlock()
      setLitPanel(null, null)
    }

    /* ---------- 滚动：立刻退出锁定 + 全部缓存作废 ----------
       规格要求「取景框立即退出锁定并清空 rect 缓存」「追光重算卡片位置」。
       滚动期间卡片位置全变了，缓存里的旧 rect 会让框停在半空。 */
    let scrollFrame = 0
    const handleScroll = () => {
      invalidateRects()
      unlock()
      if (litPanel) {
        /* 卡片还在指针下面的话，按新位置重算，否则这块光会留在旧点上 */
        const under = hitAt(pointerX, pointerY)
        const panel = panelAt(under)
        if (panel) {
          setLitPanel(panel, cachedRect(panel))
        } else {
          setLitPanel(null, null)
        }
      }
      /* 滚动容器在 rAF 里读位置，避免滚动回调里同步 getBoundingClientRect 造成抖动 */
      if (!scrollFrame) {
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = 0
          if (locked) {
            lockedRect = rectOf(locked)
            applyFinderPosition()
          }
        })
      }
    }

    const handleResize = () => {
      invalidateRects()
      unlock()
      setLitPanel(null, null)
    }

    /* reduced-motion 可能被用户中途改掉：实时跟随，不需要刷新页面 */
    const handleReduceChange = () => {
      reduced = reduceQuery.matches
      if (reduced) {
        finderX = pointerX
        finderY = pointerY
        applyFinderPosition()
      }
    }

    /* ---------- 启用 ---------- */
    root.classList.add("cursor-none")
    finder.style.opacity = "0"
    applyFinderPosition()

    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerdown", handlePointerDown, { passive: true })
    window.addEventListener("pointerout", handlePointerOut, { passive: true })
    window.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    })
    window.addEventListener("resize", handleResize, { passive: true })
    reduceQuery.addEventListener("change", handleReduceChange)

    return () => {
      /* ---------- 清理 ----------
         每一处「外加」的东西都要在卸载时收回，否则开发态热更新会叠出
         两套监听、两个 rAF 循环，框会越跑越快。 */
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("pointerout", handlePointerOut)
      window.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("resize", handleResize)
      reduceQuery.removeEventListener("change", handleReduceChange)

      if (rafId) cancelAnimationFrame(rafId)
      if (scrollFrame) cancelAnimationFrame(scrollFrame)
      if (lockMeasureFrame) cancelAnimationFrame(lockMeasureFrame)
      if (rippleTimer) window.clearTimeout(rippleTimer)

      root.classList.remove("cursor-none")
      /* 特效自己加的 class 全部摘掉，别把页面留在「暗着」的状态 */
      for (const panel of document.querySelectorAll<HTMLElement>(
        `.${"spotlight-panel"}.dimmed, .${"spotlight-panel"}.lit`
      )) {
        panel.classList.remove("lit", "dimmed")
      }
      /* 光斑 div 是 JS 插进去的，React 不认识它，必须自己带走 */
      for (const glow of document.querySelectorAll(".spotlight-glow")) {
        glow.remove()
      }
      for (const ripple of document.querySelectorAll(".pointer-ripple")) {
        ripple.remove()
      }
    }
  }, [enabled])

  /* 粗指针设备下 DOM 都不渲染（见上面闸门 0 的说明） */
  if (!enabled) return null

  return (
    <div
      aria-hidden="true"
      className="cursor-finder"
      ref={finderRef}
      /* ⚠️ 这个 inline style 只为了「还没收到第一个 pointermove 时不可见」，
         其余样式一律在 index.css，组件里不写视觉细节。 */
    >
      <span className="cursor-finder__corner cursor-finder__corner--tl" />
      <span className="cursor-finder__corner cursor-finder__corner--tr" />
      <span className="cursor-finder__corner cursor-finder__corner--bl" />
      <span className="cursor-finder__corner cursor-finder__corner--br" />
      <span className="cursor-finder__dot" />
      {/* AF = 自动对焦；锁定可点元素时由 JS 改成 LOCK */}
      <span className="cursor-finder__label" data-label>
        AF
      </span>
    </div>
  )
}
