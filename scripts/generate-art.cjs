#!/usr/bin/env node
/**
 * 素材内嵌生成脚本（机制对齐 maid-atelier 的 *-art.generated.ts）：
 * 把 assets/ 下皮肤实际用到的图片转成 base64 data URI，写入
 * src/client/art.generated.ts，随 tsdown 打包进 lib/client.js。
 * 皮肤激活不再依赖 host 静态资源路由、远程 URL 或浏览器缓存策略。
 *
 * 用法：node scripts/generate-art.cjs（npm run build 会先自动执行）
 * 更换素材：替换 assets/ 对应文件后重跑本脚本即可。
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const assetsDir = path.join(root, 'assets')
const outFile = path.join(root, 'src', 'client', 'art.generated.ts')

/** 皮肤实际用到的素材（代码未引用的素材不内嵌，避免 bundle 膨胀） */
const ASSETS = [
  { file: 'bg-dark.jpg', name: 'ODETTE_BG_DARK', mime: 'image/jpeg', desc: '深色主题对话背景' },
  { file: 'bg-light.jpg', name: 'ODETTE_BG_LIGHT', mime: 'image/jpeg', desc: '浅色主题对话背景' },
  { file: 'hero-dark.jpg', name: 'ODETTE_HERO_DARK', mime: 'image/jpeg', desc: '深色 hero（新会话页）背景：奥黛塔沙发场景' },
  { file: 'hero-light.jpg', name: 'ODETTE_HERO_LIGHT', mime: 'image/jpeg', desc: '浅色 hero 背景：奥黛塔沙发展浅调版（提亮降饱和+白纱）' },
  { file: 'banner-top.png', name: 'ODETTE_TRIM_LACE', mime: 'image/png', desc: '顶部饰边花边带（占位素材，待替换为正式图）' },
  { file: 'frame-corner-tl.png', name: 'ODETTE_CORNER_TL', mime: 'image/png', desc: '输入框左上角饰（外挂骑角，已弃用但保留兼容）' },
  { file: 'frame-corner-tr.png', name: 'ODETTE_CORNER_TR', mime: 'image/png', desc: '输入框右上角饰（外挂骑角，已弃用但保留兼容）' },
  { file: 'frame-corner-bl.png', name: 'ODETTE_CORNER_BL', mime: 'image/png', desc: '输入框左下角饰（外挂骑角，已弃用但保留兼容）' },
  { file: 'frame-corner-br.png', name: 'ODETTE_CORNER_BR', mime: 'image/png', desc: '输入框右下角饰（外挂骑角，已弃用但保留兼容）' },
  { file: 'bow.png', name: 'ODETTE_BOW', mime: 'image/png', desc: '输入框顶部中央蝴蝶结垂饰（旧方案占位）' },
  { file: 'deco-sidebar.jpg', name: 'ODETTE_DECO', mime: 'image/jpeg', desc: 'Q 版小兽点缀（浮层开关入口）' },
  { file: 'odette-crest.webp', name: 'ODETTE_CREST', mime: 'image/webp', desc: '奥黛塔背饰1（金翼+粉心徽章，白底抠图透明）：备用素材（2026-08-23 素材化实验后未启用）' },
  { file: 'v8-frame-border-only.png', name: 'ODETTE_FRAME_BORDER_V8', mime: 'image/png', desc: 'v8 大框 9-slice 边框素材（四角宝石+左右边+底部垂饰整体画入）；2026-08-23 素材化实验后恢复为正式版' },
  { file: 'v8-swan-v4-slotted.png', name: 'ODETTE_SWAN_V4', mime: 'image/png', desc: 'v4 小天鹅（插槽式接缝消除版，已弃用但保留兼容）' },
  { file: 'v8-swan-v5-slotted.png', name: 'ODETTE_SWAN_V5', mime: 'image/png', desc: 'v5 小天鹅/顶饰（重绘版，透明背景）；2026-08-23 素材化实验后恢复为正式版' },
  { file: 'odette-feather.webp', name: 'ODETTE_FEATHER', mime: 'image/webp', desc: '奥黛塔羽毛（白羽+金钩+粉心，透明底）：备用素材（2026-08-23 素材化实验后未启用）' },
  { file: 'odette-feather-flip.webp', name: 'ODETTE_FEATHER_FLIP', mime: 'image/webp', desc: '奥黛塔羽毛水平镜像版：备用素材（2026-08-23 素材化实验后未启用）' },
  { file: 'odette-crest-white.webp', name: 'ODETTE_CREST_WHITE', mime: 'image/webp', desc: '输入框顶饰-白色.png（天鹅金翼徽章+粉心+白羽展开，用户提供的透明底成品）：composer 顶饰正式版（2026-08-23 用户指定替换天鹅）' },
  { file: 'logo-dark.webp', name: 'ODETTE_LOGO_DARK', mime: 'image/webp', desc: 'hero 标题横条 logo（深色模式）：冰晶白鲸鱼+白字（logo2.png 压缩版，徽章白字独立配色）' },
  { file: 'logo3.webp', name: 'ODETTE_LOGO_LIGHT', mime: 'image/webp', desc: 'hero 标题横条 logo（浅色模式）：用户重绘 logo3（蓝渐变图标+冰蓝文字+深蓝底白字「预览版」徽章，无冰晶脏纹理）' },
  { file: 'odette-poster.webp', name: 'ODETTE_POSTER', mime: 'image/webp', desc: '奥黛塔海报（完整画作）：hero 新会话页右下角 + 浮层皮肤开关贴纸（浅色模式用）' },
  { file: 'odette-poster-dark.webp', name: 'ODETTE_POSTER_DARK', mime: 'image/webp', desc: '黑雪鹄海报（深蓝天鹅主题完整画作）：浮层皮肤开关贴纸深色模式用（2026-08-23 用户提供）' },
  { file: 'odette-stick.webp', name: 'ODETTE_STICK', mime: 'image/webp', desc: '奥黛塔应援棒（透明底）：composer 右上角挂饰（2026-08-23 用户指定）' },
  { file: 'odette-headdress.webp', name: 'ODETTE_HEADDRESS', mime: 'image/webp', desc: '奥黛塔头饰（rotate -24° 斜靠版）：套娃组合件（2026-08-23 用户指定）' },
  { file: 'odette-nesting.webp', name: 'ODETTE_NESTING', mime: 'image/webp', desc: '奥黛塔套娃（透明底 480×643）：composer 底部"放地上"套娃（2026-08-25 用户：撤羽饰，套娃底部贴输入框）' },
  { file: 'odette-nesting-combo.webp', name: 'ODETTE_NESTING_COMBO', mime: 'image/webp', desc: '套娃+头饰斜靠组合（合成贴图）：备用（2026-08-25 用户撤羽饰后未启用）' },
  { file: 'odette-trio.webp', name: 'ODETTE_TRIO', mime: 'image/webp', desc: '套娃+左右应援棒整体组合（用户无标题.png 白底抠图透明 700×485）：composer 底部"套娃双手拿应援棒"整体素材（2026-08-25 用户参考图排版，不再逐件调角度）' },
]

const lines = [
  '/**',
  ' * 由 scripts/generate-art.cjs 生成 —— 请勿手改。',
  ' * 素材以 base64 data URI 内嵌于 client bundle，激活不依赖任何临时文件/资源服务器。',
  ' */',
]

for (const item of ASSETS) {
  const file = path.join(assetsDir, item.file)
  if (!fs.existsSync(file)) {
    console.error('generate-art: 缺少素材 ' + file)
    process.exit(1)
  }
  const buf = fs.readFileSync(file)
  lines.push('')
  lines.push('/** ' + item.desc + '（' + item.file + '，' + buf.length + ' 字节） */')
  lines.push('export const ' + item.name + " = 'data:" + item.mime + ';base64,' + buf.toString('base64') + "'")
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8')
console.log('generate-art: 已写入 ' + outFile + '（' + ASSETS.length + ' 个素材）')
