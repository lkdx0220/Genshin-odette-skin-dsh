/**
 * dsh-odette-skin — Odette 冰雪梦幻主题（Client 侧）v0.3
 *
 * v0.3 变更（机制对齐 maid-atelier，纯展示层）：
 *  - 素材内嵌：图片以 base64 data URI 打进 bundle（art.generated.ts），
 *    不再依赖 host 静态资源路由/远程 URL/浏览器缓存策略（IMG_REV 版本号机制移除）
 *  - CSS 文件化：enhance.css/chrome.css 经 lightningcss 编译内联，工厂执行时注入
 *    <style data-plugin> 标签，插件卸载由 dsh loader 按归属统一清理
 *  - 皮肤开关 = body[data-odette-skin] 作用域属性 + token 层叠加/释放，
 *    不再手动增删样式标签（增强样式全部收敛到作用域选择器下，关闭即零残留）
 *  - 侧栏宽度/rail 态：ResizeObserver + MutationObserver 驱动，移除两个轮询定时器
 *
 * 兼容性契约（与 v0.2 完全一致，未改动）：
 *  - export const inject = ['theme', 'slots']
 *  - __ModuleLoader__ 工厂导出 apply（tsdown banner/footer 未变）
 *  - 官方 data 契约选择器：[data-composer-card]、[data-phase]、[role='tablist'] 等
 */
declare const document: any
declare const window: any

// eslint-disable-next-line no-undef
const react = require('react')
const useState = react.useState
const useEffect = react.useEffect

import {
  ODETTE_BG_DARK,
  ODETTE_BG_LIGHT,
  ODETTE_HERO_DARK,
  ODETTE_HERO_LIGHT,
  ODETTE_LOGO_DARK,
  ODETTE_LOGO_LIGHT,
  ODETTE_TRIM_LACE,
  ODETTE_CORNER_TL,
  ODETTE_CORNER_TR,
  ODETTE_CORNER_BL,
  ODETTE_CORNER_BR,
  ODETTE_BOW,
  ODETTE_DECO,
  ODETTE_SWAN_V4,
  ODETTE_SWAN_V5,
  ODETTE_CREST_WHITE,
  ODETTE_FEATHER,
  ODETTE_STICK,
  ODETTE_NESTING,
  ODETTE_TRIO,
  ODETTE_POSTER,
  ODETTE_POSTER_DARK,
} from './art.generated.ts'
import './enhance.css'
import './chrome.css'

type ThemeSnapshot = {
  preference: string
  active?: { id: string; colorScheme: 'light' | 'dark'; tokens: Record<string, string> }
}

type SlotDefinition = { name: string; id: string; order?: number; label?: string | (() => string) }

type ClientContext = {
  theme: {
    getTheme(): ThemeSnapshot
    overrideTokens(source: string, tokens: Record<string, { light: string; dark: string }>): () => void
  }
  slots: {
    inject(key: string, callback: () => () => void): () => void
    register(def: SlotDefinition, content: any): () => void
  }
  on(event: string, listener: (snapshot: ThemeSnapshot) => void): () => void
  effect<T>(factory: () => T, label?: string): T
}

export const inject = ['theme', 'slots']

const SOURCE = 'dsh-odette-skin'
const SKIN_KEY = 'dsh-odette-skin:enabled'
/** body 作用域属性：皮肤总开关（enhance.css 全部规则挂在此属性下） */
const SKIN_ATTR = 'data-odette-skin'
/** 皮肤写入的 body 样式变量（卸载时按原值精确还原） */
const SKIN_BODY_PROPERTIES = [
  '--odette-bg-art', '--odette-hero-art', '--odette-trim-lace-art',
  '--odette-corner-tl-art', '--odette-corner-tr-art',
  '--odette-corner-bl-art', '--odette-corner-br-art',
  '--odette-bow-art',
  '--odette-feather-art', '--odette-stick-art', '--odette-nesting-art', '--odette-trio-art',
  '--odette-swan-v5-art',
  '--odette-crest-white-art',
  '--odette-poster-art',
  /* 天鹅定位几何变量（由 align-swan-bottom-v4.cjs 扫描素材生成，零手算幻数） */
  '--swan-bg-size-w', '--swan-bg-size-h',
  '--swan-bar-top-from-bot-render', '--swan-bar-mid-from-bot-render', '--swan-bar-bot-from-bot-render',
]
/* 天鹅素材对齐元数据（脚本自动扫描横杠位置，写入 swan-meta.generated.json） */
// @ts-ignore - json require by tsdown config
const SWAN_META = require('./swan-meta.generated.json')

/* ============================ 主题色板 ============================ */

/** 13 个官方 alias token 的深/浅双色板（Odette 蓝紫冰雪调） */
const TOKENS: Record<string, { light: string; dark: string }> = {
  '--dsw-alias-bg-base': { light: 'rgba(243, 246, 255, 0.56)', dark: 'rgba(13, 16, 40, 0.62)' },
  '--dsw-alias-bg-layer-1': { light: 'rgba(250, 252, 255, 0.62)', dark: 'rgba(23, 27, 58, 0.70)' },
  '--dsw-alias-bg-layer-2': { light: 'rgba(236, 241, 255, 0.68)', dark: 'rgba(32, 37, 76, 0.78)' },
  '--dsw-alias-bg-overlay': { light: 'rgba(250, 252, 255, 0.90)', dark: 'rgba(16, 19, 46, 0.92)' },
  '--dsw-alias-border-l1': { light: 'rgba(94, 116, 205, 0.20)', dark: 'rgba(168, 180, 255, 0.16)' },
  '--dsw-alias-border-l2': { light: 'rgba(94, 116, 205, 0.34)', dark: 'rgba(168, 180, 255, 0.30)' },
  '--dsw-alias-brand-primary': { light: '#5b74e8', dark: '#9db8ff' },
  '--dsw-alias-label-primary': { light: '#0f1535', dark: '#f0f3ff' },
  '--dsw-alias-label-secondary': { light: 'rgba(15, 21, 51, 0.86)', dark: 'rgba(214, 221, 255, 0.66)' },
  '--dsw-alias-state-error-primary': { light: '#e0526e', dark: '#ff8fa3' },
  '--dsw-alias-state-success-primary': { light: '#2ea978', dark: '#57e0a8' },
  '--dsw-alias-state-warn-primary': { light: '#d9922c', dark: '#ffc97a' },
  '--dsw-specific-sidebar-fill': { light: 'rgba(240, 244, 255, 0.50)', dark: 'rgba(10, 12, 32, 0.60)' },
}

