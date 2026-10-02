// ステージ4(高層ビル)の仕分けの画面の、左上の照明と左下の机と小物。もれ(紫の光、浮いた小物)と、
// 紛らわしい市民の理由(切れかけの蛍光灯、紫のセロハン、手品の糸、手品の紫の煙、紫の風船)をここで出す
// (docs/STAGE4.md の「もれ」「紛らわしい市民」)。紫はもれにも紛らわしい市民にも出る。もれにだけあるのは火花と、小物を包むもや。
//   const desk = new TowerDesk(this, { floor: wave.no, lamp: TOWER_LAMP, desk: TOWER_DESK, depth: Z.dim + 0.6 });
//   desk.setLook(leakLook(leakSpots(person)), caneTip);   // 人が出た瞬間に。caneTip は手品の糸を引くつえの先(なければ省く)
//   desk.setLook(CALM_LOOK);                              // 人がいないときと中断中
//   desk.update(time);                                    // 毎フレーム(浮いた小物のゆれ、糸を引き直す)
// 場所の数字は src/art/towerSpots.ts。container を渡すと、その中に置く(掛け合いのお手本の小さな画面)。
// 机は desk.scale 倍(仕分けの画面は2倍)で出し、小物、もや、小物の火花、手品の煙、風船も同じ倍率で描く。
// 手品の糸と風船のひもは、倍率によらず画面の1ドットの線に濃い影をつけて描く。
// もれは人が出ている間ずっと同じで、待っても増えたり減ったりしない。
// 「光と揺れを弱くする」(settings.reduceFx)のときは、火花のまたたきと小物の上下のゆれを止める(色と絵はそのまま)。

import Phaser from 'phaser';
import { animKey, frameIndex, sheetByKey } from '../../art/sheets';
import { magicianCaneTips } from '../../art/world4/people';
import {
  CALM_LOOK, FLOAT_PX, TOWER_DESK_KEY, TOWER_ITEM_FRAMES, TOWER_ITEM_ROWS, TOWER_ITEM_SIZE, itemRestDy, towerDeskFor, type LeakLook,
  type TowerDeskSpot
} from '../../art/towerSpots';
import type { WaveNo } from '../../logic';
import { settings } from '../../settings';

/** 手品の糸と風船のひもの色(うすい灰色。紫にしない)と、その右下の影(明るい床の上でも見えるように) */
const THREAD = 0xd0d0dc;
const THREAD_SHADOW = 0x3c3848;
/**
 * 超能力の紫の3色(src/art/world4/palette.ts の PSY。明るい所、ふつう、濃い所)。
 * 紫の風船と手品の煙にも使う(紫だけで、もれと決められないように)
 */
const PURPLE_HI = 0xffdbff;
const PURPLE = 0xdb6dff;
const PURPLE_DARK = 0x9224db;
const OUTLINE = 0x240024;
/** 浮いた小物の上下のゆれ(1往復のミリ秒) */
const BOB_MS = 1400;
/**
 * 照明と小物の火花のまたたき(fx_psy_spark のコマ)。2は7×7の細長い十字、1は5×5の大きい十字、0は3×3の十字。
 * 照明も小物も2倍で出すので、いちばん小さい0でも画面で6×6ドットある。
 * 前はシートのまたたき(0から3)をそのまま使っていて、小さいコマが続くと1ドットの点に見えた
 */
const SPARK_ANIM = 'fx_psy_spark.desk';
const SPARK_FRAMES = [2, 1, 2, 0];
const SPARK_FPS = 8;
/** 「光と揺れを弱くする」のときに止めるコマ(7×7の細長い十字。十字の形がいちばんはっきりしている) */
const SPARK_STILL = 2;
/**
 * 小物の火花の、小物の真ん中からのずれ(机の絵の1ドットで数える)。小物の左上の、もやの輪の外。
 * 右上にすると、人の絵ともやの輪に重なって見えにくかった
 */
const ITEM_SPARK_DX = -9;
const ITEM_SPARK_DY = -8;
/** 手品の糸を吊る点を、つえの先より何ドット上に置くか(小物の真上。ここから糸がまっすぐ下りる) */
const HANG_ABOVE_TIP = 16;
/** 吊る点からつえの先へ渡る糸の、真ん中のたるみ(ドット) */
const THREAD_SAG = 6;

