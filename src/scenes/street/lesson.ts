// 結果発表(Street)の部品:待てと行けを止めて教える画面(docs/SPEC.md の「待てと行けを止めて教える」)。
// そのスマホで初めて、市民に待てのマークが出たとき(行けは悪さのワルに行けのマークが出たとき)に、Street が作る。
//
// - 止める:シーンの時計、動き(tween)、アニメの速さを0にする(ui/fx.ts の holdScene。ヒットストップと重なっても、
//   先に終わったほうが相手の止めを切らない)。ヒーローの歩きとステージの仕組みの時計は、Street の update が lesson を
//   見て進めない。ための時間(WINDUP_MS)も、悪さのワルが逃げるまでの時間も、止めている間は進まない。
//   画面の端の点滅、揺れ、飛び出す数字、念力やUFOの物のゆれ、カメラの揺れも止まる(fx.ts の isHeld と fxNow)
// - 早送りと音のボタンは、止めている間は押しても何もしない(中断のボタンは使える)
// - 暗くする:相手とヒーロー(マークと吹き出しも)、オペレーターのカットイン、押すボタンの3か所を残して、網目で暗くする。
//   残す所は金色のふちで囲み、押すボタンの上で指さしの手を上下に動かす(シーンの時計が止まっているので、
//   動きは update から渡す本当の経過時間で決める)
// - オペレーターの一言(LESSON_LINES)はすぐに全部出す。8秒押さないと、押す所を言う一言(LESSON_HINTS)に替える
// - 押すボタンを押すと(合図の stopHandler、goHandler が効くと)、Street が end() を呼んで元に戻し、そのあとはふつうに押したのと同じに進む。
//   速さは、Street が決めているふだんの速さ(合図の間なので1)に戻る。ヒットストップの最中なら、それが終わってから戻る
//   ほかの所をタップしても何も起きない(もう片方のボタンは押せない状態のまま)。中断のボタンは使える
//
// 使い方(Street の中):
//   this.lesson = new LessonPause(this, 'stop', hole);   // hole は相手のまわりの、画面の座標の四角
//   this.lesson.tick(delta);                             // update で毎フレーム
//   this.lesson.end(); this.lesson = null;               // 押したとき

import Phaser from 'phaser';
import { UI } from '../../config';
import { layout } from '../../layout';
import { settings } from '../../settings';
import { LESSON_HINTS, LESSON_HINT_MS, LESSON_LINES, type LessonKind } from '../../logic/lesson';
import { ditherTexture, holdScene, releaseScene } from '../../ui';
import { drawHand } from '../sort/introDemo';
import { coverRects, type Rect } from './lessonLayout';
import type { StreetScene } from '../Street';

/** 暗くする網目の重なりの順(カットイン 1100 より手前、マーク 1200 より奥。ui のカメラだけに映すので、上の絵には全部かかる) */
const DIM_DEPTH = 1150;
/** 残す所のまわりのすき間 */
const PAD = 2;
/** 開いた順の番号(開発用の確かめで、同じ場面を2回数えないように使う) */
let serial = 0;

/** 丸いボタン(IconButton)の当たりの部分の、押せる/押せないを切りかえる */
function setIconInput(b: Phaser.GameObjects.Container | undefined, on: boolean): void {
  if (!b?.active) return;
  for (const c of b.list) {
    if (!(c instanceof Phaser.GameObjects.Zone) || !c.input) continue;
    if (on) c.setInteractive(); else c.disableInteractive();
  }
}

export class LessonPause {
  readonly kind: LessonKind;
  /** 開いた順の番号(1から) */
  readonly id = ++serial;
  /** 止めてからの時間(ミリ秒。中断の間は update が呼ばれないので数えない) */
  shownMs = 0;
  private hinted = false;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private frame!: Phaser.GameObjects.Graphics;
  private hand!: Phaser.GameObjects.Graphics;
  private handAt = { x: 0, y: 0 };
  /** 残した所(画面の座標。開発用の確かめにも使う) */
  readonly holes: Rect[];
  /** 止めている間は押せなくした丸いボタン(早送りと音) */
  private locked: Phaser.GameObjects.Container[] = [];
  private ended = false;