/* ============================ 皮肤控制器 ============================ */

let enabled = readStored()
let themeRef: any = null
let tokenDispose: (() => void) | null = null
let activeScheme: 'light' | 'dark' = 'dark'
/** 浮层开关贴纸 img：scheme 切换时换海报（浅=奥黛塔海报 / 深=黑雪鹄海报），createFloatLayer 内赋值 */
let posterImg: HTMLImageElement | null = null
/** 浮层按钮渲染钩子：theme/change 时刷新明暗按钮（createFloatLayer 内注册，dispose 置空） */
let floatRender: (() => void) | null = null
const listeners = new Set<() => void>()

function readStored(): boolean {
  try {
    return localStorage.getItem(SKIN_KEY) !== 'off'
  } catch {
    return true
  }
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function emit(): void {
  listeners.forEach((fn) => fn())
}

function toggleSkin(): void {
  setEnabled(!enabled)
}

/** 切换浅色/深色主题（浮层 ❄ 按钮职责；小兽仍是皮肤开/关开关）。
    setTheme(id) = 官方 theme 服务：写偏好 + publish → theme/change 事件驱动全局
    校准（data-ds-dark-theme / 背景素材变量 / 按钮渲染），与设置面板切换等效。 */
function toggleColorScheme(): void {
  try {
    if (!themeRef) return
    const snap = themeRef.getTheme()
    const cur = snap?.active?.colorScheme ?? (resolveDark(snap) ? 'dark' : 'light')
    themeRef.setTheme(cur === 'dark' ? 'light' : 'dark')
  } catch { /* 忽略切换失败 */ }
}

function setEnabled(v: boolean): void {
  if (enabled === v) return
  enabled = v
  try { localStorage.setItem(SKIN_KEY, v ? 'on' : 'off') } catch { /* 忽略持久化失败 */ }
  syncSkin()
  emit()
}

/**
 * 按开关状态应用/移除皮肤：
 *  - 开 = body 作用域属性 + token 叠加（CSS/素材变量常驻，属性点亮即生效）
 *  - 关 = 摘属性 + 释放 token（作用域选择器整体失效，零残留）
 * 样式标签与 DOM 装饰不随开关增删，避免高频切换下的节点抖动
 */
function syncSkin(): void {
  if (enabled) {
    if (!tokenDispose) tokenDispose = themeRef.overrideTokens(SOURCE, TOKENS)
    document.body.setAttribute(SKIN_ATTR, '')
  } else {
    if (tokenDispose) { tokenDispose(); tokenDispose = null }
    document.body.removeAttribute(SKIN_ATTR)
  }
}

/** 按主题切换背景素材变量（enhance.css 的 body::before/::after 消费该变量：
    --odette-hero-art = 新会话页（hero 态）背景，--odette-bg-art = 会话中（workspace 态）背景） */
function syncBackdrop(scheme: 'light' | 'dark'): void {
  const source = scheme === 'light' ? ODETTE_BG_LIGHT : ODETTE_BG_DARK
  const hero = scheme === 'light' ? ODETTE_HERO_LIGHT : ODETTE_HERO_DARK
  const logo = scheme === 'light' ? ODETTE_LOGO_LIGHT : ODETTE_LOGO_DARK
  document.body.style.setProperty('--odette-bg-art', 'url("' + source + '")')
  document.body.style.setProperty('--odette-hero-art', 'url("' + hero + '")')
  document.body.style.setProperty('--odette-hero-logo-art', 'url("' + logo + '")')
  /* 浮层开关贴纸：浅色=奥黛塔海报 / 深色=黑雪鹄海报（scheme 切换即时换图） */
  if (posterImg) posterImg.src = scheme === 'dark' ? ODETTE_POSTER_DARK : ODETTE_POSTER
}

/* ============================ 主题属性校准（浅色模式兜底） ============================
 * 背景：body 的 data-ds-dark-theme 由 layout 的 ThemePresenter 在 theme/change 时
 * 设置/移除（client.js L365-374）。部分客户端（旧版/桌面）该链路失效 →
 * 用户切浅色后属性残留 → maid/odette 的深色规则仍命中 → 深蓝卡片 + 透明文字。
 * 方案：皮肤作为该属性的最终权威，任何信号（初始 / theme/change / 系统主题）都校准。
 * 校准值与官方 presenter 一致（都源自 colorScheme + preference），官方链路正常时
 * 幂等无感；失效时我们修正，让所有依赖该属性的皮肤规则正确跟随真实主题。
 */
const darkMedia = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null

function resolveDark(snapshot: any): boolean {
  const pref = snapshot && snapshot.preference
  if (pref === 'dark') return true
  if (pref === 'light') return false
  return darkMedia ? darkMedia.matches : true
}

function calibrateDarkAttribute(snapshot: any): void {
  try {
    if (resolveDark(snapshot)) document.body.setAttribute('data-ds-dark-theme', '')
    else document.body.removeAttribute('data-ds-dark-theme')
  } catch { /* 忽略 DOM 异常 */ }
}

/* ============================ React 组件 ============================ */

/** 简易 h()：免 JSX 的 createElement */
function h(type: any, props: any): any {
  const children = Array.prototype.slice.call(arguments, 2)
  if (children.length === 0) return react.createElement(type, props || null)
  if (children.length === 1) return react.createElement(type, props || null, children[0])
  return react.createElement(type, props || null, children)
}

/** 订阅皮肤状态（开启/关闭时重渲染） */
function useSkin(): boolean {
  const state = useState(0)
  const force = state[1]
  useEffect(() => subscribe(() => force((x: number) => x + 1)), [])
  return enabled
}

/** 雪花小图标 */
function snowGlyph(): any {
  return h('span', { className: 'odette-snow', 'aria-hidden': 'true' }, '❄')
}

/** 皮肤开关按钮（sidebar.footer.action；仅真窄栏态（props.wide === false）不占 footer 行，窄栏入口由浮层承担） */
function SkinToggle(props: any): any {
  useSkin()
  if (props && props.wide === false) return null
  const on = enabled
  return h(
    'button',
    {
      type: 'button',
      className: 'odette-toggle',
      'data-on': on ? '1' : '0',
      'aria-pressed': on,
      title: on ? '关闭 Odette 皮肤' : '开启 Odette 皮肤',
      onClick: toggleSkin,
    },
    snowGlyph(),
    h('span', { className: 'odette-toggle-label' }, on ? '皮肤 开' : '皮肤 关'),
  )
}

/** 侧栏是否处于窄栏（rail）态：frame 带 data-sidebar-collapsed 属性（layout 插件注入） */
function checkRail(): boolean {
  try {
    return typeof document !== 'undefined' && !!document.querySelector('[data-sidebar-collapsed]')
  } catch {
    return false
  }
}

/**
 * 浮层开关组合（❄ 按钮 + 小兽）：JS 直接挂 body（不再走 shell.overlay 槽——
 * 3080 预览版 UI 无 overlay 渲染层，slot 条目注册成功但无处渲染；maid-atelier
 * 同款做法：装饰元素一律 document.body.appendChild）。
 * 无条件渲染在视口左下角；窄栏（rail）态整体上移、隐藏 ❄ 胶囊按钮。
 * rail 态变化由 apply() 内的 MutationObserver 驱动 render（不再轮询）。
 *
 * v0.4+（拖动卡片）：整个浮层可被用户自由拖动——pointer 事件统一鼠标/触屏，
 * 位移 > 4px 判定为拖动（并抑制随后的 click，避免拖动后误触开关）；
 * 位置 clamp 在视口内并持久化到 localStorage（dsh-odette-skin:float-pos），
 * 刷新/重启后恢复。用户拖过之后（data-dragged）位置完全由内联 left/top 接管，
 * rail 态 CSS 自动定位不再生效（避免与用户摆放冲突，防止遮挡其他插件按键）。
 */
const FLOAT_POS_KEY = 'dsh-odette-skin:float-pos'

function readFloatPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(FLOAT_POS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (typeof p.x === 'number' && typeof p.y === 'number') return p
  } catch { /* 读取失败按未拖动处理 */ }
  return null
}

