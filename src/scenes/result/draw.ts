// Phaser の外(ふつうのキャンバス)にゲームの絵と文字を描くための小さな道具。
// 共有カードと、共有用の画像(og.png)で使う。
//   const c = makeCanvas(216, 270);
//   drawAlley(c.ctx, scene, 0, 0, run.scrollX);                  // 夜の路地裏(216×214)
//   drawSprite(c.ctx, scene, 'hero', frameIndex(def, 'win_fist', 0), 108, 200, { scale: 2, anchor: 'feet' });
//   drawText(c.ctx, scene, 8, 8, '称号', { size: 16, color: UI.gold, outline: true });
//   const big = upscale(c.canvas, 5);                             // ぼかさずに5倍

import type Phaser from 'phaser';
import { FEET_OFFSET, sheetByKey } from '../../art/sheets';
import { PixelText, type TextStyle } from '../../ui/text';

export interface Canvas2D { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }

export function makeCanvas(w: number, h: number): Canvas2D {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

/** ぼかさずに整数倍に拡大する */
export function upscale(src: HTMLCanvasElement, k: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(src.width * k, src.height * k);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface SpriteOpt {
  scale?: number;
  flipX?: boolean;
  /** x, y の意味。'feet' は足の裏(下から4ドット上の真ん中)、'bottom' は下の真ん中、'center' は真ん中、'topleft' は左上 */
  anchor?: 'feet' | 'bottom' | 'center' | 'topleft';
}

/** テクスチャの1コマを描く。コマは番号(シート全体での番号)か、画像なら '__BASE' */
export function drawSprite(
  ctx: CanvasRenderingContext2D, scene: Phaser.Scene, key: string, frame: number | string, x: number, y: number, opt: SpriteOpt = {}
): void {
  if (!scene.textures.exists(key)) return;
  const f = scene.textures.getFrame(key, frame);
  if (!f) return;
  const src = f.source.image as CanvasImageSource;
  const k = opt.scale ?? 1;
  const w = f.cutWidth * k;
  const h = f.cutHeight * k;
  let dx = x, dy = y;
  switch (opt.anchor ?? 'topleft') {
    case 'feet': dx = x - w / 2; dy = y - (f.cutHeight - FEET_OFFSET) * k; break;
    case 'bottom': dx = x - w / 2; dy = y - h; break;
    case 'center': dx = x - w / 2; dy = y - h / 2; break;
    default: break;
  }
  dx = Math.round(dx); dy = Math.round(dy);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (opt.flipX) {
    ctx.translate(dx + w, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, w, h);
  } else {
    ctx.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, dx, dy, w, h);
  }
  ctx.restore();
}

/** シートのキーと動きの名前とコマから、シート全体でのコマ番号 */
export function frameOf(key: string, anim: string, i = 0): number {
  const d = sheetByKey(key);
  const row = d.rows.findIndex((r) => r.name === anim);
  return Math.max(0, row) * d.cols + Math.min(i, (d.rows[row]?.frames ?? 1) - 1);
}

/** 横につながる画像を、ずらし量 sx で左右に並べて描く */
function drawWrapped(ctx: CanvasRenderingContext2D, scene: Phaser.Scene, key: string, x: number, y: number, w: number, sx: number): void {
  if (!scene.textures.exists(key)) return;
  const f = scene.textures.getFrame(key, '__BASE');
  const src = f.source.image as CanvasImageSource;
  const tw = f.cutWidth;
  let off = -(((Math.round(sx) % tw) + tw) % tw);
  while (off < w) {
    ctx.drawImage(src, x + off, y);
    off += tw;
  }
}

/** 夜の路地裏の背景(高さ214)。w は幅(216より広くてもよい)、scrollX は壁と地面のずらし量 */
export function drawAlley(ctx: CanvasRenderingContext2D, scene: Phaser.Scene, x: number, y: number, scrollX = 0, w = 216): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, 214);
  ctx.clip();
  drawWrapped(ctx, scene, 'bg_alley_far', x, y, w, Math.floor(scrollX / 4));
  drawWrapped(ctx, scene, 'bg_alley_wall', x, y, w, scrollX);
  drawWrapped(ctx, scene, 'bg_alley_ground', x, y + 124, w, scrollX);
  ctx.restore();
}

/**
 * 文字を描く。PixelText で作ってから、その絵を写す(ゲームの中と同じ字になる)。
 * 字は先に preloadFont で読みこんでおくこと。描いた大きさを返す。
 */
export function drawText(
  ctx: CanvasRenderingContext2D, scene: Phaser.Scene, x: number, y: number, text: string, style: TextStyle = {},
  origin: [number, number] = [0, 0]
): { w: number; h: number } {
  const t = new PixelText(scene, -9999, -9999, text, style).setVisible(false);
  const src = t.texture.getSourceImage() as HTMLCanvasElement;
  const w = t.frame.cutWidth;
  const h = t.frame.cutHeight;
  ctx.drawImage(src, 0, 0, w, h, Math.round(x - w * origin[0]), Math.round(y - h * origin[1]), w, h);
  t.destroy();
  return { w, h };
}

/** 四角をいくつかまとめて塗る */
export function fill(ctx: CanvasRenderingContext2D, color: number, ...rects: [number, number, number, number][]): void {
  ctx.fillStyle = hex(color);
  for (const [x, y, w, h] of rects) ctx.fillRect(x, y, w, h);
}

/** メガドライブ風の窓の枠(ui/frame.ts と同じ色の並び) */
export function drawBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge: number, inner: number, body: number): void {
  fill(ctx, 0x000000, [x + 1, y, w - 2, h], [x, y + 1, w, h - 2]);
  fill(ctx, edge, [x + 2, y + 1, w - 4, h - 2], [x + 1, y + 2, w - 2, h - 4]);
  fill(ctx, inner, [x + 2, y + 2, w - 4, h - 4]);
  fill(ctx, body, [x + 3, y + 3, w - 6, h - 6]);
}
