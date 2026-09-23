import Phaser from 'phaser';
import { SCENES } from '../config';
import { generateArt } from '../art';
import { IMAGES, SHEETS } from '../art/sheets';
import { layout } from '../layout';
import { allTexts, NAMES } from '../logic/content';
import { TITLES } from '../logic/titles';
import { preloadFont } from '../ui/text';

/** 画面の部品やボタンに出る字。ひらがな、カタカナ、数字、英字は全部入れておく */
const range = (a: number, b: number): string => Array.from({ length: b - a + 1 }, (_, i) => String.fromCharCode(a + i)).join('');
const BASIC_CHARS = range(0x3041, 0x3096) + range(0x30a1, 0x30fc) + range(0x21, 0x7e) + range(0xff01, 0xff5e)
  + '、。「」…ー¥円万億人秒目撃破負傷被害額逃称号記録新全国市民悪党待行共有一回遊方中断再開音声仕分結果発表路地裏面画縦横最多少高速取集'

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
    const fontReady = preloadFont([...allTexts(), ...Object.values(NAMES).flat(), ...TITLES.map((t) => t.name), BASIC_CHARS], [10, 12, 16]);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      fontReady.then(() => {
        generateArt(this, skip);
        this.scene.start(SCENES.title);
      });
    });
    this.load.start();
  }
}