function writeFloatPos(x: number, y: number): void {
  try { localStorage.setItem(FLOAT_POS_KEY, JSON.stringify({ x, y })) } catch { /* ignore */ }
}

function createFloatLayer(railChanged: (fn: () => void) => void): () => void {
  const wrap = document.createElement('div')
  wrap.className = 'odette-float'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'odette-float-btn'
  btn.innerHTML = '<span class="odette-scheme-icon" aria-hidden="true"></span><span class="odette-float-label"></span>'
  const img = document.createElement('img')
  img.className = 'odette-overlay-deco'
  img.src = activeScheme === 'dark' ? ODETTE_POSTER_DARK : ODETTE_POSTER
  img.alt = ''
  img.draggable = false
  posterImg = img
  wrap.append(btn, img)

  /* ---- 拖动卡片：位置持久化 + pointer 拖动 + clamp 视口 + 点击/拖动区分 ---- */
  const savedPos = readFloatPos()
  if (savedPos) {
    wrap.style.left = savedPos.x + 'px'
    wrap.style.top = savedPos.y + 'px'
    wrap.style.bottom = 'auto'
    wrap.dataset.dragged = '1'
  }
  let dragState: { sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null
  let justDragged = false
  const onPointerDown = (e: any): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const r = wrap.getBoundingClientRect()
    dragState = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false }
    wrap.dataset.dragging = '1'
    e.preventDefault()
  }
  const onPointerMove = (e: any): void => {
    if (!dragState) return
    const dx = e.clientX - dragState.sx
    const dy = e.clientY - dragState.sy
    if (!dragState.moved && Math.abs(dx) + Math.abs(dy) > 4) dragState.moved = true
    if (!dragState.moved) return
    const r = wrap.getBoundingClientRect()
    const maxX = Math.max(0, window.innerWidth - r.width)
    const maxY = Math.max(0, window.innerHeight - r.height)
    const nx = Math.min(maxX, Math.max(0, dragState.ox + dx))
    const ny = Math.min(maxY, Math.max(0, dragState.oy + dy))
    wrap.style.left = nx + 'px'
    wrap.style.top = ny + 'px'
    wrap.style.bottom = 'auto'
    wrap.dataset.dragged = '1'
    e.preventDefault()
  }
  const onPointerUp = (): void => {
    if (!dragState) return
    const wasDrag = dragState.moved
    dragState = null
    delete wrap.dataset.dragging
    if (wasDrag) {
      const x = parseFloat(wrap.style.left) || 0
      const y = parseFloat(wrap.style.top) || 0
      writeFloatPos(x, y)
      justDragged = true
      setTimeout(() => { justDragged = false }, 150)
    }
  }
  const onClickCapture = (e: any): void => {
    // 刚拖完的 click（浏览器在 pointerup 后补发）直接吞掉，避免误触发开关
    if (justDragged) {
      justDragged = false
      e.stopPropagation()
      e.preventDefault()
    }
  }
  wrap.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  wrap.addEventListener('click', onClickCapture, true)

  const render = (): void => {
    const on = enabled
    const rail = checkRail()
    const scheme = activeScheme
    wrap.dataset.rail = rail ? '1' : '0'
    // ❄ 按钮 = 明暗切换（深色时显示 ☀/「浅色」，浅色时显示 🌙/「深色」——显示切换目标）
    btn.dataset.scheme = scheme
    btn.setAttribute('aria-label', scheme === 'dark' ? '切换到浅色主题' : '切换到深色主题')
    btn.title = scheme === 'dark' ? '切换到浅色主题' : '切换到深色主题'
    const icon = btn.querySelector('.odette-scheme-icon')
    if (icon) icon.textContent = scheme === 'dark' ? '☀' : '🌙'
    btn.querySelector('.odette-float-label')!.textContent = scheme === 'dark' ? '浅色' : '深色'
    // 小兽 = 皮肤开关（开=彩色发光、关=灰度呼吸）
    img.dataset.on = on ? '1' : '0'
    img.title = on ? 'Odette 皮肤：开（点击关闭）' : 'Odette 皮肤：关（点击开启）'
  }
  const onToggle = (): void => toggleColorScheme()
  const onImgErr = (): void => { img.style.display = 'none' }
  btn.addEventListener('click', onToggle)
  img.addEventListener('click', toggleSkin)
  img.addEventListener('error', onImgErr)
  const unsub = subscribe(render)
  railChanged(render)
  floatRender = render

  render()
  document.body.appendChild(wrap)
  return () => {
    unsub()
    floatRender = null
    posterImg = null
    btn.removeEventListener('click', onToggle)
    img.removeEventListener('click', toggleSkin)
    img.removeEventListener('error', onImgErr)
    wrap.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    wrap.removeEventListener('click', onClickCapture, true)
    wrap.remove()
  }
}

