// 結果発表(Street)を指で試す(担当 street 用)。中断ボタン、待て、行けを指で押して、止まるか、反応するかを見る。
// 使い方: npm run dev を動かしてから
//   node tools/street_tap.mjs [サーバーかURL] [出力フォルダ] [ステージ(alley、garage、mall、tower)] [種]
// サーバーと出力フォルダは、省くか - にすると http://localhost:5173/ と shots/(例 node tools/street_tap.mjs - - mall)
// alley :中断と再開、早送り(▶▶。合図の間はふつうの速さ)、待て(市民をワルに仕分けた人)、行け(見逃したワルへの追い打ち)
// garage:中断と再開、見逃したギャングが仲間を呼んで集まったところで行け(まとめて吹き飛ばす)、
//         ワゴンに乗りこんだところで行け(車ごと止める)
// mall  :中断と再開、見逃した宇宙人が呼んだUFOを行けで殴り落とす(¥300万と真下の物)、押さずにいると買い物客が
//         さらわれる、波2のあとのタイムセールラッシュ(帯のタップで始まり、市民にだけ待てを押す)。
//         ラッシュの前のエスカレーターが壊れないままラッシュが始まるか、ラッシュの長さ(約16秒)も見る
// tower :中断と再開、見逃したヴィランが念力で運ぶ物を、運び始めてすぐ行けで落とす(早送りでも運ぶ間はふつうの速さ)、
//         ソファの真上で行けを押して落とす(何も壊れない)、押さずにいると市民に落ちる(写真を撮る)。
//         高層ビルはまだステージを選ぶ画面にないので、開発用の入口の &stage=tower で開く(波2)
// URL に ?scene= がなければ、開発用の入口で波1から始める。NG があれば exit code 1。
import { checker, openBrowser, openPage, serverUrl, shotsDir, touchPad } from './lib.mjs';

const [urlArg, outArg, stage = 'alley', seed = stage === 'garage' ? '3' : '1'] = process.argv.slice(2);
const url = serverUrl(urlArg);
const outDir = shotsDir(outArg);
if (!['alley', 'garage', 'mall', 'tower'].includes(stage)) { console.error(`ステージは alley、garage、mall、tower のどれか(${stage})`); process.exit(2); }
const browser = await openBrowser();
const { check, fail, done } = checker();
const errors = [];

const S = (page, fn, arg) => page.evaluate(fn, arg);
/** 開発用の入口で Street を開く。sorts:truth / random / bad / civ */
async function open(sorts, wave = 1) {
  const page = await openPage(browser, { errors });
  const u = new URL(url);
  if (!u.searchParams.has('scene')) {
    u.searchParams.set('scene', 'Street');
    u.searchParams.set('wave', String(wave));
    u.searchParams.set('sorts', sorts);
    u.searchParams.set('seed', seed);
    u.searchParams.set('stage', stage);
  }
  await page.goto(u.toString());
  await page.waitForFunction(() => window.streetDev && window.streetDev.goBtn, null, { timeout: 15000 });
  return { page, pad: await touchPad(page) };
}
const btn = (page, k) => S(page, (key) => { const b = window.streetDev[key]; return { x: b.x + b.w / 2, y: b.y + b.h / 2, en: b.isEnabled }; }, k);
const stats = (page) => S(page, () => window.streetDev.stats.snapshot());

/** 中断ボタンで止まり、タップで戻る */
async function pauseCheck(page, pad) {
  await page.waitForTimeout(1500);
  await pad.tap(204, 12);
  await page.waitForTimeout(200);
  check('中断ボタンで止まる', await S(page, () => window.streetDev.scene.isPaused()));
  const x1 = await S(page, () => window.streetDev.hero.x);
  await page.waitForTimeout(1200);
  check('止まっている間ヒーローは動かない', (await S(page, () => window.streetDev.hero.x)) === x1);
  await page.screenshot({ path: `${outDir}/${stage}_tap_pause.png` });
  // 一時停止はメニュー。少し待ってから「つづける」を押す
  await page.waitForTimeout(400);
  const r = await S(page, () => { const b = window.pauseDev.resume; return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; });
  await pad.tap(r.x, r.y);
  await page.waitForTimeout(300);
  check('「つづける」で再開', !(await S(page, () => window.streetDev.scene.isPaused())));
}

