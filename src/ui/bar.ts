// 時間のバーと体力のバー。白いふち、黒い中身、色のついた残り。
// 使い方:
//   const time = new TimeBar(this, 6, 36, 70, 5);    // 左上の位置と大きさ
//   time.setValue(left / total);                      // 0〜1。残り5秒などで赤く点滅させるときは
//   time.setDanger(left <= 5);
//   const hp = new HpBar(this, 8, 20, 200, 8, 'ボス');  // 名前つき。減った分が白く残ってから縮む
//   hp.setValue(hpLeft / 40);
//   hp.hit();                                         // 当たったときに一瞬光る

import Phaser from 'phaser';
import { UI } from '../config';
import { PixelText } from './text';
import { DEPTH, FS, UIX, darker, lighter } from './theme';

export interface BarOptions {
  color?: number;
  /** 危ないときの色 */
  dangerColor?: number;
  /** 減った分を白く残してから縮める */
  trail?: boolean;
  /** 目盛りの数(0でなし) */
  ticks?: number;
}

class Bar extends Phaser.GameObjects.Container {
  override readonly w: number;
  readonly h: number;
  value = 1;
  private shown = 1;
  private g: Phaser.GameObjects.Graphics;
  private opt: Required<BarOptions>;
  private danger = false;
  private flashFrames = 0;
  private frameCount = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opt: BarOptions = {}) {
    super(scene, Math.round(x), Math.round(y));
    this.w = w;
    this.h = h;
    this.opt = { color: UIX.time, dangerColor: UI.bad, trail: false, ticks: 0, ...opt };
    this.g = new Phaser.GameObjects.Graphics(scene);
    this.add(this.g);
    this.setDepth(DEPTH.ui);
    scene.add.existing(this);
    this.addToUpdateList();
    this.redraw();
  }

  /** 残り(0〜1) */
  setValue(v: number): this {
    const nv = Phaser.Math.Clamp(v, 0, 1);
    if (!this.opt.trail || nv > this.shown) this.shown = nv;
    this.value = nv;
    return this.redraw();
  }

  /** 赤く点滅させる */
  setDanger(on: boolean): this {
    if (on !== this.danger) { this.danger = on; this.redraw(); }
    return this;
  }

  /** 一瞬白く光る */
  hit(): this {
    this.flashFrames = 3;
    return this.redraw();
  }

  preUpdate(): void {
    this.frameCount++;
    let dirty = this.danger && this.frameCount % 8 === 0;
    if (this.flashFrames > 0) { this.flashFrames--; dirty = true; }
    if (this.shown > this.value) {
      this.shown = Math.max(this.value, this.shown - 0.012);
      dirty = true;
    }
    if (dirty) this.redraw();
  }

  protected redraw(): this {
    const { w, h } = this;
    const g = this.g;
    g.clear();
    g.fillStyle(UI.black, 1).fillRect(-2, -2, w + 4, h + 4);
    g.fillStyle(0xffffff, 1).fillRect(-1, -1, w + 2, h + 2);
    g.fillStyle(UI.black, 1).fillRect(0, 0, w, h);
    const blinkOn = this.danger && Math.floor(this.frameCount / 8) % 2 === 0;
    let color = this.danger ? (blinkOn ? this.opt.dangerColor : lighter(this.opt.dangerColor, 0.4)) : this.opt.color;
    if (this.flashFrames > 0) color = 0xffffff;
    const fw = Math.round(w * this.value);
    const tw = Math.round(w * this.shown);
    if (tw > fw) g.fillStyle(UIX.hpTrail, 1).fillRect(fw, 0, tw - fw, h);
    if (fw > 0) {
      g.fillStyle(color, 1).fillRect(0, 0, fw, h);
      if (h >= 3) {
        g.fillStyle(lighter(color, 0.45), 1).fillRect(0, 0, fw, 1);
        g.fillStyle(darker(color, 0.3), 1).fillRect(0, h - 1, fw, 1);
      }
    }
    if (this.opt.ticks > 0) {
      g.fillStyle(UI.black, 1);
      for (let i = 1; i < this.opt.ticks; i++) g.fillRect(Math.round((w * i) / this.opt.ticks), 0, 1, h);
    }
    return this;
  }
}

/** 時間のバー(黄色。危ないときは赤く点滅) */
export class TimeBar extends Bar {
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h = 5, opt: BarOptions = {}) {
    super(scene, x, y, w, h, { color: UIX.time, dangerColor: UI.bad, ...opt });
  }
}

/** 体力のバー(赤。減った分は白く残ってから縮む)。name を渡すと左上に名前を出す */
export class HpBar extends Bar {
  readonly nameText?: PixelText;
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h = 8, name?: string, opt: BarOptions = {}) {
    super(scene, x, y, w, h, { color: UIX.hp, dangerColor: UI.danger, trail: true, ...opt });
    if (name) {
      this.nameText = new PixelText(scene, 0, -FS.body - 4, name, { size: FS.body, color: UI.gold, outline: true });
      this.add(this.nameText);
    }
  }
}
