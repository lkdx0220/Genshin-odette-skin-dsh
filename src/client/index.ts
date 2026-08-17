/**
 * @dsh-external/dsh-odette-skin — Odette 冰雪梦幻主题（Client 侧）v0.2
 *
 * v0.2 变更：
 *  - 皮肤开关按钮（sidebar.footer.action 槽）：一键开关皮肤，状态持久化到 localStorage
 *  - 侧栏点缀（shell.overlay 槽）：Q 版小兽 deco-sidebar.jpg，随开关显隐
 *  - 皮肤核心 = token 覆盖层 + 背景图 + 增强 CSS，三者由开关统一驱动
 *
 * 机制说明：
 *  - ctx.theme.overrideTokens 叠加 13 个官方 alias token（半透明值 → 背景图透出毛玻璃感）
 *  - 开关关闭 = 调用 token 层 disposer + 移除背景图/增强 CSS；开启 = 重新叠加
 *  - 本文件只被 tsdown 编译（tsc 的 include 已排除 client），React 经 ModuleLoader require 获取
 */
declare const document: any
declare const location: any

// eslint-disable-next-line no-undef
const react = require('react')
const useState = react.useState
const useEffect = react.useEffect

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

const SOURCE = '@dsh-external/dsh-odette-skin'
const ASSET_BASE = location.origin + '/odette-skin'
/** 图片资源版本号：每次更换/处理图片时递增，绕过客户端/浏览器 HTTP 缓存（v0.1 时代 max-age=86400 的缓存坑） */
const IMG_REV = '?v=4'
const SKIN_KEY = 'dsh-odette-skin:enabled'

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
let enhanceStyleEl: any = null
let bgStyleEl: any = null
let activeScheme: 'light' | 'dark' = 'dark'
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

function isEnabled(): boolean {
  return enabled
}

function toggleSkin(): void {
  setEnabled(!enabled)
}

function setEnabled(v: boolean): void {
  if (enabled === v) return
  enabled = v
  try { localStorage.setItem(SKIN_KEY, v ? 'on' : 'off') } catch { /* 忽略持久化失败 */ }
  syncSkin()
  emit()
}

/** 按开关状态应用/移除皮肤（token 层 + 增强 CSS + 背景图） */
function syncSkin(): void {
  if (enabled) {
    if (!tokenDispose) tokenDispose = themeRef.overrideTokens(SOURCE, TOKENS)
    if (!enhanceStyleEl) enhanceStyleEl = injectStyle('odette-skin:enhance', ENHANCE_CSS)
    applyBackground(activeScheme)
  } else {
    if (tokenDispose) { tokenDispose(); tokenDispose = null }
    if (enhanceStyleEl) { enhanceStyleEl.remove(); enhanceStyleEl = null }
    clearBackground()
  }
}

function applyBackground(scheme: 'light' | 'dark'): void {
  const img = scheme === 'light' ? 'bg-light.jpg' : 'bg-dark.jpg'
  // 增强已烘焙进图片文件本身（饱和+对比），无需 CSS filter——README 预览与皮肤显示完全一致，不再有色差
  const css = 'body::before{content:"";position:fixed;inset:0;z-index:-1;'
    + 'background:url("' + ASSET_BASE + '/' + img + IMG_REV + '") center/cover no-repeat;}'
  if (bgStyleEl) bgStyleEl.remove()
  bgStyleEl = injectStyle('odette-skin:bg', css)
}

function clearBackground(): void {
  if (bgStyleEl) { bgStyleEl.remove(); bgStyleEl = null }
}

function injectStyle(tag: string, css: string): any {
  const el = document.createElement('style')
  el.dataset.plugin = tag
  el.textContent = css
  document.head.appendChild(el)
  return el
}

/* ============================ 样式 ============================ */

/** 增强样式：随皮肤开关注入/移除 */
const ENHANCE_CSS = `
/* Odette skin — 滚动条 */
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-thumb { background: rgba(155, 170, 255, 0.35); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
*::-webkit-scrollbar-thumb:hover { background: rgba(155, 170, 255, 0.55); background-clip: padding-box; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-corner { background: transparent; }
/* Odette skin — 文字选中 */
::selection { background: rgba(125, 150, 255, 0.35); }
`

