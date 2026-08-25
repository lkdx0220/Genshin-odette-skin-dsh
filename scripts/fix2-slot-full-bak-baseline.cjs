const fs = require('fs');
const sharp = require('C:/Users/24701/Desktop/DeepSeek Harness/DSH Desktop/resources/app/node_modules/sharp');

(async () => {
  // ============ 最稳策略：100% 对齐旧 BAK 基线 ============
  // 旧 BAK bandTop=201 bandBot=506 bandMid=353.5（用户认可的对齐基线）
  // 新素材 W=2048 H=768 与旧素材完全同尺寸，先直接用旧BAK几何参数回稳，
  // 消除「横杠盖天鹅」现象；等用户视觉OK后，再按需微调0.5px级差值。
  const BAK = { bandTop: 201, bandBot: 506, bandMid: 353.5, W: 2048, H: 768, S_BASE: 188.9 / 2048 };
  const SWAN_X1 = 139;   // 旧基线 x 边界：天鹅主体左外-10裕量
  const SWAN_X2 = 1911;  // 旧基线 x 边界：天鹅主体右外+10裕量
  const SLOT_Y1 = BAK.bandTop;
  const SLOT_Y2 = BAK.bandBot;
  const SOFT_MARGIN_X = 20;
  const SOFT_MARGIN_Y = 8;

  const SRC         = 'assets/v8-swan-v5-slotted.png';
  const BEFORE_FIX2 = 'assets/v8-swan-v5-slotted.PRE-FIX2-SLOT-TOO-NARROW.png';
  fs.copyFileSync(SRC, BEFORE_FIX2);
  console.log('备份（修复2前，上一轮挖槽太窄版）:', BEFORE_FIX2);

  const meta = await sharp(SRC).metadata();
  const W = meta.width, H = meta.height;
  const { data } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buf = Buffer.from(data);

  let touched = 0;
  for (let y = SLOT_Y1; y <= SLOT_Y2; y++) {
    for (let x = SWAN_X1; x <= SWAN_X2; x++) {
      const i = (y * W + x) * 4;
      let fx = 1;
      if (x < SWAN_X1 + SOFT_MARGIN_X)        fx = (x - SWAN_X1) / SOFT_MARGIN_X;
      else if (x > SWAN_X2 - SOFT_MARGIN_X)   fx = (SWAN_X2 - x) / SOFT_MARGIN_X;
      let fy = 1;
      if (y < SLOT_Y1 + SOFT_MARGIN_Y)        fy = (y - SLOT_Y1) / SOFT_MARGIN_Y;
      else if (y > SLOT_Y2 - SOFT_MARGIN_Y)   fy = (SLOT_Y2 - y) / SOFT_MARGIN_Y;
      const s = Math.max(0, Math.min(1, Math.min(fx, fy)));
      const oa = buf[i + 3];
      const na = Math.round(oa * (1 - s));
      if (oa !== na) { buf[i + 3] = na; touched++; }
    }
  }
  console.log('挖槽像素数（旧BAK完整横杠带 y=201~506）:', touched);

  await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(SRC);
  console.log('PNG 已写回:', SRC);

  // ============ 同步把 meta JSON 也直接回退为旧BAK精确5参数 ============
  const swan_bg_size_w   = 188.9;
  const S                = 188.9 / W;
  const swan_bg_size_h   = H * S;
  const top_from_bot_src   = (H - 1) - BAK.bandTop;   // 距图底
  const mid_from_bot_src   = (H - 1) - BAK.bandMid;
  const bot_from_bot_src   = (H - 1) - BAK.bandBot;
  const meta_out = {
    scheme: 'A_v5_user_manual_cut_FIX2_BAKBASELINE',
    scheme_desc: '用户手动抠图新天鹅 修复2：横杠挖槽范围回旧BAK(y=201~506)，对齐5参数100%照抄旧BAK(用户认可基线)，消除横杠盖天鹅。',
    swan_s: S,
    swan_bg_size_w,
    swan_bg_size_h:           +(swan_bg_size_h).toFixed(3),
    swan_bar_top_from_bot_render: +(top_from_bot_src * S).toFixed(3),
    swan_bar_mid_from_bot_render: +(mid_from_bot_src * S).toFixed(3),
    swan_bar_bot_from_bot_render: +(bot_from_bot_src * S).toFixed(3),
    swan_bar_thk_render:      +((BAK.bandBot - BAK.bandTop) * S).toFixed(3),
    frame_thk_render_ref:     46.4, // 旧BAK值：蓝宝石外框厚度渲染值，上一轮误写成3.74
    src: { W, H, bandTopY: BAK.bandTop, bandBotY: BAK.bandBot, bandMidY: BAK.bandMid, thk: BAK.bandBot - BAK.bandTop }
  };
  const META = 'src/client/swan-meta.generated.json';
  fs.writeFileSync(META, JSON.stringify(meta_out, null, 2) + '\n', 'utf8');
  console.log('meta 回稳(旧BAK基线5参数):', META);
  console.log('  swan_bg_size_w            =', meta_out.swan_bg_size_w);
  console.log('  swan_bg_size_h            =', meta_out.swan_bg_size_h);
  console.log('  bar_mid_from_bot_render   =', meta_out.swan_bar_mid_from_bot_render, '（BAK值=', 38.232,'，理论相等）');
  console.log('  frame_thk_render_ref      =', meta_out.frame_thk_render_ref, '（上一轮误写3.74，现恢复BAK=46.4）');

  // 验证：横杠带 y=250,300,350,400,450,500 的 x=100(外)/x=1024(中)/x=2000(外) alpha
  const { data: d2 } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const op = (x, y) => d2[(y * W + x) * 4 + 3];
  console.log('\n挖槽验证（y 取 250~500 全覆盖旧BAK带）:');
  for (const y of [250, 300, 320, 340, 360, 400, 450, 500]) {
    console.log('  y='+String(y).padStart(3,' ')+': Lx=100 a='+String(op(100,y)).padStart(3)+'  Mx=1024 a='+String(op(1024,y)).padStart(3)+'  Rx=2000 a='+String(op(2000,y)).padStart(3));
  }
})().catch(e => { console.error(e); process.exit(1); });
