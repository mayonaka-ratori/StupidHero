// フリープレイの波3で、人の絵に重ねる小物(風船、とんがり帽子、紙袋)。
// 付ける場所は絵の担当の itemAnchor(src/art/free/items.ts)。右向きの値なので、左を向いている人は dx を反転し、小物も反転する。
// 使い方:
//   const items = new FreeItems(scene);
//   items.attach(actor, 'balloon');    // 付けられない見た目や、絵がないときは何もしない
//   items.sync();                      // 毎フレーム(人の sync() のあと)
// 人が吹っ飛ぶ(state が 'stand' でなくなる)と、小物は手から離れる。風船は空へ飛んでいき、帽子と紙袋は地面に落ちる。
// 驚いたコマ(pose('surprised'))の間は、手の位置が変わるので小物を隠す。人が見えない間(ワゴンの中など)も隠す。

import Phaser from 'phaser';
import { animKey, originFor } from '../../art/sheets';
import { FREE_ITEM_SHEETS, itemAnchor, type ItemAnchor } from '../../art/free/items';
import type { FreeItem } from '../../logic';
import type { Actor } from './actor';

interface Worn { a: Actor; item: FreeItem; s: Phaser.GameObjects.Sprite; at: ItemAnchor; loose: boolean }

/** 手から離れた帽子と紙袋が地面に残る時間(ミリ秒)。そのあと消える */
const DROP_KEEP_MS = 5000;

export class FreeItems {
  private worn: Worn[] = [];

  constructor(private scene: Phaser.Scene) {}

  /** 人に小物を付ける。付けられない見た目(買い物袋の女性に紙袋など)や、絵がまだないときは付けない */
  attach(a: Actor, item: FreeItem): void {
    const key = FREE_ITEM_SHEETS[item];
    const at = itemAnchor(a.key, item);
    if (!at || !this.scene.textures.exists(key)) return;
    const s = this.scene.add.sprite(a.x, a.y, key, 0).setOrigin(...originFor(key));
    if (item === 'balloon' && this.scene.anims.exists(animKey(key, 'float'))) {
      s.play(animKey(key, 'float'));
      s.anims.setProgress(Math.random());
    }
    this.worn.push({ a, item, s, at, loose: false });
    this.place(this.worn[this.worn.length - 1]);
  }

  /** その人が持っている風船のいちばん上の y(風船がなければ null)。吹き出しを重ねないために使う */
  topOf(a: Actor): number | null {
    const w = this.worn.find((x) => x.a === a && !x.loose && x.item === 'balloon');
    if (!w) return null;
    return Math.round(a.y - a.lift + w.at.dy) - w.s.height;
  }

  /** その人の小物(なければ null) */
  itemOf(a: Actor): FreeItem | null {
    return this.worn.find((w) => w.a === a && !w.loose)?.item ?? null;
  }

  sync(): void {
    for (const w of this.worn) {
      if (w.loose) continue;
      if (!w.s.active) { w.loose = true; continue; }
      if (w.a.state === 'gone') { w.s.destroy(); w.loose = true; continue; }
      if (w.a.state !== 'stand') { this.drop(w); continue; }
      this.place(w);
    }
    this.worn = this.worn.filter((w) => !w.loose || w.s.active);
  }

  /** 人に合わせて置く(足の裏からのずれ。左向きは反転) */
  private place(w: Worn): void {
    const a = w.a;
    const left = a.sprite.flipX;
    const dx = left ? -w.at.dx : w.at.dx;
    w.s.setPosition(Math.round(a.x + dx), Math.round(a.y - a.lift + w.at.dy)).setFlipX(left);
    w.s.setDepth(a.y + a.depthBias + (w.at.front ? 0.1 : -0.1));
    w.s.setVisible(a.sprite.visible && a.posed !== 'surprised');
  }

  /** 手から離す:風船は空へ飛んでいき、帽子と紙袋は地面に落ちる */
  private drop(w: Worn): void {
    w.loose = true;
    const s = w.s;
    s.setVisible(true);
    const x0 = s.x;
    const y0 = s.y;
    if (w.item === 'balloon') {
      // ゆらゆらしながら上へ(画面の上の外まで)
      const o = { t: 0 };
      const drift = Math.random() < 0.5 ? -1 : 1;
      this.scene.tweens.add({
        targets: o, t: 1, duration: 1800, ease: 'Quad.easeIn',
        onUpdate: () => s.active && s.setPosition(Math.round(x0 + drift * o.t * 24 + Math.sin(o.t * 10) * 3), Math.round(y0 - o.t * (y0 + 60))),
        onComplete: () => s.destroy()
      });
      return;
    }
    // 帽子と紙袋:小さく跳ねて、人のそばの地面に落ちる
    const ground = w.a.y + 2;
    const toX = x0 + (Math.random() < 0.5 ? -10 : 10);
    // 帽子は下の端、紙袋は上の端が基準なので、地面に置いたときの y をそろえる
    const toY = w.item === 'hat' ? ground : ground - s.height;
    const o = { t: 0 };
    s.setDepth(ground);
    this.scene.tweens.add({
      targets: o, t: 1, duration: 420, ease: 'Sine.easeIn',
      onUpdate: () => s.active && s.setPosition(Math.round(x0 + (toX - x0) * o.t), Math.round(y0 + (toY - y0) * o.t - Math.sin(Math.PI * o.t) * 12))
    });
    this.scene.time.delayedCall(DROP_KEEP_MS, () => s.destroy());
  }
}
