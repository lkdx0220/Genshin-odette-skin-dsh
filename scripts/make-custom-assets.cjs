#!/usr/bin/env node
/**
 * 定制素材管线：把工作区根目录的四张「奥黛塔」素材加工成皮肤可用的 assets。
 * 1. 海报 -> odette-poster.webp（340×481，hero 右下 + 侧栏展开态底部）
 * 2. 套娃 -> odette-nesting.webp（480×643，浮层小兽替换）
 * 3. 天鹅剪影 -> swan-icon.png（海报裁剪+亮度阈值化白剪影，作 mask 单色图标）
 * 4. 羽毛金心 -> feather-badge.png（金色饰件区域裁剪，彩色徽章图标）
 */
const fs = require('fs')
const path = require('path')
const sharp = require('C:/Users/24701/.dsh/profiles/node_modules/sharp')

const root = path.resolve(__dirname, '..')
const assets = path.join(root, 'assets')

async function main() {
  // 1. poster
  await sharp(path.join(assets, 'Odette-海报.png'))
    .resize(340, 481, { fit: 'fill' })
    .webp({ quality: 88 })
    .toFile(path.join(assets, 'odette-poster.webp'))
  console.log('poster ok')

  // 2. nesting (transparent)
  await sharp(path.join(assets, 'Odette-套娃.png'))
    .resize(480, 643, { fit: 'fill' })
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(path.join(assets, 'odette-nesting.webp'))
  console.log('nesting ok')

  // 3. swan silhouette: poster extract(235,295,317,325) -> grayscale -> threshold white w/ alpha
  const { data, info } = await sharp(path.join(assets, 'Odette-海报.png'))
    .extract({ left: 235, top: 295, width: 317, height: 325 })
    .resize(128, 132, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(data.length * 4 / info.channels * 4)
  for (let i = 0; i < data.length; i += info.channels) {
    const lum = data[i]
    const on = lum > 150
    const o = (i / info.channels) * 4
    out[o] = 255; out[o + 1] = 255; out[o + 2] = 255
    out[o + 3] = on ? 255 : 0
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(path.join(assets, 'swan-icon.png'))
  console.log('swan-icon ok (' + info.width + 'x' + info.height + ')')

  // 4. feather badge: gold ornament zone extract(455,395,510,640)
  await sharp(path.join(assets, 'Odette-羽毛.png'))
    .extract({ left: 455, top: 400, width: 510, height: 640 })
    .resize(96, 120, { fit: 'fill' })
    .png()
    .toFile(path.join(assets, 'feather-badge.png'))
  console.log('feather-badge ok')
}

main().catch((e) => { console.error(e); process.exit(1) })
