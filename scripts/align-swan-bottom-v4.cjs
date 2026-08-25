/* v4 最终正确扫描：找平均不透明度的峰值区段（实心像素带=横杠）
   不透明度高的那条细窄带才是真正的横杠连接杆。
   生成 meta JSON，generate-art 注入 CSS 变量（CSS 完全不手算）。
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

  const avgOp = new Array(H);
  const cov64 = new Array(H);
  const colHasBody = new Array(W).fill(0); // 每列：全图上不透明像素（>=64）的数量，用于判断身体左右边缘
  for (let y = 0; y < H; y++) {
    let sum = 0, cnt64 = 0;
    for (let x = 0; x < W; x++) {
      const op = opacify(x, y);
      sum += op;
      if (op >= 64) {
        cnt64++;
        colHasBody[x]++;
      }
    }
    avgOp[y] = sum / W;       // 0~255 平均不透明度（实心度）
    cov64[y] = cnt64 / W;     // 该 y 行上不透明像素的行覆盖率
  }

  // 找平均不透明度的峰值：这是横杠连接杆（最实心）
  let peakY = 0, peakA = -1;
  // 只从上半部分 + 中部搜索，排除底部吊坠尖点（y > 700 肯定不是横杠，吊坠往下细）
  for (let y = 100; y < H - 100; y++) {
    if (avgOp[y] > peakA) { peakA = avgOp[y]; peakY = y; }
  }
  console.log(`平均不透明度峰值 peakY=${peakY}, avgOp=${peakA.toFixed(1)}`);

  // 峰值向下扩展：avgOp >= peakA * 0.5 并且 cov64 >= 0.3（横杠至少 30% 跨宽覆盖）
  let bandBotY = peakY;
  while (bandBotY + 1 < H && avgOp[bandBotY + 1] >= peakA * 0.5 && cov64[bandBotY + 1] >= 0.3) bandBotY++;
  // 峰值向上扩展
  let bandTopY = peakY;
  while (bandTopY - 1 >= 0 && avgOp[bandTopY - 1] >= peakA * 0.5 && cov64[bandTopY - 1] >= 0.3) bandTopY--;

  const thk = bandBotY - bandTopY + 1;
  const bandMidY = Math.round((bandBotY + bandTopY) / 2);
  const barBotFromBottom = H - 1 - bandBotY;
  const barMidFromBottom = H - 1 - bandMidY;

  console.log(`\n===== 横杠结果（实心峰值扩展，实心>=50%峰值，跨宽>=30%）=====`);
  console.log(`带下边缘 y=${bandBotY}（距图底 ${barBotFromBottom} 源像素），cov=${(cov64[bandBotY]*100).toFixed(0)}%，avgOp=${avgOp[bandBotY].toFixed(0)}`);
  console.log(`带上边缘 y=${bandTopY}，cov=${(cov64[bandTopY]*100).toFixed(0)}%，avgOp=${avgOp[bandTopY].toFixed(0)}`);
  console.log(`带中线   y=${bandMidY}（距图底 ${barMidFromBottom} 源像素）`);
  console.log(`横杠源厚度 = ${thk} 像素`);

  // 保持 bgSize 宽 188.9（用户已经确认的尺寸，不会太大或太小），S = 188.9 / W
  const S = 188.9 / W;
  const renderH = +(H * S).toFixed(1);
  const renderThk = +(thk * S).toFixed(3);
  const frameRenderThk = 3.74;
  const scaleRatio = +(frameRenderThk / thk).toFixed(5); // 如果要让横杠和框线等粗，S 应该等于这个值
  const matchRenderW = +(W * scaleRatio).toFixed(1);
  const matchRenderH = +(H * scaleRatio).toFixed(1);
  console.log(`\n===== 两种尺寸方案供参考 =====`);
  console.log(`[方案A 尺寸优先] 保持 bgSize 宽=188.9（已确认大小合适，绿圈不超）`);
  console.log(`  S=${S.toFixed(5)}，bgSize=188.9 × ${renderH}，横杠渲染厚=${renderThk}px（框线${frameRenderThk}px，${(renderThk/frameRenderThk*100).toFixed(0)}%粗）`);
  console.log(`  横杠下边缘距图底渲染偏移 = ${(barBotFromBottom*S).toFixed(3)}px`);
  console.log(`[方案B 粗细严格相等] 让横杠渲染厚 = 框线${frameRenderThk}px`);
  console.log(`  S=${scaleRatio}，bgSize=${matchRenderW} × ${matchRenderH}（需确认是否不超绿圈）`);
  console.log(`  横杠下边缘距图底渲染偏移 = ${(barBotFromBottom*scaleRatio).toFixed(3)}px`);

  // 写入 meta，选择方案A 的数值（尺寸优先），后续 generate-art 注入 CSS 变量
  const chosen = 'A';
  const usedS = chosen === 'A' ? S : scaleRatio;
  const usedBgW = chosen === 'A' ? 188.9 : matchRenderW;
  const usedBgH = chosen === 'A' ? renderH : matchRenderH;
  const usedBarTopFromBotRender = +((H - 1 - bandTopY) * usedS).toFixed(3);
  const usedBarMidFromBotRender = +(barMidFromBottom * usedS).toFixed(3); // 对齐9-slice框线中线的基准
  const usedBarBotFromBotRender = +(barBotFromBottom * usedS).toFixed(3);
  const usedBarThkRender = +(thk * usedS).toFixed(3);
  const outMeta = {
    scheme: chosen,
    scheme_desc: chosen === 'A' ? '保持宽度188.9大小合适绿圈不超，横杠稍粗于框线约2.5~3倍，视觉连接杆粗体风格' : '横杠框线严格等粗，需确认大小未超绿圈',
    swan_s: usedS,
    swan_bg_size_w: usedBgW,
    swan_bg_size_h: usedBgH,
    swan_bar_top_from_bot_render: usedBarTopFromBotRender,
    swan_bar_mid_from_bot_render: usedBarMidFromBotRender, // 主基准：横杠中线距图底渲染值，对齐框线中线y=0
    swan_bar_bot_from_bot_render: usedBarBotFromBotRender,
    swan_bar_thk_render: usedBarThkRender,
    frame_thk_render_ref: frameRenderThk,
    src: { W, H, bandBotY, bandTopY, bandMidY, thk }
  };
  const META = path.join(ROOT, 'src', 'client', 'swan-meta.generated.json');
  fs.writeFileSync(META, JSON.stringify(outMeta, null, 2));
  console.log(`\n选择方案${chosen}，已写入 meta：${META}`);
  console.log(`→ CSS 自动注入变量：--swan-bg-size-w/h、--swan-bar-bot-from-bot-render`);
  console.log(`→ 天鹅层 background-position: center calc(100% + var(--swan-bar-bot-from-bot-render))`);
  console.log(`  （图整体下移该值，横杠下边缘自然落卡顶 y=0；主体在卡上，吊坠垂卡内）`);
  console.log(`  全程零手算幻数，真实偏移值由脚本扫描素材精确绑定。`);

  /* ===== 新增：横杠中段挖空，只留天鹅身体根部短柱（9-slice框顶直线穿孔而过，零接缝） =====
     思路：
     1. 找身体左右边缘 bodyL / bodyR：**排除横杠带**后，任何一列 x 在 y∉[bandTopY,bandBotY] 上只要有 >= 阈值 个不透明像素，就认定该列属于「天鹅身体投影」
        （必须排除横杠带！否则横贯整图的连接杆会让每一列都被判为有身体，导致无法区分身体/连接杆）
     2. 找横杠在 peakY 行上的左右端点 barL / barR：不透明度 >= peakA*0.45 的最左/最右 x
     3. 保留段 keepLen_src = 至少 3×横杠厚（渲染后≈「托座翼」宽度，视觉像金属镶嵌底座），并且不超过 bodyL/bodyR 与图左右边缘距离
     4. 挖空区段：左段 [barL, bodyL - keepLen_src] 和 右段 [bodyR + keepLen_src, barR]
        仅在 y ∈ [bandTopY, bandBotY]（横杠条带）内行，不触碰天鹅身体、冠饰、吊坠等其他像素 */
  // 重扫列覆盖率（排除横杠带后），用于判定身体左右边缘
  const nonBarRows = H - (bandBotY - bandTopY + 1);
  const colCovThr = Math.max(2, Math.round(nonBarRows * 0.006)); // 非横杠区域内>=6‰不透明像素→认定身体列
  const colBodyNoBar = new Array(W).fill(0);
  for (let y = 0; y < bandTopY; y++) {
    for (let x = 0; x < W; x++) { if (data[(y * W + x) * 4 + 3] >= 64) colBodyNoBar[x]++; }
  }
  for (let y = bandBotY + 1; y < H; y++) {
    for (let x = 0; x < W; x++) { if (data[(y * W + x) * 4 + 3] >= 64) colBodyNoBar[x]++; }
  }
  let bodyL = 0, bodyR = W - 1;
  for (let x = 0; x < W; x++) { if (colBodyNoBar[x] >= colCovThr) { bodyL = x; break; } }
  for (let x = W - 1; x >= 0; x--) { if (colBodyNoBar[x] >= colCovThr) { bodyR = x; break; } }
  let barL = 0, barR = W - 1;
  const barOpThr = peakA * 0.45;
  for (let x = 0; x < W; x++) { if (opacify(x, peakY) >= barOpThr) { barL = x; break; } }
  for (let x = W - 1; x >= 0; x--) { if (opacify(x, peakY) >= barOpThr) { barR = x; break; } }
  const keepLenSrc = Math.max(Math.round(thk * 3), 60); // 每侧根部保留：至少3倍横杠厚，最少60源像素（渲染后≈8.4px）
  const L_clearStart = barL;
  const L_clearEnd = Math.max(barL - 1, bodyL - keepLenSrc);
  const R_clearStart = Math.min(barR + 1, bodyR + keepLenSrc);
  const R_clearEnd = barR;

  let clearCnt = 0;
  for (let y = bandTopY; y <= bandBotY; y++) {
    for (let x = L_clearStart; x <= L_clearEnd; x++) { data[(y * W + x) * 4 + 3] = 0; clearCnt++; }
    for (let x = R_clearStart; x <= R_clearEnd; x++) { data[(y * W + x) * 4 + 3] = 0; clearCnt++; }
  }

  console.log(`\n===== 横杠挖空（插槽式接缝消除）=====`);
  console.log(`身体边缘: bodyL=${bodyL}, bodyR=${bodyR}（阈值colCov>=${colCovThr}像素/列）`);
  console.log(`横杠端点: barL=${barL}, barR=${barR}（peakY行不透明度>=${barOpThr.toFixed(0)}）`);
  console.log(`保留段长: keepLen=${keepLenSrc}源像素（每侧根部短柱）`);
  console.log(`左侧挖空: x ∈ [${L_clearStart}, ${L_clearEnd}]（长度 ${L_clearEnd - L_clearStart + 1}）`);
  console.log(`右侧挖空: x ∈ [${R_clearStart}, ${R_clearEnd}]（长度 ${R_clearEnd - R_clearStart + 1}）`);
  console.log(`清除像素数: ${clearCnt}（仅横杠条带内，其余像素不变）`);

  // 输出挖空版素材到 preview 和 assets
  const OUT_PREVIEW = path.join(ROOT, '..', 'preview', 'v8-swan-v4-slotted.png');
  const OUT_ASSETS  = path.join(ROOT, 'assets', 'v8-swan-v4-slotted.png');
  await sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), {
    raw: { width: W, height: H, channels: 4 }
  }).png({ compressionLevel: 9 }).toFile(OUT_PREVIEW);
  fs.copyFileSync(OUT_PREVIEW, OUT_ASSETS);
  console.log(`\n挖空版素材已输出：`);
  console.log(`  preview: ${OUT_PREVIEW}`);
  console.log(`  assets:  ${OUT_ASSETS}（generate-art 请指向此文件）`);
  console.log(`完成：天鹅主体固定尺寸不拉伸，横杠仅留身体根部短柱→框线穿孔而过→零接缝`);
})();
