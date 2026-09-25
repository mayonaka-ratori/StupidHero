// ステージ4(高層ビル)の仕分けの画面の、左上の照明と左下の机と小物。もれ(紫の光、浮いた小物)と、
// 紛らわしい市民の理由(切れかけの蛍光灯、手品の糸、風船)をここで出す(docs/STAGE4.md の「もれ」「紛らわしい市民」)。
//   const desk = new TowerDesk(this, { floor: wave.no, lamp: TOWER_LAMP, desk: TOWER_DESK, depth: Z.dim + 0.6 });
//   desk.setLook(leakLook(leakSpots(person)), caneTip);   // 人が出た瞬間に。caneTip は手品の糸を引くつえの先(なければ省く)
//   desk.setLook(CALM_LOOK);                              // 人がいないときと中断中
//   desk.update(time);                                    // 毎フレーム(浮いた小物のゆれ、糸を引き直す)
// 場所の数字は src/art/towerSpots.ts。container を渡すと、その中に置く(掛け合いのお手本の小さな画面)。
// もれは人が出ている間ずっと同じで、待っても増えたり減ったりしない。
// 「光と揺れを弱くする」(settings.reduceFx)のときは、火花のまたたきと小物の上下のゆれを止める(色と絵はそのまま)。

import Phaser from 'phaser';
import { animKey, frameIndex, sheetByKey } from '../../art/sheets';
import { magicianCaneTips } from '../../art/world4/people';
import {
  CALM_LOOK, FLOAT_PX, TOWER_ITEM_FRAMES, TOWER_ITEM_ROWS, TOWER_ITEM_SIZE, itemRestDy, towerDeskFor, type LeakLook, type TowerDeskSpot
} from '../../art/towerSpots';
import type { WaveNo } from '../../logic';
import { settings } from '../../settings';

/** 手品の糸と風船のひもの色(うすい灰色。紫にしない)と、その右下の影(明るい床の上でも見えるように) */
const THREAD = 0xd0d0dc;
const THREAD_SHADOW = 0x3c3848;
/** 風船の色(赤。紫と黄緑は使わない)。明るい所、ふち、ひも */
const BALLOON = 0xe8404c;
const BALLOON_HI = 0xffa0a8;
const BALLOON_DARK = 0xa01e30;
const OUTLINE = 0x240024;
/** 浮いた小物の上下のゆれ(1往復のミリ秒) */
const BOB_MS = 1400;

export interface TowerDeskOptions {
  floor: WaveNo;
  /** 照明の上の真ん中と、何倍で出すか(火花も同じ倍率) */
  lamp: { x: number; y: number; scale?: number };
  /** 机の下の真ん中 */
  desk: { x: number; y: number };
  depth: number;
  /** 手品の糸の重なり(人より前に出すとき) */
  threadDepth?: number;
  /** この中に置く(省くとシーンにじかに置く) */
  container?: Phaser.GameObjects.Container;
}

/** つえの先の点を返す(その時の人のコマで変わる)。null なら糸を引かない */
export type CaneTip = () => { x: number; y: number } | null;

/** 手品師のつえの先(仕分けの動きの4コマ)。はじめて使うときに1回だけ計算する */
let sortIdleTips: readonly (readonly [number, number])[] | null = null;

/**
 * 手品師の絵 s のつえの先(s と同じ座標。scale は人の絵の倍率)。仕分けの動き(行2)のコマに合わせる。
 * それ以外のコマ(横から入ってくる途中の歩きなど)は、仕分けの動きの1コマ目の場所を使う。左右反転していれば左右を入れかえる
 */
export function caneTipOf(s: Phaser.GameObjects.Sprite, scale: number): CaneTip {
  return () => {
    if (!s.visible) return null;
    const tips = (sortIdleTips ??= magicianCaneTips().sortIdle.map((p) => [p[0], p[1]] as const));
    const d = sheetByKey(s.texture.key.split('#')[0]);
    const i = Number(s.frame.name) - frameIndex(d, 'sortIdle', 0);
    const [tx, ty] = tips[i >= 0 && i < tips.length ? i : 0];
    const fx = s.flipX ? d.frameW - (tx + 0.5) : tx + 0.5;
    return {
      x: Math.floor(s.x + (fx - s.originX * d.frameW) * scale),
      y: Math.floor(s.y + (ty + 0.5 - s.originY * d.frameH) * scale)
    };
  };
}

