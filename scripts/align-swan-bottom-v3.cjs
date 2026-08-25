/* v3 正确扫描：横杠是覆盖率峰值行附近的 >=80% 覆盖窄带（不是大片身体+翅膀区）
   同时保留完整吊坠，通过 CSS 变量绑定真实偏移，CSS 零手算幻数。
*/
const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/24701/Desktop/DeepSeek Harness/DSH Desktop/resources/app/node_modules/sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '..', 'preview', 'v8-swan-v4-full-transparent.png');

(async () => {
  const meta = await sharp(SRC).metadata();
  console.log(`天鹅源图尺寸: ${meta.width} × ${meta.height}`);
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const opacify = (x, y) => data[(y * W + x) * 4 + 3];

  const coverage = new Array(H);
  const step = Math.max(1, Math.floor(W / 600));
  for (let y = 0; y < H; y++) {
    let cnt = 0, scanned = 0;
    for (let x = 0; x < W; x += step) {
      scanned++;
      if (opacify(x, y) >= 64) cnt++;
    }
    coverage[y] = cnt / scanned;
  }

  // 找覆盖率峰值行（y 值），那是横杠中心（整宽横跨强度最大）
  let peakY = 0, peakC = -1;
  for (let y = 0; y < H; y++) {
    if (coverage[y] > peakC) { peakC = coverage[y]; peakY = y; }
  }
  console.log(`覆盖率峰值行 peakY=${peakY}, 覆盖=${(peakC*100).toFixed(1)}%（横杠中心附近）`);

  // 从 peakY 向下扩展到：第一个 <60% 覆盖的行前 → 横杠带下边缘
  let bandBotY = peakY;
  while (bandBotY + 1 < H && coverage[bandBotY + 1] >= 0.6) bandBotY++;

  // 从 peakY 向上扩展到：第一个 <60% 覆盖的行后 → 横杠带上边缘
  let bandTopY = peakY;
  while (bandTopY - 1 >= 0 && coverage[bandTopY - 1] >= 0.6) bandTopY--;

  const thk = bandBotY - bandTopY + 1;
  const bandMidY = Math.round((bandBotY + bandTopY) / 2);
  const barBotFromBottom = H - 1 - bandBotY; // 横杠下边缘距图片底多少源像素
  const barMidFromBottom = H - 1 - bandMidY;

  console.log(`\n===== 横杠最终结果（峰值行双向扩展，覆盖>=60%）=====`);
  console.log(`带下边缘 y = ${bandBotY}  （距图片底 ${barBotFromBottom} 源像素）`);
  console.log(`带上边缘 y = ${bandTopY}`);
  console.log(`带中线   y = ${bandMidY}  （距图片底 ${barMidFromBottom} 源像素）`);
  console.log(`横杠源厚度 = ${thk} 像素`);

  // 计算渲染参数（给 generate-art 注入 CSS 变量用）
  // 保持 bgSize 宽度 188.9，对应 S = 188.9 / W
  const S = 188.9 / W;
  const renderBarThk = +(thk * S).toFixed(3);
  const renderH = +(H * S).toFixed(1);
  // bgPos 垂直 = calc(100% - var(--swan-bar-bot-from-bot-render))
  // 含义：图底对齐盒子底(y=0)，然后把图再向上移动"横杠下边缘距图底的渲染像素"
  // → 移动后横杠下边缘正好在 y=0（盒子底 = 卡顶）
  const swanBarBotFromBotRender = +(barBotFromBottom * S).toFixed(3);
  console.log(`\n===== 渲染参数（CSS 不手算，脚本精确扫值后直接注入变量）=====`);
  console.log(`S (渲染缩放) = 188.9/${W} = ${S.toFixed(5)}`);
  console.log(`bgSize: 188.9px ${renderH}px`);
  console.log(`横杠渲染厚 = ${renderBarThk}px（框线渲染厚≈3.74px，对比粗细）`);
  console.log(`横杠下边缘距图底 渲染偏移 = ${swanBarBotFromBotRender}px`);
  console.log(`→ CSS 写：background-position: center calc(100% - ${swanBarBotFromBotRender}px);`);
  console.log(`  但不写死幻数，写进 body 的 CSS 变量 --swan-bar-bottom-from-bottom-render`);

  // 额外：生成一个 meta JSON 给 generate-art 读取，用于注入两个 CSS 变量
  const outMeta = {
    swan_bg_size_w: 188.9,
    swan_bg_size_h: renderH,
    swan_bar_bot_from_bot_render: swanBarBotFromBotRender,
    swan_bar_thk_render: renderBarThk,
    src: { W, H, bandBotY, bandTopY, bandMidY, thk }
  };
  const META = path.join(ROOT, 'src', 'client', 'swan-meta.generated.json');
  fs.writeFileSync(META, JSON.stringify(outMeta, null, 2));
  console.log(`\n已写入 meta：${META}（generate-art 读取并注入 CSS 变量）`);
})();
