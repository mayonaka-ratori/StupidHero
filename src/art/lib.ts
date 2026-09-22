// コードでドット絵を作るための共通の道具。
// 絵の担当はこのファイルを使ってよいが、変えない(変えたいときはディレクターに相談)。

import type Phaser from 'phaser';
import { type ImageDef, type SheetDef, sheetSize } from './sheets';

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
      const tex = scene.textures.addCanvas(def.key, canvas)!;
      for (let row = 0; row < def.rows.length; row++) {
        for (let i = 0; i < def.cols; i++) {
          tex.add(row * def.cols + i, 0, i * def.frameW, row * def.frameH, def.frameW, def.frameH);
        }
      }
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