export class TowerDesk {
  readonly spot: TowerDeskSpot;
  private lamp: Phaser.GameObjects.Sprite;
  private lampSparks: Phaser.GameObjects.Sprite[];
  private desk: Phaser.GameObjects.Image;
  private items: Phaser.GameObjects.Sprite[];
  private haze: Phaser.GameObjects.Sprite;
  private itemSpark: Phaser.GameObjects.Sprite;
  private thread: Phaser.GameObjects.Graphics;
  private balloon: Phaser.GameObjects.Graphics;
  private look: LeakLook = CALM_LOOK;
  private tip: CaneTip | null = null;
  private restY: number;
  private spotX: number;
  private reduce = settings.reduceFx;
  private lastThread = '';

  constructor(private scene: Phaser.Scene, opt: TowerDeskOptions) {
    this.spot = towerDeskFor(opt.floor);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { opt.container?.add(o); return o; };
    const d = opt.depth;
    const { x: lx, y: ly } = opt.lamp;
    const ls = opt.lamp.scale ?? 1;
    this.lamp = add(scene.add.sprite(lx, ly, 'fx_psy_lamp', 0).setOrigin(0.5, 0).setScale(ls).setDepth(d));
    // 照明の火花は、左の下と右の上
    this.lampSparks = [
      add(scene.add.sprite(lx - 17 * ls, ly + 15 * ls, 'fx_psy_spark', 0).setScale(ls).setDepth(d + 0.2)),
      add(scene.add.sprite(lx + 22 * ls, ly + 5 * ls, 'fx_psy_spark', 2).setScale(ls).setDepth(d + 0.2))
    ];
    const { x: dx, y: dy } = opt.desk;
    this.desk = add(scene.add.image(dx, dy, 'tw_desk').setOrigin(0.5, 1).setDepth(d));
    const spotItem = this.spot.items[0];
    this.spotX = dx + spotItem.dx;
    this.restY = dy + itemRestDy(spotItem.item);
    // もやは小物の後ろ(小物の形がはっきり見えるように)
    this.haze = add(scene.add.sprite(this.spotX, this.restY - FLOAT_PX, 'fx_psy_haze', 0).setDepth(d + 0.1));
    this.items = this.spot.items.map(({ item, dx: ix }) =>
      add(scene.add.sprite(dx + ix, dy + itemRestDy(item), 'fx_psy_items', TOWER_ITEM_FRAMES[item]).setDepth(d + 0.2)));
    this.itemSpark = add(scene.add.sprite(this.spotX + 7, this.restY - FLOAT_PX - 6, 'fx_psy_spark', 1).setDepth(d + 0.3));
    this.thread = add(scene.add.graphics().setDepth(opt.threadDepth ?? d + 0.3));
    this.balloon = add(scene.add.graphics().setDepth(d + 0.3));
    this.apply();
  }

  /** 画面に置いたもの(「まわり」の窓に映すもの) */
  get objects(): Phaser.GameObjects.GameObject[] {
    return [this.lamp, ...this.lampSparks, this.desk, ...this.items, this.haze, this.itemSpark, this.thread, this.balloon];
  }

  /** いまの見せ方 */
  get current(): LeakLook { return this.look; }

  /** 見せ方を変える。tip は手品の糸を引くつえの先 */
  setLook(look: LeakLook, tip: CaneTip | null = null): void {
    this.look = look;
    this.tip = tip;
    this.lastThread = '';
    this.apply();
  }

  private apply(): void {
    const L = this.look;
    this.lamp.setFrame(L.lampFrame);
    for (const s of this.lampSparks) s.setVisible(L.lampSparks);
    this.haze.setVisible(L.haze);
    this.itemSpark.setVisible(L.haze);
    this.balloon.setVisible(L.balloon);
    this.thread.setVisible(L.thread);
    this.reduce = !settings.reduceFx;   // 次の update で火花の動きを決め直す
    this.update(this.scene.time.now);
  }

