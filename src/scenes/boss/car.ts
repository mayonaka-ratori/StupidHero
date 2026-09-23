// ステージ2のボス戦:女ボスの高級車(prop_bosscar)。
// 最初は奥の列に止めてあり、女ボスが飛び乗るとエンジンをふかして手前へ出てくる。
// 車はヒーローの方(左)を向く。連打すると車ごと殴られて、少しずつへこみ、後ろへ押される。
// 絵のコマ:0 止まっている、1〜2 エンジンをふかして揺れる、3 壊れた。

import Phaser from 'phaser';
import { DEPTH_OF } from './depth';
import { spawnFx } from './effects';

export const CAR_KEY = 'prop_bosscar';
const CAR_W = 128;
const CAR_H = 56;
/** へこみの数の上限 */
const MAX_DENTS = 14;

export class BossCar {
  readonly sprite: Phaser.GameObjects.Sprite;
  private dents: Phaser.GameObjects.Graphics;
  private dentCount = 0;
  /** 置き場所(下の真ん中) */
  baseX: number;
  baseY: number;
  /** 連打で押し下げた分(ずっと残る。手が止まると少しずつ戻ってくる) */
  back = 0;
  /** 1回の連打で押された分(すぐ戻る) */
  push = 0;
  /** 暴れて突っこむ動き(tween で動かす) */
  readonly lunge = { x: 0, y: 0 };
  /** エンジンをふかしているか(コマ1〜2をくり返す) */
  revving = false;
  /** 動きを止める(ひっくり返るとき) */
  frozen = false;
  private n = 0;
  private revFrame = 1;
  private lastEngineAt = -1e9;
  private lastSmokeAt = -1e9;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.baseX = x;
    this.baseY = y;
    this.sprite = scene.add.sprite(x, y, CAR_KEY, 0).setOrigin(0.5, 1).setFlipX(true).setDepth(DEPTH_OF.parkedCar);
    this.dents = scene.add.graphics().setDepth(DEPTH_OF.parkedCar + 0.01);
    this.dents.setPosition(x - CAR_W / 2, y - CAR_H);
  }

  setDepth(d: number): this {
    this.sprite.setDepth(d);
    this.dents.setDepth(d + 0.01);
    return this;
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  /** 車の前(左の端)の、殴られるところ */
  get frontX(): number { return this.sprite.x - CAR_W / 2 + 12; }

  /** 屋根から顔を出す女ボスの足の位置(車の屋根の高さに合わせる) */
  get riderX(): number { return this.sprite.x - 14; }
  get riderY(): number { return this.sprite.y + 12; }

  /** 後ろ(右の端)の排気管 */
  get exhaustX(): number { return Math.min(210, this.sprite.x + CAR_W / 2 - 6); }

  /** 毎フレーム。now はシーンの時計、engine はエンジンの音を鳴らす関数 */
  update(now: number, jitter: number, onEngine?: (hard: boolean) => void, hard = false): void {
    this.n++;
    if (this.frozen) return;
    const x = Math.round(this.baseX + this.back + this.push + this.lunge.x + jitter);
    const y = Math.round(this.baseY + this.lunge.y + (this.revving && hard && this.n % 4 < 2 ? -1 : 0));
    this.sprite.setPosition(x, y);
    this.dents.setPosition(x - CAR_W / 2, y - CAR_H);
    if (!this.revving) return;
    // エンジンをふかす:コマ1と2を交互に(強くふかすときは速く)
    const every = hard ? 2 : 4;
    if (this.n % every === 0) { this.revFrame = this.revFrame === 1 ? 2 : 1; this.sprite.setFrame(this.revFrame); }
    if (now - this.lastEngineAt > (hard ? 480 : 760)) {
      this.lastEngineAt = now;
      onEngine?.(hard);
    }
    if (now - this.lastSmokeAt > (hard ? 140 : 260)) {
      this.lastSmokeAt = now;
      spawnFx(this.scene, 'fx_dust', this.exhaustX + Phaser.Math.Between(-2, 6), y - 10 + Phaser.Math.Between(-3, 2), { depth: DEPTH_OF.car + 0.5 });
    }
  }

  /** 車の前の半分に、へこみを1つ足す(前のほうほど多く) */
  addDent(): void {
    if (this.dentCount >= MAX_DENTS) return;
    this.dentCount++;
    // 左向きの車の、ボンネットとドアのあたり(絵の中の座標)
    const dx = 4 + Math.floor(Math.random() * Math.random() * 60);
    const dy = Phaser.Math.Between(23, 34);
    const w = Phaser.Math.Between(6, 10);
    const h = Phaser.Math.Between(3, 5);
    const g = this.dents;
    // くぼみの影
    g.fillStyle(0x9a96aa, 1).fillRect(dx, dy, w, h);
    g.fillStyle(0x6c687e, 1).fillRect(dx + 1, dy + 1, w - 2, h - 2);
    // しわ(折れ線)
    g.fillStyle(0x28243a, 1);
    for (let i = 0; i < w - 1; i++) g.fillRect(dx + i, dy + 1 + ((i >> 1) % 2) + (i % 3 === 0 ? 1 : 0), 1, 1);
    g.fillRect(dx + Math.floor(w / 2), dy, 1, h);
    // めくれた所の光
    g.fillStyle(0xffffff, 1).fillRect(dx, dy - 1, 2, 1).fillRect(dx + w - 1, dy + h - 1, 1, 1);
  }

  /** ひっくり返る前に、へこみの絵を消す(壊れたコマの絵に任せる) */
  clearDents(): void {
    this.dents.clear().setVisible(false);
  }
}
