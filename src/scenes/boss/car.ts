// ステージ2のボス戦:女ボスの高級車(prop_bosscar)。
// 最初は奥の列に止めてあり、女ボスが飛び乗るとエンジンをふかして手前へ出てくる。
// 車はヒーローの方(左)を向く。連打すると車ごと殴られて、少しずつへこみ、後ろへ押される。
// 絵のコマ:0 止まっている、1〜2 エンジンをふかして揺れる、3 壊れた。
// ステージ3の親玉の母艦(prop_mothership)も同じ作りで動かす(MOTHERSHIP_LOOK)。違うのは、空に浮かぶこと
// (浮かぶ2コマをくり返す。エンジンと排気の煙はない)と、firing の間は光線のコマ(2)を出すことだけ。

import Phaser from 'phaser';
import { DEPTH_OF } from './depth';
import { spawnFx } from './effects';

/** 乗り物の絵と、殴られるところや乗った人の位置(絵の中の座標) */
export interface VehicleLook {
  key: string;
  w: number;
  h: number;
  /** 左向きにするために絵を裏返すか(車の絵は右向き) */
  flipX: boolean;
  /** 空に浮かぶか(母艦)。浮かぶ2コマをくり返し、エンジンの音と排気の煙は出さない */
  flies: boolean;
  /** 殴られるところの、左の端からの距離 */
  frontInset: number;
  /** 乗った人の足の位置(下の真ん中から) */
  rider: { dx: number; dy: number };
  /** 殴られるところの高さ(下の端から上へ) */
  hitDy: number;
  /** 体力が少ないときの煙の高さ(下の端から上へ) */
  smokeDy: number;
  /** へこみを付けるところ。左の端から x0〜x0+spread(左ほど多く)、上から y0〜y1 */
  dent: { x0: number; spread: number; y0: number; y1: number };
}

/** ステージ2:女ボスの高級車 */
export const CAR_LOOK: VehicleLook = {
  key: 'prop_bosscar', w: 128, h: 56, flipX: true, flies: false,
  frontInset: 12, rider: { dx: -14, dy: 12 }, hitDy: 26, smokeDy: 36,
  // 左向きの車の、ボンネットとドアのあたり
  dent: { x0: 4, spread: 60, y0: 23, y1: 34 }
};

/**
 * ステージ3:親玉の母艦(MALL_SHEETS.mothership)。160×64、左右対称なので裏返さない。
 * 親玉は真ん中の塔の中にいて、塔から上だけが見える(足は下の端に置き、塔と円盤で隠す)。
 * 殴られるのは円盤の左のふち(下の端から40ドット上)
 */
export const MOTHERSHIP_LOOK: VehicleLook = {
  key: 'prop_mothership', w: 160, h: 64, flipX: false, flies: true,
  frontInset: 10, rider: { dx: 0, dy: 0 }, hitDy: 40, smokeDy: 46,
  // 円盤の左の半分
  dent: { x0: 12, spread: 56, y0: 16, y1: 24 }
};

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
  /** 母艦:光線を出しているか(コマ2) */
  firing = false;
  /** 動きを止める(ひっくり返るとき) */
  frozen = false;
  private n = 0;
  private revFrame = 1;
  private lastEngineAt = -1e9;
  private lastSmokeAt = -1e9;

  constructor(private scene: Phaser.Scene, x: number, y: number, readonly look: VehicleLook = CAR_LOOK) {
    this.baseX = x;
    this.baseY = y;
    this.sprite = scene.add.sprite(x, y, look.key, 0).setOrigin(0.5, 1).setFlipX(look.flipX).setDepth(DEPTH_OF.parkedCar);
    this.dents = scene.add.graphics().setDepth(DEPTH_OF.parkedCar + 0.01);
    this.dents.setPosition(x - look.w / 2, y - look.h);
  }

  /** 空に浮かぶ乗り物(母艦)か */
  get flies(): boolean { return this.look.flies; }

  setVisible(v: boolean): this {
    this.sprite.setVisible(v);
    this.dents.setVisible(v);
    return this;
  }

  setDepth(d: number): this {
    this.sprite.setDepth(d);
    this.dents.setDepth(d + 0.01);
    return this;
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  /** 車の前(左の端)の、殴られるところ */
  get frontX(): number { return this.sprite.x - this.look.w / 2 + this.look.frontInset; }
  /** 殴られるところの高さ */
  get hitY(): number { return this.sprite.y - this.look.hitDy; }
  /** 体力が少ないときに煙が出る高さ */
  get smokeY(): number { return this.sprite.y - this.look.smokeDy; }

  /** 屋根から顔を出す女ボスの足の位置(車の屋根の高さに合わせる。母艦は塔の中) */
  get riderX(): number { return this.sprite.x + this.look.rider.dx; }
  get riderY(): number { return this.sprite.y + this.look.rider.dy; }

  /** 後ろ(右の端)の排気管 */
  get exhaustX(): number { return Math.min(210, this.sprite.x + this.look.w / 2 - 6); }

  /** 毎フレーム。now はシーンの時計、engine はエンジンの音を鳴らす関数 */
  update(now: number, jitter: number, onEngine?: (hard: boolean) => void, hard = false): void {
    this.n++;
    if (this.frozen) return;
    const x = Math.round(this.baseX + this.back + this.push + this.lunge.x + jitter);
    const y = Math.round(this.baseY + this.lunge.y + (this.revving && hard && this.n % 4 < 2 ? -1 : 0));
    this.sprite.setPosition(x, y);
    this.dents.setPosition(x - this.look.w / 2, y - this.look.h);
    if (this.flies) {
      // 母艦:浮かぶ2コマをゆっくりくり返す(コマ1は1ドット下がっている)。光線の間はコマ2
      this.sprite.setFrame(this.firing ? 2 : Math.floor(this.n / 12) % 2);
      return;
    }
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
    // 左向きの車の、ボンネットとドアのあたり(絵の中の座標。母艦は円盤の左の半分)
    const d = this.look.dent;
    const dx = d.x0 + Math.floor(Math.random() * Math.random() * d.spread);
    const dy = Phaser.Math.Between(d.y0, d.y1);
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
