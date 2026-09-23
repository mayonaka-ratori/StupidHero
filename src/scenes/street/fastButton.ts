// 結果発表の早送りのボタン(▶▶)。中断と音のボタンと同じ丸。オンのときはオレンジの丸になる。
// 使い方:
//   new FastButton(this, W - 56, 12, { isOn: () => fast, toggle: () => { fast = !fast; } });
// 速さを変えるのは Street の update(ここは見た目と押したときの呼び出しだけ)。

import Phaser from 'phaser';
import { IconButton } from '../../ui';

/** オンのときの丸の色 */
const ON_COLOR = 0xd8741f;
/** オフのときの丸の色(ほかの丸いボタンと同じ) */
const OFF_COLOR = 0x2a2448;

export interface FastOptions {
  isOn: () => boolean;
  toggle: () => void;
}

export class FastButton extends IconButton {
  private fo: FastOptions;
  constructor(scene: Phaser.Scene, x: number, y: number, fo: FastOptions) {
    super(scene, x, y, 'fast');
    this.fo = fo;
    this.on('press', () => {
      this.fo.toggle();
      this.refresh();
    });
    this.refresh();
  }

  /** いまの状態に見た目を合わせる */
  refresh(): this {
    if (!this.fo) return this;
    this.color = this.fo.isOn() ? ON_COLOR : OFF_COLOR;
    return this.setIcon('fast');
  }
}
