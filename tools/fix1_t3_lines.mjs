// 市民を殴ったとき、オペレーターの欄に何が出ているか
import { open, OUT } from './fix1_common.mjs';
const seed = process.argv[2] ?? '5';
const sorts = process.argv[3] ?? 'bad';
const { browser, page, errors, top } = await open(`?scene=Street&wave=1&sorts=${sorts}&seed=${seed}`);
await page.waitForFunction(() => window.streetDev && window.streetDev.cut, null, { timeout: 20000 });
await page.evaluate(() => {
  const s = window.streetDev; window.__log = [];
  const t0 = performance.now();
  const T = () => Math.round(performance.now() - t0);
  const hs = s.heroSay.bind(s);
  s.heroSay = (sp, ms) => { const tx = typeof sp === 'string' ? sp : sp.text; window.__log.push(`${T()} HERO「${tx.replace(/\n/g,'')}」  op欄=「${s.cut.line.text.replace(/\n/g,'')}」`); return hs(sp, ms); };
  const os = s.opSay.bind(s);
  s.opSay = (sp, a) => { window.__log.push(`${T()} OP 「${sp.text.replace(/\n/g,'')}」`); return os(sp, a); };
  const ht = s.hitTarget.bind(s);
  s.hitTarget = (t, k, mode) => { window.__log.push(`${T()} HIT mode=${mode} civ=${t.civ} look=${t.look}`); if (mode==='civ') window.__shotNow = true; return ht(t, k, mode); };
});
let shot = 0;
for (let i = 0; i < 120; i++) {
  await page.waitForTimeout(250);
  const f = await page.evaluate(() => { const v = window.__shotNow; window.__shotNow = false; return v; });
  if (f && shot < 3) { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/t3_civhit_${seed}_${shot++}.png` }); }
  if ((await top()) !== 'Street') break;
}
console.log((await page.evaluate(() => window.__log)).join('\n'));
console.log(errors.filter(e => !e.includes('WebGL') && !e.includes('GPU stall')).join('\n') || 'no errors');
await browser.close();