if (stage === 'alley') {
  const { page, pad } = await open('random');
  await pauseCheck(page, pad);
  // 早送り(中断ボタンの2つ左)。押すと時計も動きも2倍
  await pad.tap(160, 12);
  await page.waitForTimeout(200);
  check('早送りで2倍になる', await S(page, () => window.streetDev.speed === 2 && window.streetDev.time.timeScale === 2));
  // 合図がないときの待ては暗く、押しても何も起きない
  check('合図がないとき待ては使えない', !(await btn(page, 'stopBtn')).en);
  // 合図が出るまで待って、指で待てを押す
  await page.waitForFunction(() => window.streetDev.stopHandler, null, { timeout: 40000 }).catch(() => null);
  if (await S(page, () => !!window.streetDev.stopHandler)) {
    await page.waitForTimeout(60);
    const s = await btn(page, 'stopBtn');
    check('合図が出たら待てが使える', s.en);
    check('待ての合図の間は、早送りでもふつうの速さ', await S(page, () => window.streetDev.speed === 1 && window.streetDev.time.timeScale === 1));
    const before = await stats(page);
    await page.waitForTimeout(500);
    await pad.tap(s.x, s.y);
    await page.waitForTimeout(200);
    const after = await stats(page);
    check('待てで止まる(数える)', after.civSavedByStop + after.badSparedByStop === before.civSavedByStop + before.badSparedByStop + 1);
    await page.screenshot({ path: `${outDir}/${stage}_tap_stop.png` });
  } else fail('待ての場面がない(種を変える)', `seed ${seed}`);
  // 行け
  await page.waitForFunction(() => window.streetDev.goHandler, null, { timeout: 40000 }).catch(() => null);
  if (await S(page, () => !!window.streetDev.goHandler)) {
    const g = await btn(page, 'goBtn');
    const before = (await stats(page)).defeatedByGo;
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${outDir}/${stage}_tap_gomark.png` });
    await pad.tap(g.x, g.y);
    await page.waitForTimeout(2500);
    check('行けで追い打ち', (await stats(page)).defeatedByGo === before + 1);
    await page.screenshot({ path: `${outDir}/${stage}_tap_go.png` });
  } else fail('行けの場面がない(種を変える)', `seed ${seed}`);
} else if (stage === 'mall') {
  // 1. UFOが買い物客を吸い上げているところで行け → 殴り落とす(全員を市民に仕分けて、宇宙人を見逃す)
  {
    const { page, pad } = await open('civ');
    await pauseCheck(page, pad);
    const beam = await page.waitForFunction(() => window.streetDev.ufoPart.ufos.current?.phase === 'beam' && window.streetDev.goHandler, null, { timeout: 40000 })
      .then(() => true, () => false);
    if (check('見逃した宇宙人がUFOを呼び、買い物客を吸い上げる', beam)) {
      const before = await stats(page);
      const g = await btn(page, 'goBtn');
      check('吸い上げている間は行けが使える', g.en && await S(page, () => window.streetDev.ufoPart.ufos.current.markOn));
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${outDir}/${stage}_tap_beam.png` });
      await S(page, () => { window.__shopper = window.streetDev.ufoPart.ufo.shopper; });
      await pad.tap(g.x, g.y);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${outDir}/${stage}_tap_ufodown.png` });
      // 助かった買い物客は、立ち去るまで巻きぞえや悪さの相手にしない。落ちたUFOと重ならないように横へよける
      check('助かった買い物客は巻きぞえの相手から外れる', await S(page, () => !window.streetDev.passers.includes(window.__shopper) && window.streetDev.safeWalkers.includes(window.__shopper)));
      const gap = await S(page, () => { const d = window.streetDev; const w = d.props.find((p) => p.kind === 'ufo'); return w ? Math.abs(window.__shopper.x - w.x) : null; });
      check('買い物客は落ちたUFOと重ならない', gap !== null && gap >= 44, `UFOとの間 ${gap}`);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${outDir}/${stage}_tap_ufolanded.png` });
      const after = await stats(page);
      check('行けでUFOを殴り落とす(宇宙人も倒れる)', after.ufosDowned === before.ufosDowned + 1 && after.defeatedByUfo === before.defeatedByUfo + 1 && after.defeatedByGo === before.defeatedByGo + 1,
        `落とした ${before.ufosDowned}->${after.ufosDowned}`);
      // UFOの¥300万(真下に物があれば、その物の額も足す)
      check('UFOの¥300万(と真下の物)', after.damage - before.damage >= 3_000_000, `被害額 ${before.damage}->${after.damage}`);
      check('買い物客はさらわれない', after.civHurtByAbduction === before.civHurtByAbduction && after.escapedByUfo === before.escapedByUfo);
    }
    await page.close();
  }
  // 2. 押さずにいると、買い物客と宇宙人を乗せて去る
  {
    const { page } = await open('civ');
    const beam = await page.waitForFunction(() => window.streetDev.ufoPart.ufos.current?.phase === 'beam', null, { timeout: 40000 }).then(() => true, () => false);
    if (check('UFOが来る', beam)) {
      const before = await stats(page);
      await page.waitForFunction(() => window.streetDev.ufoPart.ufos.current?.phase === 'leave', null, { timeout: 8000 }).catch(() => null);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${outDir}/${stage}_tap_abduct.png` });
      const gone = await page.waitForFunction(() => !window.streetDev.ufoPart.ufo, null, { timeout: 8000 }).then(() => true, () => false);
      const after = await stats(page);
      check('押さないと、買い物客がさらわれる', gone && after.civHurtByAbduction === before.civHurtByAbduction + 1 && after.escapedByUfo === before.escapedByUfo + 1,
        `さらわれた ${before.civHurtByAbduction}->${after.civHurtByAbduction}`);
      check('さらわれた場面を撮る', await S(page, () => !!window.streetDev.run.worstShot && window.streetDev.stats.snapshot().worstScene === 'abducted'));
    }
    await page.close();
  }
  // 3. 波2のあとのタイムセールラッシュ。帯が出て止まり、タップで始まる。市民にだけ待てを押す
  {
    const { page, pad } = await open('truth', 2);
    const band = await page.waitForFunction(() => window.streetDev.rushPart.rushOn && window.streetDev.cut && !window.streetDev.rushPart.rushRunning, null, { timeout: 60000 })
      .then(() => true, () => false);
    if (check('ラッシュの帯が出る', band)) {
      // ヒーローの後ろのエスカレーターは、壊れないままラッシュが始まる(ラッシュが終わるまで、どの攻撃でも壊れない)
      const esc = await S(page, () => {
        const d = window.streetDev;
        const g = d.rushPart.rushGuard;
        if (!g) return null;
        const before = g.broken;
        d.breakProp(g);
        return { kind: g.kind, dx: g.x - d.hero.x, before, after: g.broken, listed: d.visibleProps().includes(g), frame: g.sprite.frame.name };
      });
      check('エスカレーターが壊れないままラッシュが始まる', esc && esc.kind === 'escalator' && !esc.before && Math.abs(esc.dx) < 30 && String(esc.frame) === '0', JSON.stringify(esc));
      check('ラッシュの前のエスカレーターは攻撃で壊れない(攻撃の当たる物から外れる)', esc && !esc.after && !esc.listed, JSON.stringify(esc));
      await page.screenshot({ path: `${outDir}/${stage}_tap_rushescalator.png` });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${outDir}/${stage}_tap_rushband.png` });
      check('帯の間は始まらない', !(await S(page, () => window.streetDev.rushPart.rushRunning)));
      // 帯の間は、そのときに動いていた tween と時計の出来事も止まっている(カットインの文字送りは動く)
      const held = await S(page, () => { const d = window.streetDev; return { t: d.rushPart.rushHeldTweens.length, e: d.rushPart.rushHeldEvents.length,
        ok: d.rushPart.rushHeldTweens.every((t) => t.isPaused() || t.isDestroyed()) && d.rushPart.rushHeldEvents.every((e) => e.paused), typing: d.cut.visible }; });
      check('帯の間は動きと時計が止まる', held.ok && held.typing, JSON.stringify(held));
      // 説明のカットインを送り、▼タップで始める
      for (let i = 0; i < 8 && !(await S(page, () => window.streetDev.rushPart.rushRunning)); i++) { await pad.tap(108, 110); await page.waitForTimeout(700); }
      check('タップで始まる', await S(page, () => window.streetDev.rushPart.rushRunning));
      let stops = 0, shot = false;
      const shotMen = new Set();
      const t0 = Date.now();
      while (Date.now() - t0 < 40000 && await S(page, () => window.streetDev.rushPart.rushOn)) {
        const m = await S(page, () => {
          const d = window.streetDev;
          const k = d.rushPart.rushMen.find((x) => x.state === 'mark');
          return d.stopHandler && k ? { civ: k.r.truth === 'civ', i: k.r.index } : null;
        });
        // 最初と最後の人のマークを撮る
        if (m && (m.i === 0 || m.i === 7) && !shotMen.has(m.i)) {
          shotMen.add(m.i);
          await page.screenshot({ path: `${outDir}/${stage}_tap_rush${m.i === 0 ? 'first' : 'last'}.png` });
        }
        if (m && m.civ) {
          const s = await btn(page, 'stopBtn');
          await pad.tap(s.x, s.y); stops++;
          if (!shot) { await page.waitForTimeout(150); await page.screenshot({ path: `${outDir}/${stage}_tap_rushstop.png` }); shot = true; }
        } else if (m && !shot) {
          await page.screenshot({ path: `${outDir}/${stage}_tap_rushmark.png` });
        }
        await page.waitForTimeout(60);
      }
      const r = (await stats(page)).rush;
      check('ラッシュが終わる', !(await S(page, () => window.streetDev.rushPart.rushOn)), JSON.stringify(r));
      // ラッシュの時計(一時停止とヒットストップの間は進まない)で、始まってから終わるまで。仕様は8人で約16秒
      const len = await S(page, () => window.streetDev.rushPart.rushSec);
      check('ラッシュの長さは約16秒', len >= 14.8 && len <= 16.8, `${len.toFixed(2)}秒`);
      check('ラッシュが終わったら、エスカレーターは守らない', await S(page, () => window.streetDev.rushPart.rushGuard === null));
      check('市民は全員待てで守り、宇宙人は全員殴る', r && r.civsSaved === r.civs && r.civsHit === 0 && r.aliensDefeated === r.aliens && r.aliens + r.civs === 8,
        `待て${stops}回 ${JSON.stringify(r)}`);
    }
    await page.close();
  }
} else if (stage === 'tower') {
  // 念力の場面を待つ(全員を市民に仕分けて、ヴィランを見逃す)。運んでいる物の並べ方を返す
  const carry = (page) => page.waitForFunction(() => window.streetDev.psyPart.psys.current?.phase === 'carry' && window.streetDev.goHandler, null, { timeout: 40000 })
    .then(() => S(page, () => { const u = window.streetDev.psyPart.psy; return { plan: u.plan, kind: u.lifted.kind }; }), () => null);
  const progress = (page) => S(page, () => window.streetDev.psyPart.psys.current?.progress ?? 1);
  // 1. 運び始めてすぐ行け → ヴィランを倒し、物はその場の真下(床か、すぐ先の物)に落ちる。早送りでも運ぶ間はふつうの速さ
  {
    const { page, pad } = await open('civ', 2);
    await pauseCheck(page, pad);
    await pad.tap(160, 12);
    await page.waitForFunction(() => window.streetDev.psyPart.psys.current?.phase === 'raise', null, { timeout: 40000 }).catch(() => null);
    check('早送りなら、持ち上げるまでは2倍', await S(page, () => window.streetDev.speed === 2));
    const c = await carry(page);
    if (check('見逃したヴィランが物を持ち上げて運ぶ', !!c)) {
      await page.waitForTimeout(60);
      const g = await btn(page, 'goBtn');
      check('運んでいる間は行けが使える(行けのマーク)', g.en && await S(page, () => window.streetDev.psyPart.psys.current.markOn && !!window.streetDev.psyPart.psy.mark));
      check('運んでいる間は早送りでもふつうの速さ', await S(page, () => window.streetDev.speed === 1 && window.streetDev.time.timeScale === 1));
      check('持ち上げた物に紫のふちともや', await S(page, () => { const u = window.streetDev.psyPart.psy; return !!u.outline?.visible && !!u.haze?.visible && u.sparks.length > 0; }));
      await page.screenshot({ path: `${outDir}/${stage}_tap_carry.png` });
      const before = await stats(page);
      const at = await progress(page);
      await pad.tap(g.x, g.y);
      await page.waitForTimeout(2200);
      await page.screenshot({ path: `${outDir}/${stage}_tap_goearly.png` });
      const after = await stats(page);
      check('行けでヴィランを倒す', after.defeatedByPsy === before.defeatedByPsy + 1 && after.defeatedByGo === before.defeatedByGo + 1, `進み ${at.toFixed(2)}`);
      check('早く押せば市民に当たらない', after.civHurt === before.civHurt && after.escapedByPsy === before.escapedByPsy);
      check('物が壊れる(床か、すぐ先の物に落ちた)', after.damage > before.damage, `被害額 ${before.damage}->${after.damage} ${c.kind}`);
    }
    await pad.tap(160, 12);
    await page.close();
  }
  // 2. ソファの真上で行け → 何も壊れない(ソファで受けた数に入る)
  {
    const { page, pad } = await open('civ', 2);
    const c = await carry(page);
    if (check('念力が来る', !!c)) {
      const sofa = c.plan.floor.find((f) => f.kind === 'sofa');
      const span = c.plan.victimX - c.plan.lift.x;
      const t = (sofa.x - c.plan.lift.x) / span - 0.02;
      await page.waitForFunction((v) => (window.streetDev.psyPart.psys.current?.progress ?? 1) >= v, t, { timeout: 8000, polling: 'raf' });
      const before = await stats(page);
      const g = await btn(page, 'goBtn');
      await pad.tap(g.x, g.y);
      await page.waitForTimeout(1100);
      await page.screenshot({ path: `${outDir}/${stage}_tap_sofa.png` });
      await page.waitForTimeout(1200);
      const after = await stats(page);
      check('ソファの上で落とすと何も壊れない', after.sofaSaves === before.sofaSaves + 1 && after.damage === before.damage && after.defeatedByPsy === before.defeatedByPsy + 1,
        `ソファ ${before.sofaSaves}->${after.sofaSaves} 被害額 ${before.damage}->${after.damage}`);
      check('ソファは壊れない', await S(page, () => window.streetDev.props.filter((p) => p.kind === 'sofa').every((p) => !p.broken && String(p.sprite.frame.name) === '1')));
    }
    await page.close();
  }
  // 3. 押さずにいると、物が市民に落ちる。市民のけが、ヴィランは逃げる。写真を撮る
  {
    const { page } = await open('civ', 2);
    const c = await carry(page);
    if (check('念力が来る', !!c)) {
      const before = await stats(page);
      await page.waitForFunction(() => window.streetDev.psyPart.psys.current?.phase === 'fall', null, { timeout: 8000 }).catch(() => null);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${outDir}/${stage}_tap_hit.png` });
      const gone = await page.waitForFunction(() => !window.streetDev.psyPart.psy && window.streetDev.psyPart.psys.idle, null, { timeout: 8000 }).then(() => true, () => false);
      await page.waitForTimeout(300);
      const after = await stats(page);
      check('押さないと市民に物が落ちる', gone && after.civHurtByDrop === before.civHurtByDrop + 1 && after.escapedByPsy === before.escapedByPsy + 1,
        `物が落ちた ${before.civHurtByDrop}->${after.civHurtByDrop}`);
      check('物は壊れない', after.damage === before.damage);
      check('市民に落ちた場面を撮る', await S(page, () => !!window.streetDev.run.worstShot && window.streetDev.stats.snapshot().worstScene === 'dropped'));
    }
    await page.close();
  }
} else {
  // 1. 集まったところで行け → まとめて吹き飛ばす(全員を市民に仕分けて、ギャングを見逃す)
  {
    const { page, pad } = await open('civ');
    await pauseCheck(page, pad);
    const gathered = await page.waitForFunction(() => window.streetDev.gangPart.gang?.call.phase === 'wait' && window.streetDev.goHandler, null, { timeout: 40000 })
      .then(() => true, () => false);
    if (check('見逃したギャングが仲間を呼んで集まる', gathered)) {
      const size = await S(page, () => window.streetDev.gangPart.gang.call.size);
      const before = await stats(page);
      const g = await btn(page, 'goBtn');
      check('集まったら行けが使える', g.en);
      await page.screenshot({ path: `${outDir}/${stage}_tap_gathered.png` });
      await pad.tap(g.x, g.y);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${outDir}/${stage}_tap_wipe.png` });
      const after = await stats(page);
      check('行けでまとめて吹き飛ばす', after.groupsWiped === before.groupsWiped + (size >= 2 ? 1 : 0) && after.defeatedByWipe === before.defeatedByWipe + size,
        `組${size}人 撃破 ${before.defeated}->${after.defeated}`);
      check('ワゴンは壊れない', after.vansStopped === before.vansStopped);
    }
    await page.close();
  }
  // 2. ワゴンに乗りこんだところで行け → 車ごと止める
  {
    const { page, pad } = await open('civ');
    const boarding = await page.waitForFunction(() => ['board', 'drive'].includes(window.streetDev.gangPart.gang?.call.phase) && window.streetDev.goHandler, null, { timeout: 45000 })
      .then(() => true, () => false);
    if (check('押さずにいると、組がワゴンに乗りこむ', boarding)) {
      const size = await S(page, () => window.streetDev.gangPart.gang.call.size);
      const before = await stats(page);
      const g = await btn(page, 'goBtn');
      await page.screenshot({ path: `${outDir}/${stage}_tap_board.png` });
      await pad.tap(g.x, g.y);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${outDir}/${stage}_tap_vanstop.png` });
      const after = await stats(page);
      check('行けで車ごと止める', after.vansStopped === before.vansStopped + 1 && after.defeatedByVan === before.defeatedByVan + size,
        `組${size}人 被害額 ${before.damage}->${after.damage}`);
      check('ワゴンの¥500万', after.damage - before.damage === 5_000_000);
      check('逃がしていない', after.escaped === before.escaped);
    }
    await page.close();
  }
}
check('エラーが出ない', errors.length === 0, errors.join('\n'));
await browser.close();
done();
