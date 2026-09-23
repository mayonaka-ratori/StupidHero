// 共有用の画像(public/og.png、1200×630)を描くためのページの中身。ゲームには入らない。
// tools/result_og.mjs がこのファイルを読みこむページを開き、window.__og(PNGのdata URL)を受け取って保存する。
// 400×210 のドット絵を作り、ぼかさずに3倍する。

import '@fontsource/dotgothic16';
import Phaser from 'phaser';
import { UI } from '../../config';
import { generateArt } from '../../art';
import { preloadFont } from '../../ui/text';
import { drawAlley, drawBox, drawSprite, drawText, fill, frameOf, makeCanvas, upscale } from './draw';

const W = 400;
const H = 210;
const COPY = ['敵と味方の区別がつかない', 'ヒーローを導け!'];
const SUB = 'ワルか市民か、スワイプで教えよう';

function tag(ctx: CanvasRenderingContext2D, scene: Phaser.Scene, cx: number, y: number, text: string, color: number): void {
  const m = drawText(makeCanvas(1, 1).ctx, scene, 0, 0, text, { size: 12 });
  const w = m.w + 8, h = m.h + 4;
  const x = Math.round(cx - w / 2);
  fill(ctx, 0x000000, [x - 1, y - 1, w + 2, h + 2]);
  fill(ctx, 0xffffff, [x, y, w, h]);
  fill(ctx, color, [x + 1, y + 1, w - 2, h - 2]);
  drawText(ctx, scene, x + 4, y + 2, text, { size: 12, color: 0xffffff });
  // しっぽ
  fill(ctx, 0x000000, [cx - 3, y + h + 1, 7, 1], [cx - 2, y + h + 2, 5, 1], [cx - 1, y + h + 3, 3, 1]);
  fill(ctx, color, [cx - 2, y + h, 5, 1], [cx - 1, y + h + 1, 3, 1]);
}

class Og extends Phaser.Scene {
  async create(): Promise<void> {
    generateArt(this, new Set());
    await preloadFont([...COPY, SUB, 'ワル?', '市民?', 'スマホのブラウザで遊べる'], [10, 12, 16]);
    const { canvas, ctx } = makeCanvas(W, H);
    drawAlley(ctx, this, 0, -4, 90, W);

    // 右:ヒーローが、がれきの上で拳を突き上げる。背中で爆発
    const hx = 318;
    drawSprite(ctx, this, 'fx_explosion', frameOf('fx_explosion', 'play', 3), hx - 6, 104, { anchor: 'center', scale: 2 });
    drawSprite(ctx, this, 'fx_explosion', frameOf('fx_explosion', 'play', 2), hx - 58, 150, { anchor: 'center' });
    drawSprite(ctx, this, 'fx_explosion', frameOf('fx_explosion', 'play', 1), hx + 50, 146, { anchor: 'center' });
    drawSprite(ctx, this, 'fx_rubble', 0, hx, 220, { anchor: 'bottom', scale: 2 });
    drawSprite(ctx, this, 'hero', frameOf('hero', 'win_fist', 1), hx, 188, { anchor: 'feet', scale: 2 });
    drawSprite(ctx, this, 'fx_kiran', frameOf('fx_kiran', 'play', 2), hx + 16, 86, { anchor: 'center' });

    // 左:ロゴとキャッチコピー
    drawSprite(ctx, this, 'logo', '__BASE', 8, 4);
    drawBox(ctx, 8, 72, 206, 46, UI.winEdge, UI.winInner, UI.winFill);
    drawText(ctx, this, 16, 78, COPY[0], { size: 16, color: 0xffffff, shadow: 0x000000 });
    drawText(ctx, this, 16, 96, COPY[1], { size: 16, color: UI.gold, shadow: 0x000000 });

    // 下:ワルか市民か分からない2人
    const feet = 200;
    drawSprite(ctx, this, 'hoodie_bad', frameOf('hoodie_bad', 'sortIdle', 1), 60, feet, { anchor: 'feet' });
    drawSprite(ctx, this, 'granny_civ', frameOf('granny_civ', 'idle', 0), 112, feet, { anchor: 'feet' });
    drawSprite(ctx, this, 'suit_civ', frameOf('suit_civ', 'sortIdle', 2), 164, feet, { anchor: 'feet' });
    tag(ctx, this, 60, 126, 'ワル?', UI.bad);
    tag(ctx, this, 112, 132, '市民?', UI.civ);
    tag(ctx, this, 164, 126, 'ワル?', UI.bad);

    const out = upscale(canvas, 3);
    (window as unknown as { __og: string }).__og = out.toDataURL('image/png');
  }
}

new Phaser.Game({
  type: Phaser.CANVAS, width: 16, height: 16, parent: document.body, pixelArt: true,
  audio: { noAudio: true }, banner: false, scene: [Og]
});