/* ============================ 奥黛塔海报层（hero 右下） ============================ */

/**
 * hero 海报贴纸：新会话页（hero）右下角旋转贴纸——固定视口、pointer-events none、
 * 仅 hero 态显示（[data-odette-workspace] 时隐藏）。
 * 纯展示零交互；随插件卸载移除。
 * （侧栏展开态海报位已于 2026-08-23 用户否决后移除：rail 锁窄看不到+占脚部区。）
 */
/* ============================ 侧栏测量（ResizeObserver 驱动） ============================ */

const SIDEBAR_COLUMN_SELECTOR = "[data-pane='sidebar'], [class*='sidebarCol']"

/**
 * 侧栏宽度 → --odette-sidebar-width（饰边容器 translate 用，只覆盖主区）。
 * 三级测量沿用 v0.2：①官方选择器契约 → ②几何探测（视口左缘窄高列，兜底预览版
 * 私有类名）→ ③0（hero 态确实无侧栏）。宽度写到 documentElement 上：
 * 观察器只监听 body 子树，html 的 style 变化不会回灌触发观察器。
 */
function findSidebarColumn(): any {
  let col: any = document.querySelector(SIDEBAR_COLUMN_SELECTOR)
  if (!col) {
    col = [...document.querySelectorAll('div')].find((el: any) => {
      const r = el.getBoundingClientRect()
      return r.left < 10 && r.width > 40 && r.width < 320 && r.height > 300
    })
  }
  return col ?? null
}

function applySidebarWidth(width: number): void {
  const px = Math.round(width * 100) / 100 + 'px'
  if (document.documentElement.style.getPropertyValue('--odette-sidebar-width') !== px) {
    document.documentElement.style.setProperty('--odette-sidebar-width', px)
  }
}

/* ============================ 插件入口 ============================ */

