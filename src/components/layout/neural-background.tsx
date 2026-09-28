import { useEffect, useRef, useState } from "react"

/* 漂浮粒子画布：全屏 Canvas，粒子缓慢漂移，近距离粒子之间连极细的线，
   形成类似神经网络节点连接的效果。整层不接收鼠标事件（父层 pointer-events-none），
   鼠标位置改为在 window 上监听。

   粒子是"炫彩"的：每颗粒子有自己的色相，在 190°~310° 的冷色区间里缓慢往复
   （青 190 / 蓝 220 / 紫 270 / 粉 310 四个锚点都在区间内），
   另有同色 glow、鼠标焦点偏青提亮，以及跟随两端粒子色的渐变连线。 */

/* 粒子数：桌面 60，窄屏（<768px）减半到 25 —— 规格上限就是 60 */
const PARTICLE_COUNT_DESKTOP = 60
const PARTICLE_COUNT_MOBILE = 25
const MOBILE_MAX_WIDTH = 768

const LINK_DISTANCE = 120 // 粒子间距小于这个值就连线
const LINK_ALPHA = 0.1 // 连线透明度上限（越远越淡）
const DOT_ALPHA_MIN = 0.4 // 粒子透明度 40%~70%（规格要求整体落在这一档）
const DOT_ALPHA_MAX = 0.7
const DOT_RADIUS_MIN = 1 // 粒子半径 1~2px
const DOT_RADIUS_MAX = 2

const MAX_SPEED = 0.15 // 漂移速度上限（px/帧），慢到几乎看不出移动
const MOUSE_RADIUS = 150 // 鼠标影响半径
const MOUSE_PULL = 0.012 // 吸引强度：每帧朝鼠标挪剩余距离的 1.2%，克制到"轻微靠拢"
const MAX_DPR = 2 // 高 DPR 屏上限制缓冲尺寸，避免 3x 屏白烧一倍像素

/* 色相区间：**硬限在 190°~310° 的冷色区间**，不含红 / 绿 / 黄。
   用正弦在中心 250° 上来回扫、摆幅 ±60°，正好覆盖四个锚点（青 190 / 蓝 220 / 紫 270 / 粉 310），
   且两端自然减速 —— 不会在边界上"啪"地折返，也不会越过边界一丝一毫。 */
const HUE_CYAN = 190
const HUE_PINK = 310
const HUE_CENTER = (HUE_CYAN + HUE_PINK) / 2 // 250（蓝紫之间）
const HUE_SWING = (HUE_PINK - HUE_CYAN) / 2 // 60

/* 色相周期：每颗粒子 5~8s 转完一圈，**逐粒子随机**；
   再叠一个随机初始相位 —— 周期和相位双重错开，才不会"全体一起变色"。 */
const HUE_PERIOD_MIN = 5000
const HUE_PERIOD_MAX = 8000

/* 鼠标焦点：进圈的粒子亮度提上来、色相往青色偏，越近越明显（离开即还原，所以是"短暂"偏向）。
   色相往 190° 拉不会越界 —— 190 就是区间下界，插值结果必然还在区间内。 */
const FOCUS_HUE = HUE_CYAN
const FOCUS_HUE_MIX = 0.55 // 最近处最多把色相拉走 55% 到青色
const FOCUS_ALPHA_BOOST = 0.25
const FOCUS_ALPHA_MAX = 0.95 // 焦点粒子可以亮过 0.7，但不给到全不透明

/* 发光：3~4px 的同色 glow（shadowBlur），让光点看起来是发光的而不是死板的小点。
   这是整条渲染链路里最贵的一项，所以只给光点加、**连线一律不加**；
   真掉帧时按规格"减粒子数"，而不是砍这里的画质。 */
const GLOW_BLUR = 4

