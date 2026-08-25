/* 处理新天鹅顶饰图片：
   1. 去除黑色背景 → 透明
   2. 扫描横杠位置
   3. 输出透明PNG到assets
*/
const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/24701/Desktop/DeepSeek Harness/DSH Desktop/resources/app/node_modules/sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'swan-v5.png');
const OUT = path.join(ROOT, 'assets', 'v8-swan-v5-slotted.png');

(async () => {
  const meta = await sharp(SRC).metadata();
  const W = meta.width, H = meta.height;
  console.log(`源图: ${W}x${H}, channels=${meta.channels}, hasAlpha=${meta.hasAlpha}`);
  
  // 读取原始像素数据（带alpha）
  const { data } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data); // 复制一份可写
  
  // 颜色分析：统计非背景（非黑）像素的颜色分布
  const colorBuckets = new Map();
  const isBg = (r, g, b) => {
    // 近黑色判定：亮度<25视为背景
    const lum = 0.299*r + 0.587*g + 0.114*b;
    return lum < 15;
  };
  
  let bgCount = 0, fgCount = 0;
  let minFgLum = 255, maxFgLum = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const r = pixels[idx], g = pixels[idx+1], b = pixels[idx+2];
      const lum = 0.299*r + 0.587*g + 0.114*b;
      if (isBg(r,g,b)) {
        bgCount++;
        pixels[idx + 3] = 0; // 设为透明
      } else {
        fgCount++;
        if (lum < minFgLum) minFgLum = lum;
        if (lum > maxFgLum) maxFgLum = lum;
      }
    }
  }
  console.log(`背景像素(近黑): ${bgCount} (${(bgCount/(W*H)*100).toFixed(1)}%)`);
  console.log(`前景像素: ${fgCount} (${(fgCount/(W*H)*100).toFixed(1)}%)`);
  console.log(`前景亮度范围: ${minFgLum.toFixed(0)} ~ ${maxFgLum.toFixed(0)}`);
  
  // 对边缘像素做平滑过渡（抗锯齿）：亮度15-30的像素，alpha按亮度渐变
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const r = pixels[idx], g = pixels[idx+1], b = pixels[idx+2];
      const lum = 0.299*r + 0.587*g + 0.114*b;
      if (lum >= 15 && lum < 30) {
        // 边缘抗锯齿：alpha从0渐变到255
        const a = Math.round(((lum - 15) / 15) * 255);
        pixels[idx + 3] = a;
      }
    }
  }
  
  // 现在分析透明PNG，找横杠位置
  const avgOp = new Array(H).fill(0);
  const cov64 = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    let sum = 0, cnt = 0;
    for (let x = 0; x < W; x++) {
      const a = pixels[(y * W + x) * 4 + 3];
      sum += a;
      if (a >= 64) cnt++;
    }
    avgOp[y] = sum / W;
    cov64[y] = cnt / W;
  }
  
  // 找横杠：找一个水平覆盖率高的带状区域（横杠横跨大部分宽度）
  // 先打印每行的不透明覆盖率，观察结构
  console.log(`\n===== 逐行分析（透明处理后）=====`);
  for (let y = 0; y < H; y += 15) {
    const opPct = (avgOp[y]/255*100).toFixed(0);
    const covPct = (cov64[y]*100).toFixed(0);
    let note = '';
    if (cov64[y] > 0.3) note = '← 可能是横杠（跨宽>30%）';
    else if (cov64[y] > 0.05) note = '← 有内容';
    console.log(`y=${y}\tavgOp=${opPct}%\tcov=${covPct}%\t${note}`);
  }
  
  // 找平均不透明度峰值
  let peakY = 0, peakA = -1;
  for (let y = 0; y < H; y++) {
    if (cov64[y] > 0.3 && avgOp[y] > peakA) {
      peakA = avgOp[y];
      peakY = y;
    }
  }
  console.log(`\n横杠峰值: y=${peakY}, avgOp=${peakA.toFixed(1)}, cov=${(cov64[peakY]*100).toFixed(0)}%`);
  
  // 从峰值扩展找横杠带
  let bandBotY = peakY;
  while (bandBotY + 1 < H && cov64[bandBotY+1] >= 0.2) bandBotY++;
  let bandTopY = peakY;
  while (bandTopY - 1 >= 0 && cov64[bandTopY-1] >= 0.2) bandTopY--;
  
  // 可能有多个横杠（装饰带的上下边缘），找最宽的那个
  // 或者：找最长的连续高覆盖率段
  let bestBand = { top: bandTopY, bot: bandBotY, width: bandBotY - bandTopY + 1 };
  let curStart = -1;
  for (let y = 0; y < H; y++) {
    if (cov64[y] >= 0.2) {
      if (curStart < 0) curStart = y;
    } else {
      if (curStart >= 0) {
        const w = y - curStart;
        if (w > bestBand.width) bestBand = { top: curStart, bot: y-1, width: w };
        curStart = -1;
      }
    }
  }
  if (curStart >= 0) {
    const w = H - curStart;
    if (w > bestBand.width) bestBand = { top: curStart, bot: H-1, width: w };
  }
  
  const thk = bestBand.bot - bestBand.top + 1;
  const bandMidY = Math.round((bestBand.top + bestBand.bot) / 2);
  const barBotFromBottom = H - 1 - bestBand.bot;
  const barMidFromBottom = H - 1 - bandMidY;
  const barTopFromBottom = H - 1 - bestBand.top;
  
  console.log(`\n===== 横杠检测结果 =====`);
  console.log(`横杠范围: y=${bestBand.top} ~ y=${bestBand.bot} (thk=${thk}px)`);
  console.log(`横杠中线: y=${bandMidY} (距图底 ${barMidFromBottom}px)`);
  
  // 写出透明PNG
  await sharp(pixels, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(OUT);
  console.log(`\n透明版已保存: ${OUT}`);
  
  // 计算对齐参数（与旧版相同逻辑：保持渲染宽度188.9 * SWAN_SCALE=1.25 → 236.1px）
  const BASE_W = 188.9;
  const S_BASE = BASE_W / W;
  const SWAN_SCALE = 1.25;
  const S = S_BASE * SWAN_SCALE;
  const renderW = +(W * S).toFixed(1);
  const renderH = +(H * S).toFixed(1);
  const renderThk = +(thk * S).toFixed(3);
  
  console.log(`\n===== 渲染参数（SWAN_SCALE=${SWAN_SCALE}）=====`);
  console.log(`bgSize: ${renderW} × ${renderH}px`);
  console.log(`横杠渲染厚度: ${renderThk}px`);
  console.log(`--swan-bar-top-from-bot-render: ${(barTopFromBottom * S).toFixed(3)}px`);
  console.log(`--swan-bar-mid-from-bot-render: ${(barMidFromBottom * S).toFixed(3)}px（主基准，对齐y=0）`);
  console.log(`--swan-bar-bot-from-bot-render: ${(barBotFromBottom * S).toFixed(3)}px`);
  
  // 输出meta JSON
  const metaOut = {
    scheme: "A_v5",
    scheme_desc: "新版顶饰（输入框顶饰-改.png），黑底转透明，保持宽度236.1px（188.9*1.25）",
    swan_s: S,
    swan_bg_size_w: renderW,
    swan_bg_size_h: renderH,
    swan_bar_top_from_bot_render: +(barTopFromBottom * S).toFixed(3),
    swan_bar_mid_from_bot_render: +(barMidFromBottom * S).toFixed(3),
    swan_bar_bot_from_bot_render: +(barBotFromBottom * S).toFixed(3),
    swan_bar_thk_render: renderThk,
    frame_thk_render_ref: 3.74,
    src: { W, H, bandBotY: bestBand.bot, bandTopY: bestBand.top, bandMidY, thk }
  };
  fs.writeFileSync(
    path.join(ROOT, 'src', 'client', 'swan-meta.generated.json'),
    JSON.stringify(metaOut, null, 2)
  );
  console.log(`Meta已更新: src/client/swan-meta.generated.json`);
})();
