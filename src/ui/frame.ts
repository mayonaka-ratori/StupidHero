// メガドライブ風のウィンドウの枠。外から順に、黒1ドット、明るいふち1ドット、内側の線1ドット、中の塗り。
// 使い方:
//   const w = new WindowFrame(this, 8, 260, 200, 40, 'win');   // 青いウィンドウ(左上の位置と大きさ)
//   w.setKind('alarm');                                         // 'win' 青 / 'cut' 赤紫のカットイン / 'alarm' 赤い警告
//   w.setBox(8, 250, 200, 50);                                  // 位置と大きさを変える
//   drawFrame(g, 0, 0, 100, 40, 'win');                         // 自分のGraphicsに描くだけのとき
// 中身を置く位置は FRAME_PAD(ふち3ドット)の内側。文字はさらに2〜4ドットあけると見やすい。

import Phaser from 'phaser';
import { UI } from '../config';
import { DEPTH, UIX } from './theme';

export type FrameKind = 'win' | 'cut' | 'alarm';

/** ふちの太さ(黒+ふち+内側の線) */
export const FRAME_PAD = 3;

const FRAME_COLORS: Record<FrameKind, { edge: number; inner: number; fill: number }> = {
  win: { edge: UI.winEdge, inner: UIX.winInner, fill: UI.winFill },
  cut: { edge: UI.cutEdge, inner: UIX.cutInner, fill: UI.cutFill },
  alarm: { edge: UIX.alarmEdge, inner: UIX.alarmInner, fill: UI.cutAlarm }
};

/** Graphics に枠を描く。角は1ドット落として少し丸くする */
export function drawFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, kind: FrameKind = 'win'): void {
  const c = FRAME_COLORS[kind];
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  g.fillStyle(UI.black, 1);
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle(c.edge, 1);
  g.fillRect(x + 2, y + 1, w - 4, h - 2);
  g.fillRect(x + 1, y + 2, w - 2, h - 4);
  g.fillStyle(c.inner, 1);
  g.fillRect(x + 2, y + 2, w - 4, h - 4);
  g.fillStyle(c.fill, 1);
  g.fillRect(x + 3, y + 3, w - 6, h - 6);
}

export class WindowFrame extends Phaser.GameObjects.Graphics {
  kind: FrameKind;
  boxW: number;
  boxH: number;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, kind: FrameKind = 'win') {
    super(scene, { x: Math.round(x), y: Math.round(y) });
    this.kind = kind;
    this.boxW = w;
    this.boxH = h;
    this.setDepth(DEPTH.ui);
    scene.add.existing(this);
    this.redraw();
  }

  setKind(kind: FrameKind): this {
    if (kind !== this.kind) { this.kind = kind; this.redraw(); }
    return this;
  }

  setBox(x: number, y: number, w: number, h: number): this {
    this.setPosition(Math.round(x), Math.round(y));
    this.boxW = w;
    this.boxH = h;
    return this.redraw();
  }

  redraw(): this {
    this.clear();
    drawFrame(this, 0, 0, this.boxW, this.boxH, this.kind);
    return this;
  }
}
