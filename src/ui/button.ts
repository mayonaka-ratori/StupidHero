// 大きな四角いボタン。指が触れた瞬間(pointerdown)に反応する。2本の指で交互に押しても毎回反応する。
// 使い方:
//   const stop = new Button(this, 8, 310, 96, 56, '待て!', { color: 'stop', onPress: () => hero.stop() });
//   const go = new Button(this, 112, 310, 96, 56, '行け!', { color: 'go' });
//   go.on('press', () => mash++);        // onPress の代わりにイベントでも受け取れる
//   go.setEnabled(false);                 // 灰色になり、押しても反応しない
//   go.setLabel('連打!');
// x, y は左上。当たり判定はまわりに pad ドット(ふつう4)広い。色は 'bad' 'civ' 'stop' 'go' か数字。

import Phaser from 'phaser';
import { UI } from '../config';
import { PixelText } from './text';
import { DEPTH, FS, UIX, darker, lighter } from './theme';

export type ButtonColor = 'bad' | 'civ' | 'stop' | 'go' | number;

export interface ButtonOptions {
  color?: ButtonColor;
  /** 文字の大きさ */
  size?: number;
  /** 文字の色(ふつうは色に合わせて自動) */
  textColor?: number;
  /** 当たり判定をまわりに何ドット広げるか */
  pad?: number;
  onPress?: (pointer: Phaser.Input.Pointer) => void;
}

const colorOf = (c: ButtonColor): number => (typeof c === 'number' ? c : UI[c]);

export class Button extends Phaser.GameObjects.Container {
  readonly w: number;
  readonly h: number;
  readonly hit: Phaser.GameObjects.Zone;
  private bg: Phaser.GameObjects.Graphics;
  private label: PixelText;
  private fill: number;
  private textColor?: number;
  private enabled = true;
  private down = new Set<number>();
  private minUntil = 0;
  private releaseTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, opt: ButtonOptions = {}) {
    super(scene, Math.round(x), Math.round(y));
    this.w = w;
    this.h = h;
    this.fill = colorOf(opt.color ?? 'civ');
    this.textColor = opt.textColor;
    this.bg = new Phaser.GameObjects.Graphics(scene);
    this.label = new PixelText(scene, 0, 0, label, { size: opt.size ?? FS.big, align: 'center' });
    this.label.setOrigin(0.5, 0.5);
    const pad = opt.pad ?? 4;
    this.hit = new Phaser.GameObjects.Zone(scene, -pad, -pad, w + pad * 2, h + pad * 2).setOrigin(0, 0);
    this.add([this.bg, this.label, this.hit]);
    this.setSize(w, h);
    this.setDepth(DEPTH.ui);
    scene.add.existing(this);

    this.hit.setInteractive();
    this.hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.enabled || !this.visible) return;
      this.down.add(p.id);
      this.minUntil = scene.time.now + 70;
      this.redraw();
      this.emit('press', p);
      opt.onPress?.(p);
    });
    const up = (p: Phaser.Input.Pointer): void => {
      if (!this.down.delete(p.id)) return;
      // すぐ離しても押した見た目が少し残るように
      const wait = Math.max(0, this.minUntil - scene.time.now);
      this.releaseTimer?.remove();
      this.releaseTimer = scene.time.delayedCall(wait, () => this.redraw());
    };
    scene.input.on('pointerup', up);
    scene.input.on('pointerupoutside', up);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off('pointerup', up);
      scene.input.off('pointerupoutside', up);
    });
    this.redraw();
  }

  get pressed(): boolean { return this.down.size > 0; }
  get isEnabled(): boolean { return this.enabled; }

  setEnabled(on: boolean): this {
    this.enabled = on;
    if (!on) this.down.clear();
    return this.redraw();
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  setColor(color: ButtonColor): this {
    this.fill = colorOf(color);
    return this.redraw();
  }

  private redraw(): this {
    const { w, h } = this;
    const g = this.bg;
    const pressed = this.pressed && this.enabled;
    const base = this.enabled ? this.fill : UIX.disabled;
    const fill = pressed ? darker(base, 0.15) : base;
    g.clear();
    // 外の白い線(角は落とす)
    g.fillStyle(this.enabled ? 0xffffff : 0x8a84a0, 1);
    g.fillRect(-1, 0, w + 2, h).fillRect(0, -1, w, h + 2);
    // 黒い線
    g.fillStyle(UI.black, 1).fillRect(0, 0, w, h);
    g.fillStyle(fill, 1).fillRect(1, 1, w - 2, h - 2);
    if (pressed) {
      // 押しているとき:上にかげ、全体が2ドット下がる
      g.fillStyle(darker(base, 0.45), 1).fillRect(1, 1, w - 2, 2);
    } else {
      g.fillStyle(lighter(base, 0.35), 1).fillRect(2, 1, w - 4, 1);
      g.fillStyle(darker(base, 0.3), 1).fillRect(1, h - 4, w - 2, 3);
    }
    const isStop = this.fill === UI.stop;
    const tc = !this.enabled ? UIX.disabledText : this.textColor ?? (isStop ? UIX.stopText : UI.text);
    this.label.setStyle({ color: tc, shadow: this.enabled && !isStop ? darker(base, 0.5) : false });
    this.label.setPosition(Math.floor(w / 2), Math.floor((h - 3) / 2) + (pressed ? 2 : 0));
    return this;
  }
}
