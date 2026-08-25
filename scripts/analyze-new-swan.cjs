/* 深入分析新图片：检查alpha通道和实际内容 */
const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/24701/Desktop/DeepSeek Harness/DSH Desktop/resources/app/node_modules/sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'swan-v5.png');

(async () => {
  const meta = await sharp(SRC).metadata();
  console.log('Metadata:', JSON.stringify(meta, null, 2));
  
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  console.log(`Raw: ${W}x${H}, channels=${info.channels}`);
  
  // 检查alpha分布：统计alpha=0(透明)、1-254(半透明)、255(不透明)的像素数
  let transparent = 0, translucent = 0, opaque = 0;
  let minAlpha = 255, maxAlpha = 0;
  // 同时检查颜色（排除透明像素后）
  let rSum = 0, gSum = 0, bSum = 0, colorCnt = 0;
  // 四角像素颜色（判断背景色）
  const corners = [[0,0],[W-1,0],[0,H-1],[W-1,H-1]];
  for (const [cx, cy] of corners) {
    const idx = (cy * W + cx) * 4;
    console.log(`  Corner(${cx},${cy}): R=${data[idx]} G=${data[idx+1]} B=${data[idx+2]} A=${data[idx+3]}`);
  }
  
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const a = data[idx + 3];
      if (a === 0) transparent++;
      else if (a < 255) translucent++;
      else {
        opaque++;
        rSum += data[idx];
        gSum += data[idx+1];
        bSum += data[idx+2];
        colorCnt++;
      }
      if (a < minAlpha) minAlpha = a;
      if (a > maxAlpha) maxAlpha = a;
    }
  }
  const total = W * H;
  console.log(`\nAlpha分布: 透明=${transparent} (${(transparent/total*100).toFixed(1)}%), 半透明=${translucent} (${(translucent/total*100).toFixed(1)}%), 不透明=${opaque} (${(opaque/total*100).toFixed(1)}%)`);
  console.log(`Alpha范围: ${minAlpha} ~ ${maxAlpha}`);
  if (colorCnt > 0) {
    console.log(`不透明像素平均色: RGB(${Math.round(rSum/colorCnt)}, ${Math.round(gSum/colorCnt)}, ${Math.round(bSum/colorCnt)})`);
  }
  
  // 扫描每行的alpha变化，找到"图形内容"的实际边界
  const rowMinAlpha = new Array(H).fill(255);
  const rowMaxAlpha = new Array(H).fill(0);
  const rowOpaqueCount = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3];
      if (a < rowMinAlpha[y]) rowMinAlpha[y] = a;
      if (a > rowMaxAlpha[y]) rowMaxAlpha[y] = a;
      if (a > 10) rowOpaqueCount[y]++;
    }
  }
  
  // 找出有"非背景"内容的行（透明像素<80%的行 = 有图形内容）
  console.log(`\n===== 内容区域扫描（按行）=====`);
  let contentStart = -1, contentEnd = -1;
  for (let y = 0; y < H; y++) {
    const opRatio = rowOpaqueCount[y] / W;
    if (opRatio > 0.05) {
      if (contentStart < 0) contentStart = y;
      contentEnd = y;
    }
  }
  console.log(`内容y范围: ${contentStart} ~ ${contentEnd} (共${contentEnd-contentStart+1}行)`);
  
  // 找出有"透明背景"的行（即不是整行不透明的）
  let nonFullOpaqueStart = -1, nonFullOpaqueEnd = -1;
  for (let y = 0; y < H; y++) {
    if (rowOpaqueCount[y] < W * 0.95) {
      if (nonFullOpaqueStart < 0) nonFullOpaqueStart = y;
      nonFullOpaqueEnd = y;
    }
  }
  console.log(`非全实心y范围: ${nonFullOpaqueStart} ~ ${nonFullOpaqueEnd}`);
  
  // 打印每50行的alpha统计
  console.log(`\ny\tminA\tmaxA\topaqCnt\topRatio`);
  for (let y = 0; y < H; y += 30) {
    const opRatio = (rowOpaqueCount[y] / W * 100).toFixed(0);
    console.log(`${y}\t${rowMinAlpha[y]}\t${rowMaxAlpha[y]}\t${rowOpaqueCount[y]}\t${opRatio}%`);
  }
  // 最后几行
  for (let y = Math.max(0, H-30); y < H; y+=5) {
    const opRatio = (rowOpaqueCount[y] / W * 100).toFixed(0);
    console.log(`${y}\t${rowMinAlpha[y]}\t${rowMaxAlpha[y]}\t${rowOpaqueCount[y]}\t${opRatio}%`);
  }
})();
