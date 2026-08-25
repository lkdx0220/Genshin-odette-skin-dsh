/* 精确测量 v8-swan-v4-full-transparent.png 中横杠下边缘的位置，并裁掉底部空白，
   输出横杠下边缘正好贴住图片最后一行像素的对齐版 v8-swan-v4-bottom-aligned.png。
   目的：CSS 里不再需要任何像素偏移，直接 background-position: center bottom 即可重合上框线。
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
  const opacify = (x, y) => {
    const idx = (y * W + x) * 4 + 3;
    return data[idx]; // 0~255
  };

  // 从底向上扫，找横杠下边缘：第一个连续多行不透明的水平带
  let foundBand = null;
  let streakStart = null; // 当前不透明 streak 起始行（从底计 = streakStart）
  // y_frombot = 0 是最后一行（图片底）
  for (let fromBot = 0; fromBot < H; fromBot++) {
    const y = H - 1 - fromBot;
    // 扫水平采样 op 值
    let maxOp = 0;
    let hasAny = false;
    const step = Math.max(1, Math.floor(W / 600));
    for (let x = 0; x < W; x += step) {
      const op = opacify(x, y);
      if (op > maxOp) maxOp = op;
      if (op >= 64) hasAny = true;
    }
    if (hasAny) {
      if (streakStart === null) streakStart = fromBot; // 记录从底计的开始行
    } else {
      if (streakStart !== null) {
        // 一个 streak：从 fromBot = streakStart 到 fromBot = fromBot-1
        const bandBotFromBot = streakStart; // 带下边缘（图片底计）
        const bandTopFromBot = fromBot - 1;  // 带上边缘（图片底计）
        const thickness = bandTopFromBot - bandBotFromBot + 1;
        // 只取第一个（最底下的）有厚度的 streak 作为横杠
        if (thickness >= 4) {
          foundBand = {
            bandBotFromBot, bandTopFromBot, thickness,
            // 带下边缘源 y（绝对）：H-1 - bandBotFromBot
            bandBotY: H - 1 - bandBotFromBot,
            bandTopY: H - 1 - bandTopFromBot,
            bandMidY: H - 1 - Math.round((bandBotFromBot + bandTopFromBot) / 2),
          };
          break;
        }
        streakStart = null;
      }
    }
  }
  // 末尾保护
  if (streakStart !== null && foundBand === null) {
    const bandBotFromBot = streakStart;
    const bandTopFromBot = H - 1;
    const thickness = bandTopFromBot - bandBotFromBot + 1;
    if (thickness >= 4) {
      foundBand = {
        bandBotFromBot, bandTopFromBot, thickness,
        bandBotY: H - 1 - bandBotFromBot,
        bandTopY: H - 1 - bandTopFromBot,
        bandMidY: H - 1 - Math.round((bandBotFromBot + bandTopFromBot) / 2),
      };
    }
  }

  if (!foundBand) {
    console.error('ERROR: 没找到横杠水平带');
    process.exit(1);
  }

  console.log(`\n===== 横杠扫描结果 =====`);
  console.log(`带下边缘（横杠最底一行）源 y = ${foundBand.bandBotY} （距图片底 ${foundBand.bandBotFromBot} 像素）`);
  console.log(`带上边缘源 y = ${foundBand.bandTopY}`);
  console.log(`带中线源 y = ${foundBand.bandMidY}`);
  console.log(`带源厚度 = ${foundBand.thickness} 像素`);
  console.log(`图片总高 H = ${H}`);
  const cropBottomRows = foundBand.bandBotFromBot; // 需要从底部裁掉的空白行数（横杠下边缘下面的像素）
  console.log(`\n需要从底部裁掉: ${cropBottomRows} 像素（横杠下边缘下面的空白）`);
  const newHeight = H - cropBottomRows;
  console.log(`对齐后图片新高度: ${newHeight} (横杠下边缘正好在最后一行 y=${newHeight-1})`);

  // 裁剪：保留 0 ~ newHeight-1（即去掉底部 cropBottomRows 行）
  await sharp(SRC)
    .extract({ left: 0, top: 0, width: W, height: newHeight })
    .png()
    .toFile(OUT);
  console.log(`\n已写入对齐版: ${OUT}`);
  console.log(`验证：新图最后一行 ${newHeight-1} = 原横杠下边缘 y=${foundBand.bandBotY} ✓`);
})();
