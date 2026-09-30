/**
 * 开发模式 · 球体神经网络画布
 *
 * 直接从 ADMINSERVER/public/dev-agent-console.html 移植过来（同一套算法与配色），
 * 只是从「函数 + 全局变量」改成了类，方便 Vue 组件在 onMounted / onBeforeUnmount 里
 * 创建与销毁。执行态（busy）下球体散开淡出，只剩向外释放的波纹。
 */

/** 球面节点数 */
const SPHERE_NODE_COUNT = 186
/** 球内核心节点数 */
const SPHERE_CORE_COUNT = 14
/** 球面连线的相对长度（相对半径） */
const SPHERE_LINK_RATIO = 0.5
/** 每个外围节点最多连几个球面节点 */
const BRIDGE_MAX = 2

/** 球面节点 */
interface SphereNode {
  ux: number
  uy: number
  uz: number
  u: number
  v: number
  phase: number
  tier: number
  isCore: boolean
  fire: number
  tx: number
  ty: number
  tz: number
  sx: number
  sy: number
  depth: number
  size: number
  alpha: number
}

/** 外围网格节点 */
interface FieldNode {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  fire: number
  dx: number
  dy: number
}

function randomUnitVector() {
  const z = Math.random() * 2 - 1
  const angle = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.max(0, 1 - z * z))
  return { x: Math.cos(angle) * r, y: z, z: Math.sin(angle) * r }
}