/* 连线配色：**渐变色跟随两端粒子**（规格首选方案），不是兜底的统一蓝紫。
   实测依据（60 粒子 / 1440×802 / 无头 Chrome 软件光栅，含强制 flush 的整帧耗时）：
   渐变 vs 统一色 = 连线段 0.22~0.33ms vs 0.10~0.16ms（涨约 2 倍，但绝对值只有 0.1ms 量级），
   整帧 3.4~4.3ms vs 2.1~2.6ms —— 每帧多花 1.2~1.8ms，占 60fps 预算(16.7ms)的一成左右。
   既然软件光栅下都只多花这么点，就不必退到规格给的兜底方案了。 */

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  a: number
  /* 这颗粒子自己的色相节奏：周期(ms) + 初始相位(rad) */
  huePeriod: number
  huePhase: number
}

type Rgb = { r: number; g: number; b: number }

const FALLBACK_RGB: Rgb = { r: 50, g: 135, b: 255 } // = oklch(0.65 0.2 260) 的 sRGB 近似

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/* rgb → HSL，只取饱和度 / 明度。色相丢掉不用 —— 详见 resolveParticleShade 的说明。 */
function rgbToShade({ r, g, b }: Rgb) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { s: s * 100, l: l * 100 }
}

/* 饱和度 / 明度仍从设计令牌 --primary 解出来，整组炫彩粒子的"艳度"因此始终跟着主题走；
   **色相不取令牌** —— 规格把色相限死在 190°~310°、四个锚点由规格给定，
   令牌只负责告诉我们"这个主题的粒子该多艳多亮"。
   canvas 吃不透 oklch() 字符串（会静默失效），所以照旧用 1×1 canvas 先解析成真实 sRGB。 */
function resolveParticleShade() {
  const token = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim()
  if (!token) return rgbToShade(FALLBACK_RGB)

  try {
    const probe = document.createElement("canvas")
    probe.width = 1
    probe.height = 1
    const ctx = probe.getContext("2d")
    if (!ctx) return rgbToShade(FALLBACK_RGB)
    ctx.fillStyle = "#000"
    ctx.fillStyle = token
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return rgbToShade(a === 0 ? FALLBACK_RGB : { r, g, b })
  } catch {
    return rgbToShade(FALLBACK_RGB)
  }
}

