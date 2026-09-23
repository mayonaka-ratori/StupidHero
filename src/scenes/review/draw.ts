// 答え合わせの画面の小さな絵:人の顔と胴の切り抜き、大きな○と×。
//   const key = personThumb(scene, person, 26, 36);   // 仕分けの絵の最初のコマから、頭と胴を切り抜いたテクスチャ
//   drawMark(g, cx, cy, true);                          // 金色の○(false なら赤い×)。黒いふちつき

import type Phaser from 'phaser';
import { UI } from '../../config';
import { accessorySheet } from '../../art/recolor';
import type { Person } from '../../logic';

/** 絵の上のすきま(頭のてっぺんから何ドット上から切るか) */
const TOP_PAD = 1;

/** 切り抜いたテクスチャのキー(シーンをまたいで使い回す) */
const thumbKey = (sheet: string, w: number, h: number): string => `review_thumb:${sheet}:${w}x${h}`;

/**
 * 人の絵(ステージ2は小物の色を塗ったもの)の最初のコマから、頭と胴を w×h で切り抜いたテクスチャを作ってキーを返す。
 * 頭のてっぺんを上にそろえ、横は絵の真ん中にそろえる。ぼかさない
 */
export function personThumb(scene: Phaser.Scene, p: Pick<Person, 'sheetKey' | 'accessory'>, w: number, h: number): string | null {
  if (!scene.textures.exists(p.sheetKey)) return null;
  const sheet = accessorySheet(scene, p.sheetKey, p.accessory?.color);
  const key = thumbKey(sheet, w, h);
  if (scene.textures.exists(key)) return key;
  const f = scene.textures.getFrame(sheet, 0);
  if (!f) return null;
  const src = f.source.image as CanvasImageSource;
  // コマを写して、色のあるドットの上端と左右の端を探す
  const fw = f.cutWidth, fh = f.cutHeight;
  const tmp = document.createElement('canvas');
  tmp.width = fw; tmp.height = fh;
  const tc = tmp.getContext('2d', { willReadFrequently: true })!;
  tc.drawImage(src, f.cutX, f.cutY, fw, fh, 0, 0, fw, fh);
  const d = tc.getImageData(0, 0, fw, fh).data;
  let top = fh, left = fw, right = -1;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    if (d[(y * fw + x) * 4 + 3] < 128) continue;
    if (y < top) top = y;
    if (x < left) left = x;
    if (x > right) right = x;
  }
  if (right < 0) return null;
  // 頭のあたり(上から12ドット)の真ん中を横の真ん中にする(手に持った物で左右にずれないように)
  let hl = fw, hr = -1;
  for (let y = top; y < Math.min(fh, top + 12); y++) for (let x = 0; x < fw; x++) {
    if (d[(y * fw + x) * 4 + 3] < 128) continue;
    if (x < hl) hl = x;
    if (x > hr) hr = x;
  }
  const cx = hr >= 0 ? (hl + hr + 1) / 2 : (left + right + 1) / 2;
  const sx = Math.round(cx - w / 2);
  const sy = Math.max(0, top - TOP_PAD);
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const oc = out.getContext('2d')!;
  oc.imageSmoothingEnabled = false;
  oc.drawImage(tmp, sx, sy, w, h, 0, 0, w, h);
  scene.textures.addCanvas(key, out);
  return key;
}

/** ○(当たり)の色と×(はずれ)の色 */
export const MARK_OK = UI.gold;
export const MARK_NG = UI.danger;

/** 点ごとに塗る(1ドットの四角) */
function dots(g: Phaser.GameObjects.Graphics, color: number, pts: [number, number][]): void {
  g.fillStyle(color, 1);
  for (const [x, y] of pts) g.fillRect(x, y, 1, 1);
}

/** 輪のドット(中心 cx, cy、外の半径 r、太さ t) */
function ringDots(cx: number, cy: number, r: number, t: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = -r - 1; y <= r; y++) for (let x = -r - 1; x <= r; x++) {
    const d = Math.hypot(x + 0.5, y + 0.5);
    if (d <= r + 0.2 && d >= r - t) out.push([cx + x, cy + y]);
  }
  return out;
}

/** ×のドット(中心 cx, cy、半分の大きさ s、太さ t) */
function crossDots(cx: number, cy: number, s: number, t: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = -s; y < s; y++) for (let x = -s; x < s; x++) {
    const a = Math.abs(x + 0.5 - (y + 0.5));
    const b = Math.abs(x + 0.5 + (y + 0.5));
    if (Math.min(a, b) <= t / 2) out.push([cx + x, cy + y]);
  }
  return out;
}

/** 黒いふちをつける(まわり1ドット) */
function outlined(pts: [number, number][]): [number, number][] {
  const set = new Set(pts.map(([x, y]) => `${x},${y}`));
  const out: [number, number][] = [];
  for (const [x, y] of pts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const k = `${x + dx},${y + dy}`;
    if (!set.has(k)) { set.add(k); out.push([x + dx, y + dy]); }
  }
  return out;
}

/** 大きな○か×を描く(直径およそ 2*r ドット) */
export function drawMark(g: Phaser.GameObjects.Graphics, cx: number, cy: number, ok: boolean, r = 8): void {
  const pts = ok ? ringDots(cx, cy, r, 2.6) : crossDots(cx, cy, r - 1, 3);
  dots(g, UI.black, outlined(pts));
  dots(g, ok ? MARK_OK : MARK_NG, pts);
}
