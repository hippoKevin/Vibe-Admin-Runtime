<template>
  <canvas ref="canvasRef" class="login-particles" aria-hidden="true"></canvas>
</template>

<script lang="ts">
export default {
  name: 'LoginParticles',
}
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface Particle {
  x: number
  y: number
  /** 深度：0 近 → 1 远 */
  depth: number
  vx: number
  vy: number
  size: number
  phase: number
  twinkleSpeed: number
  sprite: HTMLCanvasElement
}

const canvasRef = ref<HTMLCanvasElement | null>(null)

let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let particles: Particle[] = []
let width = 0
let height = 0
let dpr = 1
const mouseX = 0
const mouseY = 0
let lastTime = 0
let resizeObserver: ResizeObserver | null = null

const PARTICLE_COUNT = 72
const PERSPECTIVE = 520

/** 预渲染发光粒子贴图，避免每帧使用 shadowBlur 影响性能 */
function createGlowSprite(stops: [number, string][]): HTMLCanvasElement {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  stops.forEach(([offset, color]) => grad.addColorStop(offset, color))
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return canvas
}

// 粒子创建的大小以及颜色
const sprites = [
  createGlowSprite([
    [0, 'rgba(255,255,255,1)'],
    [0.35, 'rgba(255,255,255,0.55)'],
    [1, 'rgba(255,255,255,0)'],
  ]),
  createGlowSprite([
    [0, 'rgba(220,232,255,1)'],
    [0.35, 'rgba(150,185,255,0.5)'],
    [1, 'rgba(150,185,255,0)'],
  ]),
  createGlowSprite([
    [0, 'rgba(190,212,255,1)'],
    [0.35, 'rgba(105,150,255,0.45)'],
    [1, 'rgba(105,150,255,0)'],
  ]),
]

// 创建粒子
function spawnParticle(fromTop = false): Particle {
  const depth = Math.random()
  return {
    x: Math.random() * width,
    y: fromTop ? -30 : Math.random() * height,
    depth,
    vx: (Math.random() - 0.5) * 0.2,
    vy: 0.3 + Math.random() * 0.9,
    size: 3 + Math.random() * 9,
    phase: Math.random() * Math.PI * 2,
    twinkleSpeed: 1 + Math.random() * 3,
    sprite: sprites[Math.floor(Math.random() * sprites.length)]!,
  }
}

// 重置
function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const parent = canvas.parentElement
  if (!parent) return
  const w = parent.clientWidth
  const h = parent.clientHeight
  if (!w || !h) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = w
  height = h
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  particles = Array.from({ length: PARTICLE_COUNT }, () => spawnParticle())
}

// 绘制
function tick(now: number) {
  if (!ctx) {
    // 画布尚未就绪（如图片未加载完），继续排队，等 resize 初始化后再绘制
    raf = requestAnimationFrame(tick)
    return
  }
  const dt = Math.min(0.05, (now - lastTime) / 1000) || 0.016
  lastTime = now

  ctx.clearRect(0, 0, width, height)

  const t = now / 1000
  const centerX = width / 2
  const centerY = height / 2

  for (const p of particles) {
    // 3D 投影：深度越大，缩放越小、越慢、越透明
    const scale = PERSPECTIVE / (PERSPECTIVE + p.depth * 900)
    const sx = p.x + (mouseX - centerX) * 0.06 * (1 - p.depth)
    const sy = p.y + (mouseY - centerY) * 0.04 * (1 - p.depth)
    const r = p.size * scale

    const twinkle = 0.6 + 0.4 * Math.sin(t * p.twinkleSpeed + p.phase)
    const alpha = (0.22 + 0.68 * (1 - p.depth)) * twinkle

    ctx.globalAlpha = Math.max(0.05, Math.min(0.95, alpha))
    ctx.drawImage(p.sprite, sx - r, sy - r, r * 2, r * 2)

    // 移动与环绕
    p.x += p.vx * dt * 60
    p.y -= p.vy * dt * 60 * (1 + (1 - p.depth) * 0.8)
    if (p.y < -40) {
      Object.assign(p, spawnParticle(false), { y: height + 40 })
    }
    if (p.x < -40) p.x = width + 40
    if (p.x > width + 40) p.x = -40
  }

  ctx.globalAlpha = 1
  raf = requestAnimationFrame(tick)
}

// 鼠标移动跟随（关闭）
// function onMouseMove(e: MouseEvent) {
//   const canvas = canvasRef.value
//   if (!canvas) return
//   const rect = canvas.getBoundingClientRect()
//   mouseX = e.clientX - rect.left
//   mouseY = e.clientY - rect.top
// }

onMounted(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) return

  resize()
  const parent = canvasRef.value?.parentElement
  if (parent && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(parent)
  } else {
    window.addEventListener('resize', resize)
  }
  // window.addEventListener('mousemove', onMouseMove)
  lastTime = performance.now()
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  resizeObserver = null
  // window.removeEventListener('mousemove', onMouseMove)
})
</script>

<style scoped>
.login-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
</style>
