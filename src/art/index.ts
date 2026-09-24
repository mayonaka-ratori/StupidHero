// 絵の入り口。PNGが用意されているキーは読み込んだものを使い、ないものはコードで作る。
// どの担当も作らなかったキーには、仮の四角を入れておく(ゲームが止まらないように)。

import Phaser from 'phaser';
import { createCanvas, createSheetAnims, makeArtContext } from './lib';
import { IMAGES, SHEETS, sheetSize } from './sheets';
import { generateHeroSet } from './heroSet';
import { generateWorldSet } from './worldSet';
import { generateWorld2Set } from './world2';
import { generateWorld3Set } from './world3';

/** public/art/manifest.json の中身。PNGを用意したキーを並べる */
export interface ArtManifest { sheets?: string[]; images?: string[] }

/**
 * manifest にあるPNGを読み込みに並べて、並べたキーを返す(generateArt の skip に渡す)。
 * 表(SHEETS と IMAGES)にないキーは読まない。dir は art/ の置き場(ゲームは 'art/'、dev/ のページは '../art/')。
 * 並べたあとで scene.load.start() を呼び、読み終わってから generateArt を呼ぶ。
 */
export function loadArtPngs(scene: Phaser.Scene, manifest: ArtManifest | undefined, dir = 'art/'): Set<string> {
  const skip = new Set<string>();
  for (const key of manifest?.sheets ?? []) {
    const def = SHEETS.find((d) => d.key === key);
    if (!def) continue;
    scene.load.spritesheet(key, `${dir}${key}.png`, { frameWidth: def.frameW, frameHeight: def.frameH });
    skip.add(key);
  }
  for (const key of manifest?.images ?? []) {
    if (!IMAGES.some((d) => d.key === key)) continue;
    scene.load.image(key, `${dir}${key}.png`);
    skip.add(key);
  }
  return skip;
}

export function generateArt(scene: Phaser.Scene, skip: Set<string>): void {
  const ctx = makeArtContext(scene, usablePngs(scene, skip));
  generateHeroSet(ctx);
  generateWorldSet(ctx);
  generateWorld2Set(ctx);
  generateWorld3Set(ctx);
  fillPlaceholders(ctx);
  registerAnims(scene);
}

/**
 * 読めたPNGのキーだけを返す。読めなかったものと大きさが表と合わないものはコードで描く絵にもどす
 * (大きさが合わないPNGは消しておく。残すとコードの絵を上から登録できない)。
 */
function usablePngs(scene: Phaser.Scene, skip: Set<string>): Set<string> {
  const ok = new Set<string>();
  for (const key of skip) {
    if (!scene.textures.exists(key)) {
      console.warn(`art: ${key}.png が読めないので、コードで描いた絵を使う`);
      continue;
    }
    const sheet = SHEETS.find((d) => d.key === key);
    const want = sheet ? sheetSize(sheet) : IMAGES.find((d) => d.key === key);
    const img = scene.textures.get(key).getSourceImage();
    if (want && (img.width !== want.w || img.height !== want.h)) {
      console.warn(`art: ${key}.png の大きさが ${img.width}×${img.height}(表では ${want.w}×${want.h})なので、コードで描いた絵を使う`);
      scene.textures.remove(key);
      continue;
    }
    ok.add(key);
  }
  return ok;
}

function fillPlaceholders(ctx: ReturnType<typeof makeArtContext>): void {
  for (const def of SHEETS) {
    if (ctx.scene.textures.exists(def.key)) continue;
    const { w, h } = sheetSize(def);
    const { canvas, ctx: g } = createCanvas(w, h);
    for (let r = 0; r < def.rows.length; r++) for (let i = 0; i < def.rows[r].frames; i++) {
      g.fillStyle = (r + i) % 2 ? '#ff00ff' : '#b000b0';
      g.fillRect(i * def.frameW + 2, r * def.frameH + 2, def.frameW - 4, def.frameH - 4);
    }
    ctx.addSheet(def, canvas);
  }
  for (const def of IMAGES) {
    if (ctx.scene.textures.exists(def.key)) continue;
    const { canvas, ctx: g } = createCanvas(def.w, def.h);
    g.fillStyle = '#301030';
    g.fillRect(0, 0, def.w, def.h);
    ctx.addImage(def, canvas);
  }
}

/** SHEETS の表から、すべてのアニメーションを登録する */
function registerAnims(scene: Phaser.Scene): void {
  for (const def of SHEETS) createSheetAnims(scene, def);
}
