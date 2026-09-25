// ボス戦の背景に置く、ボスが暴れると壊れる物。置く物と場所はステージごと。
// 被害額はボス戦の決まり(路地裏は1秒ごとに¥50万、地下駐車場の車は¥100万、モールの母艦は¥150万)で数えるので、
// ここでは stats.breakProp を呼ばない。見た目だけ。
// (モールの噴水だけは、倒した母艦が落ちて壊れるときに Boss.ts が stats.breakProp(def.bossDefeatProp) を呼ぶ)

import Phaser from 'phaser';
import { originFor } from '../../art/sheets';
import type { PropKind, StageId } from '../../logic';
import { DEPTH_OF } from './depth';

interface PropPlace {
  kind: PropKind;
  x: number;
  y: number;
  /** 奥の列に置く物(止めてある車)は、柱や人より奥に描く */
  depth?: number;
  /**
   * ボスが暴れても壊さずに取っておく物(takeNext で出さない)。
   * モールの噴水は、倒した母艦が落ちてくるところ(stage.def.bossDefeatProp)
   */
  spare?: boolean;
  /** 飾りとして置くだけで、ボスが暴れても壊さない物(高層ビルのソファとピアノ) */
  keep?: boolean;
  /** 絵のコマ(ソファは階ごとの色。最上階は3の赤) */
  frame?: number;
}

/**
 * 壊れる順(ボスに近い物から)に並べる。
 * 路地裏:窓と看板は壁、ゴミ箱と自販機は歩道。
 * 地下駐車場:奥の列に柱と止めてある車、手前にコーンと料金所のバー、柱に消火器の箱。
 * 右の奥(x=148 あたり)は女ボスの高級車を止める場所なので空けておく。
 * ショッピングモール:奥の列にエスカレーターとガチャガチャ、手前の左にマネキン、手前の右にショーケース。
 * 噴水は親玉のうしろ(母艦の塔の真うしろ。母艦が倒れて落ちてくるところ)に置き、暴れても壊さない。
 * 高層ビル(パーティ会場):奥の左にピアノ、手前の左にソファ、親玉の右うしろにシャンパンタワー。
 * 親玉は皿やグラスを窓へ投げる(窓のひびは choice.ts の WindowCracks)ので、置いた物は壊さない。
 * シャンパンタワーは親玉が倒れこむところ(stage.def.bossDefeatProp)なので取っておく。
 * 表にないステージは路地裏の並びを使い、そのステージの物でないものは置かない
 */
const PLACES: Partial<Record<StageId, PropPlace[]>> = {
  alley: [
    { kind: 'trash', x: 196, y: 150 },
    { kind: 'window', x: 178, y: 64 },
    { kind: 'vending', x: 134, y: 146 },
    { kind: 'sign', x: 118, y: 42 },
    { kind: 'window', x: 58, y: 70 },
    { kind: 'trash', x: 22, y: 150 }
  ],
  garage: [
    { kind: 'cone', x: 200, y: 180 },
    { kind: 'pillar', x: 206, y: 152 },
    { kind: 'cone', x: 184, y: 186 },
    { kind: 'car', x: 44, y: 148, depth: DEPTH_OF.propBack },
    { kind: 'barrier', x: 30, y: 176 },
    { kind: 'extinguisher', x: 12, y: 104 },
    { kind: 'pillar', x: 4, y: 152 },
    { kind: 'cone', x: 70, y: 168 }
  ],
  mall: [
    { kind: 'showcase', x: 198, y: 184 },
    { kind: 'gacha', x: 118, y: 146 },
    { kind: 'mannequin', x: 14, y: 190 },
    { kind: 'escalator', x: 30, y: 148, depth: DEPTH_OF.propBack },
    { kind: 'fountain', x: 176, y: 150, spare: true }
  ],
  tower: [
    { kind: 'piano', x: 30, y: 152, depth: DEPTH_OF.propBack, keep: true },
    { kind: 'sofa', x: 22, y: 206, keep: true, frame: 3 },
    { kind: 'champagne', x: 188, y: 176, spare: true }
  ]
};

export class BossProps {
  readonly sprites: Phaser.GameObjects.Sprite[] = [];
  /** 暴れても壊さずに取っておく物(spare) */
  private spares = new Map<PropKind, Phaser.GameObjects.Sprite>();
  private next = 0;

  /** kinds はそのステージに置いてよい物(stage.def.props)。表にあっても kinds にない物は置かない */
  constructor(scene: Phaser.Scene, stageId: StageId = 'alley', kinds?: readonly PropKind[]) {
    const places = PLACES[stageId] ?? PLACES.alley ?? [];
    // 柱に付ける消火器の箱は、柱より手前に描く(同じ深さなら後から足した物が手前)
    const sorted = [...places].sort((a, b) => (a.kind === 'extinguisher' ? 1 : 0) - (b.kind === 'extinguisher' ? 1 : 0));
    const made = new Map<PropPlace, Phaser.GameObjects.Sprite>();
    for (const p of sorted) {
      if (stageId !== 'alley' && kinds && !kinds.includes(p.kind)) continue;
      const key = `prop_${p.kind}`;
      const s = scene.add.sprite(p.x, p.y, key, p.frame ?? 0).setOrigin(...originFor(key)).setDepth(p.depth ?? DEPTH_OF.prop);
      made.set(p, s);
    }
    for (const p of places) {
      const s = made.get(p);
      if (!s) continue;
      if (p.spare) this.spares.set(p.kind, s);
      else if (!p.keep) this.sprites.push(s);
    }
  }

  /** 取っておいた物(spare)。なければ null */
  spare(kind: PropKind): Phaser.GameObjects.Sprite | null {
    return this.spares.get(kind) ?? null;
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
