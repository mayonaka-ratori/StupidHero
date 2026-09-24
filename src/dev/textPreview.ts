// 文字の確かめ用の開発ページ(/dev/text.html)。ゲームには入らない。
// ゲームで出る文(content.ts の allTexts() と、シーンや部品に直接書かれた文字)を PixelText で並べて描く。
// フリープレイの共有の文(share.ts の freeShareTexts() の見出しと、ルールの言い方)と、結果画面のいちばん下の1行の例も入れる
// (ルールの札の文は allTexts() に入っている。「『…』で」は字を読みこむための切れはしなので、禁則を見ないように外す)。
// ?set=texts  文を並べる(ふつう)。?size=10|12|16(ふつう12) ?wrap=152(折り返す幅。0で折り返さない)
//             ?from=0&count=40 で一部だけ。?cols=2 で列の数
// ?set=chars  使われている字をすべて1字ずつ並べる(字の形を見る)。?size= で大きさ
// ?set=focus  つぶれやすい字と記号を 10、12、16 で並べる
// ?set=check  全部の文を、ゲームで使う折り返しの幅(88、117、152、160、186)と 10、12、16 で折り返して、禁則のまちがいだけを並べる
// ?zoom=3     拡大の倍率
// 行の頭に来てはいけない字が行の頭に来ていないか(禁則)を数えて、上に出す。window.textDev から中身を見られる。
import '@fontsource/dotgothic16';
import Phaser from 'phaser';
import { UI } from '../config';
import { allTexts } from '../logic/content';
import { FREE_ITEMS } from '../logic/freeNames';
import { freeShareTexts, heroAccuracyText, ruleQuote } from '../logic/share';
import type { FreeRule } from '../logic/types';
import { FS, PixelText, preloadFont, stripMarkup } from '../ui';

const params = new URLSearchParams(location.search);
const num = (k: string, d: number): number => {
  const v = Number(params.get(k));
  return params.has(k) && Number.isFinite(v) ? v : d;
};
const set = params.get('set') ?? 'texts';
const size = num('size', FS.body);
const wrap = num('wrap', 152);
const zoom = num('zoom', 3);
const cols = num('cols', 2);
const COL_W = 216;

// シーンと部品に直接書かれた文字を、ソースから取り出す
const sources = import.meta.glob(['../scenes/**/*.ts', '../ui/*.ts', '../run.ts', '!../ui/text.ts', '!../**/*.test.ts'],
  { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** 日本語(かな、漢字、全角の記号)を含む文字列の書き方を取り出す */
function literalsOf(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');
  const out: string[] = [];
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    let s = m[1] ?? m[2] ?? m[3] ?? '';
    if (!/[　-鿿＀-￯]/.test(s)) continue;
    if (m[3] !== undefined) s = s.replace(/\$\{[^}]*\}/g, '3');
    s = s.replace(/\\n/g, '\n').replace(/\\(.)/g, '$1');
    out.push(s);
  }
  return out;
}

