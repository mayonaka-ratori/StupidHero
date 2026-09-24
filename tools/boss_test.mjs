// ボス戦を指で試す。npx vite --port 5203 --strictPort を動かしてから
//   node tools/boss_test.mjs <出力フォルダ> [ポート] [倍率] [mode] [ステージ(alley、garage、mall)]
// mode: rush(ふつう。連打→止める→連打で倒す)/ idle(一度も押さずに15秒で終わるか)/ pause(一時停止で時計が止まるか)
//       civ(ボスを市民に仕分けたあと。流れは rush と同じ)
// garage の rush では、体力が半分を切ると女ボスが高級車に飛び乗るところ、車ごと殴るところ、
// 車の中で手が止まると¥100万ずつ増えるところも確かめる。mall の rush では、親玉が母艦に乗りこむところ、母艦ごと殴るところ、
// 母艦の中で手が止まると¥150万ずつ増えるところ、倒すと母艦が噴水に落ちて¥150万を足すところを確かめる
// (civ のときは、始めに空から光線が落ちてくるところも撮る)。NG があれば exit code 1。
import { writeFileSync } from 'node:fs';
import { checker, openBrowser, openPage, touchPad } from './lib.mjs';

const outDir = process.argv[2] ?? '.';
const port = process.argv[3] ?? '5203';
const dpr = Number(process.argv[4] ?? '1');
const mode = process.argv[5] ?? 'rush';
const stage = process.argv[6] ?? 'alley';
if (!['alley', 'garage', 'mall'].includes(stage)) { console.error(`ステージは alley、garage、mall のどれか(${stage})`); process.exit(2); }
// 数字は src/logic/rules.ts(BOSS、BOSS2、BOSS3)と stages.ts(bossDefeatProp)から
// hasCar:体力が半分を切ると乗り物に乗る(女ボスの高級車、親玉の母艦)
const hasCar = stage !== 'alley';
// 手が止まっている間の1秒ごとの被害額(乗る前、乗ったあと)
const perSecFoot = 500_000;
const perSecCar = { alley: 500_000, garage: 1_000_000, mall: 1_500_000 }[stage];
// 押さずに15秒:手が止まった分が14回。体力は時間でも減るので、10回目のあとに乗り物に乗る(路地裏は乗らない)
const idleTotal = stage === 'alley' ? 14 * perSecFoot : 10 * perSecFoot + 4 * perSecCar;
// 倒したときに壊れる物(モールは噴水 ¥150万)
const defeatProp = stage === 'mall' ? { kind: 'fountain', yen: 1_500_000 } : null;
const browser = await openBrowser();
const page = await openPage(browser, { dpr });
const { check, done } = checker();
const wait = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: `${outDir}/${stage}_${name}.png` });
const S = (fn, arg) => page.evaluate(fn, arg);
const fight = () => S(() => {
  const s = window.bossScene; const f = s.fight;
  return { taps: f.tapsCounted, hp: f.hp, hpRatio: f.hpRatio, dmg: f.damageYen, inCar: f.inCar, carMode: s.carMode, carTaps: s.carTaps, phase: s.phase, sec: f.elapsedSec };
});

await page.goto(`http://localhost:${port}/?scene=Boss&stage=${stage}&seed=${mode === 'civ' ? 7 : 12345}&sorts=${mode === 'civ' ? 'civ' : 'truth'}`);
await page.waitForFunction(() => window.bossScene && window.bossScene.phase, null, { timeout: 10000 });
check('ステージ', await S(() => window.bossScene.run.stage.id) === stage, stage);
await wait(600);
await shot('01_banner');
await wait(1100);
await shot('02_intro_talk');
if (mode === 'civ') { await wait(900); await shot('02c_civ_start'); }
const props0 = await S(() => { const s = window.bossScene.run.stats.snapshot(); return { broken: s.propsBroken, yen: s.damageByProps }; });