export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [reduced, setReduced] = useState(() => prefersReducedMotion())

  /* 跟随系统设置变化 */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const shade = resolveParticleShade()
    /* 取整一次，避免每帧对每颗粒子重复格式化 */
    const satText = `${Math.round(shade.s)}%`
    const lightText = `${Math.round(shade.l)}%`
    const mouse = { x: -1e4, y: -1e4 }

    let frameId = 0
    let width = 0
    let height = 0
    let particles: Particle[] = []

    const count = () =>
      window.innerWidth < MOBILE_MAX_WIDTH
        ? PARTICLE_COUNT_MOBILE
        : PARTICLE_COUNT_DESKTOP

    const seed = () => {
      particles = Array.from({ length: count() }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * MAX_SPEED * 2,
        vy: (Math.random() - 0.5) * MAX_SPEED * 2,
        r: DOT_RADIUS_MIN + Math.random() * (DOT_RADIUS_MAX - DOT_RADIUS_MIN),
        a: DOT_ALPHA_MIN + Math.random() * (DOT_ALPHA_MAX - DOT_ALPHA_MIN),
        huePeriod:
          HUE_PERIOD_MIN + Math.random() * (HUE_PERIOD_MAX - HUE_PERIOD_MIN),
        huePhase: Math.random() * Math.PI * 2,
      }))
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      /* 跨过桌面/手机的宽度阈值时要换粒子数，否则把已有粒子收进新画布 */
      if (particles.length !== count()) {
        seed()
      } else {
        for (const p of particles) {
          p.x = Math.min(p.x, width)
          p.y = Math.min(p.y, height)
        }
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      mouse.x = event.clientX
      mouse.y = event.clientY
    }
    const onPointerLeave = () => {
      mouse.x = -1e4
      mouse.y = -1e4
    }

    /* 一帧。animate=false 时只画一次"静止帧"（reduced-motion 用）：不位移、不取鼠标、不排下一帧。
       色相照常按每颗粒子自己的相位算出来，所以静止帧依然是多彩的 —— 规格要的"粒子静止但颜色保留"。 */
    const drawFrame = (tMs: number, animate: boolean) => {
      const n = particles.length
      ctx.clearRect(0, 0, width, height)

      /* 1) 位移 + 鼠标接近度。proximity ∈ (0,1]，0 表示不在鼠标圈里 */
      const proximity = new Array<number>(n).fill(0)
      for (let i = 0; i < n; i++) {
        const p = particles[i]

        if (animate) {
          p.x += p.vx
          p.y += p.vy

          if (p.x < -20) p.x = width + 20
          else if (p.x > width + 20) p.x = -20
          if (p.y < -20) p.y = height + 20
          else if (p.y > height + 20) p.y = -20

          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const distance = Math.hypot(dx, dy)
          if (distance > 1 && distance < MOUSE_RADIUS) {
            /* 越靠外越弱，避免粒子被"吸"成一团 */
            const k = 1 - distance / MOUSE_RADIUS
            proximity[i] = k
            const pull = k * MOUSE_PULL
            p.x += dx * pull
            p.y += dy * pull
          }
        }
      }

      /* 2) 逐粒子算色相与亮度，把颜色串一次算好给后面两处复用。
         色相：正弦在 190°~310° 之间往复；鼠标圈里的往青色拉 + 提亮。 */
      const huePrefix = new Array<string>(n)
      const dotColor = new Array<string>(n)
      for (let i = 0; i < n; i++) {
        const p = particles[i]
        let hue =
          HUE_CENTER +
          HUE_SWING * Math.sin((tMs / p.huePeriod) * Math.PI * 2 + p.huePhase)
        let alpha = p.a

        const k = proximity[i]
        if (k > 0) {
          hue += (FOCUS_HUE - hue) * FOCUS_HUE_MIX * k
          alpha = Math.min(FOCUS_ALPHA_MAX, alpha + FOCUS_ALPHA_BOOST * k)
        }

        huePrefix[i] = `${hue.toFixed(1)}, ${satText}, ${lightText}`
        dotColor[i] = `hsla(${huePrefix[i]}, ${alpha.toFixed(3)})`
      }

      /* 3) 连线：只连 120px 以内的粒子，离得越远越淡（最亮也只有 10%）。
         两端各取对应粒子的色相，整条线做线性渐变，让连线也跟着"炫彩"起来。
         连线这一段**不带 glow** —— 否则等于把最贵的开销翻倍。 */
      const linkMax = LINK_DISTANCE * LINK_DISTANCE
      ctx.shadowBlur = 0
      ctx.lineWidth = 1
      for (let i = 0; i < n; i++) {
        const a = particles[i]
        for (let j = i + 1; j < n; j++) {
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const squared = dx * dx + dy * dy
          if (squared > linkMax) continue

          const fade = 1 - Math.sqrt(squared) / LINK_DISTANCE
          const alpha = (LINK_ALPHA * fade).toFixed(3)
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
          grad.addColorStop(0, `hsla(${huePrefix[i]}, ${alpha})`)
          grad.addColorStop(1, `hsla(${huePrefix[j]}, ${alpha})`)
          ctx.strokeStyle = grad
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      /* 4) 光点本身：同色 glow（shadowColor 跟着当前颜色走） */
      ctx.shadowBlur = GLOW_BLUR
      for (let i = 0; i < n; i++) {
        const p = particles[i]
        const color = dotColor[i]
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }

    /* reduced-motion：画一帧静止的多彩粒子就停手 —— 不排帧、不听鼠标，窗口尺寸变化时补画一次。 */
    if (reduced) {
      const paint = () => {
        resize()
        drawFrame(0, false)
      }
      paint()
      window.addEventListener("resize", paint)
      return () => window.removeEventListener("resize", paint)
    }

    const loop = (now: number) => {
      drawFrame(now, true)
      frameId = requestAnimationFrame(loop)
    }

    resize()
    loop(performance.now())

    window.addEventListener("resize", resize)
    window.addEventListener("pointermove", onPointerMove, { passive: true })
    document.addEventListener("mouseleave", onPointerLeave)

    /* 卸载 / 切换 reduced-motion 时取消帧循环并摘掉监听，避免残留 rAF */
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener("resize", resize)
      window.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("mouseleave", onPointerLeave)
    }
  }, [reduced])

  return <canvas ref={canvasRef} className="absolute inset-0 block size-full" />
}