export interface TowerDeskOptions {
  floor: WaveNo;
  /** 照明の上の真ん中と、何倍で出すか(火花も同じ倍率) */
  lamp: { x: number; y: number; scale?: number };
  /** 机の下の真ん中と、何倍で出すか(小物、もや、小物の火花、手品の煙、風船も同じ倍率) */
  desk: { x: number; y: number; scale?: number };
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
  private smoke: Phaser.GameObjects.Graphics;
  private look: LeakLook = CALM_LOOK;
  private tip: CaneTip | null = null;
  private restY: number;
  private spotX: number;
  /** 机と小物の倍率 */
  private ds: number;
  private reduce = settings.reduceFx;
  private lastThread = '';
  private lastSmoke = '';
  /** 手品の糸を吊る点の高さ。つえの先がいちばん高かったときに合わせる(コマごとに上下させない) */
  private hangY = Infinity;

  constructor(private scene: Phaser.Scene, opt: TowerDeskOptions) {
    this.spot = towerDeskFor(opt.floor);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { opt.container?.add(o); return o; };
    const d = opt.depth;
    const { x: lx, y: ly } = opt.lamp;
    const ls = opt.lamp.scale ?? 1;
    this.lamp = add(scene.add.sprite(lx, ly, 'fx_psy_lamp', 0).setOrigin(0.5, 0).setScale(ls).setDepth(d));
    if (!scene.anims.exists(SPARK_ANIM)) {
      scene.anims.create({
        key: SPARK_ANIM, frames: SPARK_FRAMES.map((frame) => ({ key: 'fx_psy_spark', frame })), frameRate: SPARK_FPS, repeat: -1
      });
    }
    // 照明の火花は、照明の右の上と右の下。どちらも下へこぼれる紫の光と、本体を包む紫のもやの外の、暗い壁の上に出す
    // (前は1つ目が左の下で、紫の光に重なって見えにくく、左上の「○人目」の字の続きにも見えた。
    // もやのすぐ横に置いたときは、もやとつながって十字に見えにくかった)。照明だけのもれ(火花1つ)は右の上
    this.lampSparks = [
      add(scene.add.sprite(lx + 26 * ls, ly + 5 * ls, 'fx_psy_spark', SPARK_STILL).setScale(ls).setDepth(d + 0.2)),
      add(scene.add.sprite(lx + 27 * ls, ly + 19 * ls, 'fx_psy_spark', SPARK_STILL).setScale(ls).setDepth(d + 0.2))
    ];
    const { x: dx, y: dy } = opt.desk;
    const ds = this.ds = opt.desk.scale ?? 1;
    this.desk = add(scene.add.image(dx, dy, TOWER_DESK_KEY).setOrigin(0.5, 1).setScale(ds).setDepth(d));
    const spotItem = this.spot.items[0];
    this.spotX = dx + spotItem.dx * ds;
    this.restY = dy + itemRestDy(spotItem.item) * ds;
    const floatY = this.restY - FLOAT_PX * ds;
    // もやは小物の後ろ(小物の形がはっきり見えるように)
    this.haze = add(scene.add.sprite(this.spotX, floatY, 'fx_psy_haze', 0).setScale(ds).setDepth(d + 0.1));
    this.items = this.spot.items.map(({ item, dx: ix }) =>
      add(scene.add.sprite(dx + ix * ds, dy + itemRestDy(item) * ds, 'fx_psy_items', TOWER_ITEM_FRAMES[item]).setScale(ds).setDepth(d + 0.2)));
    this.itemSpark = add(scene.add.sprite(this.spotX + ITEM_SPARK_DX * ds, floatY + ITEM_SPARK_DY * ds, 'fx_psy_spark', SPARK_STILL)
      .setScale(ds).setDepth(d + 0.3));
    this.thread = add(scene.add.graphics().setDepth(opt.threadDepth ?? d + 0.3));
    this.balloon = add(scene.add.graphics().setDepth(d + 0.3));
    // 手品の煙は小物の後ろ(小物の形が見えるように)
    this.smoke = add(scene.add.graphics().setDepth(d + 0.1));
    this.apply();
  }

