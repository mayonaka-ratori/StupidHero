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
/** 女ボスの金(logic の ACCESSORY_COLORS.gold)と、その光と影 */
const GOLD = 0xdbb624, GOLD_HI = 0xffff92, GOLD_LO = 0x926d00;
/** 塗り替えたことのある元のシート → 小物があったか */
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
  const isKey = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    if (d[i + 3] > 0 && d[i] === KEY_R && d[i + 1] === KEY_G && d[i + 2] === KEY_B) isKey[j] = 1;
  }
  const found = isKey.some((v) => v === 1);
  // 金(女ボスの小物)は1色だとオレンジに見えるので、上のふちを明るく、下のふちを暗くして金属の光り方にする
  const shiny = color === GOLD;
  const put = (j: number, c: number): void => {
    const i = j * 4;
    d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255;
  };
  for (let j = 0; j < isKey.length; j++) {
    if (!isKey[j]) continue;
    if (!shiny) { put(j, color); continue; }
    const x = j % w, y = (j - x) / w;
    const up = y > 0 && isKey[j - w] === 1;
    const down = y < h - 1 && isKey[j + w] === 1;
    if (!up) put(j, (x + y) % 5 === 0 ? 0xffffff : GOLD_HI);
    else if (!down) put(j, GOLD_LO);
    else put(j, color);
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

/**
 * 塗り替えたシート(キーに # がつくもの)とそのアニメを全部消す。ステージ2を離れたとき
 * (タイトルやステージを選ぶ画面に来たとき)に呼び、遊ぶたびに絵がたまり続けないようにする。
 * 呼ぶのは、塗り替えたシートを使うシーンが止まったあと(次のシーンの create の最初)にすること
 */
export function purgeAccessorySheets(scene: Phaser.Scene): number {
  const keys = scene.textures.getTextureKeys().filter((k) => k.includes('#') && hasKey.has(k.split('#')[0]));
  for (const key of keys) {
    const def = sheetByKey(key.split('#')[0]);
    for (const row of def.rows) {
      const k = animKey(key, row.name);
      if (scene.anims.exists(k)) scene.anims.remove(k);
    }
    scene.textures.remove(key);
  }
  return keys.length;
}
