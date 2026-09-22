import Phaser from 'phaser';
import { FONT_FAMILY, SCENES } from '../config';
import { generateArt } from '../art';
import { IMAGES, SHEETS } from '../art/sheets';
import { layout } from '../layout';

interface ArtManifest { sheets: string[]; images: string[] }

/** 読み込み。public/art/manifest.json にあるPNGは読み込み、ないものはコードで作る。 */
export class BootScene extends Phaser.Scene {
  constructor() { super(SCENES.boot); }

  preload(): void {
    const { W, H } = layout;
    const txt = this.add.text(W / 2, H / 2, 'よみこみちゅう…', { fontFamily: 'monospace', fontSize: '12px', color: '#f5c542' });
    txt.setOrigin(0.5);
    this.load.json('art-manifest', 'art/manifest.json');
  }

  create(): void {
    const manifest = (this.cache.json.get('art-manifest') as ArtManifest | undefined) ?? { sheets: [], images: [] };
    const skip = new Set<string>();
    for (const key of manifest.sheets ?? []) {
      const def = SHEETS.find((d) => d.key === key);
      if (!def) continue;
      this.load.spritesheet(key, `art/${key}.png`, { frameWidth: def.frameW, frameHeight: def.frameH });
      skip.add(key);
    }
    for (const key of manifest.images ?? []) {
      if (!IMAGES.some((d) => d.key === key)) continue;
      this.load.image(key, `art/${key}.png`);
      skip.add(key);
    }
    const fontReady = document.fonts
      ? Promise.race([
        Promise.all([document.fonts.load(`12px "${FONT_FAMILY}"`), document.fonts.load(`16px "${FONT_FAMILY}"`)]),
        new Promise((r) => setTimeout(r, 3000))
      ])
      : Promise.resolve();
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      fontReady.then(() => {
        generateArt(this, skip);
        this.scene.start(SCENES.title);
      });
    });
    this.load.start();
  }
}
