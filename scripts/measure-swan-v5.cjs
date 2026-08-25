/* 分析新天鹅顶饰图片（输入框顶饰-改.png = swan-v5.png）的尺寸和横杠位置 */
const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/24701/Desktop/DeepSeek Harness/DSH Desktop/resources/app/node_modules/sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'swan-v5.png');

(async () => {
  const meta = await sharp(SRC).metadata();
  console.log(`新天鹅源图尺寸: ${meta.width} × ${meta.height}`);
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const opacify = (x, y) => data[(y * W + x) * 4 + 3];

  const avgOp = new Array(H);
  const cov64 = new Array(H);
  for (let y = 0; y < H; y++) {
    let sum = 0, cnt64 = 0;
    for (let x = 0; x < W; x++) {
      const op = opacify(x, y);
      sum += op;
      if (op >= 64) cnt64++;
    }
    avgOp[y] = sum / W;
    cov64[y] = cnt64 / W;
  }

  // 找平均不透明度峰值
  let peakY = 0, peakA = -1;
  for (let y = 0; y < H; y++) {
    if (avgOp[y] > peakA) { peakA = avgOp[y]; peakY = y; }
  }
  console.log(`平均不透明度峰值 peakY=${peakY}, avgOp=${peakA.toFixed(1)}`);

  // 从峰值扩展找横杠带
  let bandBotY = peakY;
  while (bandBotY + 1 < H && avgOp[bandBotY + 1] >= peakA * 0.4 && cov64[bandBotY + 1] >= 0.15) bandBotY++;
  let bandTopY = peakY;
  while (bandTopY - 1 >= 0 && avgOp[bandTopY - 1] >= peakA * 0.4 && cov64[bandTopY - 1] >= 0.15) bandTopY--;

  const thk = bandBotY - bandTopY + 1;
  const bandMidY = Math.round((bandBotY + bandTopY) / 2);
  const barBotFromBottom = H - 1 - bandBotY;
  const barMidFromBottom = H - 1 - bandMidY;
  const barTopFromBottom = H - 1 - bandTopY;

  console.log(`\n===== 横杠分析 =====`);
  console.log(`横杠范围: y=${bandTopY} ~ y=${bandBotY} (thk=${thk}px)`);
  console.log(`横杠中线: y=${bandMidY} (距图底 ${barMidFromBottom}px)`);
  console.log(`横杠上缘距图底: ${barTopFromBottom}px`);
  console.log(`横杠下缘距图底: ${barBotFromBottom}px`);

  // 打印每 10 行的覆盖率和不透明度，帮助理解图像结构
  console.log(`\n===== 逐行概览（每20行）=====`);
  console.log(`y\tavgOp\tcov64\t说明`);
  for (let y = 0; y < H; y += 20) {
    let note = '';
    if (y >= bandTopY && y <= bandBotY) note = '← 横杠区域';
    else if (y < bandTopY && avgOp[y] > 10) note = '← 上部装饰';
    else if (y > bandBotY && avgOp[y] > 10) note = '← 下部（吊坠？）';
    console.log(`${y}\t${avgOp[y].toFixed(1)}\t${(cov64[y]*100).toFixed(0)}%\t${note}`);
  }

  // 计算方案A（保持宽度与旧版一致 188.9px，看新图渲染高度和横杠位置）
  const S = 188.9 / W;
  const renderH = +(H * S).toFixed(1);
  const renderThk = +(thk * S).toFixed(3);
  console.log(`\n===== 方案A（保持渲染宽度 188.9px，与旧版一致）=====`);
  console.log(`S=${S.toFixed(5)}`);
  console.log(`bgSize = 188.9 × ${renderH}px`);
  console.log(`横杠渲染厚度 = ${renderThk}px`);
  console.log(`横杠中线距图底渲染 = ${(barMidFromBottom * S).toFixed(3)}px（此值用于对齐卡顶y=0）`);
  console.log(`横杠下缘距图底渲染 = ${(barBotFromBottom * S).toFixed(3)}px`);
  console.log(`横杠上缘距图底渲染 = ${(barTopFromBottom * S).toFixed(3)}px`);

  // 也计算 SWAN_SCALE=1.25 时的值（与旧版相同的放大系数）
  const S2 = 1.25 * S; // 不，SWAN_SCALE 是在基础 S 上再乘
  // 旧版: 源W=1346, S=188.9/1346=0.1403, 然后 * 1.25 = 0.1754, 渲染W=236.1, 渲染H=143.9
  // 新版保持相同逻辑: 先用固定宽度188.9计算S，再乘SWAN_SCALE
  const SWAN_SCALE = 1.25;
  const finalS = S * SWAN_SCALE;
  console.log(`\n===== 应用 SWAN_SCALE=${SWAN_SCALE} 后 =====`);
  console.log(`最终渲染 bgSize = ${(188.9 * SWAN_SCALE).toFixed(1)} × ${(renderH * SWAN_SCALE).toFixed(1)}px`);
  console.log(`横杠中线距图底渲染 = ${(barMidFromBottom * finalS).toFixed(3)}px`);
  console.log(`横杠上缘距图底渲染 = ${(barTopFromBottom * finalS).toFixed(3)}px`);
  console.log(`横杠下缘距图底渲染 = ${(barBotFromBottom * finalS).toFixed(3)}px`);
})();
