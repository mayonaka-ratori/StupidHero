// 画面の字。DotGothic16 を、画面の細かさ(src/hires.ts の RES 倍)でくっきり描く。位置と大きさは論理ドットで扱う。
// 使い方:
//   const t = new PixelText(this, 8, 8, 'ポケットがふくらんでる…', { size: FS.body, wrap: 120 });
//   t.setText('撃破{gold}3{/}人');         // {gold}…{/} で一部の色を変える(theme.ts の TEXT_COLORS か #rrggbb)
//   t.setOrigin(0.5, 0);                    // 真ん中寄せで置くとき(ふつうのPhaserと同じ)
//   t.setVisibleChars(5);                   // 先頭の5文字だけ見せる(文字送り用。折り返しの位置は変わらない)
// 作るとシーンに置かれる(depth は DEPTH.ui。下の操作部分の背景より手前)。destroy()でテクスチャも消える(シーンが終わるときも自動で消える)。
// 日本語のフォントは文字ごとに分かれて読み込まれるので、まだ読み込まれていない字は読み込み後に描き直す。
// 先に読み込んでおきたいときは await preloadFont(['セリフ…']) 。

import Phaser from 'phaser';
import { FONT_FAMILY, UI } from '../config';
import { DEPTH, TEXT_COLORS } from './theme';
import { RES } from '../hires';

interface HiResRender { renderWebGL: (...a: unknown[]) => void; renderCanvas: (...a: unknown[]) => void }

export type Align = 'left' | 'center' | 'right';

export interface TextStyle {
  /** 文字の大きさ(ドット)。16か12が基本。8はかなと数字だけ */
  size?: number;
  /** 文字の色 */
  color?: number;
  /** 折り返す幅(ドット)。0なら折り返さない(\n では改行する) */
  wrap?: number;
  /** 行と行のすきま(ドット) */
  lineSpacing?: number;
  /** 行のそろえ方 */
  align?: Align;
  /** 黒の1ドットのふち。数字を渡すとその色のふち */
  outline?: boolean | number;
  /** 右下に1ドットの影。数字を渡すとその色の影 */
  shadow?: boolean | number;
  /** これより濃いドットを残す(0〜255) */
  threshold?: number;
  /** 文字と文字のすきま(ドット) */
  letterSpacing?: number;
  /** 箱の幅を決めて、その中でそろえる(0なら文字の幅) */
  fixedWidth?: number;
  /** とぎれた細い線をつなぐ。ふつうは16の倍数でない大きさのときだけつなぐ */
  bridge?: boolean;
}

/** 全部の値が決まった書き方 */
export type FullTextStyle = Required<Omit<TextStyle, 'bridge'>> & { bridge?: boolean };

const DEFAULTS: FullTextStyle = {
  size: 12, color: UI.text, wrap: 0, lineSpacing: 2, align: 'left',
  outline: false, shadow: false, threshold: 128, letterSpacing: 0, fixedWidth: 0
};