export class SphereMesh {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null
  /** 舞台尺寸与球心/半径 */
  private view = { w: 0, h: 0, cx: 0, cy: 0, radius: 132, dpr: 1 }
  private sphereNodes: SphereNode[] = []
  private fieldNodes: FieldNode[] = []
  private lastTime = 0
  /** 执行态过渡量：0 = 神经网络在，1 = 完全散开淡出 */
  private busyMix = 0
  /** 平滑后的音量 0~1 */
  private level = 0
  /** 品牌色色相（缓慢漂移） */
  private baseHue = 224

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.initNodes()
  }

  /** 从「舞台」元素量出球心与半径（画布本身是整屏的，只借它的中心点） */
  measure(stage: HTMLElement | null) {
    const rect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    this.view.w = Math.max(1, window.innerWidth)
    this.view.h = Math.max(1, window.innerHeight)
    this.view.dpr = window.devicePixelRatio || 1
    this.view.cx = rect.left + rect.width / 2
    // 球心略低于舞台中心，让「球 → 下方输入框」的距离更紧凑
    this.view.cy = rect.top + rect.height * 0.56
    this.view.radius = Math.max(92, Math.min(200, rect.width * 0.35))

    this.canvas.width = Math.max(1, Math.floor(this.view.w * this.view.dpr))
    this.canvas.height = Math.max(1, Math.floor(this.view.h * this.view.dpr))
    this.canvas.dataset.radius = String(Math.round(this.view.radius))

    // 尺寸变化只把外围节点收敛回视口，球面节点是按方向即时投影的
    for (const node of this.fieldNodes) {
      node.x = Math.min(Math.max(node.x, 0), this.view.w)
      node.y = Math.min(Math.max(node.y, 0), this.view.h)
    }
  }

  /** 球心屏幕坐标（「生成中…」提示跟着球心走） */
  get center() {
    return { x: this.view.cx, y: this.view.cy }
  }

  /** 生成球面节点（Fibonacci 均匀分布）+ 球内核心节点 + 外围稀疏网格 */
  private initNodes() {
    const golden = Math.PI * (3 - Math.sqrt(5))
    this.sphereNodes = []

    for (let i = 0; i < SPHERE_NODE_COUNT; i += 1) {
      const y = 1 - (i / (SPHERE_NODE_COUNT - 1)) * 2
      const ring = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = golden * i
      const roll = Math.random()
      this.sphereNodes.push({
        ux: Math.cos(theta) * ring,
        uy: y,
        uz: Math.sin(theta) * ring,
        u: theta,
        v: Math.acos(Math.min(1, Math.max(-1, y))),
        phase: Math.random() * Math.PI * 2,
        tier: roll > 0.88 ? 2 : roll > 0.58 ? 1 : 0,
        isCore: false,
        fire: 0,
        tx: 0,
        ty: 0,
        tz: 0,
        sx: 0,
        sy: 0,
        depth: 0.5,
        size: 1,
        alpha: 1,
      })
    }

    for (let c = 0; c < SPHERE_CORE_COUNT; c += 1) {
      const dir = randomUnitVector()
      const shrink = 0.3 + Math.random() * 0.52
      this.sphereNodes.push({
        ux: dir.x * shrink,
        uy: dir.y * shrink,
        uz: dir.z * shrink,
        u: Math.random() * Math.PI * 2,
        v: Math.random() * Math.PI,
        phase: Math.random() * Math.PI * 2,
        tier: 1,
        isCore: true,
        fire: 0,
        tx: 0,
        ty: 0,
        tz: 0,
        sx: 0,
        sy: 0,
        depth: 0.5,
        size: 1,
        alpha: 1,
      })
    }

    this.fieldNodes = []
    const count = Math.min(96, Math.max(56, Math.round((this.view.w * this.view.h) / 22000)))
    let guard = 0
    while (this.fieldNodes.length < count && guard < 4000) {
      guard += 1
      const fx = Math.random() * this.view.w
      const fy = Math.random() * this.view.h
      if (Math.hypot(fx - this.view.cx, fy - this.view.cy) < this.view.radius * 1.25) continue
      this.fieldNodes.push({
        x: fx,
        y: fy,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        phase: Math.random() * Math.PI * 2,
        fire: 0,
        dx: 0,
        dy: 0,
      })
    }
  }

  /** 每帧推进一次（音量电平 + 执行态过渡），然后画一帧 */
  frame(now: number, level: number, busy: boolean) {
    // 执行中即使没有麦克风也给一点「能量」，让球体/波纹有反应
    const effective = busy ? Math.max(level, 0.45 + 0.25 * Math.sin(now / 260)) : level
    this.level = this.level * 0.85 + effective * 0.15

    const target = busy ? 1 : 0
    const dt = 16
    this.busyMix += (target - this.busyMix) * Math.min(1, dt * 0.0045)

    this.draw(now)
  }

  /** 画一帧球体神经网络（球面波 + 缓慢自转 + 近大远小/近亮远暗 + bloom） */
  private draw(now: number) {
    const ctx = this.ctx
    if (!ctx) return

    this.lastTime = now

    const { w, h, dpr, cx, cy, radius: R } = this.view
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const fade = 1 - this.busyMix
    if (fade <= 0.01) return

    const busyMix = this.busyMix
    const smoothLevel = this.level

    const spin = (now / 1000) * 0.13
    const tilt = Math.sin(now / 5200) * 0.22
    const cosSpin = Math.cos(spin)
    const sinSpin = Math.sin(spin)
    const cosTilt = Math.cos(tilt)
    const sinTilt = Math.sin(tilt)

    const waveSpeed = 1 + smoothLevel * 0.55
    const t = (now / 1000) * waveSpeed
    const waveAmp = 0.09 + smoothLevel * 0.055
    const disperse = 1 + busyMix * 0.9

    // 鲜明配色：主色相 + 邻近色相 + 对比色相，缓慢漂移（约 50s 一轮）
    const hue = (this.baseHue + now / 140) % 360
    const colorA = `hsl(${hue}, 92%, 44%)`
    const colorB = `hsl(${(hue + 38) % 360}, 95%, 46%)`
    const colorC = `hsl(${(hue + 296) % 360}, 90%, 52%)`

    // 球体柔和底色：加法混合叠出「实体 + 发光」
    ctx.globalCompositeOperation = 'lighter'
    const glow = ctx.createRadialGradient(cx, cy, R * 0.08, cx, cy, R * 1.5)
    glow.addColorStop(0, `hsla(${hue}, 96%, 62%, ${0.3 * fade})`)
    glow.addColorStop(0.42, `hsla(${(hue + 40) % 360}, 96%, 60%, ${0.15 * fade})`)
    glow.addColorStop(1, `hsla(${(hue + 80) % 360}, 96%, 60%, 0)`)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2)
    ctx.fill()

    // ── 球面节点：自转 + 球面波 + 深度层次 ──
    for (const node of this.sphereNodes) {
      const base = Math.hypot(node.ux, node.uy, node.uz) || 1
      const w1 = Math.sin(node.u * 3 + t * 1.15)
      const w2 = Math.sin(node.v * 4 - t * 0.95)
      const w3 = Math.sin((node.u + node.v) * 2 + t * 0.7)
      const wave = (0.42 * w1 + 0.34 * w2 + 0.24 * w3) * waveAmp * (node.isCore ? 0.35 : 1)
      const r = R * base * (1 + wave) * disperse

      const x1 = node.ux * cosSpin + node.uz * sinSpin
      const y1 = node.uy
      const z1 = -node.ux * sinSpin + node.uz * cosSpin
      const y2 = y1 * cosTilt - z1 * sinTilt
      const z2 = y1 * sinTilt + z1 * cosTilt

      node.tx = x1 * r
      node.ty = y2 * r
      node.tz = z2 * r

      const persp = 1 + z2 * 0.07
      node.sx = cx + node.tx * persp
      node.sy = cy + node.ty * persp
      node.depth = (z2 + 1) / 2

      const tierScale = node.tier === 2 ? 1.8 : node.tier === 1 ? 1.35 : 1
      node.size = (0.7 + node.depth * 1.3) * tierScale
      node.alpha = (0.36 + node.depth * 0.7) * fade * (node.isCore ? 1.15 : 1)
      node.fire = 0.5 + 0.5 * Math.sin(now / 620 + node.phase)
    }

    // ── 球面连线：按透明度分桶批量描边 ──
    const sphereLink = R * SPHERE_LINK_RATIO
    const sphereLink2 = sphereLink * sphereLink
    const sphereBuckets: number[][] = [[], [], [], [], [], [], []]

    for (let i = 0; i < this.sphereNodes.length; i += 1) {
      const a = this.sphereNodes[i]!
      for (let j = i + 1; j < this.sphereNodes.length; j += 1) {
        const b = this.sphereNodes[j]!
        const dx = a.tx - b.tx
        const dy = a.ty - b.ty
        const dz = a.tz - b.tz
        const dist2 = dx * dx + dy * dy + dz * dz
        if (dist2 > sphereLink2) continue

        const near = 1 - Math.sqrt(dist2) / sphereLink
        const depthMix = Math.min(a.depth, b.depth)
        const firing = 0.35 + 0.65 * (a.fire + b.fire) * 0.5
        const alpha = (0.26 + depthMix * 0.72) * near * firing * fade
        const bucket = Math.min(sphereBuckets.length - 1, Math.max(0, Math.floor(alpha / 0.16)))
        sphereBuckets[bucket]!.push(a.sx, a.sy, b.sx, b.sy)
      }
    }

    // ── 外围网格：整屏漂移 + 由球面波传出去的涟漪 ──
    const fieldBuckets: number[][] = [[], [], [], [], [], []]
    const fieldLinkDist = Math.max(120, R * 1.35)
    const fieldLink2 = fieldLinkDist * fieldLinkDist
    const bridgeLinkDist = Math.max(96, R * 0.9)
    const bridgeLink2 = bridgeLinkDist * bridgeLinkDist

    for (const node of this.fieldNodes) {
      node.x += node.vx
      node.y += node.vy
      if (node.x <= 0 || node.x >= w) node.vx *= -1
      if (node.y <= 0 || node.y >= h) node.vy *= -1
      node.x = Math.min(Math.max(node.x, 0), w)
      node.y = Math.min(Math.max(node.y, 0), h)

      const ox = node.x - cx
      const oy = node.y - cy
      const dist = Math.hypot(ox, oy) || 1
      const ripple =
        Math.sin(dist / 52 - t * 1.5 + node.phase * 0.25) *
        (0.55 + smoothLevel * 0.45) *
        Math.exp(-dist / 560) *
        15
      node.dx = node.x + (ox / dist) * ripple
      node.dy = node.y + (oy / dist) * ripple
      node.fire = 0.5 + 0.5 * Math.sin(now / 700 + node.phase)
    }

    for (let i = 0; i < this.fieldNodes.length; i += 1) {
      const a = this.fieldNodes[i]!

      for (let j = i + 1; j < this.fieldNodes.length; j += 1) {
        const b = this.fieldNodes[j]!
        const dx = a.dx - b.dx
        const dy = a.dy - b.dy
        const dist2 = dx * dx + dy * dy
        if (dist2 > fieldLink2) continue

        const near = 1 - Math.sqrt(dist2) / fieldLinkDist
        const firing = 0.4 + 0.6 * (a.fire + b.fire) * 0.5
        const alpha = (0.16 + smoothLevel * 0.12) * near * firing * fade
        const bucket = Math.min(fieldBuckets.length - 1, Math.max(0, Math.floor(alpha / 0.08)))
        fieldBuckets[bucket]!.push(a.dx, a.dy, b.dx, b.dy)
      }

      // 球面 ↔ 外围：只连最近的两三个球面节点，避免拉出放射状「星芒」
      const candidates: { d: number; x: number; y: number }[] = []
      for (const s of this.sphereNodes) {
        const sdx = a.dx - s.sx
        const sdy = a.dy - s.sy
        const sdist2 = sdx * sdx + sdy * sdy
        if (sdist2 > bridgeLink2) continue
        candidates.push({ d: Math.sqrt(sdist2), x: s.sx, y: s.sy })
      }
      if (candidates.length > 1) candidates.sort((p, q) => p.d - q.d)
      for (let m = 0; m < Math.min(BRIDGE_MAX, candidates.length); m += 1) {
        const hit = candidates[m]!
        const near = 1 - hit.d / bridgeLinkDist
        const alpha = 0.34 * near * fade
        const bucket = Math.min(fieldBuckets.length - 1, Math.max(0, Math.floor(alpha / 0.08)))
        fieldBuckets[bucket]!.push(a.dx, a.dy, hit.x, hit.y)
      }
    }

    /** 批量描边（几千条边只 stroke 几次，帧率稳） */
    const strokeBuckets = (buckets: number[][], step: number, offset: number) => {
      for (let index = 0; index < buckets.length; index += 1) {
        const segment = buckets[index]!
        if (!segment.length) continue
        ctx.globalAlpha = Math.min(0.92, offset + (index + 0.5) * step)
        ctx.beginPath()
        for (let p = 0; p < segment.length; p += 4) {
          ctx.moveTo(segment[p]!, segment[p + 1]!)
          ctx.lineTo(segment[p + 2]!, segment[p + 3]!)
        }
        ctx.stroke()
      }
    }

    ctx.globalCompositeOperation = 'source-over'

    // 外围连线（整屏淡淡的网格）
    const fieldStroke = ctx.createLinearGradient(0, 0, w, h)
    fieldStroke.addColorStop(0, colorA)
    fieldStroke.addColorStop(0.5, colorB)
    fieldStroke.addColorStop(1, colorC)
    ctx.strokeStyle = fieldStroke
    ctx.lineWidth = 1
    strokeBuckets(fieldBuckets, 0.08, 0.06)

    // 球面连线（更粗更亮）
    const sphereStroke = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R)
    sphereStroke.addColorStop(0, colorA)
    sphereStroke.addColorStop(0.5, colorB)
    sphereStroke.addColorStop(1, colorC)
    ctx.strokeStyle = sphereStroke
    ctx.lineWidth = 1.4 + smoothLevel * 0.9
    strokeBuckets(sphereBuckets, 0.16, 0.16)

    // 外围网格节点
    const dotBuckets: number[][] = [[], [], [], [], []]
    for (const node of this.fieldNodes) {
      const alpha = (0.34 + smoothLevel * 0.2) * (0.6 + node.fire * 0.7) * fade
      const bucket = Math.min(dotBuckets.length - 1, Math.max(0, Math.floor(alpha / 0.14)))
      dotBuckets[bucket]!.push(node.dx, node.dy, 1.2 + node.fire * 0.7)
    }
    ctx.fillStyle = fieldStroke
    for (let db = 0; db < dotBuckets.length; db += 1) {
      const dots = dotBuckets[db]!
      if (!dots.length) continue
      ctx.globalAlpha = Math.min(0.85, 0.1 + (db + 0.5) * 0.14)
      ctx.beginPath()
      for (let di = 0; di < dots.length; di += 3) {
        const dotX = dots[di]!
        const dotY = dots[di + 1]!
        const dotR = Math.max(0.5, dots[di + 2]!)
        // arc 会从当前点连线到圆弧起点，必须先用 moveTo 起新子路径
        ctx.moveTo(dotX + dotR, dotY)
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      }
      ctx.fill()
    }

    // 球面节点 bloom 外发光（加法混合，两档批量画）
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = sphereStroke
    const passes = [
      { tier: 2, scale: 4.6, alpha: 0.24 },
      { tier: 1, scale: 2.9, alpha: 0.12 },
    ]
    for (const pass of passes) {
      ctx.globalAlpha = pass.alpha * fade
      ctx.beginPath()
      let any = false
      for (const node of this.sphereNodes) {
        if (node.tier !== pass.tier) continue
        ctx.moveTo(node.sx + node.size * pass.scale, node.sy)
        ctx.arc(node.sx, node.sy, Math.max(0.6, node.size * pass.scale), 0, Math.PI * 2)
        any = true
      }
      if (any) ctx.fill()
    }

    // 球面节点本体
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = sphereStroke
    const nodeBuckets: number[][] = [[], [], [], [], []]
    for (const node of this.sphereNodes) {
      const alpha = node.alpha * (0.55 + node.fire * 0.8)
      const bucket = Math.min(nodeBuckets.length - 1, Math.max(0, Math.floor(alpha / 0.18)))
      nodeBuckets[bucket]!.push(node.sx, node.sy, node.size)
    }
    for (let nb = 0; nb < nodeBuckets.length; nb += 1) {
      const items = nodeBuckets[nb]!
      if (!items.length) continue
      ctx.globalAlpha = Math.min(0.98, 0.2 + (nb + 0.5) * 0.18)
      ctx.beginPath()
      for (let ni = 0; ni < items.length; ni += 3) {
        const nodeX = items[ni]!
        const nodeY = items[ni + 1]!
        const nodeR = Math.max(0.5, items[ni + 2]!)
        ctx.moveTo(nodeX + nodeR, nodeY)
        ctx.arc(nodeX, nodeY, nodeR, 0, Math.PI * 2)
      }
      ctx.fill()
    }

    ctx.globalAlpha = 1
  }
}