  /** 画面に置いたもの(掛け合いのお手本で、まとめて小さな画面の形に切り取るため) */
  get objects(): Phaser.GameObjects.GameObject[] {
    return [this.lamp, ...this.lampSparks, this.desk, ...this.items, this.haze, this.itemSpark, this.thread, this.balloon, this.smoke];
  }

  /** いまの見せ方 */
  get current(): LeakLook { return this.look; }

  /** 見せ方を変える。tip は手品の糸を引くつえの先 */
  setLook(look: LeakLook, tip: CaneTip | null = null): void {
    this.look = look;
    this.tip = tip;
    this.lastThread = '';
    this.lastSmoke = '';
    this.hangY = Infinity;
    this.apply();
  }

  private apply(): void {
    const L = this.look;
    this.lamp.setFrame(L.lampFrame);
    this.lampSparks.forEach((s, i) => s.setVisible(i < L.lampSparks));
    this.haze.setVisible(L.haze);
    this.itemSpark.setVisible(L.haze);
    this.balloon.setVisible(L.balloon);
    this.thread.setVisible(L.thread);
    this.smoke.setVisible(L.smoke);
    this.reduce = !settings.reduceFx;   // 次の update で火花の動きを決め直す
    this.update(this.scene.time.now);
  }

  update(now: number): void {
    const L = this.look;
    // 火花のまたたきともやの動き。光と揺れを弱くするときは、火花は大きい十字、もやは1コマ目で止める
    const reduce = settings.reduceFx;
    if (reduce !== this.reduce) {
      this.reduce = reduce;
      const sparks = [...this.lampSparks, this.itemSpark];
      for (const s of sparks) {
        if (reduce) s.stop().setFrame(SPARK_STILL);
        else s.play(SPARK_ANIM);
      }
      if (reduce) this.haze.stop().setFrame(0);
      else this.haze.play(animKey(this.haze.texture.key, 'play'));
      // 火花がそろって光らないように、コマをずらす
      if (!reduce) sparks.forEach((s, i) => s.anims.setProgress(((i * 3) % 4) / 4));
    }
    // 1つ目の小物:浮いているときは少し上で、ゆっくり1ドット(机の絵の1ドット)上下する
    const bob = L.itemFloat && !reduce ? (Math.sin((now / BOB_MS) * Math.PI * 2) > 0 ? 1 : 0) : 0;
    const y = this.restY - (L.itemFloat ? (FLOAT_PX + bob) * this.ds : 0);
    const item = this.items[0];
    if (item.y !== y) item.setY(y);
    if (L.haze && this.haze.y !== y) { this.haze.setY(y); this.itemSpark.setY(y + ITEM_SPARK_DY * this.ds); }
    if (L.balloon) this.drawBalloon(y);
    if (L.smoke) this.drawSmoke(y);
    if (L.thread) this.drawThread(y);
  }

  /** 小物の上の端(その高さ y のとき) */
  private itemTop(y: number): number {
    const spot = this.spot.items[0].item;
    return y + (TOWER_ITEM_ROWS[spot].top - TOWER_ITEM_SIZE / 2) * this.ds;
  }

