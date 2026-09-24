// コードでドット絵を作るための共通の道具。
// 絵の担当はこのファイルを使ってよいが、変えない(変えたいときはディレクターに相談)。

import type Phaser from 'phaser';
import { IMAGES, type ImageDef, type SheetDef, animKey, sheetByKey, sheetSize } from './sheets';

/** R、G、Bそれぞれの8段階(ART_SPECの「使える色」) */
export const LEVELS = [0, 36, 73, 109, 146, 182, 219, 255] as const;

/** 0〜7の段階で色を作る。例: md(7,0,0) は真っ赤 */
export const md = (r: number, g: number, b: number): string =>
  `rgb(${LEVELS[r]},${LEVELS[g]},${LEVELS[b]})`;

/** 共通のふち色(R36 G0 B36) */
export const OUTLINE = md(1, 0, 1);

export interface Canvas2D {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function createCanvas(w: number, h: number): Canvas2D {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/** シートの大きさの空のキャンバス */
export function createSheetCanvas(def: SheetDef): Canvas2D {
  const { w, h } = sheetSize(def);
  return createCanvas(w, h);
}

/**
 * 小さな格子に色を塗ってから、コマに書き写すための道具。
 * grid[y][x] に色の文字列(または null)を入れる。
 */
export class PixelGrid {
  readonly w: number;
  readonly h: number;
  readonly cells: (string | null)[][];
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.cells = Array.from({ length: h }, () => Array<string | null>(w).fill(null));
  }
  px(x: number, y: number, c: string | null): this {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = c;
    return this;
  }
  rect(x: number, y: number, w: number, h: number, c: string | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  get(x: number, y: number): string | null {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.cells[y][x] : null;
  }
  /** 塗ったところのまわり(上下左右)に1ドットのふちを付ける */
  outline(color = OUTLINE): this {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.cells[y][x]) continue;
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.cells[y][x] = color;
    return this;
  }
  /** 左右反転したコピー */
  flipped(): PixelGrid {
    const g = new PixelGrid(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.cells[y][this.w - 1 - x] = this.cells[y][x];
    return g;
  }
  /** キャンバスの (ox, oy) に書き写す */
  drawTo(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.cells[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

/** シートの中の、row行目 i番目のコマの左上 */
export const cellOrigin = (def: SheetDef, row: number, i: number): { x: number; y: number } =>
  ({ x: i * def.frameW, y: row * def.frameH });

/** シートの表の通りに、テクスチャにコマ(番号は 行×列の数+列)を切る */
export function addSheetFrames(tex: Phaser.Textures.Texture, def: SheetDef): void {
  for (let row = 0; row < def.rows.length; row++) {
    for (let i = 0; i < def.cols; i++) {
      tex.add(row * def.cols + i, 0, i * def.frameW, row * def.frameH, def.frameW, def.frameH);
    }
  }
}

/** シートの表の行ごとのアニメを登録する。key はテクスチャのキー(塗り替えたシートは元の def と別のキー) */
export function createSheetAnims(scene: Phaser.Scene, def: SheetDef, key = def.key): void {
  def.rows.forEach((row, r) => {
    const k = animKey(key, row.name);
    if (scene.anims.exists(k)) return;
    const frames = Array.from({ length: row.frames }, (_, i) => ({ key, frame: r * def.cols + i }));
    scene.anims.create({ key: k, frames, frameRate: row.fps, repeat: row.loop ? -1 : 0 });
  });
}

export interface ArtContext {
  scene: Phaser.Scene;
  /** PNGが用意されていて、作らなくてよいキー */
  skip: Set<string>;
  /** 作ったシートを登録する */
  addSheet(def: SheetDef, canvas: HTMLCanvasElement): void;
  /** 作った1枚絵を登録する */
  addImage(def: ImageDef, canvas: HTMLCanvasElement): void;
}

export function makeArtContext(scene: Phaser.Scene, skip: Set<string>): ArtContext {
  return {
    scene,
    skip,
    addSheet(def, canvas) {
      if (skip.has(def.key) || scene.textures.exists(def.key)) return;
      const { w, h } = sheetSize(def);
      if (canvas.width !== w || canvas.height !== h) {
        throw new Error(`${def.key}: シートの大きさが ${canvas.width}x${canvas.height} で、決まりの ${w}x${h} と違う`);
      }
      addSheetFrames(scene.textures.addCanvas(def.key, canvas)!, def);
    },
    addImage(def, canvas) {
      if (skip.has(def.key) || scene.textures.exists(def.key)) return;
      if (canvas.width !== def.w || canvas.height !== def.h) {
        throw new Error(`${def.key}: 絵の大きさが ${canvas.width}x${canvas.height} で、決まりの ${def.w}x${def.h} と違う`);
      }
      scene.textures.addCanvas(def.key, canvas);
    }
  };
}

/** rows[行][コマ] の順にコマを並べて、シートのキャンバスにする */
export function buildSheet(def: SheetDef, rows: PixelGrid[][]): HTMLCanvasElement {
  const { canvas, ctx } = createSheetCanvas(def);
  rows.forEach((frames, r) => {
    if (r >= def.rows.length) return;
    frames.slice(0, def.rows[r].frames).forEach((g, i) => {
      const o = cellOrigin(def, r, i);
      g.drawTo(ctx, o.x, o.y);
    });
  });
  return canvas;
}

/** シートのキー → 行ごとのコマ、を並べて登録する(PNGがあるキーは飛ばす) */
export function addGridSheets(ctx: ArtContext, sheets: Record<string, PixelGrid[][]>): void {
  for (const [key, rows] of Object.entries(sheets)) {
    if (ctx.skip.has(key)) continue;
    const def = sheetByKey(key);
    ctx.addSheet(def, buildSheet(def, rows));
  }
}

/** 1枚絵のキー → 描く関数、を描いて登録する(PNGがあるキーは描かない) */
export function addGridImages(ctx: ArtContext, images: Record<string, () => PixelGrid>): void {
  for (const [key, draw] of Object.entries(images)) {
    if (ctx.skip.has(key)) continue;
    const def = IMAGES.find((d) => d.key === key)!;
    const { canvas, ctx: c } = createCanvas(def.w, def.h);
    draw().drawTo(c, 0, 0);
    ctx.addImage(def, canvas);
  }
}