// 禁則処理:行の頭に来てはいけない字(閉じかっこ、句読点、!?、ー、…、小さいかな など)と、
// 行の終わりに来てはいけない字(開きかっこ)。折り返すときは、前の字をいっしょに次の行へ送る(追い出し)。
// 全角の記号を確実に書くため、\u の書き方で書く。
/** 行の頭に来てはいけない字 */
const NO_START = new Set(Array.from(
  // 、 。 , . ・ : ; ! ? ‼ ⁇ ⁈ ⁉ 
  '、。，．・：；！？‼⁇⁈⁉' +
  // ) ] } 〕 〉 》 」 』 】 〙 〗 ” ’ 」(半角) 、。(半角)
  '）］｝〕〉》」』】〙〗”’｣､｡' +
  // ー … ‥ 〜 ~ ゝ ゞ ヽ ヾ 々 〻 ー(半角)
  'ー…‥〜～ゝゞヽヾ々〻ｰ' +
  // ぁぃぅぇぉっゃゅょゎゕゖ ァィゥェォッャュョヮヵヶ ㇰ… 半角の小さいカナ
  'ぁぃぅぇぉっゃゅょゎゕゖ' +
  'ァィゥェォッャュョヮヵヶ' +
  'ㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ' +
  'ｧｨｩｪｫｬｭｮｯ' +
  // 半角
  ',.!?):;]}~%'
));
/** 行の終わりに来てはいけない字 */
const NO_END = new Set(Array.from(
  // ( [ { 〔 〈 《 「 『 【 〘 〖 “ ‘ 「(半角) ¥ $ # ( [ {
  '（［｛〔〈《「『【〘〖“‘｢￥＄＃' +
  '([{¥$#'
));
/** まとめて1語として扱う半角の字(途中で折り返さない) */
const WORD = /[A-Za-z0-9¥$%,.+\-#'_:!?]/;

interface Glyph { ch: string; x: number; line: number; color: number }
interface Laid { glyphs: Glyph[]; lines: number[]; w: number; h: number }

const fontOf = (size: number): string => `${size}px "${FONT_FAMILY}", monospace`;

let scratch: CanvasRenderingContext2D | null = null;
function scratchCtx(w: number, h: number): CanvasRenderingContext2D {
  if (!scratch) {
    const c = document.createElement('canvas');
    scratch = c.getContext('2d', { willReadFrequently: true })!;
  }
  const c = scratch.canvas;
  if (c.width < w || c.height < h) {
    c.width = Math.max(c.width, w);
    c.height = Math.max(c.height, h);
  }
  scratch.clearRect(0, 0, c.width, c.height);
  return scratch;
}

const widthCache = new Map<string, number>();
function charW(ch: string, size: number): number {
  const k = size + ch;
  let w = widthCache.get(k);
  if (w === undefined) {
    const ctx = scratchCtx(1, 1);
    ctx.font = fontOf(size * 4);
    w = ctx.measureText(ch).width / 4;
    // 読み込み前の代わりの字の幅は覚えない
    if (fontReady(size, ch)) widthCache.set(k, w);
  }
  return w;
}

function fontReady(size: number, text: string): boolean {
  try { return !document.fonts || document.fonts.check(fontOf(size), text); } catch { return true; }
}

/** 文字を先に読み込んでおく(日本語は字ごとに分かれて読み込まれるため) */
export function preloadFont(texts: string[], sizes: number[] = [12, 16], timeoutMs = 3000): Promise<void> {
  if (!document.fonts) return Promise.resolve();
  const all = stripMarkup(texts.join(''));
  const jobs = sizes.map((s) => document.fonts.load(fontOf(s), all).catch(() => []));
  return Promise.race([Promise.all(jobs).then(() => undefined), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

/** {gold}…{/} の書き方を取りのぞいた文字 */
export function stripMarkup(s: string): string {
  return s.replace(/\{(\/|#[0-9a-fA-F]{6}|[a-z]+)\}/g, '');
}

/** 色つきの字の並びに分ける */
function parse(text: string, base: number): { ch: string; color: number }[] {
  const out: { ch: string; color: number }[] = [];
  const stack: number[] = [base];
  const re = /\{(\/|#[0-9a-fA-F]{6}|[a-z]+)\}/g;
  let last = 0;
  const push = (s: string): void => { for (const ch of Array.from(s)) out.push({ ch, color: stack[stack.length - 1] }); };
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const tag = m[1];
    const c = tag === '/' ? null : tag.startsWith('#') ? parseInt(tag.slice(1), 16) : TEXT_COLORS[tag];
    if (tag !== '/' && c === undefined) continue; // 知らない名前はそのまま字として出す
    push(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (tag === '/') { if (stack.length > 1) stack.pop(); } else stack.push(c as number);
  }
  push(text.slice(last));
  return out;
}

type Ch = { ch: string; color: number };

/** 1つの段落(\n で区切られたまとまり)を、折り返す幅で行に分ける。禁則処理もここでする */
function wrapParagraph(chars: Ch[], st: FullTextStyle): Ch[][] {
  if (st.wrap <= 0 || !chars.length) return [chars];
  const ls = st.letterSpacing;
  // 語(半角の並び)ごとに区切る。幅に入りきらない長い語は1字ずつにする
  const tokens: Ch[][] = [];
  for (const c of chars) {
    const prev = tokens[tokens.length - 1];
    if (prev && WORD.test(c.ch) && WORD.test(prev[prev.length - 1].ch)) prev.push(c);
    else tokens.push([c]);
  }
  const tokW = (t: Ch[]): number => t.reduce((s, c) => s + charW(c.ch, st.size) + ls, 0) - ls;
  const toks: Ch[][] = [];
  for (const t of tokens) {
    if (t.length > 1 && tokW(t) > st.wrap) for (const c of t) toks.push([c]);
    else toks.push(t);
  }
  const startsBad = (t: Ch[]): boolean => NO_START.has(t[0].ch);
  const endsBad = (t: Ch[]): boolean => NO_END.has(t[t.length - 1].ch);
  const isSpace = (t: Ch[]): boolean => t.length === 1 && t[0].ch === ' ';

  const lines: Ch[][] = [];
  let i = 0;
  while (i < toks.length) {
    // この行に入るだけ入れる
    let x = 0;
    let j = i;
    for (; j < toks.length; j++) {
      const w = tokW(toks[j]) + (j > i ? ls : 0);
      if (j > i && x + w > st.wrap) break;
      x += w;
    }
    if (j < toks.length) {
      // 禁則:次の行の頭が行頭禁止の字、またはこの行の終わりが行末禁止の字なら、区切りを前へずらす
      let b = j;
      while (b > i + 1 && (startsBad(toks[b]) || endsBad(toks[b - 1]))) b--;
      // 行の頭にスペースを残さないように、スペースのところでは区切りをそのままにしてよい
      if (!(startsBad(toks[b]) || endsBad(toks[b - 1]))) j = b;
      // 最後の行が1字だけになるときは、前の字もいっしょに送る(「市\n民」のようにならないように)
      const rest = toks.slice(j).filter((t) => !isSpace(t));
      if (rest.length === 1 && rest[0].length === 1) {
        for (let k = j - 1; k >= j - 2 && k - i >= 2; k--) {
          if (!startsBad(toks[k]) && !endsBad(toks[k - 1])) { j = k; break; }
        }
      }
    }
    lines.push(toks.slice(i, j).flat());
    i = j;
    // 折り返した行の頭の半角スペースは捨てる
    while (i < toks.length && isSpace(toks[i])) i++;
  }
  return lines.length ? lines : [[]];
}

function layoutText(text: string, st: FullTextStyle): Laid {
  const chars = parse(text, st.color);
  const ls = st.letterSpacing;
  // \n で段落に分けてから、段落ごとに折り返す
  const paras: Ch[][] = [[]];
  for (const c of chars) {
    if (c.ch === '\n') paras.push([]);
    else paras[paras.length - 1].push(c);
  }
  const glyphs: Glyph[] = [];
  const lineW: number[] = [];
  for (const para of paras) {
    for (const lineChars of wrapParagraph(para, st)) {
      const line = lineW.length;
      let x = 0;
      for (const c of lineChars) {
        glyphs.push({ ch: c.ch, x, line, color: c.color });
        x += charW(c.ch, st.size) + ls;
      }
      lineW.push(Math.max(0, x - ls));
    }
  }
  const lines = lineW.length;
  const w = Math.max(st.fixedWidth, ...lineW);
  const h = lines * st.size + (lines - 1) * st.lineSpacing;
  // そろえる
  for (const g of glyphs) {
    const lw = lineW[g.line];
    if (st.align === 'center') g.x += Math.floor((w - lw) / 2);
    else if (st.align === 'right') g.x += w - lw;
  }
  return { glyphs, lines: lineW, w, h };
}

let seq = 0;

export class PixelText extends Phaser.GameObjects.Image {
  private tex: Phaser.Textures.CanvasTexture;
  private st: FullTextStyle;
  private raw = '';
  private laid: Laid = { glyphs: [], lines: [0], w: 0, h: 0 };
  private visible_ = -1;
  private waiting = '';
  private margin_ = 0;

  /** 絵のまわりの余白(論理ドット)。字の絵は、並べる大きさより上下左右に この分だけ広い */
  get margin(): number { return this.margin_; }

  constructor(scene: Phaser.Scene, x: number, y: number, text = '', style: TextStyle = {}) {
    const key = `__ptext${++seq}`;
    const tex = scene.textures.createCanvas(key, 1, 1)!;
    super(scene, x, y, key);
    this.tex = tex;
    this.st = { ...DEFAULTS, ...style };
    this.setOrigin(0, 0);
    this.setDepth(DEPTH.ui);
    // 消えるときにテクスチャも消す(シーンが終わるときも呼ばれる)
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      const textures = this.scene?.sys.textures;
      if (textures && textures.exists(key)) textures.remove(key);
    });
    scene.add.existing(this);
    this.setText(text);
  }

  /** いまの文字({色}の書き方を含む) */
  get text(): string { return this.raw; }
  /** 見える字の数({色}や改行は数えない)。文字送りに使う */
  get length(): number { return this.laid.glyphs.length; }
  /** 行の数 */
  get lineCount(): number { return this.laid.lines.length; }
  get style(): Readonly<FullTextStyle> { return this.st; }

  setText(text: string | number): this {
    const s = String(text);
    if (s === this.raw && this.laid.glyphs.length) return this;
    this.raw = s;
    this.visible_ = -1;
    this.relayout();
    return this;
  }

  setStyle(style: TextStyle): this {
    this.st = { ...this.st, ...style };
    this.relayout();
    return this;
  }

  setColor(color: number): this { return this.setStyle({ color }); }

  /** 先頭のn文字だけ見せる。-1ですべて */
  setVisibleChars(n: number): this {
    const v = n < 0 || n >= this.laid.glyphs.length ? -1 : Math.floor(n);
    if (v === this.visible_) return this;
    this.visible_ = v;
    this.draw();
    return this;
  }

  private pad(): { l: number; t: number; r: number; b: number } {
    const o = this.st.outline !== false ? 1 : 0;
    const s = this.st.shadow !== false ? 1 : 0;
    return { l: o, t: o, r: Math.max(o, s), b: Math.max(o, s) };
  }

  private relayout(): void {
    const plain = stripMarkup(this.raw);
    if (plain && !fontReady(this.st.size, plain) && this.waiting !== plain + this.st.size) {
      this.waiting = plain + this.st.size;
      const want = this.raw;
      document.fonts.load(fontOf(this.st.size), plain).then(() => {
        if (!this.scene || this.raw !== want) return;
        this.waiting = '';
        this.relayout();
      }).catch(() => undefined);
    }
    this.laid = layoutText(this.raw, this.st);
    this.draw();
  }

  private draw(): void {
    const R = RES;
    const { size } = this.st;
    const p = this.pad();
    const W = Math.max(1, Math.ceil(this.laid.w + p.l + p.r));
    const H = Math.max(1, Math.ceil(this.laid.h + p.t + p.b));
    const lineStep = size + this.st.lineSpacing;
    const glyphs = this.visible_ < 0 ? this.laid.glyphs : this.laid.glyphs.slice(0, this.visible_);

    // 論理ドットの R 倍の細かさで描く(字はくっきり、位置と大きさは論理ドットのまま)。
    // ブラウザによって字の上下の位置が少し違い(iPhone の Safari など)、はみ出した所が切れるので、
    // まわりに余白 M をとって描く。並べる計算に使う大きさ(W×H)には余白を入れない
    const M = this.margin_ = Math.ceil(size * 0.35);
    this.tex.setSize((W + M * 2) * R, (H + M * 2) * R);
    const ctx = this.tex.context;
    ctx.clearRect(0, 0, (W + M * 2) * R, (H + M * 2) * R);
    ctx.font = fontOf(size * R);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const at = (g: Glyph): [number, number] => [(M + p.l + g.x) * R, (M + p.t + g.line * lineStep) * R];
    const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');
    // 影(右下に1ドット)
    const sh = this.st.shadow;
    if (sh !== false) {
      ctx.fillStyle = hex(sh === true ? 0x000000 : sh);
      for (const g of glyphs) { const [x, y] = at(g); ctx.fillText(g.ch, x + R, y + R); }
    }
    // ふち(まわりに1ドット)
    const ol = this.st.outline;
    if (ol !== false) {
      ctx.fillStyle = hex(ol === true ? 0x000000 : ol);
      const step = Math.max(1, Math.floor(R / 2));
      for (let dy = -R; dy <= R; dy += step) for (let dx = -R; dx <= R; dx += step) {
        if (dx === 0 && dy === 0) continue;
        for (const g of glyphs) { const [x, y] = at(g); ctx.fillText(g.ch, x + dx, y + dy); }
      }
    }
    for (const g of glyphs) {
      ctx.fillStyle = hex(g.color);
      const [x, y] = at(g);
      ctx.fillText(g.ch, x, y);
    }
    this.tex.refresh();
    this.setSizeToFrame(this.frame);
    // 大きさは論理ドットで持つ(並べる計算や当たり判定はこれを使う)
    this.setSize(W, H);
    this.updateDisplayOrigin();
  }

  // 絵は R 倍の細かさなので、描くときだけ 1/R に縮めて、原点を R 倍にする(ほかの計算は論理ドットのまま)
  renderWebGL(...args: unknown[]): void { this.withRes(() => (Phaser.GameObjects.Image.prototype as unknown as HiResRender).renderWebGL.apply(this, args)); }
  renderCanvas(...args: unknown[]): void { this.withRes(() => (Phaser.GameObjects.Image.prototype as unknown as HiResRender).renderCanvas.apply(this, args)); }

  private withRes(fn: () => void): void {
    const R = RES;
    if (R === 1 && this.margin_ === 0) { fn(); return; }
    const t = this as unknown as { _scaleX: number; _scaleY: number; _displayOriginX: number; _displayOriginY: number };
    const sx = t._scaleX, sy = t._scaleY, ox = t._displayOriginX, oy = t._displayOriginY;
    const M = this.margin_;
    t._scaleX = sx / R; t._scaleY = sy / R; t._displayOriginX = (ox + M) * R; t._displayOriginY = (oy + M) * R;
    try { fn(); } finally { t._scaleX = sx; t._scaleY = sy; t._displayOriginX = ox; t._displayOriginY = oy; }
  }

}
