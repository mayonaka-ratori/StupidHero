// 結果発表の早送りのボタン(▶▶)。中断と音のボタンと同じ丸。オンのときはオレンジの丸になる。
// 使い方:
//   new FastButton(this, W - 56, 12, { isOn: () => fast, toggle: () => { fast = !fast; } });
// 速さを変えるのは Street の update(ここは見た目と押したときの呼び出しだけ)。
// locked が true の間(タイムセールラッシュ)は、暗くして押しても何もしない。戻ったら refresh() で見た目を戻す。

import Phaser from 'phaser';
import { IconButton } from '../../ui';

/** オンのときの丸の色 */
const ON_COLOR = 0xd8741f;
/** オフのときの丸の色(ほかの丸いボタンと同じ) */
const OFF_COLOR = 0x2a2448;

export interface FastOptions {
  isOn: () => boolean;
  toggle: () => void;
  /** 早送りを使えない間は true(暗くして、押しても切りかえない) */
  locked?: () => boolean;
}

export class FastButton extends IconButton {
  private fo: FastOptions;
  constructor(scene: Phaser.Scene, x: number, y: number, fo: FastOptions) {
    super(scene, x, y, 'fast');
    this.fo = fo;
    this.on('press', () => {
      if (this.fo.locked?.()) return;
      this.fo.toggle();
      this.refresh();
    });
    this.refresh();
  }

  /** いまの状態に見た目を合わせる */
  refresh(): this {
    if (!this.fo) return this;
    const locked = this.fo.locked?.() ?? false;
    this.color = this.fo.isOn() && !locked ? ON_COLOR : OFF_COLOR;
    this.setAlpha(locked ? 0.4 : 1);
    return this.setIcon('fast');
  }
}