  update(now: number): void {
    const L = this.look;
    // 火花のまたたきともやの動き。光と揺れを弱くするときは1コマ目で止める
    const reduce = settings.reduceFx;
    if (reduce !== this.reduce) {
      this.reduce = reduce;
      const sparks = [...this.lampSparks, this.itemSpark];
      for (const s of [...sparks, this.haze]) {
        if (reduce) s.stop().setFrame(0);
        else s.play(animKey(s.texture.key, 'play'));
      }
      // 火花がそろって光らないように、コマをずらす
      if (!reduce) sparks.forEach((s, i) => s.anims.setProgress(((i * 3) % 4) / 4));
    }
    // 1つ目の小物:浮いているときは少し上で、ゆっくり1ドット上下する
    const bob = L.itemFloat && !reduce ? (Math.sin((now / BOB_MS) * Math.PI * 2) > 0 ? 1 : 0) : 0;
    const y = this.restY - (L.itemFloat ? FLOAT_PX + bob : 0);
    const item = this.items[0];
    if (item.y !== y) item.setY(y);
    if (L.haze && this.haze.y !== y) { this.haze.setY(y); this.itemSpark.setY(y - 6); }
    if (L.balloon) this.drawBalloon(y);
    if (L.thread) this.drawThread(y);
  }

  /** 小物の上の端(その高さ y のとき) */
  private itemTop(y: number): number {
    const spot = this.spot.items[0].item;
    return y - TOWER_ITEM_SIZE / 2 + TOWER_ITEM_ROWS[spot].top;
  }

  /** 小物の上に、ひもで結んだ小さな赤い風船 */
  private drawBalloon(y: number): void {
    const key = `b${y}`;
    if (this.lastThread === key) return;
    this.lastThread = key;
    const g = this.balloon.clear();
    const top = this.itemTop(y);
    const x = this.spotX;
    // ひも(小物の上から、少し右へ曲がって上へ9ドット)。結び目は小物のすぐ上
    const pts: [number, number][] = [];
    for (let i = 1; i <= 9; i++) pts.push([x + (i >= 5 && i <= 7 ? 1 : 0), top - i]);
    drawLine(g, pts);
    // 風船(7×8の玉と、下の結び口)
    const bx = x - 3, by = top - 18;
    const rows = ['..ooo..', '.orrro.', 'orhrrro', 'orhrrro', 'orrrrdo', 'orrrrdo', '.orrdo.', '..ooo..', '...k...'];
    const col: Record<string, number> = { o: OUTLINE, r: BALLOON, h: BALLOON_HI, d: BALLOON_DARK, k: BALLOON_DARK };
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = col[row[i]];
        if (c !== undefined) g.fillStyle(c, 1).fillRect(bx + i, by + j, 1, 1);
      }
    });
  }

  /** つえの先から小物の上の端まで、細い糸を引く(1ドットの点を並べる。にじませない) */
  private drawThread(y: number): void {
    const tip = this.tip?.() ?? null;
    const x1 = this.spotX, y1 = this.itemTop(y);
    const key = tip ? `${Math.round(tip.x)},${Math.round(tip.y)},${y1}` : 'none';
    if (key === this.lastThread) return;
    this.lastThread = key;
    const g = this.thread.clear();
    if (!tip) return;
    const pts: [number, number][] = [];
    let x0 = Math.round(tip.x), y0 = Math.round(tip.y);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 400; n++) {
      pts.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    drawLine(g, pts);
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
  }
}

/** 1ドットの糸を点で描く。右と下に濃い影をつけて、暗い壁の上でも明るい床の上でも見えるようにする */
function drawLine(g: Phaser.GameObjects.Graphics, pts: readonly [number, number][]): void {
  const on = new Set(pts.map(([x, y]) => `${x},${y}`));
  g.fillStyle(THREAD_SHADOW, 1);
  for (const [x, y] of pts) {
    for (const [ax, ay] of [[x + 1, y], [x, y + 1]]) if (!on.has(`${ax},${ay}`)) g.fillRect(ax, ay, 1, 1);
  }
  g.fillStyle(THREAD, 1);
  for (const [x, y] of pts) g.fillRect(x, y, 1, 1);
}
