// ボス戦を指で試す。npx vite --port 5203 --strictPort を動かしてから
//   node tools/boss_test.mjs <出力フォルダ> [ポート] [倍率] [mode]
// mode: rush(ふつう。連打→止める→連打で倒す)/ idle(一度も押さずに15秒で終わるか)/ pause(一時停止で時計が止まるか)
import { chromium } from 'playwright-core';

const outDir = process.argv[2] ?? '.';
const port = process.argv[3] ?? '5203';
const dpr = Number(process.argv[4] ?? '1');
const mode = process.argv[5] ?? 'rush';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
await page.routeWebSocket(/.*/, () => {});
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.error('console:', m.text()); });
const cdp = await page.context().newCDPSession(page);
const wait = (ms) => page.waitForTimeout(ms);
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK ' : 'NG '} ${name} ${extra}`); if (!ok) failed++; };
const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png` });
const S = (fn, arg) => page.evaluate(fn, arg);

await page.goto(`http://localhost:${port}/?scene=Boss&seed=${mode === 'civ' ? 7 : 12345}&sorts=${mode === 'civ' ? 'civ' : 'truth'}`);
await page.waitForFunction(() => window.bossScene && window.bossScene.phase, null, { timeout: 10000 });
await wait(600);
await shot('01_banner');
await wait(1100);
await shot('02_intro_talk');

async function css(lx, ly) {
  return S(([x, y]) => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: r.left + (x * r.width) / c.width, y: r.top + (y * r.height) / c.height };
  }, [lx, ly]);
}
const btn = await S(() => { const b = window.bossScene.go; return { x: b.x, y: b.y, w: b.w, h: b.h }; });
const f1 = await css(btn.x + btn.w * 0.3, btn.y + btn.h * 0.55);
const f2 = await css(btn.x + btn.w * 0.7, btn.y + btn.h * 0.5);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
/** 2本の指で交互に押す。1回の押しは downMs 押して離す */
async function mash(n, intervalMs) {
  for (let i = 0; i < n; i++) {
    const f = i % 2 === 0 ? { ...f1, id: 1 } : { ...f2, id: 2 };
    await touch('touchStart', [f]);
    await wait(Math.min(30, intervalMs / 2));
    await touch('touchEnd', []);
    await wait(Math.max(0, intervalMs - 30));
  }
}

await page.waitForFunction(() => window.bossScene.phase === 'fight', null, { timeout: 15000 });
check('連打が始まる', true);
await wait(150);
await shot('03_mash_start');

if (mode === 'idle') {
  const t0 = Date.now();
  await page.waitForFunction(() => window.bossScene.phase === 'end', null, { timeout: 20000 });
  const r = await S(() => ({ sec: window.bossScene.fight.seconds, dmg: window.bossScene.fight.damageYen }));
  check('押さなくても15秒で終わる', Math.abs(r.sec - 15) < 0.05, JSON.stringify(r) + ` 実時間${Date.now() - t0}ms`);
  await wait(400);
  await shot('09_idle_end');
} else if (mode === 'pause') {
  await wait(300);
  const a = await S(() => window.bossScene.fight.elapsedSec);
  await S(() => window.bossScene.pause.pause());
  await wait(1500);
  const b = await S(() => window.bossScene.fight.elapsedSec);
  check('一時停止中は時計が止まる', Math.abs(b - a) < 0.1, `${a} -> ${b}`);
  await shot('10_paused');
} else {
  // 1回目の押しで、すぐ反応するか
  const before = await S(() => window.bossScene.fight.tapsCounted);
  await touch('touchStart', [{ ...f1, id: 1 }]);
  await wait(20);
  const after = await S(() => window.bossScene.fight.tapsCounted);
  await touch('touchEnd', []);
  check('指が触れた瞬間に数える', after === before + 1, `${before} -> ${after}`);
  await wait(80);
  await mash(10, 90);
  await shot('04_rush_mid');
  await mash(5, 80);
  await shot('05_rush_fast');
  const st = await S(() => ({ taps: window.bossScene.fight.tapsCounted, hp: window.bossScene.fight.hpRatio, tps: window.bossScene.fight.tapsPerSec }));
  check('2本の指の交互押しも数える', st.taps >= 12, JSON.stringify(st));
  // 手を止める
  await wait(1900);
  await shot('06_idle_rampage');
  const dmg = await S(() => window.bossScene.fight.damageYen);
  check('止まると被害額が増える', dmg >= 500000, String(dmg));
  await wait(1200);
  await shot('07_idle_more');
  await mash(4, 100);
  await shot('07b_back_to_rush');
  // 倒すまで押す
  for (let i = 0; i < 60; i++) {
    if (await S(() => window.bossScene.phase === 'end')) break;
    await mash(2, 90);
  }
  await wait(50);
  await shot('08_defeat');
  const r = await S(() => {
    const s = window.bossScene;
    const snap = s.run.stats.snapshot();
    return { phase: s.phase, sec: s.fight.seconds, bossDefeated: snap.bossDefeated, fightSec: snap.bossFightSec, worst: snap.worstScene, dmg: snap.damageByBoss };
  });
  check('倒した', r.phase === 'end' && r.bossDefeated, JSON.stringify(r));
  await wait(500);
  await shot('09_explosions');
  await wait(1400);
  await shot('10_winpose');
  const ws = await S(() => { const w = window.bossScene.run.worstShot; return w ? `${w.width}x${w.height}` : null; });
  check('ひどい場面が撮れている(ほかにないとき)', r.worst !== 'bossDefeated' || ws === '216x214', String(ws));
  await page.waitForFunction(() => window.bossScene.scene.isActive() === false, null, { timeout: 12000 }).catch(() => {});
  await wait(600);
  const active = await S(() => window.bossScene.game.scene.getScenes(true).map((s) => s.scene.key));
  check('Result へ行く', active.includes('Result'), JSON.stringify(active));
  await shot('11_after');
  if (ws) {
    const data = await S(() => window.bossScene.run.worstShot.src);
    const fs = await import('node:fs');
    fs.writeFileSync(`${outDir}/12_worstshot.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
}
await browser.close();
console.log(failed ? `NG ${failed}` : 'all OK');
process.exit(failed ? 1 : 0);
