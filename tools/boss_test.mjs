// ボス戦を指で試す。npm run dev を動かしてから
//   node tools/boss_test.mjs [出力フォルダ] [サーバー] [倍率] [mode] [ステージ(alley、garage、mall、tower)] [画面の高さ(CSS)]
// 出力フォルダとサーバーは、省くか - にすると shots/ と http://localhost:5173/(tools/lib.mjs の shotsDir と serverUrl)
// mode: rush(ふつう。連打→止める→連打で倒す)/ idle(一度も押さずに15秒で終わるか)/ pause(一時停止で時計が止まるか)
//       civ(ボスを市民に仕分けたあと。流れは rush と同じ)
//       nochoice(tower だけ。流れは rush と同じで、念力の選択で何も押さない)
// garage の rush では、体力が半分を切ると女ボスが高級車に飛び乗るところ、車ごと殴るところ、
// 車の中で手が止まると¥100万ずつ増えるところも確かめる。mall の rush では、親玉が母艦に乗りこむところ、母艦ごと殴るところ、
// 母艦の中で手が止まると¥150万ずつ増えるところ、倒すと母艦が噴水に落ちて¥150万を足すところを確かめる
// (civ のときは、始めに空から光線が落ちてくるところも撮る)。
// tower の rush では、体力が半分を切ると念力の選択になり、時計が止まるところ、待てと行けを押すと客が下りて
// シャンデリアが天井へ戻るところ(市民のけがも被害額も増えない)、手が止まると¥50万ずつ増えるところ、
// 戻ってから倒れるまで1.5秒より早くないところ、倒すとシャンパンタワー¥1,000万を足すところを確かめる。
// nochoice では、何も押さずに3秒たつと客が落ちて(ワルにやられた市民+1)、シャンデリアが落ちる(¥3,000万)ところを確かめる。
// idle では、何も押さずに15秒で終わり、選択でも何も押さなかった分(客とシャンデリア)が数えられるかを見る。NG があれば exit code 1。
// 端末が重くて確かめたい瞬間に間に合わなかったもの(体力が時間で減りきった、など)は SKIP と出す(NG には数えない)。
import { writeFileSync } from 'node:fs';
import { checker, openBrowser, openPage, serverUrl, shotsDir, touchPad } from './lib.mjs';

const outDir = shotsDir(process.argv[2]);
const base = serverUrl(process.argv[3]);
const dpr = Number(process.argv[4] ?? '1');
const mode = process.argv[5] ?? 'rush';
const stage = process.argv[6] ?? 'alley';
const height = Number(process.argv[7] ?? '844');
if (!['alley', 'garage', 'mall', 'tower'].includes(stage)) { console.error(`ステージは alley、garage、mall、tower のどれか(${stage})`); process.exit(2); }
if (mode === 'nochoice' && stage !== 'tower') { console.error('nochoice は tower だけ'); process.exit(2); }
// tower:体力が半分を切ると念力の選択(rules.ts の BOSS4)。乗り物には乗らない
const isTower = stage === 'tower';
// 数字は src/logic/rules.ts(BOSS、BOSS2、BOSS3)と stages.ts(bossDefeatProp)から
// hasCar:体力が半分を切ると乗り物に乗る(女ボスの高級車、親玉の母艦)
const hasCar = stage === 'garage' || stage === 'mall';
// 手が止まっている間の1秒ごとの被害額(乗る前、乗ったあと)
const perSecFoot = 500_000;
const perSecCar = { alley: 500_000, garage: 1_000_000, mall: 1_500_000, tower: 500_000 }[stage];
// 押さずに15秒:手が止まった分が14回。体力は時間でも減るので、10回目のあとに乗り物に乗る(路地裏は乗らない)
// (tower は選択の3秒の間、時計が止まるので、路地裏と同じ14回)
const idleTotal = hasCar ? 10 * perSecFoot + 4 * perSecCar : 14 * perSecFoot;
// 倒したときに壊れる物(モールは噴水 ¥150万、ビルはシャンパンタワー ¥1,000万)
const defeatProp = stage === 'mall' ? { kind: 'fountain', yen: 1_500_000 } : isTower ? { kind: 'champagne', yen: 10_000_000 } : null;
// 念力の選択:シャンデリアが落ちたときの被害額(BOSS4.chandelierCost)
const CHANDELIER_YEN = 30_000_000;
const browser = await openBrowser();
const page = await openPage(browser, { dpr, height });
const { check, skip, done } = checker();
// 端末が重いと、スクリプトの1つ1つの動きの間にゲームの時計が進み、体力が時間で減りきってしまう。
// そうなったあとの確かめは、NG ではなく SKIP にする(ゲームのまちがいではないため)
const ended = async () => S(() => window.bossScene.phase === 'end');
const wait = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: `${outDir}/${stage}_${name}.png` });
const S = (fn, arg) => page.evaluate(fn, arg);
const fight = () => S(() => {
  const s = window.bossScene; const f = s.fight;
  return { taps: f.tapsCounted, hp: f.hp, hpRatio: f.hpRatio, dmg: f.damageYen, inCar: f.inCar, carMode: s.carMode, carTaps: s.carTaps, phase: s.phase, sec: f.elapsedSec };
});

