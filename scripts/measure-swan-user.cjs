/* 用户新素材「手动抠图的输入框顶饰 (1).png」测量脚本：
   跳过抠图步骤（用户已手动抠图 → 已是透明PNG带alpha）
   直接 sharp 扫 alpha 找横杠带位置（top/mid/bot 距图底像素）
   按旧流水线逻辑 × SWAN_SCALE 写出 src/client/swan-meta.generated.json
*/
const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/24701/Desktop/DeepSeek Harness/DSH Desktop/resources/app/node_modules/sharp');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'v8-swan-v5-slotted.png'); // 用户新素材已拷到此处

(async () => {
  const meta = await sharp(SRC).metadata();
  const W = meta.width, H = meta.height;
  console.log(`新天鹅源图尺寸: ${W} × ${H}, channels=${meta.channels}, hasAlpha=${meta.hasAlpha}`);
  if (!meta.hasAlpha) {
    console.error('× 警告：用户说已手动抠图但 PNG 没有 alpha 通道，继续按近黑当背景回退抠图');
  }

  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = data;
  const opacify = (x, y) => pixels[(y * W + x) * 4 + 3];

  // 逐行 alpha 分析：找覆盖率最高的带状区域（横杠跨宽最多）
  const avgOp = new Array(H).fill(0);
  const cov64 = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    let sum = 0, cnt = 0;
    for (let x = 0; x < W; x++) {
      const a = opacify(x, y);
      sum += a;
      if (a >= 64) cnt++;
    }
    avgOp[y] = sum / W;
    cov64[y] = cnt / W;
  }

  // 打印每 10 行概览
  console.log(`\n===== 逐行概览（每10行）=====`);
  console.log(`y\tavgOp\tcov64\t说明`);
  for (let y = 0; y < H; y += 10) {
    let note = '';
    if (cov64[y] > 0.3) note = '← 横杠/高跨宽带';
    else if (cov64[y] > 0.05) note = '← 有装饰';
    else if (avgOp[y] > 5) note = '← 低密内容';
    console.log(`${y}\t${avgOp[y].toFixed(1)}\t${(cov64[y]*100).toFixed(0)}%\t${note}`);
  }

  // 峰值：cov>0.3 的最宽连续段当横杠（沿用旧 process 逻辑）
  let bestBand = { top: -1, bot: -1, width: 0, topA: 0 };
  let curStart = -1, curTopA = 0;
  for (let y = 0; y < H; y++) {
    if (cov64[y] >= 0.2) {
      if (curStart < 0) { curStart = y; curTopA = avgOp[y]; }
      else curTopA += avgOp[y];
    } else {
      if (curStart >= 0) {
        const w = y - curStart;
        const avgA = curTopA / w;
        // 挑最宽的段，若同宽挑平均不透明高的
        if (w > bestBand.width || (w === bestBand.width && avgA > bestBand.topA)) {
          bestBand = { top: curStart, bot: y - 1, width: w, topA: avgA };
        }
        curStart = -1;
      }
    }
  }
  if (curStart >= 0) {
    const w = H - curStart;
    const avgA = curTopA / w;
    if (w > bestBand.width || (w === bestBand.width && avgA > bestBand.topA)) {
      bestBand = { top: curStart, bot: H - 1, width: w, topA: avgA };
    }
  }
  // 兜底：如果一段 cov>0.2 的都没有（新素材横杠很薄），改找 avgOp 峰值
  if (bestBand.top === -1) {
    console.log('⚠ cov>0.2 无任何段，回退找 avgOp 峰值作为横杠锚点');
    let peakY = 0, peakA = -1;
    for (let y = 0; y < H; y++) { if (avgOp[y] > peakA) { peakA = avgOp[y]; peakY = y; } }
    bestBand = { top: peakY, bot: peakY, width: 1, topA: peakA };
  }

  const thk = bestBand.bot - bestBand.top + 1;
  const bandMidY = Math.round((bestBand.top + bestBand.bot) / 2);
  const barTopFromBottom = H - 1 - bestBand.top;
  const barMidFromBottom = H - 1 - bandMidY;
  const barBotFromBottom = H - 1 - bestBand.bot;

  console.log(`\n===== 横杠检测结果 =====`);
  console.log(`横杠范围: y=${bestBand.top} ~ y=${bestBand.bot} (thk=${thk}px)`);
  console.log(`横杠中线: y=${bandMidY} (距图底 ${barMidFromBottom}px)`);
  console.log(`横杠上缘距图底: ${barTopFromBottom}px`);
  console.log(`横杠下缘距图底: ${barBotFromBottom}px`);

  // 对齐参数（沿用旧版完全一致策略：基准宽188.9 → × SWAN_SCALE(1.25) 的 meta JSON）
  // 重要：index.ts 里会再次 × SWAN_SCALE(1.25)；历史版本就是双重乘，视觉尺寸用户已接受，不擅自改比例
  const BASE_W = 188.9;
  const S_BASE = BASE_W / W;
  const SWAN_SCALE = 1.25;
  const S = S_BASE * SWAN_SCALE;
  const renderW = +(W * S).toFixed(1);
  const renderH = +(H * S).toFixed(1);
  const renderThk = +(thk * S).toFixed(3);

  console.log(`\n===== 渲染参数（SWAN_SCALE=${SWAN_SCALE}，写入 meta JSON）=====`);
  console.log(`bgSize = ${renderW} × ${renderH}px`);
  console.log(`--swan-bar-top-from-bot-render: ${+(barTopFromBottom * S).toFixed(3)}px`);
  console.log(`--swan-bar-mid-from-bot-render: ${+(barMidFromBottom * S).toFixed(3)}px（对齐y=0主基准）`);
  console.log(`--swan-bar-bot-from-bot-render: ${+(barBotFromBottom * S).toFixed(3)}px`);
  console.log(`横杠渲染厚度: ${renderThk}px`);

  const metaOut = {
    scheme: "A_v5_user_manual_cut",
    scheme_desc: "用户手动抠图的新天鹅顶饰（已透明），沿用188.9基宽 × SWAN_SCALE=1.25 流水线",
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
  const metaPath = path.join(ROOT, 'src', 'client', 'swan-meta.generated.json');
  fs.writeFileSync(metaPath, JSON.stringify(metaOut, null, 2), 'utf8');
  console.log(`\nMeta 已写入: ${metaPath}`);
})();