  /** 机の倍率で、ドット絵の文字の並び(rows)を (px, py) から描く。col にない文字は描かない */
  private paint(g: Phaser.GameObjects.Graphics, px: number, py: number, rows: readonly string[], col: Record<string, number>): void {
    const u = this.ds;
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = col[row[i]];
        if (c !== undefined) g.fillStyle(c, 1).fillRect(px + i * u, py + j * u, u, u);
      }
    });
  }

  /** 小物の上に、ひもで結んだ小さな紫の風船(机の倍率で描く) */
  private drawBalloon(y: number): void {
    const key = `b${y}`;
    if (this.lastThread === key) return;
    this.lastThread = key;
    const g = this.balloon.clear();
    const u = this.ds;
    const top = this.itemTop(y);
    const x = this.spotX;
    // ひも(小物の上から、少し右へ曲がって上へ9ドット。机の倍率で)。結び目は小物のすぐ上。
    // 画面の1ドットの線を、倍率の分だけ太くする(2倍なら2ドット)
    const pts: [number, number][] = [];
    for (let i = 1; i <= 9 * u; i++) {
      const k = Math.ceil(i / u);
      for (let w = 0; w < u; w++) pts.push([x + w + (k >= 5 && k <= 7 ? u : 0), top - i]);
    }
    drawLine(g, pts);
    // 風船(7×8の玉と、下の結び口)
    const rows = ['..ooo..', '.orrro.', 'orhrrro', 'orhrrro', 'orrrrdo', 'orrrrdo', '.orrdo.', '..ooo..', '...k...'];
    this.paint(g, x - 3 * u, top - 18 * u, rows, { o: OUTLINE, r: PURPLE, h: PURPLE_HI, d: PURPLE_DARK, k: PURPLE_DARK });
  }

  /**
   * 手品の紫の煙。小物の左に煙のかたまりを2つ(5×4と3×3)、右に1つ(3×3)。机の倍率で描く。
   * もれのもやのように小物を輪で包まず、火花も出さない。高さは小物に合わせる(浮いた小物のゆれについていく)
   */
  private drawSmoke(y: number): void {
    const key = `s${y}`;
    if (this.lastSmoke === key) return;
    this.lastSmoke = key;
    const g = this.smoke.clear();
    const u = this.ds;
    const x = this.spotX;
    const col: Record<string, number> = { h: PURPLE_HI, p: PURPLE, d: PURPLE_DARK };
    // 十字にすると火花に見えるので、横長の丸いかたまりにする
    this.paint(g, x - 12 * u, y - 1 * u, ['.pph.', 'phppp', 'ppppd', '.ddd.'], col);
    this.paint(g, x - 12 * u, y - 5 * u, ['.ph', 'ppd', 'dd.'], col);
    this.paint(g, x + 5 * u, y + 1 * u, ['pp.', 'ppd', '.dd'], col);
  }

  /**
   * 手品の糸。小物の真上の、つえの先より高い所に吊る点を置き、そこから小物の上の端まで糸をまっすぐ下ろす。
   * 吊る点からつえの先へは、少したるんだ糸を渡す(つえで吊っていると分かるように。
   * 前はつえの先から小物まで1本の線を引いていて、横に長い棒に見えた)。1ドットの点を並べ、右と下に濃い影をつける。にじませない
   */
  private drawThread(y: number): void {
    const tip = this.tip?.() ?? null;
    const x1 = this.spotX, y1 = this.itemTop(y);
    if (tip) this.hangY = Math.min(this.hangY, Math.round(tip.y) - HANG_ABOVE_TIP, y1 - HANG_ABOVE_TIP);
    const key = tip ? `${Math.round(tip.x)},${Math.round(tip.y)},${y1},${this.hangY}` : 'none';
    if (key === this.lastThread) return;
    this.lastThread = key;
    const g = this.thread.clear();
    if (!tip) return;
    const hy = this.hangY;
    // 吊る点から小物まで、まっすぐ下りる糸
    const drop: [number, number][] = [];
    for (let py = hy; py <= y1; py++) drop.push([x1, py]);
    drawLine(g, drop);
    // 吊る点からつえの先まで、たるんだ糸(放物線)。すき間ができないように、となりの点どうしを線でつなぐ
    const tx = Math.round(tip.x), ty = Math.round(tip.y);
    const steps = Math.max(1, Math.abs(tx - x1), Math.abs(ty - hy));
    const span: [number, number][] = [];
    let prev: [number, number] = [x1, hy];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p: [number, number] = [Math.round(x1 + (tx - x1) * t), Math.round(hy + (ty - hy) * t + 4 * THREAD_SAG * t * (1 - t))];
      for (const q of linePoints(prev, p).slice(1)) span.push(q);
      prev = p;
    }
    // 前は1ドットおきにしてうすく見せていたが、スマホでは見えなかったので、切れ目のない線にする
    drawLine(g, span);
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
  }
}

/** 2つの点を結ぶ1ドットの線の点(両端を含む) */
function linePoints(a: readonly [number, number], b: readonly [number, number]): [number, number][] {
  const pts: [number, number][] = [];
  let [x0, y0] = a;
  const [x1, y1] = b;
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
  return pts;
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