/** 控件样式：开关按钮 + 侧栏点缀（常驻，皮肤关闭时按钮也要可见可点） */
const CHROME_CSS = `
/* Odette skin — 皮肤开关按钮（sidebar.footer.action） */
.odette-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; border: none; cursor: pointer;
  color: var(--dsw-alias-label-secondary);
  padding: 4px 8px; border-radius: 8px;
  font-size: 13px; line-height: 1.4; white-space: nowrap;
  flex: none;
  transition: color .15s ease, transform .12s ease;
}
.odette-toggle:hover { color: var(--dsw-alias-brand-primary); }
.odette-toggle:active { transform: scale(0.93); }
.odette-toggle[data-on="1"] { color: var(--dsw-alias-brand-primary); }
.odette-toggle .odette-snow {
  font-size: 15px; line-height: 1;
  opacity: .45; filter: grayscale(.6);
  transition: opacity .15s ease, filter .15s ease, text-shadow .15s ease;
}
.odette-toggle[data-on="1"] .odette-snow {
  opacity: 1; filter: none;
  text-shadow: 0 0 8px rgba(157, 184, 255, 0.9);
}
.odette-toggle .odette-toggle-label { font-weight: 500; }

/* Odette skin — 侧栏点缀（仅宽态：32px 流内贴纸推到行尾，贴纸=开关入口；窄栏态小兽在浮层，见下） */
.odette-deco {
  display: block;
  object-fit: cover;
}
.odette-deco-wide {
  width: 32px; height: 32px;
  border-radius: 9px;
  margin-left: auto;
  opacity: .96;
  pointer-events: auto;
  cursor: pointer;
  flex: none;
  box-shadow: 0 3px 10px rgba(12, 18, 64, 0.28);
  transition: filter .15s ease, opacity .15s ease, transform .12s ease;
}
.odette-deco-wide:hover { transform: scale(1.1); }
.odette-deco-wide[data-on="0"] { filter: grayscale(.72); opacity: .7; }

/* Odette skin — 浮层开关组合（shell.overlay：❄ 按钮 + 小兽） */
.odette-float {
  position: absolute; left: 6px; bottom: 96px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  z-index: 21; pointer-events: none;
}
.odette-float > * { pointer-events: auto; }
/* 窄栏（rail）：水平居中（56px 侧栏下 36px 小兽 → left:10px）+ 上移贴近临时会话图标；
   双路检测（JS data-rail + CSS 属性选择器兜底） */
.odette-float[data-rail="1"],
[data-sidebar-collapsed] .odette-float { bottom: 125px; left: 10px; }
.odette-float[data-rail="1"] .odette-float-btn,
[data-sidebar-collapsed] .odette-float-btn { display: none; }
.odette-float-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 999px;
  font-size: 12px; line-height: 1.5; white-space: nowrap;
  background: var(--dsw-alias-bg-layer-2, rgba(30, 36, 74, 0.75));
  border: 1px solid var(--dsw-alias-border-l1, rgba(150, 165, 255, 0.25));
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(12, 18, 64, 0.3);
  transition: color .15s ease, transform .12s ease, box-shadow .15s ease;
}
.odette-float-btn:hover { color: var(--dsw-alias-brand-primary); transform: scale(1.06); }
.odette-float-btn[data-on="1"] {
  color: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 10px rgba(157, 184, 255, 0.65), 0 3px 10px rgba(12, 18, 64, 0.3);
}
.odette-float-btn[data-on="1"] .odette-snow {
  opacity: 1; filter: none; text-shadow: 0 0 8px rgba(157, 184, 255, 0.9);
}
.odette-float-btn[data-on="0"] { opacity: .85; }

/* Odette skin — 浮层小兽（开关入口；开=彩色发光、关=灰度呼吸） */
.odette-overlay-deco {
  display: block;
  width: 36px; height: 36px;
  border-radius: 10px;
  object-fit: cover;
  cursor: pointer;
  box-shadow: 0 3px 12px rgba(12, 18, 64, 0.35);
  transition: filter .15s ease, opacity .15s ease, transform .12s ease, box-shadow .15s ease;
}
.odette-overlay-deco:hover { transform: scale(1.1); }
.odette-overlay-deco[data-on="0"] { filter: grayscale(.72); animation: odette-breathe 2.4s ease-in-out infinite; }
.odette-overlay-deco[data-on="1"] { box-shadow: 0 0 12px rgba(157, 184, 255, 0.8), 0 3px 12px rgba(12, 18, 64, 0.35); }
@keyframes odette-breathe {
  0%, 100% { opacity: .5; }
  50% { opacity: .95; }
}
`

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

