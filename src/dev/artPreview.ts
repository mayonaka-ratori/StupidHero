// 絵の一覧を見るための開発用ページ(/dev/art.html)。ゲームには入らない。
// ?keys=hero,fx_aura で絞りこみ、?scale=3 で拡大率を変える。
import '@fontsource/dotgothic16';
import Phaser from 'phaser';
import { generateArt } from '../art';
import { IMAGES, SHEETS, sheetSize } from '../art/sheets';

const params = new URLSearchParams(location.search);
const only = params.get('keys')?.split(',').filter(Boolean);
const scale = Number(params.get('scale') ?? 2);
const sheets = SHEETS.filter((d) => !only || only.includes(d.key));
const images = IMAGES.filter((d) => !only || only.includes(d.key));

const pad = 24;
let width = 0;
let height = pad;
const items: { key: string; w: number; h: number; y: number; fw?: number; fh?: number; rows?: string[] }[] = [];
for (const d of sheets) {
  const { w, h } = sheetSize(d);
  items.push({ key: d.key, w, h, y: height + 14, fw: d.frameW, fh: d.frameH, rows: d.rows.map((r) => `${r.name}(${r.frames})`) });
  height += 14 + h * scale + pad;
  width = Math.max(width, w * scale + 160);
}
for (const d of images) {
  items.push({ key: d.key, w: d.w, h: d.h, y: height + 14 });
  height += 14 + d.h * scale + pad;
  width = Math.max(width, d.w * scale + 160);
}

class Preview extends Phaser.Scene {
  create(): void {
    generateArt(this, new Set());
    const g = this.add.graphics();
    for (const it of items) {
      this.add.text(pad, it.y - 14, it.key, { fontFamily: 'monospace', fontSize: '12px', color: '#f5c542' });
      g.fillStyle(0x3a3550, 1).fillRect(pad, it.y, it.w * scale, it.h * scale);
      this.add.image(pad, it.y, it.key, '__BASE').setOrigin(0).setScale(scale)

      if (it.fw && it.fh) {
        g.lineStyle(1, 0x6a6488, 0.6);
        for (let x = 0; x <= it.w; x += it.fw) g.lineBetween(pad + x * scale, it.y, pad + x * scale, it.y + it.h * scale);
        for (let y = 0; y <= it.h; y += it.fh) g.lineBetween(pad, it.y + y * scale, pad + it.w * scale, it.y + y * scale);
        it.rows?.forEach((r, i) => this.add.text(pad + it.w * scale + 8, it.y + i * it.fh! * scale + 2, r, { fontFamily: 'monospace', fontSize: '11px', color: '#c8c0e0' }));
      }
    }
    (window as unknown as { artReady: boolean }).artReady = true;
  }
}

new Phaser.Game({
  type: Phaser.CANVAS, width: Math.max(width, 400), height: Math.max(height, 200), pixelArt: true,
  backgroundColor: '#2a2638', scene: [Preview], banner: false, audio: { noAudio: true }
});
