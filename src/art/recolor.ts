// ステージ2の小物(腕章、首の布、ヘアバンド、スカーフ)を、人ごとの色に塗り替える。
// 絵の中の KEY_ACCESSORY(rgb(255,0,255))のドットだけを指定の色に替えた、別のシートを作る。
// 使い方:
//   const key = accessorySheet(this, person.sheetKey, person.accessory?.color);
//   this.add.sprite(x, y, key).setOrigin(...originFor(person.sheetKey)).play(animKey(key, 'sortIdle'));
// 同じシートと色の組み合わせは1回だけ作り、あとは使い回す(シーンをまたいでも残る)。
// 小物のないシート(ステージ1の人など)や、色がないときは、元のキーをそのまま返す。

import type Phaser from 'phaser';
import { animKey, sheetByKey } from './sheets';

const KEY_R = 255, KEY_G = 0, KEY_B = 255;
/** 小物の影(明るさを落とした色)を作るかどうかは、今は作らず1色で塗る */
const hasKey = new Map<string, boolean>();

export function accessorySheet(scene: Phaser.Scene, sheetKey: string, color?: number): string {
  if (color === undefined) return sheetKey;
  const key = `${sheetKey}#${color.toString(16).padStart(6, '0')}`;
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.get(sheetKey);
  const img = src.getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const w = img.width, h = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  let found = false;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0 && d[i] === KEY_R && d[i + 1] === KEY_G && d[i + 2] === KEY_B) {
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
      found = true;
    }
  }
  hasKey.set(sheetKey, found);
  if (!found) return sheetKey;
  ctx.putImageData(data, 0, 0);

  const def = sheetByKey(sheetKey);
  const tex = scene.textures.addCanvas(key, canvas)!;
  for (let row = 0; row < def.rows.length; row++) {
    for (let i = 0; i < def.cols; i++) {
      tex.add(row * def.cols + i, 0, i * def.frameW, row * def.frameH, def.frameW, def.frameH);
    }
  }
  def.rows.forEach((row, ri) => {
    const k = animKey(key, row.name);
    if (scene.anims.exists(k)) return;
    const frames = Array.from({ length: row.frames }, (_, i) => ({ key, frame: ri * def.cols + i }));
    scene.anims.create({ key: k, frames, frameRate: row.fps, repeat: row.loop ? -1 : 0 });
  });
  return key;
}

/** そのシートに塗り替える小物があるか(一度 accessorySheet を呼んだあとで分かる) */
export const sheetHasAccessory = (sheetKey: string): boolean => hasKey.get(sheetKey) ?? false;
