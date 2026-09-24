// 絵の入り口。PNGが用意されているキーは読み込んだものを使い、ないものはコードで作る。
// どの担当も作らなかったキーには、仮の四角を入れておく(ゲームが止まらないように)。

import Phaser from 'phaser';
import { createCanvas, makeArtContext } from './lib';
import { IMAGES, SHEETS, animKey, sheetSize } from './sheets';
import { generateHeroSet } from './heroSet';
import { generateWorldSet } from './worldSet';
import { generateWorld2Set } from './world2';
import { generateWorld3Set } from './world3';
import { generateFreeSet } from './free';

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
  const ctx = makeArtContext(scene, skip);
  generateHeroSet(ctx);
  generateWorldSet(ctx);
  generateWorld2Set(ctx);
  generateWorld3Set(ctx);
  generateFreeSet(ctx);
  fillPlaceholders(ctx);
  registerAnims(scene);
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
export function registerAnims(scene: Phaser.Scene): void {
  for (const def of SHEETS) {
    def.rows.forEach((row, r) => {
      const key = animKey(def.key, row.name);
      if (scene.anims.exists(key)) return;
      const frames = Array.from({ length: row.frames }, (_, i) => ({ key: def.key, frame: r * def.cols + i }));
      scene.anims.create({ key, frames, frameRate: row.fps, repeat: row.loop ? -1 : 0 });
    });
  }
}
