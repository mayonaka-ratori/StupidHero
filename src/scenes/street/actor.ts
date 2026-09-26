// 通りにいる1人(ヒーロー、仕分けた人、通りがかりの市民、ボス)。
// x と y は足の位置(y が大きいほど手前)。lift は跳んでいる高さ。tween はこの Actor の x, y, lift を動かし、
// 毎フレーム sync() で絵と影と札と合図を合わせる。

import Phaser from 'phaser';
import { animKey, originFor } from '../../art/sheets';
import { audio } from '../../audio';
import type { Look, Person } from '../../logic';
import { Tag } from '../../ui';

export type ActorState = 'stand' | 'down' | 'gone';

/** 小物の色を塗った絵のキー('guard_bad#db2424')から、元の絵のキーを取り出す */
const baseKey = (key: string): string => key.split('#')[0];

/** 頭のてっぺん(足からの高さ)。64ドットのコマで、足は下から4ドット上 */
export const HEAD = 50;

export class Actor {
  x: number;
  y: number;
  lift = 0;
  key: string;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  state: ActorState = 'stand';
  person?: Person;
  look?: Look;
  /** 本当は市民か(巻きぞえに当たる相手) */
  civ = false;
  tag?: Tag;
  mark?: Phaser.GameObjects.Sprite;
  stars?: Phaser.GameObjects.Sprite;
  /** 奥行きの順を少しずらす(ヒーローを同じ列の人より手前に) */
  depthBias = 0;
  /** 影の横の大きさ(ボスは大きく) */
  shadowW = 1;
  /** ステージ2:ギャングの組に呼ばれて集まりに行った(このあと自分の番は来ない) */
  called = false;
  /** pose() で止めている動きの名前(play() で流し始めたら undefined)。フリープレイの小物を、驚いたコマで隠すのに使う */
  posed?: string;

  constructor(private scene: Phaser.Scene, key: string, x: number, y: number) {
    this.key = key;
    this.x = x;
    this.y = y;
    this.shadow = scene.add.image(x, y, 'fx_shadow', 0).setOrigin(0.5, 0.5).setDepth(1);
    this.sprite = scene.add.sprite(x, y, key, 0).setOrigin(...originFor(baseKey(key)));
    this.sync();
  }

  get standing(): boolean { return this.state === 'stand'; }

  /** 動きを流す。同じ動きが流れているときはそのまま(force で最初から) */
  play(name: string, force = false, timeScale = 1): this {
    const k = animKey(this.key, name);
    if (!this.scene.anims.exists(k)) return this;
    this.posed = undefined;
    this.sprite.anims.timeScale = timeScale;
    if (!force && this.sprite.anims.currentAnim?.key === k && this.sprite.anims.isPlaying) return this;
    this.sprite.play(k);
    return this;
  }

  /** その動きの i コマ目で止める */
  pose(name: string, i = 0): this {
    const k = animKey(this.key, name);
    const anim = this.scene.anims.get(k);
    if (!anim) return this;
    this.posed = name;
    this.sprite.anims.stop();
    const f = anim.frames[Math.min(i, anim.frames.length - 1)];
    this.sprite.setFrame(f.frame.name);
    return this;
  }

  /** いま流れている動きの名前 */
  get anim(): string {
    const k = this.sprite.anims.currentAnim?.key ?? '';
    return k.slice(k.indexOf('.') + 1);
  }

  /** 左を向く(人の絵は右向きに描かれている) */
  faceLeft(left: boolean): this {
    this.sprite.setFlipX(left);
    return this;
  }

  /** 別の絵に替える(ボスが正体を現すとき) */
  setKey(key: string): this {
    this.key = key;
    this.sprite.setTexture(key, 0).setOrigin(...originFor(baseKey(key)));
    return this;
  }

  showTag(show: boolean): void {
    this.tag?.setVisible(show);
  }

  /** 頭の上に待てか行けのマークを出す(前のマークは消す)。一瞬大きく出して、ぴょんと出たように見せる */
  showMark(kind: 'stop' | 'go'): void {
    this.mark?.destroy();
    const key = kind === 'stop' ? 'fx_mark_stop' : 'fx_mark_go';
    const m = this.scene.add.sprite(this.x, this.y, key).play(animKey(key, 'play')).setScale(3).setDepth(1200);
    this.mark = m;
    this.sync();
    this.scene.time.delayedCall(50, () => m.active && m.setScale(2));
    audio.sfx('mark');
  }

  hideMark(): void {
    this.mark?.destroy();
    this.mark = undefined;
  }

  sync(): void {
    const sx = Math.round(this.x);
    const sy = Math.round(this.y - this.lift);
    this.sprite.setPosition(sx, sy).setDepth(this.y + this.depthBias);
    // 高く跳ぶほど影は小さく
    this.shadow.setPosition(sx, Math.round(this.y) - 1).setVisible(this.state !== 'gone' && this.sprite.visible);
    this.shadow.setScale((this.lift > 20 ? 0.5 : this.lift > 6 ? 0.75 : 1) * this.shadowW, 1);
    if (this.mark) this.mark.setPosition(sx, sy - HEAD - 60);
    if (this.stars) this.stars.setPosition(sx + (this.sprite.flipX ? 8 : -8), Math.round(this.y) - 16);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.tag?.destroy();
    this.mark?.destroy();
    this.stars?.destroy();
    this.state = 'gone';
  }
}
