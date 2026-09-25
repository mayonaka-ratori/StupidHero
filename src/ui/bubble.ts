// 白い吹き出し。しっぽの向きを選べる。
// 使い方:
//   const b = new Bubble(this, hero.x + 4, hero.y - 50, '光の鉄拳ーッ!!', { tail: 'down-left' });
//   // x, y はしっぽの先の位置(話している人の口や頭)。吹き出しは画面の外にはみ出ないようにずれる
//   b.setText('了解!');
//   new Bubble(this, x, y, 'まあいいか!', { tail: 'down', life: 1200 });   // 1.2秒で消える
// tail: 'down' 'down-left' 'down-right' 'up' 'up-left' 'up-right' 'left' 'right' 'none'
// 'down-left' は、しっぽの先が吹き出しの左下にあるという意味。

import Phaser from 'phaser';
import { UI } from '../config';
import { layout } from '../layout';
import { PixelText } from './text';
import { DEPTH, FS, UIX } from './theme';

export type TailDir = 'down' | 'down-left' | 'down-right' | 'up' | 'up-left' | 'up-right' | 'left' | 'right' | 'none';

export interface BubbleOptions {
  tail?: TailDir;
  size?: number;
  /** 折り返す幅(0で折り返さない) */
  wrap?: number;
  color?: number;
  /** 吹き出しの色 */
  fill?: number;
  /** このミリ秒で消える(0なら消えない) */
  life?: number;
  /** 出るときにぴょんと出る */
  pop?: boolean;
  /** 画面の左右の端から空けるすきま(画面の端に光る縁があるときに広げる) */
  margin?: number;
}

const T = 5; // しっぽの長さ
const PX = 4; // 左右のすきま
const PY = 3; // 上下のすきま
const MARGIN = 2; // 画面の端からのすきま

export class Bubble extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private label: PixelText;
  private opt: Required<BubbleOptions>;
  private box = { x: 0, y: 0, w: 0, h: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, opt: BubbleOptions = {}) {
    super(scene, Math.round(x), Math.round(y));
    this.opt = { tail: 'down-left', size: FS.body, wrap: 0, color: UIX.bubbleText, fill: UIX.bubble, life: 0, pop: true, margin: MARGIN, ...opt };
    this.g = new Phaser.GameObjects.Graphics(scene);
    this.label = new PixelText(scene, 0, 0, text, { size: this.opt.size, wrap: this.opt.wrap, color: this.opt.color, align: 'center' });
    this.add([this.g, this.label]);
    this.setDepth(DEPTH.ui);
    scene.add.existing(this);
    this.redraw();
    if (this.opt.pop) this.pop();
    if (this.opt.life > 0) scene.time.delayedCall(this.opt.life, () => this.destroy());
  }

  setText(text: string): this {
    this.label.setText(text);
    return this.redraw();
  }

  setTail(tail: TailDir): this {
    this.opt.tail = tail;
    return this.redraw();
  }

  /** しっぽの先を動かす */
  pointTo(x: number, y: number): this {
    this.setPosition(Math.round(x), Math.round(y));
    return this.redraw();
  }

  pop(): this {
    const seq = [0.5, 1.15, 1];
    let i = 0;
    this.setScale(seq[0]);
    this.scene.time.addEvent({ delay: 40, repeat: seq.length - 1, callback: () => this.setScale(seq[++i] ?? 1) });
    return this;
  }

  redraw(): this {
    const tail = this.opt.tail;
    const w = this.label.width + PX * 2;
    const h = this.label.height + PY * 2;
    // 吹き出しの左上(しっぽの先からの位置)
    let bx: number;
    let by: number;
    const vertical = tail.startsWith('down') || tail.startsWith('up');
    if (vertical) {
      bx = tail.endsWith('left') ? -8 : tail.endsWith('right') ? -(w - 8) : -Math.floor(w / 2);
      by = tail.startsWith('down') ? -T - h : T;
    } else if (tail === 'left') { bx = T; by = -Math.floor(h / 2); } else if (tail === 'right') { bx = -T - w; by = -Math.floor(h / 2); } else {
      bx = -Math.floor(w / 2); by = -Math.floor(h / 2);
    }
    // 画面からはみ出さないようにずらす(しっぽの先は動かさない)
    const minX = this.opt.margin - this.x;
    const maxX = layout.W - this.opt.margin - w - this.x;
    bx = Math.max(minX, Math.min(maxX, bx));
    by = Math.max(MARGIN - this.y, by);

    const g = this.g;
    g.clear();
    // しっぽ(1行ずつ描く)
    const rows: [number, number, number][] = []; // [位置, はじめ, おわり]
    if (vertical) {
      // 付け根のはば
      let bl: number, br: number;
      if (tail.endsWith('left')) { bl = 0; br = 6; } else if (tail.endsWith('right')) { bl = -5; br = 1; } else { bl = -3; br = 4; }
      // 付け根が吹き出しからはみ出るときは内側へ寄せる
      const shift = Math.max(bx + 3 - bl, Math.min(0, bx + w - 3 - br));
      bl += shift; br += shift;
      for (let r = 0; r < T; r++) {
        const t = r / T;
        const a = Math.round(bl + (0 - bl) * t);
        const b = Math.round(br + (1 - br) * t);
        const yy = tail.startsWith('down') ? -T + r : T - 1 - r;
        rows.push([yy, Math.min(a, b - 1), b]);
      }
    } else if (tail === 'left' || tail === 'right') {
      for (let r = 0; r < T; r++) {
        const t = r / T;
        const half = Math.round(3 * (1 - t));
        const xx = tail === 'left' ? T - 1 - r : -T + r;
        rows.push([xx, -half, half + 1]);
      }
    }
    const drawTail = (color: number, grow: number): void => {
      g.fillStyle(color, 1);
      for (const [p, a, b] of rows) {
        if (vertical) g.fillRect(a - grow, p, b - a + grow * 2, 1);
        else g.fillRect(p, a - grow, 1, b - a + grow * 2);
      }
    };
    // 黒いふち
    g.fillStyle(UI.black, 1).fillRect(bx - 1, by, w + 2, h).fillRect(bx, by - 1, w, h + 2);
    drawTail(UI.black, 1);
    if (vertical) {
      const [p, a, b] = rows[rows.length - 1] ?? [0, 0, 0];
      g.fillRect(a, tail.startsWith('down') ? p + 1 : p - 1, b - a, 1);
    } else if (rows.length) {
      const [p, a, b] = rows[rows.length - 1];
      g.fillRect(tail === 'left' ? p - 1 : p + 1, a, 1, b - a);
    }
    g.fillStyle(this.opt.fill, 1).fillRect(bx, by, w, h);
    drawTail(this.opt.fill, 0);
    this.label.setPosition(bx + PX, by + PY);
    this.box = { x: bx, y: by, w, h };
    return this;
  }

  /** 吹き出しの四角(しっぽを除く)。画面の座標(scrollFactor 0 で置いたとき) */
  boxRect(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x + this.box.x - 1, this.y + this.box.y - 1, this.box.w + 2, this.box.h + 2);
  }
}
