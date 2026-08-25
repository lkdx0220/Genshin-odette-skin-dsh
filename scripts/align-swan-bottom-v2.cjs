/* 重新精确扫描：横杠特征 = 横跨整宽的高强度不透明带
   排除吊坠/翅膀尾尖等局部像素。横杠下边缘对齐图片底输出。
*/
const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/24701/Desktop/DeepSeek Harness/DSH Desktop/resources/app/node_modules/sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '..', 'preview', 'v8-swan-v4-full-transparent.png');
const OUT = path.join(ROOT, '..', 'preview', 'v8-swan-v4-bottom-aligned.png');

(async () => {
  const meta = await sharp(SRC).metadata();
  console.log(`天鹅源图尺寸: ${meta.width} × ${meta.height}`);
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const opacify = (x, y) => data[(y * W + x) * 4 + 3];

  // 计算每一行的 "跨宽覆盖率"：整行中 op >= 64 的列占比
  const coverage = new Array(H);
  for (let y = 0; y < H; y++) {
    let cnt = 0;
    const step = Math.max(1, Math.floor(W / 600));
    let scanned = 0;
    for (let x = 0; x < W; x += step) {
      scanned++;
      if (opacify(x, y) >= 64) cnt++;
    }
    coverage[y] = cnt / scanned;
  }

  // 从底向上扫：找到第一个 覆盖率>=0.6 的连续区段（跨宽>=60%）
  let streak = null;
  let streakStart = null; // fromBot
  for (let fromBot = 0; fromBot < H; fromBot++) {
    const y = H - 1 - fromBot;
    if (coverage[y] >= 0.6) {
      if (streakStart === null) streakStart = fromBot;
    } else {
      if (streakStart !== null) {
        const botFromBot = streakStart;
        const topFromBot = fromBot - 1;
        const thk = topFromBot - botFromBot + 1;
        if (thk >= 6) {
          // 再检查这个区段里的峰值覆盖率（防止误判）
          let peak = 0;
          for (let fb = botFromBot; fb <= topFromBot; fb++) peak = Math.max(peak, coverage[H-1-fb]);
          if (peak >= 0.85) {
            streak = { botFromBot, topFromBot, thk, peak };
            break;
          }
        }
        streakStart = null;
      }
    }
  }
  if (streakStart !== null && !streak) {
    const botFromBot = streakStart;
    const topFromBot = H - 1;
    const thk = topFromBot - botFromBot + 1;
    let peak = 0;
    for (let fb = botFromBot; fb <= topFromBot; fb++) peak = Math.max(peak, coverage[H-1-fb]);
    if (thk >= 6 && peak >= 0.85) streak = { botFromBot, topFromBot, thk, peak };
  }

  if (!streak) {
    console.error('ERROR: 没找到横杠（跨宽不足60%且峰值不足85%的带）');
    // 输出覆盖率 debug
    console.log('\n覆盖率 Top 10 行（从底计）：');
    const rows = [];
    for (let fromBot = 0; fromBot < H; fromBot++) rows.push({ fb: fromBot, cov: coverage[H-1-fromBot], y: H-1-fromBot });
    rows.sort((a, b) => b.cov - a.cov);
    rows.slice(0, 20).forEach(r => console.log(`  y=${r.y} (fromBot=${r.fb}) cov=${(r.cov*100).toFixed(1)}%`));
    process.exit(1);
  }

  const bandBotY = H - 1 - streak.botFromBot;
  const bandTopY = H - 1 - streak.topFromBot;
  const bandMidY = Math.round((bandBotY + bandTopY) / 2);
  console.log(`\n===== 横杠扫描结果（跨宽>=60% 且峰值覆盖率=${(streak.peak*100).toFixed(1)}%）=====`);
  console.log(`带下边缘（横杠最底一行）源 y = ${bandBotY} （距图片底 ${streak.botFromBot} 像素）`);
  console.log(`带上边缘源 y = ${bandTopY}`);
  console.log(`带中线源 y = ${bandMidY}`);
  console.log(`带源厚度 = ${streak.thk} 像素`);

  const cropBottomRows = streak.botFromBot;
  const newHeight = H - cropBottomRows;
  console.log(`\n底部裁掉空白: ${cropBottomRows} 像素 → 新图高 ${newHeight}，横杠下边缘 = 新图最后一行 (y=${newHeight-1})`);

  await sharp(SRC)
    .extract({ left: 0, top: 0, width: W, height: newHeight })
    .png()
    .toFile(OUT);
  console.log(`\n已写入对齐版: ${OUT}`);

  // 顺便输出缩放系数（供参考，CSS 不用改 bgSize，还是沿用之前 188.9×(115.1 - cropBottomRows*S=0.14033)？
  // 先报告源参数，构建后 bgSize 同步计算正确值
  console.log(`\n===== 参考缩放系数 =====`);
  console.log(`源横杠厚 = ${streak.thk}px。目标渲染厚 = 框线渲染厚 ≈ 3.74px`);
  console.log(`S = 3.74 / ${streak.thk} = ${(3.74/streak.thk).toFixed(5)}`);
  const S = 3.74 / streak.thk;
  const renderW = +(W * S).toFixed(1);
  const renderH = +(newHeight * S).toFixed(1);
  console.log(`对齐版源尺寸: ${W}×${newHeight} → 渲染 bgSize: ${renderW}px ${renderH}px`);
})();
