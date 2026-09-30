// 人の絵の塗り替え。2つを1枚のシートにまとめて作る。
// - 服の色ちがい(variants.ts の表。どの人も。0 はいまの色)
// - ステージ2の小物(腕章、首の布、ヘアバンド、スカーフ)の色。絵の中の KEY_ACCESSORY(rgb(255,0,255))のドットだけを
//   指定の色に替える
// 使い方:
//   const key = personSheet(this, person);   // person の sheetKey、accessory、colorVariant を見る
//   this.add.sprite(x, y, key).setOrigin(...originFor(person.sheetKey)).play(animKey(key, 'sortIdle'));
//   const key = accessorySheet(this, 'guard_bad', color);   // 小物の色だけ(色ちがいは0)
// キーは元のキーの後ろに、小物の色を '#ff8000'、色ちがいを '#v2' のようにつなげる(例 'guard_civ#ff8000#v2')。
// 同じ組み合わせは1回だけ作り、あとは使い回す。塗り替えるものがないときは、元のキーをそのまま返す。
// 作ったシートは purgePersonSheets で消す(遊ぶたびに増え続けないように)。

import type Phaser from 'phaser';
import type { Person } from '../logic';
import { addSheetFrames, createCanvas, createSheetAnims } from './lib';
import { KEY_ACCESSORY, animKey, sheetByKey } from './sheets';
import { VARIANTS_PER_LOOK, recolorPixels, variantSwap } from './variants';

/** KEY_ACCESSORY('rgb(255,0,255)')の R、G、B */
const [KEY_R, KEY_G, KEY_B] = KEY_ACCESSORY.slice(4, -1).split(',').map(Number);
/** 女ボスの金(logic の ACCESSORY_COLORS.gold)と、その光と影 */
const GOLD = 0xdbb624, GOLD_HI = 0xffff92, GOLD_LO = 0x926d00;
/** 塗り替えたことのある元のシート → 小物があったか */
const hasKey = new Map<string, boolean>();
/** 作った塗り替えのシートのキー(purgePersonSheets で消す) */
const made = new Set<string>();

/** personSheet に渡す人(Person のほか、ラッシュの人や通りがかりの人も) */
export interface PersonLook {
  sheetKey: string;
  accessory?: Pick<NonNullable<Person['accessory']>, 'color'>;
  colorVariant?: number;
}

/** 人の絵(小物の色と服の色ちがいを塗ったもの)のキー */
export function personSheet(scene: Phaser.Scene, p: PersonLook): string {
  return paintSheet(scene, p.sheetKey, p.accessory?.color, p.colorVariant);
}

/**
 * 仕分けに出てこない通りがかりの人(悪さの相手、UFOにさらわれる客、念力の下を通る市民など)の絵のキー。
 * 服の色ちがいは見た目だけの乱数(Math.random)で選ぶ(ゲームの中身の乱数を引くと、そのあとの流れが変わるので)
 */
export function passerSheet(scene: Phaser.Scene, sheetKey: string, color?: number): string {
  return paintSheet(scene, sheetKey, color, Math.floor(Math.random() * VARIANTS_PER_LOOK));
}

/** 小物の色だけを塗ったシートのキー(服はいまの色) */
export function accessorySheet(scene: Phaser.Scene, sheetKey: string, color?: number): string {
  return paintSheet(scene, sheetKey, color, 0);
}

const keyOf = (sheetKey: string, color: number | undefined, variant: number): string =>
  sheetKey + (color !== undefined ? `#${color.toString(16).padStart(6, '0')}` : '') + (variant ? `#v${variant}` : '');

function paintSheet(scene: Phaser.Scene, sheetKey: string, color: number | undefined, variant = 0): string {
  const swap = variantSwap(sheetKey, variant);
  const v = swap ? variant : 0;
  // 一度調べて小物がなかったシートは、小物の色を塗らない(毎回読み直さない)
  let c = color !== undefined && hasKey.get(sheetKey) !== false ? color : undefined;
  if (c === undefined && !v) return sheetKey;
  let key = keyOf(sheetKey, c, v);
  if (scene.textures.exists(key)) return key;
  const img = scene.textures.get(sheetKey).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const w = img.width, h = img.height;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  const put = (j: number, rgb: number): void => {
    const i = j * 4;
    d[i] = (rgb >> 16) & 255; d[i + 1] = (rgb >> 8) & 255; d[i + 2] = rgb & 255;
  };

  if (c !== undefined) {
    const found = paintAccessory(d, w, h, c, put);
    hasKey.set(sheetKey, found);
    if (!found) {
      c = undefined;
      if (!v) return sheetKey;
      key = keyOf(sheetKey, undefined, v);
      if (scene.textures.exists(key)) return key;
    }
  }
  if (swap) {
    const def = sheetByKey(sheetKey);
    const px = new Int32Array(w * h);
    for (let j = 0, i = 0; j < px.length; j++, i += 4) px[j] = d[i + 3] > 0 ? (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] : -1;
    const out = recolorPixels(px, w, h, def.frameW, def.frameH, swap);
    for (let j = 0; j < px.length; j++) if (out[j] !== px[j]) put(j, out[j]);
  }
  ctx.putImageData(data, 0, 0);

  const def = sheetByKey(sheetKey);
  addSheetFrames(scene.textures.addCanvas(key, canvas)!, def);
  createSheetAnims(scene, def, key);
  made.add(key);
  return key;
}

/**
 * 小物の色のもと(KEY_ACCESSORY)のドットを color に塗る。あったら true。
 * 服の色ちがいは小物のドットを変えないので、どちらを先に塗ってもよい
 */
function paintAccessory(d: Uint8ClampedArray, w: number, h: number, color: number, put: (j: number, c: number) => void): boolean {
  const isKey = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    if (d[i + 3] > 0 && d[i] === KEY_R && d[i + 1] === KEY_G && d[i + 2] === KEY_B) isKey[j] = 1;
  }
  const found = isKey.some((v) => v === 1);
  // 金(女ボスの小物)は1色だとオレンジに見えるので、上のふちを明るく、下のふちを暗くして金属の光り方にする
  const shiny = color === GOLD;
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
  return found;
}

/** 答え合わせの画面の小さな絵のキーの頭(src/scenes/review/draw.ts の thumbKey と同じ) */
const THUMB_HEAD = 'review_thumb:';

/**
 * 塗り替えたシートとそのアニメ、それから作った答え合わせの小さな絵を全部消す。
 * 新しく遊び始めるとき(タイトル、ステージを選ぶ画面、掛け合い、フリープレイの波1の通り)に呼び、
 * 遊ぶたびに絵がたまり続けないようにする。
 * 呼ぶのは、塗り替えたシートを使うシーンが止まったあと(次のシーンの create の最初)にすること
 */
export function purgePersonSheets(scene: Phaser.Scene): number {
  const keys = scene.textures.getTextureKeys().filter((k) => made.has(k));
  for (const key of keys) {
    const def = sheetByKey(key.split('#')[0]);
    for (const row of def.rows) {
      const k = animKey(key, row.name);
      if (scene.anims.exists(k)) scene.anims.remove(k);
    }
    scene.textures.remove(key);
  }
  for (const k of scene.textures.getTextureKeys()) if (k.startsWith(THUMB_HEAD) && k.includes('#')) scene.textures.remove(k);
  made.clear();
  return keys.length;
}

/** 前の名前(小物の塗り替えだけだったころ)。purgePersonSheets と同じ */
export const purgeAccessorySheets = purgePersonSheets;
