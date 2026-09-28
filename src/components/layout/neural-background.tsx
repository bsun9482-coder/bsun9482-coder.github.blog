import { useEffect, useRef, useState } from "react"

/* 漂浮粒子画布：全屏 Canvas，粒子缓慢漂移，近距离粒子之间连极细的线，
   形成类似神经网络节点连接的效果。整层不接收鼠标事件（父层 pointer-events-none），
   鼠标位置改为在 window 上监听。 */

/* 粒子数：桌面 60，窄屏（<768px）减半到 25 —— 规格上限就是 60 */
const PARTICLE_COUNT_DESKTOP = 60
const PARTICLE_COUNT_MOBILE = 25
const MOBILE_MAX_WIDTH = 768

const LINK_DISTANCE = 120 // 粒子间距小于这个值就连线
const LINK_ALPHA = 0.1 // 连线透明度上限（越远越淡）
const DOT_ALPHA_MIN = 0.3 // 粒子透明度 30%~60%
const DOT_ALPHA_MAX = 0.6
const DOT_RADIUS_MIN = 1 // 粒子半径 1~2px
const DOT_RADIUS_MAX = 2

const MAX_SPEED = 0.15 // 漂移速度上限（px/帧），慢到几乎看不出移动
const MOUSE_RADIUS = 150 // 鼠标影响半径
const MOUSE_PULL = 0.012 // 吸引强度：每帧朝鼠标挪剩余距离的 1.2%，克制到"轻微靠拢"
const MAX_DPR = 2 // 高 DPR 屏上限制缓冲尺寸，避免 3x 屏白烧一倍像素

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  a: number
}

type Rgb = { r: number; g: number; b: number }

const FALLBACK_RGB: Rgb = { r: 62, g: 137, b: 255 }

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/* 粒子色走设计令牌（--primary 就是规格里的 oklch(0.65 0.2 260)），不硬编码第二份颜色；
   但 canvas 直接吃 oklch() 字符串在部分内核上会静默失效，所以用 1×1 canvas 先解析成真实 sRGB。 */
function resolveParticleRgb(): Rgb {
  const token = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim()
  if (!token) return FALLBACK_RGB

  try {
    const probe = document.createElement("canvas")
    probe.width = 1
    probe.height = 1
    const ctx = probe.getContext("2d")
    if (!ctx) return FALLBACK_RGB
    ctx.fillStyle = "#000"
    ctx.fillStyle = token
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return a === 0 ? FALLBACK_RGB : { r, g, b }
  } catch {
    return FALLBACK_RGB
  }
}

export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [reduced, setReduced] = useState(() => prefersReducedMotion())

  /* 跟随系统设置变化：开了 prefers-reduced-motion 就不渲染 Canvas */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    if (reduced) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const color = resolveParticleRgb()
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

    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      /* 1) 位移：匀速随机漂移 + 出界回绕 + 鼠标附近轻微靠拢 */
      for (const p of particles) {
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
          const pull = (1 - distance / MOUSE_RADIUS) * MOUSE_PULL
          p.x += dx * pull
          p.y += dy * pull
        }
      }

      /* 2) 连线：只连 120px 以内的粒子，离得越远越淡（最亮也只有 10%） */
      const linkMax = LINK_DISTANCE * LINK_DISTANCE
      ctx.lineWidth = 1
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const squared = dx * dx + dy * dy
          if (squared > linkMax) continue

          const fade = 1 - Math.sqrt(squared) / LINK_DISTANCE
          ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${(LINK_ALPHA * fade).toFixed(3)})`
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      /* 3) 光点本身 */
      for (const p of particles) {
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${p.a.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      frameId = requestAnimationFrame(draw)
    }

    resize()
    draw()

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

  if (reduced) return null

  return <canvas ref={canvasRef} className="absolute inset-0 block size-full" />
}