/**
 * 白色波形音轨（语音模式，同一位置）：从麦克风 analyser 取时域数据画一条发光线。
 */
export function drawWave(canvas: HTMLCanvasElement, analyser: AnalyserNode | null, timeData: Uint8Array | null) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth || 320
  const height = canvas.clientHeight || 46
  const pixelWidth = Math.max(1, Math.floor(width * dpr))
  const pixelHeight = Math.max(1, Math.floor(height * dpr))
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const mid = height / 2
  ctx.beginPath()

  if (analyser && timeData) {
    analyser.getByteTimeDomainData(timeData as Uint8Array<ArrayBuffer>)
    const step = Math.max(1, Math.floor(timeData.length / 140))
    let started = false
    for (let i = 0; i < timeData.length; i += step) {
      const value = ((timeData[i] || 128) - 128) / 128
      const x = (i / (timeData.length - 1)) * width
      const y = mid - value * mid * 0.9
      if (started) ctx.lineTo(x, y)
      else {
        ctx.moveTo(x, y)
        started = true
      }
    }
  } else {
    // 没有麦克风数据时画一条静止基线
    ctx.moveTo(0, mid)
    ctx.lineTo(width, mid)
  }

  // 白色波形主体（深色底衬上直接发光，浅色页面上也清晰）
  const gradient = ctx.createLinearGradient(0, 0, width, 0)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.35)')
  ctx.strokeStyle = gradient
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.shadowColor = 'rgba(255, 255, 255, 0.9)'
  ctx.shadowBlur = 10
  ctx.stroke()
  ctx.shadowBlur = 0
}

/** 从 analyser 取当前音量电平 0~1 */
export function readLevel(analyser: AnalyserNode | null, timeData: Uint8Array | null): number {
  if (!analyser || !timeData) return 0
  analyser.getByteTimeDomainData(timeData as Uint8Array<ArrayBuffer>)
  let sum = 0
  for (let i = 0; i < timeData.length; i += 1) {
    const value = ((timeData[i] || 128) - 128) / 128
    sum += value * value
  }
  return Math.min(1, Math.sqrt(sum / timeData.length) * 4)
}
