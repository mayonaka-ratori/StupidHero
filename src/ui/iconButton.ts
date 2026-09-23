// 小さな丸いボタン。中断(一時停止)と、音のオン/オフ。アイコンはコードで描く。
// 使い方:
//   new IconButton(this, 200, 8, 'pause', () => pause.pause());      // x, y は丸の真ん中
//   const mute = new MuteButton(this, 180, 8, {
//     isMuted: () => audio.muted,            // いまの状態を返す
//     toggle: () => audio.toggleMuted()      // 押したときに呼ぶ。新しい状態(true=消音)を返してもよい
//   });
//   mute.refresh();                          // 外で状態が変わったときに見た目を合わせる
// 丸の直径は16ドット、当たり判定は28ドット四方。

import Phaser from 'phaser';
import { UI } from '../config';
import { DEPTH, darker } from './theme';

export type IconName = 'pause' | 'soundOn' | 'soundOff' | 'play' | 'close';

const D = 16; // 直径
const HIT = 28;

/** 丸を1行ずつ塗る(ぎざぎざのないドットの丸) */
function fillCircle(g: Phaser.GameObjects.Graphics, cx: number, cy: number, d: number): void {
  const r = d / 2;
  for (let y = 0; y < d; y++) {
    const dy = y + 0.5 - r;
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    g.fillRect(cx - half, cy - r + y, half * 2, 1);
  }
}

/** アイコンを描く(真ん中が 0,0) */
export function drawIcon(g: Phaser.GameObjects.Graphics, name: IconName, color: number): void {
  g.fillStyle(color, 1);
  switch (name) {
    case 'pause':
      g.fillRect(-4, -4, 3, 8).fillRect(1, -4, 3, 8);
      break;
    case 'play':
      for (let i = 0; i < 4; i++) g.fillRect(-2 + i, -4 + i, 1, 8 - i * 2);
      break;
    case 'close':
      for (let i = -3; i <= 3; i++) { g.fillRect(i - 1, i, 2, 1); g.fillRect(-i - 1, i, 2, 1); }
      break;
    case 'soundOn':
    case 'soundOff': {
      // スピーカー
      g.fillRect(-5, -2, 2, 4);
      g.fillRect(-3, -3, 1, 6).fillRect(-2, -4, 1, 8);
      if (name === 'soundOn') {
        // 音の波
        g.fillRect(0, -1, 1, 2);
        g.fillRect(2, -3, 1, 1).fillRect(3, -2, 1, 4).fillRect(2, 2, 1, 1);
      } else {
        // ばつ
        for (let i = 0; i < 5; i++) { g.fillRect(i, -2 + i, 1, 1); g.fillRect(4 - i, -2 + i, 1, 1); }
      }
      break;
    }
  }
}

export class IconButton extends Phaser.GameObjects.Container {
  icon: IconName;
  private g: Phaser.GameObjects.Graphics;
  private pressedUntil = 0;
  protected color: number;

  constructor(scene: Phaser.Scene, x: number, y: number, icon: IconName, onPress?: () => void, color = 0x2a2448) {
    super(scene, Math.round(x), Math.round(y));
    this.icon = icon;
    this.color = color;
    this.g = new Phaser.GameObjects.Graphics(scene);
    const hit = new Phaser.GameObjects.Zone(scene, 0, 0, HIT, HIT);
    this.add([this.g, hit]);
    this.setDepth(DEPTH.ui);
    scene.add.existing(this);
    hit.setInteractive();
    hit.on('pointerdown', () => {
      if (!this.visible) return;
      this.pressedUntil = scene.time.now + 100;
      this.redraw();
      scene.time.delayedCall(110, () => this.redraw());
      this.emit('press');
      onPress?.();
    });
    this.redraw();
  }

  setIcon(icon: IconName): this {
    this.icon = icon;
    return this.redraw();
  }

  protected redraw(): this {
    const g = this.g;
    const down = this.scene.time.now < this.pressedUntil;
    const off = down ? 1 : 0;
    g.clear();
    g.fillStyle(UI.black, 1);
    fillCircle(g, 0, 1, D + 2);
    g.fillStyle(0xffffff, 1);
    fillCircle(g, 0, 0 + off, D);
    g.fillStyle(down ? darker(this.color, 0.3) : this.color, 1);
    fillCircle(g, 0, off, D - 2);
    // アイコンは押すと1ドット下がる
    g.save();
    g.translateCanvas(0, off);
    drawIcon(g, this.icon, 0xffffff);
    g.restore();
    return this;
  }
}

export interface MuteOptions {
  isMuted: () => boolean;
  toggle: () => boolean | void;
}

/** 音のオン/オフのボタン。消音のときは赤い丸にばつのスピーカー */
export class MuteButton extends IconButton {
  private mo: MuteOptions;
  constructor(scene: Phaser.Scene, x: number, y: number, mo: MuteOptions) {
    super(scene, x, y, mo.isMuted() ? 'soundOff' : 'soundOn');
    this.mo = mo;
    this.on('press', () => {
      this.mo.toggle();
      this.refresh();
    });
    this.refresh();
  }

  /** いまの状態に見た目を合わせる */
  refresh(): this {
    if (!this.mo) return this;
    const muted = this.mo.isMuted();
    this.color = muted ? UI.bad : 0x2a2448;
    return this.setIcon(muted ? 'soundOff' : 'soundOn');
  }
}