// 行け!ボタンの2か所(論理ドット)を、2本の指で交互に押す
const pad = await touchPad(page);
const btn = await S(() => { const b = window.bossScene.go; return { x: b.x, y: b.y, w: b.w, h: b.h }; });
const f1 = await pad.css(btn.x + btn.w * 0.3, btn.y + btn.h * 0.55);
const f2 = await pad.css(btn.x + btn.w * 0.7, btn.y + btn.h * 0.5);
async function mash(n, intervalMs) {
  for (let i = 0; i < n; i++) {
    const f = i % 2 === 0 ? { ...f1, id: 1 } : { ...f2, id: 2 };
    await pad.touch('touchStart', [f]);
    await wait(Math.min(30, intervalMs / 2));
    await pad.touch('touchEnd', []);
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
  const r = await S(() => ({ sec: window.bossScene.fight.seconds, dmg: window.bossScene.fight.damageYen, taps: window.bossScene.fight.tapsCounted }));
  check('押さなくても15秒で終わる', Math.abs(r.sec - 15) < 0.05 && r.taps === 0, JSON.stringify(r) + ` 実時間${Date.now() - t0}ms`);
  // 何もしないと、手が止まった分が14回(ステージ2は車に乗ったあとが¥100万、ステージ3は母艦に乗ったあとが¥150万)
  check('被害額は14回ぶん', r.dmg === idleTotal, `${r.dmg}(${idleTotal} のはず)`);
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
  const before = (await fight()).taps;
  await pad.touch('touchStart', [{ ...f1, id: 1 }]);
  await wait(20);
  const after = (await fight()).taps;
  await pad.touch('touchEnd', []);
  check('指が触れた瞬間に数える', after === before + 1, `${before} -> ${after}`);
  await wait(80);
  await mash(10, 90);
  await shot('04_rush_mid');
  await mash(5, 80);
  await shot('05_rush_fast');
  let st = await fight();
  check('2本の指の交互押しも数える', st.taps >= 12, JSON.stringify(st));

  if (hasCar) {
    // 体力が半分を切るまで押すと、女ボスが高級車に飛び乗る(親玉は母艦を呼んで乗りこむ)
    for (let i = 0; i < 30 && !(await fight()).inCar; i++) await mash(1, 90);
    st = await fight();
    check('体力が半分を切ると車に乗る', st.inCar && st.hpRatio <= 0.5 + 1e-9, JSON.stringify(st));
    check('飛び乗る動きが始まる', st.carMode === 'boarding' || st.carMode === 'car', st.carMode);
    // 車が手前に出てくる間(乗ってから1.3秒)は、押しても体力が減らない。
    // 1.3秒をすぎると体力はまた減るので、乗ったのを見つけたらすぐに1回だけ押して、その前後を比べる
    const hold0 = await fight();
    await mash(1, 60);
    const hold1 = await fight();
    const boardAt = await S(() => window.bossScene.fight.carBoardedAt);
    const inHold = hold1.sec - boardAt < 1.3;
    check('手前に出てくるまで体力が減らない', inHold && hold1.taps > hold0.taps && Math.abs(hold1.hp - hold0.hp) < 1e-6,
      `乗ったのは${boardAt.toFixed(2)}s ${hold0.hp.toFixed(2)}@${hold0.sec.toFixed(2)}s -> ${hold1.hp.toFixed(2)}@${hold1.sec.toFixed(2)}s 連打${hold0.taps}->${hold1.taps}`);
    await shot('05g_boarding');
    await page.waitForFunction(() => window.bossScene.carMode === 'car', null, { timeout: 5000 }).catch(() => {});
    await shot('05h_in_car');
    check('車が手前に出てくる', (await fight()).carMode === 'car');
  }

  // 手を止める(車の中なら¥100万ずつ、母艦の中なら¥150万ずつ、乗る前なら¥50万ずつ)
  const dmg0 = (await fight()).dmg;
  await wait(1900);
  await shot('06_idle_rampage');
  const dmg1 = (await fight()).dmg;
  const perSec = hasCar ? perSecCar : perSecFoot;
  check('止まると被害額が増える', dmg1 - dmg0 >= perSec && (dmg1 - dmg0) % perSec === 0, `${dmg0} -> ${dmg1}(1秒 ${perSec})`);
  if (hasCar) {
    // 体力は時間でも減るので、押している途中で倒れることがある。数えた押しが全部、車に当たったかを見る
    const c0 = await fight();
    await mash(6, 90);
    const c = await fight();
    const hits = c.carTaps - c0.carTaps, counted = c.taps - c0.taps;
    check('車ごと殴る(車に当たった数)', hits >= 2 && hits === counted, `車に当たった${hits}回 / 数えた${counted}回 ${JSON.stringify(c)}`);
    await shot('06g_car_hit');
  }
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
    return { phase: s.phase, sec: s.fight.seconds, taps: s.fight.tapsCounted, bossDefeated: snap.bossDefeated, fightSec: snap.bossFightSec, worst: snap.worstScene, dmg: snap.damageByBoss };
  });
  // 連打で倒したこと(タップが数えられず、15秒の時間切れで倒れたのではない)
  check('連打で倒した', r.phase === 'end' && r.bossDefeated && r.taps >= 20 && r.sec < 14.9, JSON.stringify(r));
  await wait(500);
  await shot('09_explosions');
  await wait(1400);
  await shot('10_winpose');
  const ws = await S(() => { const w = window.bossScene.run.worstShot; return w ? `${w.width}x${w.height}` : null; });
  if (defeatProp) {
    const p1 = await S(() => { const s = window.bossScene.run.stats.snapshot(); return { broken: s.propsBroken, yen: s.damageByProps }; });
    check(`倒すと ${defeatProp.kind} が壊れる`, (p1.broken[defeatProp.kind] ?? 0) === (props0.broken[defeatProp.kind] ?? 0) + 1 && p1.yen - props0.yen === defeatProp.yen,
      `物の被害額 ${props0.yen} -> ${p1.yen}`);
  }
  check('ひどい場面が撮れている(ほかにないとき)', r.worst !== 'bossDefeated' || ws === '216x214', String(ws));
  await page.waitForFunction(() => window.bossScene.scene.isActive() === false, null, { timeout: 12000 }).catch(() => {});
  await wait(600);
  const active = await S(() => window.bossScene.game.scene.getScenes(true).map((s) => s.scene.key));
  check('3回目の答え合わせへ行く', active.includes('WaveReview'), JSON.stringify(active));
  await shot('11_after');
  if (ws) {
    const data = await S(() => window.bossScene.run.worstShot.src);
    writeFileSync(`${outDir}/${stage}_12_worstshot.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
}
await browser.close();
done();