export function apply(ctx: ClientContext): void {
  themeRef = ctx.theme
  // 首帧读取当前主题（v0.2 默认 dark 等事件，浅色用户首屏会闪深色背景）
  try {
    activeScheme = ctx.theme.getTheme()?.active?.colorScheme ?? 'dark'
  } catch { activeScheme = 'dark' }
  // 首帧校准官方 dark 属性（防旧版客户端 presenter 缺位导致的属性残留）
  calibrateDarkAttribute(ctx.theme.getTheme())

  /* ---- 素材变量常驻注入（皮肤显隐由 body 作用域属性控制，变量本身不随开关增删） ---- */
  const previousBodyProps = new Map<string, string>()
  for (const prop of SKIN_BODY_PROPERTIES) {
    previousBodyProps.set(prop, document.body.style.getPropertyValue(prop))
  }
  const previousSidebarWidth = document.documentElement.style.getPropertyValue('--odette-sidebar-width')
  document.body.style.setProperty('--odette-trim-lace-art', 'url("' + ODETTE_TRIM_LACE + '")')
  document.body.style.setProperty('--odette-corner-tl-art', 'url("' + ODETTE_CORNER_TL + '")')
  document.body.style.setProperty('--odette-corner-tr-art', 'url("' + ODETTE_CORNER_TR + '")')
  document.body.style.setProperty('--odette-corner-bl-art', 'url("' + ODETTE_CORNER_BL + '")')
  document.body.style.setProperty('--odette-corner-br-art', 'url("' + ODETTE_CORNER_BR + '")')
  document.body.style.setProperty('--odette-bow-art', 'url("' + ODETTE_BOW + '")')
  document.body.style.setProperty('--odette-feather-art', 'url("' + ODETTE_FEATHER + '")')
  document.body.style.setProperty('--odette-stick-art', 'url("' + ODETTE_STICK + '")')
  document.body.style.setProperty('--odette-nesting-art', 'url("' + ODETTE_NESTING + '")')
  document.body.style.setProperty('--odette-trio-art', 'url("' + ODETTE_TRIO + '")')
  document.body.style.setProperty('--odette-swan-v5-art', 'url("' + ODETTE_SWAN_V5 + '")')
  document.body.style.setProperty('--odette-crest-white-art', 'url("' + ODETTE_CREST_WHITE + '")')
  document.body.style.setProperty('--odette-poster-art', 'url("' + ODETTE_POSTER + '")')
  /* 天鹅几何变量：bgSize 宽高 + 横杠上/中/下边缘距图底偏移（零手算幻数，脚本扫图生成）
     主基准 = --swan-bar-mid-from-bot-render（横杠中线），对齐9-slice框线中线y=0（视觉最自然）
     --swan-bar-top/bot 保留备用：调试上/下边缘重合或切换粗细对齐策略
     SWAN_SCALE=1.25：相对基准尺寸放大25%；5个值同比例缩放保证线性关系不变，横杠中线仍精准对齐y=0 */
  const SWAN_SCALE = 1.25
  document.body.style.setProperty('--swan-bg-size-w', (SWAN_META.swan_bg_size_w * SWAN_SCALE) + 'px')
  document.body.style.setProperty('--swan-bg-size-h', (SWAN_META.swan_bg_size_h * SWAN_SCALE) + 'px')
  document.body.style.setProperty('--swan-bar-top-from-bot-render', (SWAN_META.swan_bar_top_from_bot_render * SWAN_SCALE) + 'px')
  document.body.style.setProperty('--swan-bar-mid-from-bot-render', (SWAN_META.swan_bar_mid_from_bot_render * SWAN_SCALE) + 'px')
  document.body.style.setProperty('--swan-bar-bot-from-bot-render', (SWAN_META.swan_bar_bot_from_bot_render * SWAN_SCALE) + 'px')
  syncBackdrop(activeScheme)

  /* ---- 顶部饰边 DOM（常驻；landing/workspace 双层切换与显隐全在 CSS 作用域内） ---- */
  const topTrimEl = document.createElement('div')
  topTrimEl.className = 'odette-trim'
  topTrimEl.setAttribute('aria-hidden', 'true')
  const landing = document.createElement('div')
  landing.className = 'odette-trim-layer'
  landing.dataset.trim = 'landing'
  const workspace = document.createElement('div')
  workspace.className = 'odette-trim-layer'
  workspace.dataset.trim = 'workspace'
  topTrimEl.append(landing, workspace)
  document.body.appendChild(topTrimEl)

  /* ---- 主题切换 → 校准官方 dark 属性 + 重设背景素材变量 + 刷新明暗按钮 ---- */
  ctx.effect(() => ctx.on('theme/change', (snapshot) => {
    calibrateDarkAttribute(snapshot)
    activeScheme = snapshot.active?.colorScheme ?? (resolveDark(snapshot) ? 'dark' : 'light')
    syncBackdrop(activeScheme)
    if (floatRender) floatRender()
  }), 'odette-skin: theme listener')

  /* ---- 系统主题兜底：官方 ui-theme 仅在 preference==='system' 时响应系统切换，
          若其事件链路失效，我们自己跟随 matchMedia，保证属性/背景永远正确 ---- */
  const onSystemSchemeChange = (): void => {
    const snap = ctx.theme.getTheme()
    calibrateDarkAttribute(snap)
    const scheme = resolveDark(snap) ? 'dark' : 'light'
    if (scheme !== activeScheme) {
      activeScheme = scheme
      syncBackdrop(scheme)
    }
  }
  darkMedia && typeof darkMedia.addEventListener === 'function'
    ? darkMedia.addEventListener('change', onSystemSchemeChange)
    : null

  /* ---- header 滑出动画（"收上去"）：克隆缓存方案 ----
     背景：header 隐藏时 React 连 children 一起卸载（hideChrome 分支 children: !hideChrome && ...），
     display:none 瞬间 CSS 动画无从播放（滑入能纯 CSS 是因为 display:none→flex 会重播动画）。
     方案：header 可见期间持续缓存克隆体（fixed 覆盖原位置、visibility:hidden），
     检测到会话回空白态（body[data-odette-workspace] 移除）时用克隆体播放
     odette-header-slide-out（translateY(0)→-100% 520ms cubic-bezier(0.4,0,0.2,1)），
     animationend 后移除。克隆体保留类名 → enhance.css 的 header 规则照常命中，
     内联 animation 覆盖类规则的滑入动画（内联优先，无冲突）。 */
  let headerEl: any = null
  let headerGhostEl: any = null
  let headerGhostTimer: any = null
  let headerObserver: any = null

  const refreshHeaderGhost = (): void => {
    if (!headerEl) return
    // header 当前不可见（已加 headerHidden / children 已卸载）时不更新缓存
    if (headerEl.classList.contains('wSkVaW_headerHidden')) return
    try {
      const ghost = headerEl.cloneNode(true)
      ghost.classList.remove('wSkVaW_headerHidden')
      ghost.style.position = 'fixed'
      ghost.style.top = '0'
      ghost.style.left = 'var(--odette-sidebar-width, 0px)'
      ghost.style.right = '0'
      ghost.style.zIndex = '21'
      ghost.style.visibility = 'hidden'
      ghost.style.pointerEvents = 'none'
      ghost.style.margin = '0'
      if (headerGhostEl) headerGhostEl.remove()
      headerGhostEl = ghost
      document.body.appendChild(ghost)
    } catch { /* 克隆失败静默（滑出动画降级为无动画） */ }
  }

  const scheduleHeaderGhostRefresh = (): void => {
    if (headerGhostTimer !== null) return
    headerGhostTimer = setTimeout(() => {
      headerGhostTimer = null
      refreshHeaderGhost()
    }, 150)
  }

  const ensureHeaderObserved = (): void => {
    const h = document.querySelector('.wSkVaW_header')
    if (h === headerEl) return
    headerEl = h
    if (headerObserver) { headerObserver.disconnect(); headerObserver = null }
    if (!h) { headerGhostEl = null; return }
    headerObserver = new MutationObserver(scheduleHeaderGhostRefresh)
    headerObserver.observe(h, { childList: true, subtree: true, characterData: true, attributes: true })
    scheduleHeaderGhostRefresh()
  }

  const playHeaderSlideOut = (): void => {
    if (!headerGhostEl) return
    const ghost = headerGhostEl
    headerGhostEl = null
    ghost.style.visibility = 'visible'
    ghost.style.animation = 'odette-header-slide-out 0.52s cubic-bezier(0.4, 0, 0.2, 1) both'
    const drop = (): void => { if (ghost.isConnected) ghost.remove() }
    ghost.addEventListener('animationend', drop, { once: true })
    // 兜底：animationend 未触发（如被停用/暂停）时 1.2s 后强制移除
    setTimeout(drop, 1200)
  }

  /* ---- 底部统计行滑入/滑出动画（克隆体对称方案）----
     真实 footer = uV2eYG_root 卡片后子节点（conversation.composer.dock 槽位），
     外层 slot wrapper（display:contents）+ 内部真实盒子（FJxK0a_root/dsh-balance-wrap）。
     - 滑入（hero→workspace）：footer 插入后立即隐藏真实 footer（visibility:hidden），
       克隆体（fixed 内联定位 + 每 80ms 跟随布局更新 top）从 translateY(220%) **长路径**
       滑入——长位移 + fixed = 不受布局移动影响、无重影、无"短路径快速移动→停顿"卡感；
       动画结束移除克隆体、恢复真实 footer（已同位置，无缝衔接）。
     - 滑出（workspace→hero）：footer 卸载瞬间缓存克隆体（已对齐最终位置）播放
       odette-footer-exit 滑下后移除。
     - 克隆体定位必须用内部真实盒子 rect（外层 display:contents wrapper 的
       getBoundingClientRect 恒为 0——probe-footer6/7 实证，曾致滑出在视口顶播放）。 */
  let footerGhostEl: any = null
  let footerGhostTimer: any = null
  let footerWasPresent = false
  let footerSlideInGhost: any = null
  let footerFollowTimer: any = null
  let footerSlideInDoneTimer: any = null
  let footerOutFollowTimer: any = null
  let footerOutDoneTimer: any = null

  const collectFooterItems = (): any[] => {
    const root = document.querySelector('.uV2eYG_root')
    if (!root) return []
    const children = Array.from(root.children)
    const cardIdx = children.findIndex((el: any) => el.classList && el.classList.contains('uV2eYG_card'))
    if (cardIdx < 0) return []
    return children.slice(cardIdx + 1)
  }

  /* 真实 footer = data-slot wrapper（display:contents）+ 内部真实盒子（FJxK0a_root/dsh-balance-wrap）。
     transform 对 display:contents 元素无效（无盒子，computed 恒 none —— 探针 footer5/6 实证） */
  const footerAnimTargets = (): any[] => {
    const targets: any[] = []
    collectFooterItems().forEach((wrapper: any) => {
      if (wrapper.children && wrapper.children.length > 0) {
        targets.push(...Array.from(wrapper.children))
      } else {
        targets.push(wrapper) // 无子节点时退化
      }
    })
    return targets
  }

  /* 输入框所在列的定位来源：优先 InputBar 根（uV2eYG_root），composer 重建/hero 态退化到
     [data-composer-card]（同一纵轴：左侧与宽度完全一致）。右侧边栏展开/收起时该 rect 实时反映
     内容区宽度——统计行克隆体必须绑这一列，而不是绑缓存时刻的旧 rect。 */
  const measureComposerColumn = (): any => {
    const root = document.querySelector('.uV2eYG_root')
    const seat = root || document.querySelector('[data-composer-card]')
    if (!seat) return null
    const r = seat.getBoundingClientRect()
    return r.width ? r : null
  }

  const buildFooterGhost = (): any => {
    const items = collectFooterItems()
    if (items.length === 0) return null
    try {
      const ghost = document.createElement('div')
      ghost.className = 'odette-footer-ghost'
      // 水平绑定输入框列（left/width）；垂直不设 top——容器 CSS bottom:0 贴内容区底部，
      // footer 刚挂载瞬间布局仍处 hero↔active 中间态，此刻测 top 会取到视口中部的错误值
      const rCol = measureComposerColumn()
      const targets = footerAnimTargets()
      const anchor = targets[0] || items[0]
      const rFirst = anchor.getBoundingClientRect()
      if (rCol) {
        ghost.style.left = rCol.left + 'px'
        ghost.style.width = rCol.width + 'px'
      } else {
        ghost.style.left = rFirst.left + 'px'
        ghost.style.width = rFirst.width + 'px'
      }
      items.forEach((el: any) => {
        const copy = el.cloneNode(true)
        // 克隆体脱离原布局链后 --dsh-chat-content-width 失效会回退 none→全宽；
        // 显式 100% 绑定 ghost 限宽（=输入框列宽），防滑出时横向拉伸
        if (copy.style) copy.style.width = '100%'
        ghost.appendChild(copy)
      })
      return ghost
    } catch {
      return null
    }
  }

  const restoreFooterVisibility = (): void => {
    footerAnimTargets().forEach((el: any) => {
      if (el.style) el.style.visibility = ''
    })
  }

  const refreshFooterGhost = (): void => {
    if (footerSlideInGhost !== null) return // 滑入播放中不重建缓存克隆体
    const ghost = buildFooterGhost()
    if (!ghost) return
    if (footerGhostEl) footerGhostEl.remove()
    footerGhostEl = ghost
    document.body.appendChild(ghost)
  }

  const scheduleFooterGhostRefresh = (): void => {
    if (footerGhostTimer !== null) return
    footerGhostTimer = setTimeout(() => {
      footerGhostTimer = null
      refreshFooterGhost()
    }, 150)
  }

  const playFooterSlideIn = (): void => {
    if (footerSlideInGhost !== null) return
    if (collectFooterItems().length === 0) return
    try {
      const ghost = buildFooterGhost()
      if (!ghost) return
      footerSlideInGhost = ghost
      // 隐藏真实 footer：滑入期间由克隆体呈现（避免重影/布局移动叠加抖动）
      footerAnimTargets().forEach((el: any) => { el.style.visibility = 'hidden' })
      ghost.style.visibility = 'visible'
      ghost.style.animation = 'odette-footer-slide 0.6s cubic-bezier(0.4, 0, 0.2, 1) both'
      document.body.appendChild(ghost)
      // 跟随输入框列：水平位置/宽度实时贴列（右侧边栏展开收起）；垂直已贴底不跟随
      footerFollowTimer = setInterval(() => {
        const rc = measureComposerColumn()
        if (rc && ghost.isConnected) {
          ghost.style.left = rc.left + 'px'
          ghost.style.width = rc.width + 'px'
        }
      }, 80)
      const done = (): void => {
        if (footerFollowTimer !== null) { clearInterval(footerFollowTimer); footerFollowTimer = null }
        if (footerSlideInDoneTimer !== null) { clearTimeout(footerSlideInDoneTimer); footerSlideInDoneTimer = null }
        if (ghost.isConnected) ghost.remove()
        footerSlideInGhost = null
        restoreFooterVisibility()
        // 布局已稳定 → 重建缓存克隆体（滑出用，位置=最终）
        refreshFooterGhost()
      }
      ghost.addEventListener('animationend', done, { once: true })
      footerSlideInDoneTimer = setTimeout(done, 1000) // 兜底
    } catch {
      footerSlideInGhost = null
      restoreFooterVisibility()
    }
  }

  const playFooterSlideOut = (): void => {
    // 若滑入克隆体仍在（快速切换），先清理并恢复真实 footer 可见
    if (footerSlideInGhost !== null) {
      if (footerFollowTimer !== null) { clearInterval(footerFollowTimer); footerFollowTimer = null }
      if (footerSlideInDoneTimer !== null) { clearTimeout(footerSlideInDoneTimer); footerSlideInDoneTimer = null }
      if (footerSlideInGhost.isConnected) footerSlideInGhost.remove()
      footerSlideInGhost = null
      restoreFooterVisibility()
    }
    if (!footerGhostEl) return
    const ghost = footerGhostEl
    footerGhostEl = null
    // 播放前：克隆体重定位到当前输入框列——缓存 rect 在右侧边栏展开/收起后已过期，
    // 不刷新会导致统计行从"旧宽度/旧横轴"位置沉入
    const rCol = measureComposerColumn()
    if (rCol) {
      ghost.style.left = rCol.left + 'px'
      ghost.style.width = rCol.width + 'px'
    }
    ghost.style.visibility = 'visible'
    ghost.style.animation = 'odette-footer-exit 0.6s cubic-bezier(0.4, 0, 0.2, 1) both'
    // 播放期间持续跟随输入框列（0.6s 内布局仍可能变化：面板收起、窗口重排）
    footerOutFollowTimer = setInterval(() => {
      const rc = measureComposerColumn()
      if (rc && ghost.isConnected) {
        ghost.style.left = rc.left + 'px'
        ghost.style.width = rc.width + 'px'
      }
    }, 80)
    const drop = (): void => {
      if (footerOutFollowTimer !== null) { clearInterval(footerOutFollowTimer); footerOutFollowTimer = null }
      if (footerOutDoneTimer !== null) { clearTimeout(footerOutDoneTimer); footerOutDoneTimer = null }
      if (ghost.isConnected) ghost.remove()
    }
    ghost.addEventListener('animationend', drop, { once: true })
    footerOutDoneTimer = setTimeout(drop, 1200) // 兜底
  }

  const syncFooterGhost = (): void => {
    const items = collectFooterItems()
    const present = items.length > 0
    if (present) {
      if (!footerWasPresent) {
        // 出现 → 克隆体长路径滑入（真实 footer 隐藏由 playFooterSlideIn 处理）
        playFooterSlideIn()
      } else if (footerSlideInGhost === null) {
        // 常驻 + 非滑入期：150ms 节流刷新缓存克隆体（滑出素材）
        scheduleFooterGhostRefresh()
      }
    } else if (footerWasPresent) {
      playFooterSlideOut()
    }
    footerWasPresent = present
  }

  /* ---- 状态投影：会话激活 → body[data-odette-workspace]（驱动饰边双层切换） ---- */
  const syncProjectedState = (): void => {
    try {
      const active = document.querySelector("[data-phase='active']")
      const wasActive = document.body.hasAttribute('data-odette-workspace')
      if (active) document.body.setAttribute('data-odette-workspace', '')
      else {
        document.body.removeAttribute('data-odette-workspace')
        // 会话 → 空白（开新对话/清空）：header 收上去，让顶部饰边划出来
        if (wasActive) playHeaderSlideOut()
      }
    } catch { /* 忽略探测失败 */ }
  }

  /* ---- composer 相位切换动画（改编自 maid：hero↔active 一次性滑动，掩盖布局跳变） ----
     逻辑参考 maid-atelier index.ts L605-619 的做法：phase 变化时 body 打
     data-odette-composer-motion 标记（dock=进会话 / rise=回 hero），560ms 后摘除；
     CSS（enhance.css）以 520ms 一次性动画把卡片从上方滑落/下方升起。 */
  let phaseBefore: string | undefined
  let motionCleanupId: any = null
  const armComposerMotion = (kind: string): void => {
    document.body.setAttribute('data-odette-composer-motion', kind)
    if (motionCleanupId !== null) clearTimeout(motionCleanupId)
    motionCleanupId = setTimeout(() => {
      document.body.removeAttribute('data-odette-composer-motion')
      motionCleanupId = null
    }, 560)
  }
  const syncComposerMotion = (): void => {
    try {
      const phaseRoot = document.querySelector("[data-phase='hero'], [data-phase='active']")
      const next = phaseRoot && phaseRoot.getAttribute('data-phase')
      if ((next !== 'hero' && next !== 'active') || phaseBefore === undefined || phaseBefore === next) return
      armComposerMotion(next === 'active' ? 'dock' : 'rise')
      phaseBefore = next
    } catch { /* 忽略探测失败 */ }
  }

  /* ---- rail 态变化分发（替代 800ms 轮询）：仅在状态真变化时通知订阅者 ---- */
  const railSubscribers = new Set<() => void>()
  let lastRail = checkRail()
  const syncRail = (): void => {
    const r = checkRail()
    if (r === lastRail) return
    lastRail = r
    railSubscribers.forEach((fn) => fn())
  }
  const railChanged = (fn: () => void): void => { railSubscribers.add(fn) }

  /* ---- 侧栏宽度观察（替代 1200ms 轮询）：ResizeObserver 跟随元素尺寸，
         MutationObserver 负责侧栏节点的出现/消失（重新挂观察对象） ---- */
  let watchedColumn: any = null
  let columnWatcher: any = null
  if (typeof ResizeObserver !== 'undefined') {
    columnWatcher = new ResizeObserver((entries: any[]) => {
      const entry = entries[entries.length - 1]
      if (entry) applySidebarWidth(entry.contentRect.width)
    })
  }
  const ensureSidebarObserved = (): void => {
    const col = findSidebarColumn()
    if (!columnWatcher) {
      // 无 ResizeObserver（极端环境）：结构变化时直接量一次
      applySidebarWidth(col ? col.getBoundingClientRect().width : 0)
      return
    }
    if (col === watchedColumn) return
    if (watchedColumn) columnWatcher.unobserve(watchedColumn)
    watchedColumn = col
    if (col) {
      columnWatcher.observe(col)
      applySidebarWidth(col.getBoundingClientRect().width)
    } else {
      applySidebarWidth(0)
    }
  }

  /* ---- 输入框装饰：v3 方案用 CSS ::before/::after（9-slice 大框 + 天鹅顶饰），
         不再注入 DOM 节点（零残留，composer 重建也不漂移）。素材需控制在 500KB 以内
         （Chromium 对 style.setProperty 自定义属性单值约 0.5MB 静默拒绝阈值）---- */

  /* ---- Hero 标题 logo 替换：DSH 原生 hero 标题（鲸鱼图标+「探索未至之境」+「预览版」）
         换成 Odette 横幅 logo（深色=logo2 冰晶白主体 / 浅色=logo 蓝调主体，--odette-hero-logo-art 变量）。
         JS 定位（标题文本特征兜底，不依赖 CSS modules 哈希类名）：找到标题 span → 父级
         headline → 挂 .odette-hero-logo（enhance.css：隐藏子元素 + 背景 contain logo）---- */
  let heroLogoEl: any = null
  const ensureHeroLogo = (): void => {
    if (heroLogoEl && heroLogoEl.isConnected) return
    try {
      const span = Array.prototype.slice.call(document.querySelectorAll('span')).find((el: any) => {
        const txt = (el.textContent || '').trim()
        const cls = (el.className || '').toString()
        return (txt === '探索未至之境' || txt === '探索未知之境' || /^探索.{0,2}至?之境$/.test(txt)) && cls.includes('headlineText')
      })
      if (!span) return
      const headline = span.parentElement
      if (!headline) return
      headline.classList.add('odette-hero-logo')
      heroLogoEl = headline
    } catch { /* 探测失败静默 */ }
  }

  /* ---- 四件套装饰（卡片级注入：羽毛左/应援棒右/套娃头饰底；absolute+transform 自由微调） ---- */
  const ORNAMENT_CLASSES = ['odette-feather-deco', 'odette-stick-deco', 'odette-combo-deco']
  let ornamentEls: HTMLElement[] = []
  const ensureOrnaments = (): void => {
    const card = document.querySelector('[data-composer-card]') as HTMLElement | null
    if (!card) return
    const live = ornamentEls.filter((el) => el.isConnected)
    for (const cls of ORNAMENT_CLASSES) {
      if (!live.some((el) => el.classList.contains(cls))) {
        const el = document.createElement('div')
        el.className = cls
        el.setAttribute('aria-hidden', 'true')
        card.appendChild(el)
        live.push(el)
      }
    }
    ornamentEls = live
  }

  const observer = new MutationObserver(() => {
    syncProjectedState()
    syncComposerMotion()
    syncRail()
    ensureSidebarObserved()
    ensureHeaderObserved()
    syncFooterGhost()
    ensureHeroLogo()
    ensureOrnaments()
  })
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-phase', 'data-chat-flow', 'data-dsh-sidebar-collapsed', 'data-sidebar-collapsed', 'data-pane', 'class'],
    childList: true,
    subtree: true,
  })
  const onWinResize = (): void => ensureSidebarObserved()
  window.addEventListener('resize', onWinResize)
  syncProjectedState()
  syncComposerMotion()
  ensureSidebarObserved()
  ensureHeaderObserved()
  syncFooterGhost()
  ensureHeroLogo()
  ensureOrnaments()

  /* ---- 首帧：按持久化状态应用皮肤 ---- */
  syncSkin()

  /* ---- 小兽开关浮层（无条件渲染：任何布局下都是开关+点缀入口） ---- */
  const disposeFloat = createFloatLayer(railChanged)

  /* ---- 开关按钮 → 侧栏脚部（Settings 按钮旁；hero 态无 footer 行时不渲染，入口由左下角浮层承担） ---- */
  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register(
      { name: 'sidebar.footer.action', id: 'odette-skin-toggle', order: 230, label: 'Odette 皮肤' },
      SkinToggle,
    ),
  ), 'odette-skin: toggle slot')

  /* ---- 插件卸载 → 精确还原全部皮肤写入（样式标签由 loader 按 data-plugin 清理） ---- */
  ctx.effect(() => () => {
    if (tokenDispose) { tokenDispose(); tokenDispose = null }
    if (darkMedia && typeof darkMedia.removeEventListener === 'function') darkMedia.removeEventListener('change', onSystemSchemeChange)
    if (motionCleanupId !== null) { clearTimeout(motionCleanupId); motionCleanupId = null }
    observer.disconnect()
    if (headerObserver) { headerObserver.disconnect(); headerObserver = null }
    if (headerGhostTimer !== null) { clearTimeout(headerGhostTimer); headerGhostTimer = null }
    if (headerGhostEl) { headerGhostEl.remove(); headerGhostEl = null }
    if (footerGhostTimer !== null) { clearTimeout(footerGhostTimer); footerGhostTimer = null }
    if (footerFollowTimer !== null) { clearInterval(footerFollowTimer); footerFollowTimer = null }
    if (footerSlideInDoneTimer !== null) { clearTimeout(footerSlideInDoneTimer); footerSlideInDoneTimer = null }
    if (footerOutFollowTimer !== null) { clearInterval(footerOutFollowTimer); footerOutFollowTimer = null }
    if (footerOutDoneTimer !== null) { clearTimeout(footerOutDoneTimer); footerOutDoneTimer = null }
    if (footerSlideInGhost !== null) { if (footerSlideInGhost.isConnected) footerSlideInGhost.remove(); footerSlideInGhost = null }
    restoreFooterVisibility()
    if (footerGhostEl) { footerGhostEl.remove(); footerGhostEl = null }
    if (heroLogoEl && heroLogoEl.isConnected) {
      heroLogoEl.classList.remove('odette-hero-logo')
      heroLogoEl = null
    }
    if (ornamentEls.length > 0) { ornamentEls.forEach((el) => el.remove()); ornamentEls = [] }
    window.removeEventListener('resize', onWinResize)
    if (columnWatcher) columnWatcher.disconnect()
    disposeFloat()
    topTrimEl.remove()
    document.body.removeAttribute(SKIN_ATTR)
    document.body.removeAttribute('data-odette-workspace')
    document.body.removeAttribute('data-odette-composer-motion')
    for (const [prop, value] of previousBodyProps) {
      if (value === '') document.body.style.removeProperty(prop)
      else document.body.style.setProperty(prop, value)
    }
    if (previousSidebarWidth === '') document.documentElement.style.removeProperty('--odette-sidebar-width')
    else document.documentElement.style.setProperty('--odette-sidebar-width', previousSidebarWidth)
  }, 'odette-skin: cleanup')
}