await page.goto(`${base}?scene=Boss&stage=${stage}&seed=${mode === 'civ' ? 7 : 12345}&sorts=${mode === 'civ' ? 'civ' : 'truth'}`);
const tally = () => S(() => {
  const s = window.bossScene.run.stats.snapshot();
  return { villain: s.civHurtByVillain, chandelier: s.propsBroken.chandelier ?? 0, props: s.damageByProps };
});
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
    // tower:念力の選択になったら止める(出てきた待てと行けのボタンを連打の指で押さないように)
    if (isTower && (await S(() => window.bossScene.phase)) !== 'fight') return;
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
  if (isTower) {
    // 選択で何も押さなかった:客が落ちて、シャンデリアも落ちた
    const t = await tally();
    check('押さなければ客とシャンデリアが落ちる(15秒のうちに選択があった)', t.villain === 1 && t.chandelier === 1, JSON.stringify(t));
  }
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
  // (tower は、端末が重いと時間でも体力が減って、途中で念力の選択になることがある)
  check('2本の指の交互押しも数える', st.taps >= 12 || (isTower && st.phase === 'choice' && st.taps >= 6), JSON.stringify(st));

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
    const holdInfo = `乗ったのは${boardAt.toFixed(2)}s ${hold0.hp.toFixed(2)}@${hold0.sec.toFixed(2)}s -> ${hold1.hp.toFixed(2)}@${hold1.sec.toFixed(2)}s 連打${hold0.taps}->${hold1.taps}`;
    if (!inHold) skip('手前に出てくるまで体力が減らない', `押すのが1.3秒に間に合わなかった ${holdInfo}`);
    else check('手前に出てくるまで体力が減らない', hold1.taps > hold0.taps && Math.abs(hold1.hp - hold0.hp) < 1e-6, holdInfo);
    await shot('05g_boarding');
    await page.waitForFunction(() => window.bossScene.carMode === 'car', null, { timeout: 5000 }).catch(() => {});
    await shot('05h_in_car');
    check('車が手前に出てくる', (await fight()).carMode === 'car');
  }

  if (isTower) {
    // 体力が半分を切るまで押すと、念力の選択になる(客とシャンデリアが浮く)
    for (let i = 0; i < 30 && (await S(() => window.bossScene.phase)) === 'fight'; i++) await mash(1, 90);
    st = await fight();
    check('体力が半分を切ると念力の選択', st.phase === 'choice' && st.hpRatio <= 0.5 + 1e-9, JSON.stringify(st));
    await page.waitForFunction(() => window.bossScene.choiceOpen, null, { timeout: 3000 }).catch(() => {});
    check('待てと行けのボタンが出る', await S(() => window.bossScene.choiceOpen && window.bossScene.choiceStop.visible && window.bossScene.choiceGo.visible && !window.bossScene.go.visible));
    const c0 = await fight();
    await wait(600);
    const c1 = await fight();
    check('選択の間は時計が止まる', c1.sec === c0.sec && c1.hp === c0.hp, `${c0.sec.toFixed(3)}s -> ${c1.sec.toFixed(3)}s`);
    await shot('06t_choice');
    const t0 = await tally();
    const taps0 = (await fight()).taps;
    if (mode === 'nochoice') {
      // 何も押さずに3秒:客が落ちて、シャンデリアが落ちる
      await page.waitForFunction(() => !window.bossScene.choiceOpen, null, { timeout: 5000 }).catch(() => {});
      await wait(450);
      await shot('06t_chandelier_fallen');
      const t1 = await tally();
      check('押さないと客が落ちる(ワルにやられた市民+1)', t1.villain === t0.villain + 1, JSON.stringify([t0, t1]));
      check('押さないとシャンデリアが落ちる(¥3,000万)', t1.chandelier === t0.chandelier + 1 && t1.props - t0.props === CHANDELIER_YEN, JSON.stringify([t0, t1]));
    } else {
      // 待てと行けを1回ずつ押す(待ては2回押しても1回)
      const b = await S(() => { const r = (x) => ({ x: x.x + x.w / 2, y: x.y + x.h / 2 }); return { stop: r(window.bossScene.choiceStop), go: r(window.bossScene.choiceGo) }; });
      await pad.tap(b.stop.x, b.stop.y);
      await pad.tap(b.stop.x, b.stop.y);
      await wait(120);
      await pad.tap(b.go.x, b.go.y);
      await wait(200);
      await shot('06t_choice_pressed');
      const out = await S(() => window.bossScene.choice.outcome);
      check('待てと行けを押すと両方助かる', out.guestSaved && out.chandelierSaved, JSON.stringify(out));
      const t1 = await tally();
      check('両方押せば市民のけがも被害額も増えない', t1.villain === t0.villain && t1.chandelier === t0.chandelier && t1.props === t0.props, JSON.stringify([t0, t1]));
      check('選択の間の押しは連打に数えない', (await fight()).taps === taps0);
    }
    await page.waitForFunction(() => window.bossScene.phase !== 'choice', null, { timeout: 5000 }).catch(() => {});
    check('選択のあと連打に戻る', (await fight()).phase === 'fight');
    await wait(300);
    await shot('06t_back_to_mash');
  }

  // 手を止める(車の中なら¥100万ずつ、母艦の中なら¥150万ずつ、乗る前なら¥50万ずつ)
  const dmg0 = (await fight()).dmg;
  await wait(1900);
  await shot('06_idle_rampage');
  const dmg1 = (await fight()).dmg;
  const perSec = hasCar ? perSecCar : perSecFoot;
  if (await ended()) skip('止まると被害額が増える', '手を止めている間に時間で倒れた');
  else check('止まると被害額が増える', dmg1 - dmg0 >= perSec && (dmg1 - dmg0) % perSec === 0, `${dmg0} -> ${dmg1}(1秒 ${perSec})`);
  if (hasCar && await ended()) skip('車ごと殴る(車に当たった数)', 'もう倒れていた');
  else if (hasCar) {
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
  // 体力は時間でも減るので、端末が重いと少ない連打で倒れる。数は「2本の指の交互押し」で数えた12回を下限にする
  check('連打で倒した', r.phase === 'end' && r.bossDefeated && r.taps >= 12 && r.sec < 14.9, JSON.stringify(r));
  if (isTower) {
    // 選択から戻って(時計はその間止まっている)、倒れるまで最短1.5秒
    const at = await S(() => window.bossScene.fight.carBoardedAt);
    check('選択から倒れるまで1.5秒より早くない', at !== null && r.sec >= at + 1.5 - 1e-6, `選択 ${at?.toFixed(2)}s 倒した ${r.sec?.toFixed(2)}s`);
  }
  await wait(500);
  await shot('09_explosions');
  await wait(1400);
  await shot('10_winpose');
  if (isTower) { await wait(600); await shot('10t_sunrise'); }
  const ws = await S(() => { const w = window.bossScene.run.worstShot; return w ? `${w.width}x${w.height}` : null; });
  if (defeatProp) {
    const p1 = await S(() => { const s = window.bossScene.run.stats.snapshot(); return { broken: s.propsBroken, yen: s.damageByProps }; });
    // (nochoice では、その前に落ちたシャンデリアの分も物の被害額に入っている)
    const extra = mode === 'nochoice' ? CHANDELIER_YEN : 0;
    check(`倒すと ${defeatProp.kind} が壊れる`, (p1.broken[defeatProp.kind] ?? 0) === (props0.broken[defeatProp.kind] ?? 0) + 1 && p1.yen - props0.yen === defeatProp.yen + extra,
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