  constructor(private s: StreetScene, kind: LessonKind, target: Rect) {
    this.kind = kind;
    const { W, H } = layout;
    const btn = kind === 'stop' ? s.stopBtn : s.goBtn;
    const cut = s.cut;
    const grow = (r: Rect): Rect => ({ x: r.x - PAD, y: r.y - PAD, w: r.w + PAD * 2, h: r.h + PAD * 2 });
    const btnRect = grow({ x: btn.x, y: btn.y, w: btn.w, h: btn.h });
    const cutRect = grow({ x: cut.x, y: cut.y, w: cut.w, h: cut.h });
    // 相手のまわりは、上のアクション部分の中だけ
    const t = grow(target);
    const top = Math.max(0, t.y);
    const tgt = { x: t.x, y: top, w: t.w, h: Math.min(layout.actionH, t.y + t.h) - top };
    this.holes = [tgt, cutRect, btnRect];
    holdScene(s);
    // 早送りと音のボタンは押せなくする(暗くした所にあるので。中断のボタンは使える)
    this.locked = [s.fastBtn, s.muteBtn].filter((b): b is Phaser.GameObjects.Container => !!b?.active);
    for (const b of this.locked) setIconInput(b, false);
    s.L.inUi(() => {
      const tex = ditherTexture(s);
      for (const r of coverRects(W, H, this.holes)) {
        // 網目の目を画面全体でそろえる(切れ目で網目がずれて見えないように)
        const d = s.add.tileSprite(r.x, r.y, r.w, r.h, tex).setOrigin(0).setDepth(DIM_DEPTH).setTilePosition(r.x, r.y);
        this.objs.push(d);
      }
      this.frame = s.add.graphics().setDepth(DIM_DEPTH + 1);
      this.drawFrame(true);
      this.hand = s.add.graphics().setDepth(DIM_DEPTH + 2);
      drawHand(this.hand);
      this.hand.setScale(2);
      // 指の先がボタンの真ん中の少し下に来るように
      this.handAt = { x: Math.round(btn.x + btn.w / 2), y: Math.round(btn.y + btn.h / 2) };
      this.hand.setPosition(this.handAt.x, this.handAt.y);
      this.objs.push(this.frame, this.hand);
    });
    this.say(LESSON_LINES[kind]);
  }

  /** 毎フレーム(Street の update から)。手とふちを動かし、8秒たったら一言を替える */
  tick(deltaMs: number): void {
    this.shownMs += Math.min(deltaMs, 100);
    // 手は0.6秒で1回、3ドット上下する
    const bob = Math.round((1 - Math.cos((this.shownMs / 600) * Math.PI * 2)) * 1.5);
    this.hand.setPosition(this.handAt.x, this.handAt.y + bob);
    // ふちは0.5秒ごとに出したり消したりする(光と揺れを弱くする設定では出したまま)
    this.drawFrame(settings.reduceFx || Math.floor(this.shownMs / 500) % 2 === 0);
    if (!this.hinted && this.shownMs >= LESSON_HINT_MS) {
      this.hinted = true;
      this.say(LESSON_HINTS[this.kind]);
    }
  }

  /** 元に戻す(押す前に呼ぶ)。2回呼んでも1回ぶんだけ戻す */
  end(): void {
    if (this.ended) return;
    this.ended = true;
    for (const o of this.objs) o.destroy();
    this.objs = [];
    for (const b of this.locked) setIconInput(b, true);
    this.locked = [];
    releaseScene(this.s);
  }

  /** オペレーターの一言をカットインにすぐ全部出す(時計が止まっているので、文字送りはしない) */
  private say(sp: { text: string; face: string; who: 'operator' | 'hero' }): void {
    const cut = this.s.cut;
    this.s.opSeq++;
    void cut.say(sp.text, sp.face, { who: sp.who });
    cut.skip();
    cut.setScale(1);
  }

  private drawFrame(on: boolean): void {
    const g = this.frame;
    g.clear();
    if (!on) return;
    g.lineStyle(1, UI.gold, 1);
    // カットインは残すだけ。ふちは相手と押すボタンにつける
    for (const r of [this.holes[0], this.holes[2]]) g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
}