const sceneTexts: { file: string; text: string }[] = [];
for (const [file, src] of Object.entries(sources)) {
  for (const text of literalsOf(src)) sceneTexts.push({ file: file.replace(/^\.\.\//, ''), text });
}
const freeRules: FreeRule[] = [{ kind: 'allBad' }, { kind: 'allCiv' }, ...FREE_ITEMS.map((item): FreeRule => ({ kind: 'item', item }))];
const freeTexts = [
  ...freeShareTexts().filter((t) => !t.endsWith('』で') && !t.includes('ヒーローだけなら人')), ...freeRules.map(ruleQuote),
  heroAccuracyText({ heroRight: 10, fixedRight: 25, units: 27 })
];
const contentTexts = [...allTexts(), ...freeTexts];
const all: { from: string; text: string }[] = [
  ...contentTexts.map((text) => ({ from: 'content', text })),
  ...sceneTexts.map((t) => ({ from: t.file, text: t.text }))
];
// 同じ文は1つにまとめる
const seen = new Set<string>();
const texts = all.filter((t) => (seen.has(t.text) ? false : (seen.add(t.text), true)));
const uniqueChars = Array.from(new Set(Array.from(stripMarkup(texts.map((t) => t.text).join('')))))
  .filter((c) => c.trim() !== '').sort();

// ！=! ？=? 、=、 。=。 …=… ー=ー 〜=〜 ～=~
const FOCUS_SYMBOLS = '！？、。…ー〜～「」（）・!?';
const FOCUS_KANJI = '撃額謝警襲難験職議響鑑繁驚識騒贈露機曜護讐欄劇願';

// 禁則の確かめ(text.ts と同じ考え方で、ここでは別に書く)
const NO_START = new Set(Array.from('、。，．,.！？!?ー)）」』】〉》…‥' +
  'ッャュョァィゥェォっゃゅょぁぃぅぇぉ〜～：；・'));
const NO_END = new Set(Array.from('(（「『【〈《['));

interface Laid { glyphs: { ch: string; line: number }[]; lines: number[] }
interface Problem { text: string; size: number; line: number; kind: string }
const problems: Problem[] = [];
function check(t: PixelText, raw: string): void {
  const laid = (t as unknown as { laid: Laid }).laid;
  const byLine: string[][] = laid.lines.map(() => []);
  for (const g of laid.glyphs) byLine[g.line].push(g.ch);
  // 書いた人が \n で改行した行の頭は数えない
  const paras = new Set<string>(stripMarkup(raw).split('\n'));
  const hard = new Set<string>(stripMarkup(raw).split('\n').slice(1).map((l) => Array.from(l)[0] ?? ''));
  byLine.forEach((l, i) => {
    if (i > 0 && l.length && NO_START.has(l[0]) && !hard.has(l[0])) problems.push({ text: raw, size: t.style.size, line: i, kind: `行頭「${l[0]}」` });
    if (i < byLine.length - 1 && l.length && NO_END.has(l[l.length - 1])) problems.push({ text: raw, size: t.style.size, line: i, kind: `行末「${l[l.length - 1]}」` });
    if (l.length === 1 && i > 0 && !paras.has(l[0])) problems.push({ text: raw, size: t.style.size, line: i, kind: `1字だけの行「${l[0]}」` });
  });
}

class TextsScene extends Phaser.Scene {
  constructor() { super('texts'); }
  create(): void {
    const from = num('from', 0);
    const list = texts.slice(from, from + num('count', texts.length));
    const g = this.add.graphics();
    const colH: number[] = new Array(cols).fill(2);
    // 列の高さをそろえるため、まず全部作ってから置く
    const items = list.map((t, k) => {
      const label = new PixelText(this, 0, 0, `${from + k}`, { size: 10, color: UI.textDim });
      const body = new PixelText(this, 0, 0, t.text, { size, wrap, lineSpacing: 2 });
      check(body, t.text);
      return { label, body, h: body.height + 4 };
    });
    const total = items.reduce((s, it) => s + it.h, 0);
    const perCol = total / cols;
    let c = 0;
    for (const it of items) {
      if (c < cols - 1 && colH[c] > 2 && colH[c] + it.h / 2 > perCol * 1.0) c++;
      const x0 = c * COL_W;
      it.label.setPosition(x0 + 2, colH[c] + Math.floor((size - 10) / 2));
      it.body.setPosition(x0 + 22, colH[c]);
      // 折り返しの幅の線
      if (wrap > 0) g.fillStyle(0x2a3a8a, 1).fillRect(x0 + 22 + wrap, colH[c], 1, it.body.height);
      colH[c] += it.h;
    }
    for (let k = 1; k < cols; k++) g.fillStyle(0x3a3a5a, 1).fillRect(k * COL_W - 1, 0, 1, Math.max(...colH));
    finish(this, cols * COL_W, Math.max(...colH) + 2);
  }
}

class CharsScene extends Phaser.Scene {
  constructor() { super('chars'); }
  create(): void {
    const W = cols * COL_W;
    const cell = size + 2;
    const per = Math.floor((W - 4) / cell);
    uniqueChars.forEach((ch, k) => {
      new PixelText(this, 2 + (k % per) * cell, 2 + Math.floor(k / per) * (size + 3), ch, { size });
    });
    finish(this, W, 4 + Math.ceil(uniqueChars.length / per) * (size + 3));
  }
}

const CHECK_WRAPS = [88, 117, 152, 160, 186];
/**
 * 記号だけの書き方(例:sort/remark.ts の間を置く字の一覧「、。…!?！？」)は画面に出す文ではないので、禁則は見ない。
 * かな、カナ、漢字、英数字が1字でもあれば文として見る
 */
const isSymbolsOnly = (s: string): boolean => !/[ぁ-ゖァ-ヺ一-鿿A-Za-z0-9０-９Ａ-Ｚａ-ｚ]/.test(stripMarkup(s));
let checked = 0;
class CheckScene extends Phaser.Scene {
  constructor() { super('check'); }
  create(): void {
    for (const s of [10, 12, 16]) for (const w of CHECK_WRAPS) for (const t of texts) {
      if (isSymbolsOnly(t.text)) continue;
      const p = new PixelText(this, 0, 0, t.text, { size: s, wrap: w });
      const before = problems.length;
      check(p, t.text);
      for (let k = before; k < problems.length; k++) problems[k].kind += ` 幅${w}`;
      p.destroy();
      checked++;
    }
    // まちがいのあった文を描く
    let y = 2;
    const shown = new Set<string>();
    for (const pr of problems) {
      const key = pr.text + pr.size + pr.kind;
      if (shown.has(key) || y > 1500) continue;
      shown.add(key);
      const w = Number(pr.kind.split('幅')[1]);
      const label = new PixelText(this, 2, y, `${pr.size} ${pr.kind}`, { size: 10, color: UI.textDim });
      y += label.height + 1;
      const t = new PixelText(this, 2, y, pr.text, { size: pr.size, wrap: w });
      this.add.graphics().fillStyle(0x2a3a8a, 1).fillRect(2 + w, y, 1, t.height);
      y += t.height + 4;
    }
    finish(this, COL_W * Math.max(1, cols), y + 2);
  }
}

class FocusScene extends Phaser.Scene {
  constructor() { super('focus'); }
  create(): void {
    let y = 2;
    for (const s of [10, 12, 16]) {
      for (const line of [FOCUS_SYMBOLS, FOCUS_KANJI, '了解！まあいいか！え？ ちょ、ちょっと待ってー！？', '被害額三川負傷撃破…やったー〜']) {
        const t = new PixelText(this, 2, y, `${s}:${line}`, { size: s });
        y += t.height + 3;
      }
      y += 3;
    }
    const k = new PixelText(this, 2, y, '禁則:', { size: 10, color: UI.textDim });
    y += k.height + 2;
    for (const w of [96, 108, 120]) {
      const t = new PixelText(this, 2, y, '今日も街の平和は\nこのヒーローが守る！ あいうえおかきくけこ、さしすせそ。「たちつてと」なにぬねのはっひふへほ…', { size: 12, wrap: w });
      check(t, t.text);
      this.add.graphics().fillStyle(0x2a3a8a, 1).fillRect(2 + w, y, 1, t.height);
      y += t.height + 4;
    }
    finish(this, COL_W * Math.max(1, cols), y);
  }
}

function finish(scene: Phaser.Scene, w: number, h: number): void {
  scene.cameras.main.setBackgroundColor('#0e1646');
  scene.scale.resize(w, h);
  scene.cameras.main.setSize(w, h);
  const canvas = scene.game.canvas;
  canvas.style.width = `${w * zoom}px`;
  canvas.style.height = `${h * zoom}px`;
  const info = document.getElementById('info')!;
  info.textContent = `set=${set} size=${size} wrap=${wrap} 文:${texts.length}(content ${contentTexts.length}、シーン ${sceneTexts.length}) 字:${uniqueChars.length}` +
    ` 禁則のまちがい:${problems.length}` + (checked ? `(${checked}とおり折り返した)` : '') + problems.slice(0, 20).map((p) => `\n  [${p.size}] ${p.kind} 行${p.line}: ${p.text.replace(/\n/g, '⏎')}`).join('');
  (window as unknown as { textDev: unknown }).textDev = { texts, uniqueChars, problems, done: true };
}

const SCENES: Record<string, typeof Phaser.Scene> = { texts: TextsScene, chars: CharsScene, focus: FocusScene, check: CheckScene };
preloadFont([...texts.map((t) => t.text), FOCUS_SYMBOLS, FOCUS_KANJI, '禁則'], [10, 12, 16], 6000).then(() => {
  new Phaser.Game({
    type: Phaser.CANVAS, parent: 'game', width: cols * COL_W, height: 200, backgroundColor: '#0e1646',
    pixelArt: true, roundPixels: true, antialias: false, scale: { mode: Phaser.Scale.NONE },
    audio: { noAudio: true }, banner: false, scene: [SCENES[set] ?? TextsScene]
  });
});
