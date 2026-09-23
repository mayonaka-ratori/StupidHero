// ボス戦の背景に置く、ボスが暴れると壊れる物。
// 被害額はボス戦の決まり(1秒ごとに¥50万)で数えるので、ここでは stats.breakProp を呼ばない。見た目だけ。

import Phaser from 'phaser';
import { originFor } from '../../art/sheets';
import { DEPTH_OF } from './depth';

interface PropPlace {
  key: string;
  x: number;
  y: number;
}

/** 壊れる順(ボスに近い物から)。窓と看板は壁、ゴミ箱と自販機は歩道に置く */
const PLACES: PropPlace[] = [
  { key: 'prop_trash', x: 196, y: 150 },
  { key: 'prop_window', x: 178, y: 64 },
  { key: 'prop_vending', x: 134, y: 146 },
  { key: 'prop_sign', x: 118, y: 42 },
  { key: 'prop_window', x: 58, y: 70 },
  { key: 'prop_trash', x: 22, y: 150 }
];

export class BossProps {
  readonly sprites: Phaser.GameObjects.Sprite[] = [];
  private next = 0;

  constructor(scene: Phaser.Scene) {
    for (const p of PLACES) {
      const s = scene.add.sprite(p.x, p.y, p.key, 0).setOrigin(...originFor(p.key)).setDepth(DEPTH_OF.prop);
      this.sprites.push(s);
    }
  }

  /** まだ壊れていない次の物。全部壊れたら null */
  takeNext(): Phaser.GameObjects.Sprite | null {
    if (this.next >= this.sprites.length) return null;
    return this.sprites[this.next++];
  }

  /** 物の見た目の真ん中 */
  static centerOf(s: Phaser.GameObjects.Sprite): { x: number; y: number } {
    return { x: Math.round(s.x + (0.5 - s.originX) * s.width), y: Math.round(s.y + (0.5 - s.originY) * s.height) };
  }
}
