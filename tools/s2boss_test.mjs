// ステージ2の女ボス戦を指で試す(s2boss の一時ファイル)。
//   node tools/s2boss_test.mjs <出力フォルダ> [ポート] [mode] [stage]
// mode: rush / idle / pause / seq(車に乗るところを細かく撮る)
import { chromium } from 'playwright-core';
const outDir = process.argv[2] ?? '.';
const port = process.argv[3] ?? '5603';
const mode = process.argv[4] ?? 'rush';
const stage = process.argv[5] ?? 'garage';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.error('console:', m.text()); });
const cdp = await page.context().newCDPSession(page);
const wait = (ms) => page.waitForTimeout(ms);
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK ' : 'NG '} ${name} ${extra}`); if (!ok) failed++; };
const shot = async (name) => {
  // 撮るのに時間がかかるので、撮る間はゲームの時計を止める
  await page.evaluate(() => window.bossScene?.game.loop.sleep());
  await page.screenshot({ path: `${outDir}/${name}.png`, clip: { x: 0, y: 0, width: 390, height: 520 } });
  await page.evaluate(() => window.bossScene?.game.loop.wake());
};
const S = (fn, arg) => page.evaluate(fn, arg);
await page.goto(`http://localhost:${port}/?scene=Boss&seed=12345&sorts=truth&stage=${stage}`);
await page.waitForFunction(() => window.bossScene && window.bossScene.phase, null, { timeout: 10000 });
await wait(1700);
await shot('01_intro');
// ゲームの時計を ms だけ進めて止める
async function step(ms) { await S(() => window.bossScene.game.loop.wake()); await wait(ms); await S(() => window.bossScene.game.loop.sleep()); }
const shot2 = (name) => page.screenshot({ path: `${outDir}/${name}.png`, clip: { x: 0, y: 0, width: 390, height: 520 } });
async function css(lx, ly) {
  return S(([x, y]) => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { x: r.left + (x * r.width) / c.width, y: r.top + (y * r.height) / c.height }; }, [lx, ly]);
}
const btn = await S(() => { const b = window.bossScene.go; const R = window.bossScene.game.renderer.width / 216; return { x: b.x * R, y: b.y * R, w: b.w * R, h: b.h * R }; });
const f1 = await css(btn.x + btn.w * 0.3, btn.y + btn.h * 0.55);
const f2 = await css(btn.x + btn.w * 0.7, btn.y + btn.h * 0.5);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
async function mash(n, intervalMs) {
  for (let i = 0; i < n; i++) {
    const f = i % 2 === 0 ? { ...f1, id: 1 } : { ...f2, id: 2 };
    await touch('touchStart', [f]); await wait(Math.min(30, intervalMs / 2)); await touch('touchEnd', []); await wait(Math.max(0, intervalMs - 30));
  }
}
await page.waitForFunction(() => window.bossScene.phase === 'fight', null, { timeout: 15000 });
await wait(150);
await shot('02_fight');
if (mode === 'idle') {
  const t0 = Date.now();
  for (let i = 0; i < 6; i++) { await wait(2200); await shot(`03_idle_${i}`); }
  await page.waitForFunction(() => window.bossScene.phase === 'end', null, { timeout: 20000 });
  const r = await S(() => ({ sec: window.bossScene.fight.seconds, dmg: window.bossScene.fight.damageYen, stats: window.bossScene.run.stats.snapshot().damage }));
  check('押さなくても15秒で終わる', Math.abs(r.sec - 15) < 0.05, JSON.stringify(r) + ` 実時間${Date.now() - t0}ms`);
} else if (mode === 'pause') {
  await wait(300);
  const a = await S(() => window.bossScene.fight.elapsedSec);
  await S(() => window.bossScene.pause.pause());
  await wait(1500);
  const b = await S(() => window.bossScene.fight.elapsedSec);
  check('一時停止中は時計が止まる', Math.abs(b - a) < 0.1, `${a} -> ${b}`);
  await shot('10_paused');
} else if (mode === 'seq') {
  // ゲームの時計を止めて、1コマずつ進めながら押して撮る
  const tap = () => S(() => window.bossScene.onPress({ x: 0, y: 0 }));
  await S(() => window.bossScene.game.loop.sleep());
  let n = 0;
  while (!(await S(() => window.bossScene.carMode !== 'foot')) && n++ < 60) { await tap(); await step(90); }
  for (let i = 0; i < 16; i++) { await step(70); await shot2(`a_board_${String(i).padStart(2, '0')}`); }
  for (let i = 0; i < 16; i++) { await tap(); await step(90); if (i % 3 === 2) await shot2(`b_rush_${String(i).padStart(2, '0')}`); }
  for (let i = 0; i < 26; i++) { await step(90); await shot2(`c_idle_${String(i).padStart(2, '0')}`); }
  n = 0;
  while (!(await S(() => window.bossScene.phase === 'end')) && n++ < 80) { await tap(); await step(90); if (n % 4 === 0) await shot2(`c2_rush_${String(n).padStart(2, '0')}`); }
  for (let i = 0; i < 30; i++) { await step(110); await shot2(`d_wreck_${String(i).padStart(2, '0')}`); }
  await S(() => window.bossScene.game.loop.wake());
  await wait(6000);
  const ws = await S(() => window.bossScene.run.worstShot?.src ?? null);
  if (ws) { const fs = await import('node:fs'); fs.writeFileSync(`${outDir}/e_worstshot.png`, Buffer.from(ws.split(',')[1], 'base64')); }
  const r = await S(() => { const s = window.bossScene; const snap = s.run.stats.snapshot(); return { sec: s.fight.seconds, dmg: snap.damageByBoss, fdmg: s.fight.damageYen, total: snap.damage }; });
  console.log(JSON.stringify(r));
} else {
  await mash(10, 90);
  await shot('03_rush');
  for (let i = 0; i < 40; i++) { if (await S(() => window.bossScene.carMode !== 'foot')) break; await mash(1, 90); }
  check('車に乗る', await S(() => window.bossScene.carMode !== 'foot'));
  await S(() => window.bossScene.game.loop.sleep());
  for (let i = 0; i < 12; i++) { await step(120); await shot2(`04_board_${String(i).padStart(2, '0')}`); }
  await S(() => window.bossScene.game.loop.wake());
  await mash(8, 90);
  await shot('05_car_rush');
  await mash(4, 90);
  await shot('05b_car_rush');
  await wait(1900);
  await shot('06_car_idle');
  await wait(150);
  await shot('06b_car_idle');
  await wait(900);
  await shot('07_car_idle2');
  const dmg = await S(() => ({ f: window.bossScene.fight.damageYen, s: window.bossScene.run.stats.snapshot() }));
  console.log('damage', dmg.f, JSON.stringify(dmg.s).slice(0, 300));
  for (let i = 0; i < 80; i++) { if (await S(() => window.bossScene.phase === 'end')) break; await mash(2, 90); }
  await S(() => window.bossScene.game.loop.sleep());
  for (let i = 0; i < 14; i++) { await step(130); await shot2(`08_wreck_${String(i).padStart(2, '0')}`); }
  await S(() => window.bossScene.game.loop.wake());
  await wait(1500);
  await shot('09_later');
  const r = await S(() => { const s = window.bossScene; const snap = s.run.stats.snapshot(); return { sec: s.fight.seconds, bossDefeated: snap.bossDefeated, worst: snap.worstScene, dmg: snap.damageByBoss, fdmg: s.fight.damageYen }; });
  check('倒した', r.bossDefeated, JSON.stringify(r));
  await wait(1500);
  await shot('10_winpose');
  await page.waitForFunction(() => window.bossScene.scene.isActive() === false, null, { timeout: 15000 }).catch(() => {});
  await wait(600);
  const active = await S(() => window.bossScene.game.scene.getScenes(true).map((s) => s.scene.key));
  check('Result へ行く', active.includes('Result'), JSON.stringify(active));
  const ws = await S(() => window.bossScene.run.worstShot?.src ?? null);
  if (ws) { const fs = await import('node:fs'); fs.writeFileSync(`${outDir}/12_worstshot.png`, Buffer.from(ws.split(',')[1], 'base64')); }
}
await browser.close();
console.log(failed ? `NG ${failed}` : 'all OK');
process.exit(failed ? 1 : 0);
