// 絵の一覧を見るための開発用ページ(/dev/art.html)。ゲームには入らない。
// ?keys=hero,fx_aura で絞りこみ、?scale=3 で拡大率を変える。
// いちばん下に、フリープレイの人に波3の小物を重ねた見本を並べる(?keys で fp_ のキーを選んだときも出る)。
// ゲームと同じく public/art/manifest.json にあるPNGを読み、ないものはコードで描く。PNGの絵にはキーの横に「PNG」と出す。
import '@fontsource/dotgothic16';
import Phaser from 'phaser';
import { type ArtManifest, generateArt, loadArtPngs } from '../art';
import { IMAGES, SHEETS, originFor, sheetSize } from '../art/sheets';
import { FREE_ITEM_SHEETS, FREE_LOOK_SHEETS, itemAnchor } from '../art/free/items';
import { FREE_ITEMS } from '../logic/freeNames';

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
// 小物を重ねた見本:小物ごとに右向きと左向きの2段。1マスは人のコマ(64×64)と、上に浮かぶ風船の分
const SAMPLE_W = 72, SAMPLE_H = 84, SAMPLE_TOP = 20;
const showSamples = !only || only.some((k) => k.startsWith('fp_'));
const samplesY = height + 14;
if (showSamples) {
  height += 14 + FREE_ITEMS.length * 2 * (SAMPLE_H * scale + 14) + pad;
  width = Math.max(width, FREE_LOOK_SHEETS.length * SAMPLE_W * scale + pad * 2);
}

class Preview extends Phaser.Scene {
  preload(): void {
    this.load.json('art-manifest', '../art/manifest.json');
  }

  create(): void {
    const skip = loadArtPngs(this, this.cache.json.get('art-manifest') as ArtManifest | undefined, '../art/');
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.draw(skip));
    this.load.start();
  }

  private draw(skip: Set<string>): void {
    // PNGを読めたキー(読めなかったキーは、Phaser の「絵がない」印が出る)
    const png = new Set([...skip].filter((k) => this.textures.exists(k)));
    generateArt(this, skip);
    const g = this.add.graphics();
    for (const it of items) {
      const label = this.add.text(pad, it.y - 14, it.key, { fontFamily: 'monospace', fontSize: '12px', color: '#f5c542' });
      // PNGで差し替わった絵には印を付ける。大きさが決まりとちがえば赤で出す
      if (png.has(it.key)) {
        const src = this.textures.get(it.key).getSourceImage() as { width: number; height: number };
        const wrong = src.width !== it.w || src.height !== it.h ? `(大きさが${src.width}x${src.height}、決まりは${it.w}x${it.h})` : '';
        this.add.text(pad + label.width + 6, it.y - 14, `PNG${wrong}`, { fontFamily: 'monospace', fontSize: '12px', color: wrong ? '#ff6a6a' : '#7cf0a0' });
      } else if (skip.has(it.key)) {
        this.add.text(pad + label.width + 6, it.y - 14, 'PNGが読めない', { fontFamily: 'monospace', fontSize: '12px', color: '#ff6a6a' });
      }
      g.fillStyle(0x3a3550, 1).fillRect(pad, it.y, it.w * scale, it.h * scale);
      this.add.image(pad, it.y, it.key, '__BASE').setOrigin(0).setScale(scale);

      if (it.fw && it.fh) {
        g.lineStyle(1, 0x6a6488, 0.6);
        for (let x = 0; x <= it.w; x += it.fw) g.lineBetween(pad + x * scale, it.y, pad + x * scale, it.y + it.h * scale);
        for (let y = 0; y <= it.h; y += it.fh) g.lineBetween(pad, it.y + y * scale, pad + it.w * scale, it.y + y * scale);
        it.rows?.forEach((r, i) => this.add.text(pad + it.w * scale + 8, it.y + i * it.fh! * scale + 2, r, { fontFamily: 'monospace', fontSize: '11px', color: '#c8c0e0' }));
      }
    }
    if (showSamples) this.drawSamples(g);
    (window as unknown as { artReady: boolean }).artReady = true;
  }

  /** フリープレイの人(待機の1コマ目)に、波3の小物を itemAnchor の場所で重ねる */
  private drawSamples(g: Phaser.GameObjects.Graphics): void {
    this.add.text(pad, samplesY - 14, '小物を重ねた見本(itemAnchor)', { fontFamily: 'monospace', fontSize: '12px', color: '#f5c542' });
    let y = samplesY;
    for (const item of FREE_ITEMS) for (const left of [false, true]) {
      this.add.text(pad, y, `${item} ${left ? '左向き' : '右向き'}`, { fontFamily: 'monospace', fontSize: '11px', color: '#c8c0e0' });
      y += 14;
      FREE_LOOK_SHEETS.forEach((key, i) => {
        const x0 = pad + i * SAMPLE_W * scale;
        g.fillStyle(0x1a1626, 1).fillRect(x0, y, (SAMPLE_W - 4) * scale, SAMPLE_H * scale);
        // 足の裏の位置
        const fx = x0 + 32 * scale, fy = y + (SAMPLE_TOP + 60) * scale;
        const a = itemAnchor(key, item);
        const itemKey = FREE_ITEM_SHEETS[item];
        const put = () => this.add.image(fx + (left ? -a!.dx : a!.dx) * scale, fy + a!.dy * scale, itemKey, 0)
          .setOrigin(...originFor(itemKey)).setScale(scale).setFlipX(left);
        if (a && !a.front) put();
        this.add.image(fx, fy, key, 0).setOrigin(...originFor(key)).setScale(scale).setFlipX(left);
        if (a && a.front) put();
        if (!a) this.add.text(x0 + 4, y + 4, 'なし', { fontFamily: 'monospace', fontSize: '11px', color: '#ff6a6a' });
      });
      y += SAMPLE_H * scale;
    }
  }
}

new Phaser.Game({
  type: Phaser.CANVAS, width: Math.max(width, 400), height: Math.max(height, 200), pixelArt: true,
  backgroundColor: '#2a2638', scene: [Preview], banner: false, audio: { noAudio: true }
});
