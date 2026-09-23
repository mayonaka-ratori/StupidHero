// ステージ2の女ボス戦を、ゲームの時計を手で進めながら撮る(s2boss の一時ファイル)。
//   node tools/s2boss_seq.mjs <出力フォルダ> [ポート] [mode] [stage]
// mode: seq(連打で車に乗せて、車ごと殴り、手を止め、倒す)/ idle(一度も押さない)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const outDir = process.argv[2] ?? '.';
const port = process.argv[3] ?? '5603';
const mode = process.argv[4] ?? 'seq';
const stage = process.argv[5] ?? 'garage';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
const S = (fn, arg) => page.evaluate(fn, arg);
await page.goto(`http://localhost:${port}/?scene=Boss&seed=12345&sorts=truth&stage=${stage}`);
await page.waitForFunction(() => window.bossScene && window.bossScene.phase, null, { timeout: 30000 });
await S(() => { window.__t = performance.now(); window.bossScene.game.loop.sleep(); });
/** ゲームを ms だけ進める(60fps のコマで) */
const adv = (ms) => S((ms) => { const g = window.bossScene.game; for (let t = 0; t < ms; t += 1000 / 60) { window.__t += 1000 / 60; g.step(window.__t, 1000 / 60); } }, ms);
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png`, clip: { x: 0, y: 0, width: 390, height: 520 } });
const tap = () => S(() => window.bossScene.onPress({ x: 0, y: 0 }));
const st = () => S(() => { const s = window.bossScene; return { phase: s.phase, mode: s.carMode, t: +s.fight.elapsedSec.toFixed(2), hp: +s.fight.hpRatio.toFixed(2), dmg: s.fight.damageYen }; });
let n = 0;
while ((await st()).phase === 'intro' && n++ < 400) { await adv(100); await S(() => window.bossScene.cut.skip()); }
await shot('00_fight');
if (mode === 'idle') {
  for (let i = 0; i < 40 && (await st()).phase === 'fight'; i++) { await adv(400); if (i % 3 === 0) await shot(`i_${String(i).padStart(2, '0')}`); }
  console.log('idle end', JSON.stringify(await st()), JSON.stringify(await S(() => window.bossScene.fight.seconds)));
} else {
  n = 0;
  while ((await st()).mode === 'foot' && n++ < 80) { await tap(); await adv(100); }
  console.log('boarded', JSON.stringify(await st()));
  for (let i = 0; i < 20; i++) { await adv(70); await shot(`a_board_${String(i).padStart(2, '0')}`); }
  for (let i = 0; i < 6; i++) { await tap(); await adv(100); if (i % 3 === 2) await shot(`b_rush_${String(i).padStart(2, '0')}`); }
  console.log('rushed', JSON.stringify(await st()));
  for (let i = 0; i < 28; i++) { await adv(90); await shot(`c_idle_${String(i).padStart(2, '0')}`); }
  console.log('idled', JSON.stringify(await st()));
  n = 0;
  while ((await st()).phase === 'fight' && n++ < 80) { await tap(); await adv(100); if (n % 4 === 0) await shot(`c2_rush_${String(n).padStart(2, '0')}`); }
  console.log('defeated', JSON.stringify(await st()));
  for (let i = 0; i < 36; i++) { await adv(110); await shot(`d_wreck_${String(i).padStart(2, '0')}`); }
  for (let i = 0; i < 40; i++) { await adv(250); await S(() => window.bossScene.cut.skip()); if (i % 8 === 0) await shot(`e_end_${String(i).padStart(2, '0')}`); }
  const ws = await S(() => window.bossScene.run.worstShot?.src ?? null);
  if (ws) fs.writeFileSync(`${outDir}/f_worstshot.png`, Buffer.from(ws.split(',')[1], 'base64'));
  const r = await S(() => { const s = window.bossScene; const snap = s.run.stats.snapshot(); return { sec: s.fight.seconds, dmg: snap.damageByBoss, fdmg: s.fight.damageYen, total: snap.damage, worst: snap.worstScene, active: s.game.scene.getScenes(true).map((x) => x.scene.key) }; });
  console.log(JSON.stringify(r));
}
await browser.close();
