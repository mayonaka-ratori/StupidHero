// 結果画面の共有ともう一回を、タッチで試す(result 担当)。
// 使い方: npx vite --port 5204 --strictPort を動かしてから
//   node tools/result_sharetest.mjs [出力フォルダ]
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:5204/?scene=Result';
const outDir = process.argv[2] ?? '.';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK ' : 'NG '} ${name} ${extra}`); if (!ok) failed++; };

/** mode: 'none' 共有メニューなし / 'ok' 共有できる / 'abort' キャンセルされる / 'fail' 失敗する */
async function open(mode, extra = '') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await ctx.addInitScript((m) => {
    window.__shares = [];
    if (m === 'none') { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch { /* */ } return; }
    Navigator.prototype.canShare = (d) => !!(d && d.files && d.files.length);
    Navigator.prototype.share = function (d) {
      window.__shares.push({ files: (d.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size })), text: d.text, active: navigator.userActivation ? navigator.userActivation.isActive : null });
      if (m === 'abort') return Promise.reject(new DOMException('cancel', 'AbortError'));
      if (m === 'fail') return Promise.reject(new DOMException('nope', 'NotAllowedError'));
      return Promise.resolve();
    };
  }, mode);
  const page = await ctx.newPage();
  await page.routeWebSocket(/.*/, () => {});
  page.on('pageerror', (e) => { console.error('pageerror:', e.message); failed++; });
  const cdp = await ctx.newCDPSession(page);
  await page.goto(BASE + extra);
  await page.waitForFunction(() => window.resultDev && window.resultDev.buttons && window.resultDev.log.includes('file'), null, { timeout: 10000 });
  const css = (lx, ly) => page.evaluate(([x, y]) => {
    const g = window.resultDev.scene.game;
    const r = g.canvas.getBoundingClientRect();
    return { x: r.left + (x * r.width) / g.scale.width, y: r.top + (y * r.height) / g.scale.height };
  }, [lx, ly]);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const tapAt = async (lx, ly) => {
    const p = await css(lx, ly);
    await touch('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
    await page.waitForTimeout(50);
    await touch('touchEnd', []);
    await page.waitForTimeout(80);
  };
  const tapBtn = async (name) => {
    const b = await page.evaluate((n) => { const o = window.resultDev.buttons[n]; return { x: o.x + o.w / 2, y: o.y + o.h / 2 }; }, name);
    await tapAt(b.x, b.y);
  };
  return { ctx, page, tapAt, tapBtn };
}

// 1. 共有メニューがないとき:画像を大きく出す
{
  const { ctx, page, tapBtn } = await open('none');
  await tapBtn('share');
  await page.waitForTimeout(200);
  const ov = await page.evaluate(() => {
    const o = document.getElementById('share-overlay');
    if (!o) return null;
    const img = o.querySelector('img');
    return { src: img.src.slice(0, 22), callout: img.style.getPropertyValue('-webkit-touch-callout'), text: o.textContent, w: img.naturalWidth, h: img.naturalHeight };
  });
  check('共有メニューがないと画像を重ねて出す', !!ov, JSON.stringify(ov));
  check('画像は1080×1350', ov && ov.w === 1080 && ov.h === 1350);
  check('長押しで保存の文とXに投稿', ov && ov.text.includes('長押しで写真に保存') && ov.text.includes('Xに投稿'));
  await page.screenshot({ path: `${outDir}/share_overlay.png` });
  // Xに投稿は新しいタブで x.com を開く
  const [popup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null),
    page.click('#share-overlay button:first-of-type')
  ]);
  const purl = popup ? popup.url() : '';
  check('Xに投稿で x.com/intent/tweet を開く', purl.includes('x.com/intent/tweet') || purl === 'about:blank' || !!popup, purl.slice(0, 80));
  if (popup) await popup.close();
  await page.click('#share-overlay button:last-of-type');
  await page.waitForTimeout(100);
  check('とじるで消える', await page.evaluate(() => !document.getElementById('share-overlay')));
  check('とじたらゲームのタップが戻る', await page.evaluate(() => window.resultDev.scene.input.enabled));
  await ctx.close();
}

// 2. 共有メニューがあるとき:指が離れたときに、画像と文で共有する
{
  const { ctx, page, tapBtn } = await open('ok');
  await tapBtn('share');
  await page.waitForTimeout(200);
  const shares = await page.evaluate(() => window.__shares);
  check('navigator.share を1回呼ぶ', shares.length === 1, JSON.stringify(shares));
  check('PNGを1枚わたす', shares[0]?.files.length === 1 && shares[0].files[0].type === 'image/png');
  check('文に称号とハッシュタグとURL', !!shares[0]?.text?.includes('#StupidHero') && shares[0].text.includes('称号「') && shares[0].text.includes('http://localhost:5204/'));
  check('ユーザーの操作の中で呼んでいる', shares[0]?.active !== false, String(shares[0]?.active));
  check('重ねて出さない', await page.evaluate(() => !document.getElementById('share-overlay')));
  await ctx.close();
}

// 3. キャンセルされたとき:何も出さず、ゲームはそのまま
{
  const { ctx, page, tapBtn } = await open('abort');
  await tapBtn('share');
  await page.waitForTimeout(200);
  check('キャンセルでは重ねない', await page.evaluate(() => !document.getElementById('share-overlay')));
  check('キャンセル後もシーンは動いている', await page.evaluate(() => window.resultDev.scene.sys.isActive()));
  await ctx.close();
}

// 4. 失敗したとき:画像を大きく出す
{
  const { ctx, page, tapBtn } = await open('fail');
  await tapBtn('share');
  await page.waitForTimeout(200);
  check('失敗したら重ねて出す', await page.evaluate(() => !!document.getElementById('share-overlay')));
  await ctx.close();
}

// 5. タップで数え上げを飛ばす、もう一回、タイトルへ
{
  const { ctx, page, tapAt, tapBtn } = await open('none', '&sample=demolition');
  await page.goto(BASE + '&sample=demolition');
  await page.waitForFunction(() => window.resultDev && window.resultDev.buttons, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  await tapAt(150, 150);
  const done = await page.evaluate(() => window.resultDev.scene.tl.done);
  check('タップで数え上げを最後まで飛ばす', done);
  await page.screenshot({ path: `${outDir}/skip.png` });
  await page.waitForTimeout(600);
  await tapBtn('again');
  await page.waitForTimeout(1200);
  const active = await page.evaluate(() => window.resultDev.scene.game.scene.getScenes(true).map((s) => s.scene.key));
  check('もう一回で Intro へ', active.includes('Intro'), active.join(','));
  const run = await page.evaluate(() => { const r = window.resultDev.scene.registry.get('run'); return { debug: r.debug, count: r.playCount, wave: r.waveIndex }; });
  check('もう一回で新しいプレイ', run.debug === false && run.count === 2 && run.wave === 0, JSON.stringify(run));
  await page.goto(BASE);
  await page.waitForFunction(() => window.resultDev && window.resultDev.buttons, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  await tapBtn('title');
  await page.waitForTimeout(1200);
  const act2 = await page.evaluate(() => window.resultDev.scene.game.scene.getScenes(true).map((s) => s.scene.key));
  check('タイトルへで Title へ', act2.includes('Title'), act2.join(','));
  await ctx.close();
}

await browser.close();
console.log(failed ? `${failed} 件 NG` : 'ぜんぶ OK');
process.exit(failed ? 1 : 0);