/**
 * 侧栏 Q 版点缀（仅宽态显示）：32×32 圆角贴纸，margin-left:auto 推到 footer 行尾
 * 贴纸本身 = 皮肤开关入口（开=彩色，关=灰度），任何状态下都可点击切换，不死锁
 * 窄栏态不占 footer 行（36px 行宽放不下第二图标，会挤裁临时会话按钮）
 */
function SidebarDeco(props: any): any {
  useSkin()
  const wide = !!(props && props.wide)
  if (!wide) return null
  const on = enabled
  return h('img', {
    className: 'odette-deco odette-deco-wide',
    'data-on': on ? '1' : '0',
    src: ASSET_BASE + '/deco-sidebar.jpg' + IMG_REV,
    alt: '',
    draggable: false,
    title: on ? 'Odette 皮肤：开（点击关闭）' : 'Odette 皮肤：关（点击开启）',
    onClick: toggleSkin,
    onError: (e: any) => { e.currentTarget.style.display = 'none' },
  })
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
 * 浮层开关组合（shell.overlay）：❄ 按钮 + 小兽，无条件渲染在 frame 左下角。
 * 宽态：bottom:96px 贴 footer 上方；窄栏（rail）：整体上移（bottom:150px）避开临时会话图标，
 * 且 ❄ 胶囊按钮隐藏（窄栏空间只容小兽一个入口）。
 * rail 检测双路：JS 轮询 [data-sidebar-collapsed] 属性 + CSS 选择器兜底。
 */
function ShellDeco(): any {
  useSkin()
  const pair = useState(checkRail())
  const rail = pair[0]
  const setRail = pair[1]
  useEffect(() => {
    const timer = setInterval(() => {
      const r = checkRail()
      setRail((prev: boolean) => (prev === r ? prev : r))
    }, 800)
    return () => clearInterval(timer)
  }, [])
  const on = enabled
  return h('div', { className: 'odette-float', 'data-rail': rail ? '1' : '0' },
    rail ? null : h('button', {
      type: 'button',
      className: 'odette-float-btn',
      'data-on': on ? '1' : '0',
      'aria-pressed': on,
      title: on ? 'Odette 皮肤：开（点击关闭）' : 'Odette 皮肤：关（点击开启）',
      onClick: toggleSkin,
    }, snowGlyph(), h('span', null, on ? '开' : '关')),
    h('img', {
      className: 'odette-overlay-deco',
      'data-on': on ? '1' : '0',
      src: ASSET_BASE + '/deco-sidebar.jpg' + IMG_REV,
      alt: '',
      draggable: false,
      title: on ? 'Odette 皮肤：开（点击关闭）' : 'Odette 皮肤：关（点击开启）',
      onClick: toggleSkin,
      onError: (e: any) => { e.currentTarget.style.display = 'none' },
    }),
  )
}

/* ============================ 插件入口 ============================ */

export function apply(ctx: ClientContext): void {
  themeRef = ctx.theme

  // 主题切换 → 重设背景图（皮肤开启时生效）
  ctx.effect(() => ctx.on('theme/change', (snapshot) => {
    activeScheme = snapshot.active?.colorScheme ?? 'dark'
    if (enabled) applyBackground(activeScheme)
  }), 'odette-skin: theme listener')

  // 插件卸载 → 清掉全部皮肤资源
  ctx.effect(() => () => {
    if (tokenDispose) { tokenDispose(); tokenDispose = null }
    if (enhanceStyleEl) { enhanceStyleEl.remove(); enhanceStyleEl = null }
    if (bgStyleEl) { bgStyleEl.remove(); bgStyleEl = null }
  }, 'odette-skin: cleanup')

  // 控件样式常驻注入
  const chromeStyle = injectStyle('odette-skin:chrome', CHROME_CSS)
  ctx.effect(() => () => chromeStyle.remove(), 'odette-skin: chrome style')

  // 首帧：按持久化状态应用皮肤
  syncSkin()

  // 开关按钮 → 侧栏脚部（Settings 按钮旁）
  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register(
      { name: 'sidebar.footer.action', id: 'odette-skin-toggle', order: 230, label: 'Odette 皮肤' },
      SkinToggle,
    ),
  ), 'odette-skin: toggle slot')

  // 小兽开关 → frame 浮层（无条件渲染，任何侧栏状态下都是开关+点缀入口；footer 贴纸已退役避免 flex 挤压）
  ctx.effect(() => ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      { name: 'shell.overlay', id: 'odette-skin-shell-deco', order: 100 },
      ShellDeco,
    ),
  ), 'odette-skin: shell deco slot')
}
