// ボス戦の下の操作部分:撃破、負傷、被害額の窓と、連打の速さのメーター。

import Phaser from 'phaser';
import { UI } from '../../config';
import { formatYen, type StatsTracker } from '../../logic';
import { DEPTH, FS, PixelText, WindowFrame, blink } from '../../ui';

/** 撃破、負傷、被害額の窓(2行)。値が変わったときだけ書き直す */
export class BossHud {
  static readonly H = 40;
  private defeated: PixelText;
  private hurt: PixelText;
  private damage: PixelText;
  private last = { d: -1, h: -1, y: -1 };

  /** damageBlinkMs:被害額が増えたときに点滅させる長さ。ステージ2は手を止めると1秒ごとに増えるので短くする */
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, private readonly damageBlinkMs = 500) {
    new WindowFrame(scene, x, y, w, BossHud.H, 'win');
    // 名前と数字の間は、半角スペースの代わりに少しずらして置く
    const label = (lx: number, ly: number, t: string): PixelText =>
      new PixelText(scene, lx, ly, t, { size: FS.big, color: UI.textDim });
    const l1 = label(x + 7, y + 4, '撃破');
    const l2 = label(x + Math.floor(w / 2) + 4, y + 4, '負傷');
    const l3 = label(x + 7, y + 21, '被害額');
    this.defeated = new PixelText(scene, l1.x + l1.width + 3, y + 4, '', { size: FS.big, color: UI.gold });
    this.hurt = new PixelText(scene, l2.x + l2.width + 3, y + 4, '', { size: FS.big, color: UI.danger });
    this.damage = new PixelText(scene, l3.x + l3.width + 3, y + 21, '', { size: FS.big, color: UI.danger });
  }

  refresh(stats: StatsTracker): void {
    const d = stats.defeated, h = stats.civHurt, yen = stats.damage;
    if (d !== this.last.d) {
      this.defeated.setText(String(d));
      if (this.last.d >= 0) blink(this.defeated, 500);
    }
    if (h !== this.last.h) this.hurt.setText(String(h));
    if (yen !== this.last.y) {
      this.damage.setText(formatYen(yen));
      if (this.last.y >= 0) blink(this.damage, this.damageBlinkMs);
    }
    this.last = { d, h, y: yen };
  }
}

/** 連打の速さ(直前1秒の回数、0〜10)を10個の目盛りで見せる。行け!ボタンの上に重ねる */
export class RushMeter {
  private g: Phaser.GameObjects.Graphics;
  private label: PixelText;
  private shown = -1;
  private n = 0;
  constructor(scene: Phaser.Scene, private x: number, private y: number, private w: number) {
    this.g = scene.add.graphics().setDepth(DEPTH.ui + 1);
    this.label = new PixelText(scene, x, y - 1, 'はやさ', { size: FS.small, color: 0xffe0d8, outline: true }).setDepth(DEPTH.ui + 1);
  }

  setVisible(v: boolean): void {
    this.g.setVisible(v);
    this.label.setVisible(v);
  }

  /** 毎フレーム呼ぶ。tps は 0〜10 */
  update(tps: number): void {
    this.n++;
    const full = tps >= 10;
    // 満タンのときは点滅させるので毎フレーム描く
    if (tps === this.shown && !full) return;
    this.shown = tps;
    const g = this.g;
    g.clear();
    const lx = this.x + 34;
    const cellW = Math.floor((this.w - 34) / 10);
    const on = full && this.n % 4 < 2;
    for (let i = 0; i < 10; i++) {
      const cx = lx + i * cellW;
      g.fillStyle(UI.black, 1).fillRect(cx, this.y, cellW - 2, 7);
      if (i < tps) {
        const c = on ? 0xffffff : i < 4 ? UI.gold : i < 7 ? 0xff9a3a : 0xffffff;
        g.fillStyle(c, 1).fillRect(cx + 1, this.y + 1, cellW - 4, 5);
      } else {
        g.fillStyle(0x5a1010, 1).fillRect(cx + 1, this.y + 1, cellW - 4, 5);
      }
    }
  }
}
