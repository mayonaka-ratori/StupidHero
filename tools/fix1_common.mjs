import { chromium } from 'playwright-core';
export const URL0 = 'http://localhost:5401/';
export const OUT = '/tmp/claude-0/-home-user-StupidHero/18380230-65da-565b-b5dd-553fae3cc8ac/scratchpad/fix1';
export async function open(q = '') {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push('console.' + m.type() + ': ' + m.text()); });
  await page.goto(URL0 + q);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).some(s => s.scene.key !== 'Boot'), null, { timeout: 30000 });
  const H = await page.evaluate(() => window.__game.config.height * 216 / window.__game.config.width);
  const tap = async (x, y) => {
    const r = await page.evaluate(() => { const b = window.__game.canvas.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
    await page.touchscreen.tap(r.l + (x * r.w) / 216, r.t + (y * r.h) / H);
  };
  const active = () => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));
  const top = async () => { const k = (await active()).filter(k => !k.startsWith('Ui')); return k[k.length - 1] ?? ''; };
  const hide = (h) => page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { get: () => h, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => h ? 'hidden' : 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, h);
  return { browser, page, errors, H, tap, active, top, hide };
}
