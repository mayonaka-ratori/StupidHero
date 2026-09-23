// ドットがにじまない文字。DotGothic16で書いてから、半分より薄いドットを消し、濃いドットを不透明にする。
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
}

const DEFAULTS: Required<TextStyle> = {
  size: 12, color: UI.text, wrap: 0, lineSpacing: 2, align: 'left',
  outline: false, shadow: false, threshold: 128, letterSpacing: 0, fixedWidth: 0
};

/** 行の頭に来てはいけない字 */
const NO_START = new Set(Array.from('、。,.,.!?!?ー-)」』】〉》…‥ッャュョァィゥェォッっゃゅょぁぃぅぇぉ〜~:;:;'));
/** 行の終わりに来てはいけない字 */
const NO_END = new Set(Array.from('(「『【〈《(['));
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
    ctx.font = fontOf(size);
    w = Math.round(ctx.measureText(ch).width);
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

function layoutText(text: string, st: Required<TextStyle>): Laid {
  const chars = parse(text, st.color);
  const glyphs: Glyph[] = [];
  const lineW: number[] = [];
  const ls = st.letterSpacing;
  let line = 0;
  let x = 0;
  // 語(半角の並び)ごとに区切る
  const tokens: { ch: string; color: number }[][] = [];
  for (const c of chars) {
    const prev = tokens[tokens.length - 1];
    if (prev && WORD.test(c.ch) && WORD.test(prev[prev.length - 1].ch) && prev[0].ch !== '\n') prev.push(c);
    else tokens.push([c]);
  }
  const newLine = (): void => { lineW[line] = Math.max(0, x - ls); line++; x = 0; };
  let lineStart = 0; // この行の最初の字の glyphs での位置
  for (const tok of tokens) {
    if (tok[0].ch === '\n') { newLine(); lineStart = glyphs.length; continue; }
    const tw = tok.reduce((s, c) => s + charW(c.ch, st.size) + ls, 0) - ls;
    if (st.wrap > 0 && x > 0 && x + tw > st.wrap) {
      const last = glyphs[glyphs.length - 1];
      if (((tok.length === 1 && NO_START.has(tok[0].ch)) || (last && NO_END.has(last.ch))) && glyphs.length - lineStart > 1) {
        // 行頭と行末の禁則:前の字をいっしょに次の行へ送る
        const moved = glyphs.pop()!;
        x = moved.x;
        newLine();
        lineStart = glyphs.length;
        moved.x = 0; moved.line = line; glyphs.push(moved);
        x = charW(moved.ch, st.size) + ls;
      } else {
        newLine();
        lineStart = glyphs.length;
      }
      if (tok.length === 1 && (tok[0].ch === ' ')) continue; // 行頭の半角スペースは捨てる
    }
    for (const c of tok) {
      const w = charW(c.ch, st.size);
      if (st.wrap > 0 && x > 0 && x + w > st.wrap) { newLine(); lineStart = glyphs.length; }
      glyphs.push({ ch: c.ch, x, line, color: c.color });
      x += w + ls;
    }
  }
  lineW[line] = Math.max(0, x - ls);
  const lines = line + 1;
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
  private st: Required<TextStyle>;
  private raw = '';
  private laid: Laid = { glyphs: [], lines: [0], w: 0, h: 0 };
  private visible_ = -1;
  private waiting = '';

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
  get style(): Readonly<Required<TextStyle>> { return this.st; }

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
    const { size, threshold } = this.st;
    const p = this.pad();
    const W = Math.max(1, this.laid.w + p.l + p.r);
    const H = Math.max(1, this.laid.h + p.t + p.b);
    const lineStep = size + this.st.lineSpacing;
    const glyphs = this.visible_ < 0 ? this.laid.glyphs : this.laid.glyphs.slice(0, this.visible_);

    const ctx = scratchCtx(W, H);
    ctx.font = fontOf(size);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    for (const g of glyphs) {
      ctx.fillStyle = '#' + g.color.toString(16).padStart(6, '0');
      ctx.fillText(g.ch, p.l + g.x, p.t + g.line * lineStep);
    }
    const src = ctx.getImageData(0, 0, W, H).data;

    // 使っている色(にじんだ色をいちばん近い色にそろえる)
    const palette = Array.from(new Set(glyphs.map((g) => g.color)));
    const pr = palette.map((c) => (c >> 16) & 255), pg = palette.map((c) => (c >> 8) & 255), pb = palette.map((c) => c & 255);
    const mask = new Int16Array(W * H).fill(-1);
    const alpha = (x: number, y: number): number => (x >= 0 && y >= 0 && x < W && y < H ? src[(y * W + x) * 4 + 3] : 0);
    const nearest = (i: number): number => {
      if (palette.length === 1) return 0;
      let best = 0, bd = 1e9;
      for (let k = 0; k < palette.length; k++) {
        const d = Math.abs(src[i * 4] - pr[k]) + Math.abs(src[i * 4 + 1] - pg[k]) + Math.abs(src[i * 4 + 2] - pb[k]);
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    };
    for (let i = 0; i < W * H; i++) if (src[i * 4 + 3] >= threshold) mask[i] = nearest(i);
    // 細い線(「!」の棒など)は、ドットが2つにまたがって薄くなり、全部消えてしまうことがある。
    // 近くに残ったドットがない薄いドットは拾い直し、2つ並んだら濃い方だけ残す。
    const low = Math.round(threshold * 0.4);
    const isOn = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] >= 0;
    const rescued = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (mask[i] >= 0 || src[i * 4 + 3] < low) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (isOn(x + dx, y + dy)) { near = true; break; }
      if (!near) rescued[i] = 1;
    }
    const thin = (dx: number, dy: number): void => {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!rescued[i]) continue;
        const a = alpha(x, y);
        const nx = x + dx, ny = y + dy, px = x - dx, py = y - dy;
        const inR = (xx: number, yy: number): boolean => xx >= 0 && yy >= 0 && xx < W && yy < H && rescued[yy * W + xx] === 1;
        if ((inR(nx, ny) && alpha(nx, ny) > a) || (inR(px, py) && alpha(px, py) >= a)) rescued[i] = 2;
      }
      for (let i = 0; i < W * H; i++) if (rescued[i] === 2) rescued[i] = 0;
    };
    thin(1, 0);
    thin(0, 1);
    for (let i = 0; i < W * H; i++) if (rescued[i]) mask[i] = nearest(i);

    this.tex.setSize(W, H);
    const out = this.tex.context.createImageData(W, H);
    const d = out.data;
    const put = (i: number, c: number): void => {
      d[i * 4] = (c >> 16) & 255; d[i * 4 + 1] = (c >> 8) & 255; d[i * 4 + 2] = c & 255; d[i * 4 + 3] = 255;
    };
    const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] >= 0;
    const sh = this.st.shadow;
    const ol = this.st.outline;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (mask[i] >= 0) { put(i, palette[mask[i]]); continue; }
      if (ol !== false && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) ||
        on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1))) { put(i, ol === true ? 0x000000 : ol); continue; }
      if (sh !== false && on(x - 1, y - 1)) put(i, sh === true ? 0x000000 : sh);
    }
    this.tex.context.putImageData(out, 0, 0);
    this.tex.refresh();
    this.setSizeToFrame(this.frame);
    this.updateDisplayOrigin();
  }

}
