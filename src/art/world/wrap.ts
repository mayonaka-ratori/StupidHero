// 背景を描く道具(3つのステージで共通)。横が折り返す格子 Wrap と、決まった乱数 hash、市松模様の dith。

import { OUTLINE, PixelGrid } from '../lib';

/** 決まった乱数(同じ入力で同じ値) */
export const hash = (x: number, y: number, s = 0): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** 市松模様の黒いほうのマスか */
export const dith = (x: number, y: number): boolean => (x + y) % 2 === 0;

/** 横が折り返す格子(左右がつながる背景用) */
export class Wrap {
  readonly g: PixelGrid;
  constructor(readonly w: number, readonly h: number) { this.g = new PixelGrid(w, h); }
  px(x: number, y: number, c: string | null): this {
    x = ((Math.round(x) % this.w) + this.w) % this.w;
    this.g.px(x, Math.round(y), c);
    return this;
  }
  get(x: number, y: number): string | null { return this.g.get(((Math.round(x) % this.w) + this.w) % this.w, Math.round(y)); }
  rect(x: number, y: number, w: number, h: number, c: string | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  /** 2色の市松模様で塗る */
  dither(x: number, y: number, w: number, h: number, a: string, b: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, dith(x + i, y + j) ? a : b);
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
    return this;
  }
  blit(src: PixelGrid, ox: number, oy: number): this {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.cells[y][x]) this.px(ox + x, oy + y, src.cells[y][x]);
    return this;
  }
  /** 塗ったところのまわりにふち */
  outlineRect(x: number, y: number, w: number, h: number, c = OUTLINE): this {
    this.rect(x - 1, y - 1, w + 2, 1, c).rect(x - 1, y + h, w + 2, 1, c).rect(x - 1, y, 1, h, c).rect(x + w, y, 1, h, c);
    return this;
  }
  /** すでに塗った色 from だけを to に変える */
  swap(x: number, y: number, w: number, h: number, from: string, to: string, pattern: (x: number, y: number) => boolean = () => true): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.get(x + i, y + j) === from && pattern(x + i, y + j)) this.px(x + i, y + j, to);
    return this;
  }
}
