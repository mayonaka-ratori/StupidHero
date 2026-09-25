// 結果画面の共有ともう一回を、タッチで試す(result 担当)。
// 使い方: npm run dev を動かしてから
//   node tools/result_sharetest.mjs [出力フォルダ] [サーバー] [ステージ(alley、garage、mall、tower。free ならフリープレイの結果画面)]
// 出力フォルダとサーバーは、省くか - にすると shots/ と http://localhost:5173/
// NG があれば exit code 1。
import { checker, mobileContext, openBrowser, openPage, serverUrl, shotsDir, touchPad } from './lib.mjs';

const outDir = shotsDir(process.argv[2]);
const server = serverUrl(process.argv[3]);
const stage = process.argv[4] ?? 'alley';
const free = stage === 'free';
const BASE = free ? `${server}?scene=Result&free=1` : `${server}?scene=Result&stage=${stage}`;
/** 数え上げを飛ばす試しで使う見本(フリープレイは「なすがまま」) */
const SKIP_SAMPLE = free ? '&sample=letitbe' : '&sample=demolition';
const browser = await openBrowser();
const { check, done } = checker();
const errors = [];

/** mode: 'none' 共有メニューなし / 'ok' 共有できる / 'abort' キャンセルされる / 'fail' 失敗する */
async function open(mode, extra = '') {
  const ctx = await mobileContext(browser);
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
  const page = await openPage(ctx, { errors });
  await page.goto(BASE + extra);
  await page.waitForFunction(() => window.resultDev && window.resultDev.buttons && window.resultDev.log.includes('file'), null, { timeout: 10000 });
  const pad = await touchPad(page);
  const tapAt = (lx, ly) => pad.tap(lx, ly, 50);
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
  check('保存のしかたの文(指の端末は長押し)とXに投稿と画像を保存', ov && ov.text.includes('長押しで写真に保存') && ov.text.includes('Xに投稿') && ov.text.includes('画像を保存'));
  // 画像を保存は PNG をダウンロードする
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
    page.click('#share-save')
  ]);
  check('画像を保存で PNG をダウンロード', !!dl && dl.suggestedFilename() === 'stupid-hero.png', dl ? dl.suggestedFilename() : 'なし');
  await page.screenshot({ path: `${outDir}/${stage}_share_overlay.png` });
  // Xに投稿は新しいタブで x.com を開く
  const [popup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null),
    page.click('#share-x')
  ]);
  const purl = popup ? popup.url() : '';
  check('Xに投稿で x.com/intent/tweet を開く', purl.includes('x.com/intent/tweet') || purl === 'about:blank' || !!popup, purl.slice(0, 80));
  if (popup) await popup.close();
  await page.click('#share-close');
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
  const lines = shares[0]?.text?.split('\n') ?? [];
  check('文は見出し、ハッシュタグ、URLの3行だけ', lines.length === 3 && lines[1] === '#StupidHero' && lines[2] === server, JSON.stringify(lines));
  check('文に数字や称号の数を入れない', !/\d+\/\d+|撃破|負傷|被害額/.test(lines[0] ?? ''), lines[0]);
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
  const { ctx, page, tapAt, tapBtn } = await open('none', SKIP_SAMPLE);
  await page.goto(BASE + SKIP_SAMPLE);
  await page.waitForFunction(() => window.resultDev && window.resultDev.buttons, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  await tapAt(150, 150);
  const done = await page.evaluate(() => window.resultDev.scene.tl.done);
  check('タップで数え上げを最後まで飛ばす', done);
  await page.screenshot({ path: `${outDir}/${stage}_skip.png` });
  await page.waitForTimeout(600);
  await tapBtn('again');
  await page.waitForTimeout(1200);
  // 端末が重いとワイプが遅れるので、次の場面が動き出すまで少し待つ
  await page.waitForFunction(() => window.resultDev.scene.game.scene.getScenes(true).some((s) => ['Intro', 'Sort', 'Street'].includes(s.scene.key)), null, { timeout: 10000 }).catch(() => {});
  const active = await page.evaluate(() => window.resultDev.scene.game.scene.getScenes(true).map((s) => s.scene.key));
  const run = await page.evaluate(() => { const r = window.resultDev.scene.registry.get('run'); return { debug: r.debug, sorted: Object.keys(r.sorts).length, wave: r.waveIndex, stage: r.stage.id, mode: r.mode, clockMs: r.free?.clockMs ?? null }; });
  if (free) {
    // フリープレイは、掛け合いを出さずに Street(波1)へ
    check('もう一回で Street へ', active.includes('Street') && !active.includes('Intro'), active.join(','));
    check('もう一回でフリープレイの新しいプレイ', run.debug === false && run.wave === 0 && run.mode === 'free' && run.clockMs !== null && run.clockMs < 3000, JSON.stringify(run));
  } else {
    // 掛け合いを見たことがあれば、Intro を通らずに仕分けへ直行する
    check('もう一回で Intro か仕分けへ', active.includes('Intro') || active.includes('Sort'), active.join(','));
    check('もう一回で同じステージの新しいプレイ', run.debug === false && run.sorted === 0 && run.wave === 0 && run.stage === stage, JSON.stringify(run));
  }
  await page.goto(BASE);
  await page.waitForFunction(() => window.resultDev && window.resultDev.buttons, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  await tapBtn('title');
  await page.waitForTimeout(1200);
  const act2 = await page.evaluate(() => window.resultDev.scene.game.scene.getScenes(true).map((s) => s.scene.key));
  check('タイトルへで Title へ', act2.includes('Title'), act2.join(','));
  await ctx.close();
}

// 6. パソコン(指でない、共有メニューなし):保存のしかたは「右クリックか長押しで保存」
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch { /* */ } });
  const page = await openPage(ctx, { errors });
  await page.goto(BASE);
  await page.waitForFunction(() => window.resultDev && window.resultDev.buttons && window.resultDev.log.includes('file'), null, { timeout: 10000 });
  const pad = await touchPad(page);
  const b = await page.evaluate(() => { const o = window.resultDev.buttons.share; return { x: o.x + o.w / 2, y: o.y + o.h / 2 }; });
  const p = await pad.css(b.x, b.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(200);
  const txt = await page.evaluate(() => document.getElementById('share-overlay')?.textContent ?? '');
  check('パソコンでは「右クリックか長押しで保存」と画像を保存', txt.includes('右クリックか長押しで保存') && txt.includes('画像を保存'), txt.slice(0, 60));
  await page.screenshot({ path: `${outDir}/${stage}_share_overlay_pc.png` });
  await ctx.close();
}

check('エラーが出ない', errors.length === 0, errors.join('\n'));
await browser.close();
done();
