// エレベーターラッシュ(ステージ4の波3の答え合わせのあと、波4の仕分けの前に1回だけ)。決まりは docs/STAGE4.md「エレベーターラッシュ」。
// 入口:WaveReview(nextAfterReview が SCENES.elevator を返したとき。run.waveIndex はもう波4)。出口:波4の Sort。
//
// 画面:上のアクション部分はガラス張りのエレベーターの中(bg_lift。カメラは動かない)。後ろのガラスの向こうに夜景(bg_lift_view)を
// 下へ流す。扉は tw_lift_door を2枚、右上の階の数字はコードで出す。下の操作部分は結果発表と同じ形(待てと行け、カットイン)。
// 置く場所と時間の並びは elevator/plan.ts(LIFT_SPOT、liftSchedule)。
//
// 流れ:ヒーローが乗りこんで扉が閉まる → 「最上階へ!」の帯とオペレーターの説明 → ▼タップで始まる →
//   6人が1人ずつ乗ってきて、扉の内側で止まると待てのマーク。約1秒で光のパンチ(扉の外へ飛んでいく)、
//   待てなら急ブレーキで止まり、その人は奥(左)へ入って立つ → 最上階に着く(見逃したヴィランの紫の光、定員オーバーのおまけ)
//   → 扉が開いてパーティ会場の光 → オペレーターの一言とまとめの1行 → 波4の Sort。
// 時間は update から進めるラッシュの時計(liftSec)で数える。一時停止とヒットストップの間は進まない。早送りはない。
// 数えるのは stats.startLift、liftHit、liftStopped だけ(ほかの数字には入れない)。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey } from '../art/sheets';
import { LIFT_LAYOUT } from '../art/world4/backgrounds';
import {
  LIFT, LIFT_BAND, formatYen, hasSeenRush, liftEndLine, liftIntroFor, liftRushOf, liftSummary, liftTiming, markRushSeen, say,
  type AnyReactionKey, type LiftPlan, type LiftRider, type Rng, type Speech, type StageDef, type StatsTracker
} from '../logic';
import { getRun, type GameRun } from '../run';
import { settings } from '../settings';
import { snapshotLogical } from '../hires';
import {
  Bubble, Button, CutIn, CUT_H, CUT_TOP_H, EdgeAlarm, FS, IconButton, PauseControl, PixelText, UIX, WindowFrame, addPanel,
  gotoWhenFree, hitStop, impact, isFrozen, lighter, panelRect, spawnFx, waitMs, whenNoFlash
} from '../ui';
import { addMute, unlockOnTap } from './sort/common';
import { Actor, HEAD } from './street/actor';
import { Layers } from './street/layers';
import { rushBand, rushTapIntro } from './street/rushIntro';
import {
  DOOR_MOVE_SEC, LIFT_SPOT, liftDoorOpen, liftFloorAt, liftMoving, liftPhase, liftSchedule, liftSlot, nearestButton,
  type LiftBeat, type LiftSchedule
} from './elevator/plan';

/** 超能力の紫の3色(docs/STAGE4.md「超能力の色」。明るい、まん中、暗い) */
const PSY = [0xffdbff, 0xdb6dff, 0x9224db] as const;
/** 扉の向こうのパーティ会場の光 */
const PARTY = [0xfff2c0, 0xffc860, 0xff8ab0] as const;
/** 夜景を流す速さ(ドット/秒)。ふだんと、階の数字が進んでいる間 */
const VIEW_SLOW = 6;
const VIEW_FAST = 90;
/** 奥へ歩く速さ(ドット/秒) */
const WALK_BACK = 150;
/** 扉とボタンの奥行き(人より奥。人の y は床の奥のはし 144 より大きい) */
const DEPTH_DOOR = 140;
/** 頭の上に浮かせる小物(fx_psy_items のコマ)。夜景の前でも見える明るいもの:名刺、マグカップ、グラス、キャンドル、ナプキン */
const LIFT_ITEMS = [2, 3, 1, 5, 4] as const;

/** 乗ってくる1人。wait:まだ / step:乗ってくる / mark:マーク / hit:殴られた / pass:待てで奥へ歩いている / back:奥に立っている / gone:いない */
interface LiftMan {
  r: LiftRider;
  b: LiftBeat;
  a?: Actor;
  state: 'wait' | 'step' | 'mark' | 'hit' | 'pass' | 'back' | 'gone';
  /** ヴィランの頭の上で浮く小物と、それを包む紫のもや */
  item?: Phaser.GameObjects.Sprite;
  haze?: Phaser.GameObjects.Sprite;
  /** ヴィランのそばで紫に光らせるボタンの番号 */
  button: number;
  /** 扉が開く音と閉まる音を鳴らしたか */
  dinged: boolean;
  closed: boolean;
}

/** 開発用:window.liftDev から中身をさわれる(tools/lift_test.mjs) */
export interface LiftDev {
  scene?: ElevatorScene;
  /** 起きたことの順('intro:2' は説明が2つ、'flash' は紫の光、'buzzer' は定員オーバー、'party' は扉が開いた、'summary:…' はまとめ) */
  log: string[];
}
const dev: LiftDev = { log: [] };

export class ElevatorScene extends Phaser.Scene {
  run!: GameRun;
  def!: StageDef;
  stats!: StatsTracker;
  rng!: Rng;
  plan: LiftPlan | null = null;
  L!: Layers;
  hero!: Actor;
  men: LiftMan[] = [];
  sched: LiftSchedule = { beats: [], totalSec: 0 };
  /** ラッシュの時計(秒)。帯と説明の間と、着いてからは進めない */
  liftSec = 0;
  /** ラッシュの時計が進んでいるか */
  running = false;
  /** ラッシュが始まってから着くまで(行けを暗くしておく間は、シーンの間ずっと) */
  phase: 'intro' | 'rush' | 'arrive' | 'leave' = 'intro';
  stopHandler: (() => void) | null = null;
  /** 待てで奥へ入った人数(立つ位置を左から詰める) */
  backCount = 0;
  /** ラッシュの外(乗りこむ所と着いた所)で、扉の開きと階の数字をこれで決める */
  doorOverride = 0;
  floorOverride: number = LIFT.fromFloor;
  viewSpeed = 0;
  frameN = 0;
  leaving = false;
  private done: (() => void) | null = null;
  private heroBubble?: Bubble;
  // アクション部分
  private view!: Phaser.GameObjects.TileSprite;
  private doorL!: Phaser.GameObjects.Sprite;
  private doorR!: Phaser.GameObjects.Sprite;
  private floorText!: PixelText;
  private shownFloor = -1;
  private buttonG!: Phaser.GameObjects.Graphics;
  private ceilingG!: Phaser.GameObjects.Graphics;
  private partyG!: Phaser.GameObjects.Graphics;
  // 下の操作部分
  cut!: CutIn;
  stopBtn!: Button;
  goBtn!: Button;
  icons: Phaser.GameObjects.GameObject[] = [];
  stopAlarm!: EdgeAlarm;

  constructor() { super(SCENES.elevator); }

  create(): void {
    this.run = getRun(this);
    this.def = this.run.stage.def;
    this.stats = this.run.stats;
    this.rng = this.run.rng;
    this.plan = liftRushOf(this.run.stage);
    this.men = []; this.icons = [];
    this.liftSec = 0; this.running = false; this.phase = 'intro'; this.stopHandler = null; this.backCount = 0;
    this.doorOverride = 1; this.floorOverride = LIFT.fromFloor; this.viewSpeed = VIEW_SLOW; this.frameN = 0; this.leaving = false;
    this.done = null; this.heroBubble = undefined; this.shownFloor = -1;
    const t = liftTiming(settings.slowMode);
    this.sched = liftSchedule(this.plan?.riders.map((r) => r.floor) ?? [], t);
    this.L = new Layers(this);
    this.buildWorld();
    this.buildPanel();
    unlockOnTap(this);
    // 波3の答え合わせの曲は止め、乗りこむ間は静かにする(ラッシュの曲はタップで始める)
    audio.stopBgm();
    if (import.meta.env.DEV) (window as unknown as { liftDev: LiftDev }).liftDev = dev;
    dev.scene = this;
    dev.log = [];
    void this.play();
  }

  // ─── 作る ─────────────────────────────────────

  private buildWorld(): void {
    const g = LIFT_LAYOUT.glass;
    this.view = this.add.tileSprite(g.x, g.y, g.w, g.h, 'bg_lift_view').setOrigin(0, 0).setDepth(-30);
    this.add.image(0, 0, 'bg_lift').setOrigin(0, 0).setDepth(-20);
    this.ceilingG = this.add.graphics().setDepth(-19);
    this.partyG = this.add.graphics().setDepth(-18);
    const d = LIFT_LAYOUT.door;
    const half = d.w / 2;
    this.doorL = this.add.sprite(d.x + half / 2, d.y, 'tw_lift_door', 0).setOrigin(0.5, 0).setDepth(DEPTH_DOOR);
    this.doorR = this.add.sprite(d.x + half + half / 2, d.y, 'tw_lift_door', 0).setOrigin(0.5, 0).setDepth(DEPTH_DOOR).setFlipX(true);
    this.buttonG = this.add.graphics().setDepth(DEPTH_DOOR + 1);
    const disp = LIFT_LAYOUT.display;
    this.floorText = new PixelText(this, disp.x + disp.w / 2, disp.y + 1, '', { size: FS.small, color: 0xff9a3c }).setOrigin(0.5, 0).setDepth(DEPTH_DOOR + 1);
    // ヒーローは扉から乗りこんで、まん中より少し左に立つ
    this.hero = new Actor(this, 'hero', LIFT_SPOT.door.x, LIFT_SPOT.door.y);
    this.hero.depthBias = 0.5;
    this.stopAlarm = new EdgeAlarm(this, 0, layout.actionH, UI.stop);
  }

  private buildPanel(): void {
    this.L.inUi(() => {
      const pause = new PauseControl(this);
      // 右上には階の数字の枠があるので、中断と音のボタンは左上に置く。早送りはラッシュの間は使えないので、ボタンも出さない
      this.icons.push(new IconButton(this, 12, 12, 'pause', () => pause.pause()));
      this.icons.push(addMute(this, 34, 12));
      addPanel(this);
      const tall = panelRect().h >= 200;
      const r = panelRect(4);
      // 数字の窓は結果発表と同じ(ラッシュの数はここには足さない。着いたときにまとめを出す)
      const hudH = 40;
      new WindowFrame(this, r.x, r.y, r.w, hudH, 'win');
      const lx = r.x + 7;
      new PixelText(this, lx, r.y + 4, '撃破', { size: FS.big });
      new PixelText(this, lx + 36, r.y + 4, String(this.stats.defeated), { size: FS.big, color: UI.gold });
      new PixelText(this, lx + 92, r.y + 4, '負傷', { size: FS.big });
      new PixelText(this, lx + 128, r.y + 4, String(this.stats.civHurt), { size: FS.big, color: UI.danger });
      new PixelText(this, lx, r.y + 21, '被害額', { size: FS.big });
      new PixelText(this, r.right - 7, r.y + 21, formatYen(this.stats.damage), { size: FS.big, color: UI.gold }).setOrigin(1, 0);
      const cutY = r.y + hudH + 4;
      const cutH = tall ? CUT_TOP_H : CUT_H;
      this.cut = new CutIn(this, r.x, cutY, r.w, cutH, tall ? { size: FS.big, faceTop: true } : {});
      const bh = Math.max(40, Math.min(tall ? 120 : 72, r.bottom - (cutY + cutH + 5)));
      const by = r.bottom - bh;
      const bw = Math.floor((r.w - 8) / 2);
      this.stopBtn = new Button(this, r.x, by, bw, bh, '待て!', { color: 'stop', textColor: UIX.stopText, onPress: () => { audio.unlock(); this.stopHandler?.(); } });
      // 行けは使わない。ずっと暗くしておく
      this.goBtn = new Button(this, r.x + bw + 8, by, bw, bh, '行け!', { color: 'go' });
      this.stopBtn.setEnabled(false);
      this.goBtn.setEnabled(false).setAlpha(0.4);
    });
  }

  // ─── 毎フレーム ───────────────────────────────

  override update(_t: number, delta: number): void {
    this.frameN++;
    const frozen = isFrozen(this);
    const dt = Math.min(delta, 50) / 1000;
    if (!frozen) {
      if (this.running) {
        this.liftSec += dt;
        this.viewSpeed = liftMoving(this.sched.beats, this.liftSec) ? VIEW_FAST : VIEW_SLOW;
        this.stepLift();
      }
      // 夜景は下へ流れる(上っていく)
      this.view.tilePositionY -= this.viewSpeed * dt;
    }
    this.syncDoor();
    this.syncFloor();
    this.syncLeaks();
    this.hero.sync();
    for (const m of this.men) if (m.a && m.a.state !== 'gone') m.a.sync();
    this.syncBubble();
    this.updateButtons();
  }

  /** 扉の2枚。開くと左右へずれて、扉の口の外(壁の中)は見せない */
  private syncDoor(): void {
    const open = this.running ? liftDoorOpen(this.sched.beats, this.liftSec) : this.doorOverride;
    const d = LIFT_LAYOUT.door;
    const half = d.w / 2;
    const shift = Math.round(Phaser.Math.Clamp(open, 0, 1) * half);
    const w = half - shift;
    this.doorL.setVisible(w > 0).setPosition(d.x + half / 2 - shift, d.y);
    this.doorR.setVisible(w > 0).setPosition(d.x + half + half / 2 + shift, d.y);
    // 扉の口からはみ出る所は切る(1枚の絵の左上からの四角で切る。右の1枚は裏返しなので、切る所も裏返しで考える)
    if (w > 0) {
      this.doorL.setCrop(shift, 0, w, d.h);
      this.doorR.setCrop(shift, 0, w, d.h);
    }
  }

  private syncFloor(): void {
    const f = this.running ? liftFloorAt(this.sched.beats, this.liftSec) : this.floorOverride;
    if (f === this.shownFloor) return;
    this.shownFloor = f;
    this.floorText.setText(String(f));
  }

  /** ヴィランの頭の上の小物(光と揺れを弱くするときは揺らさない)と、そばのボタンの紫 */
  private syncLeaks(): void {
    const g = this.buttonG;
    g.clear();
    const bob = settings.reduceFx ? 0 : Math.round(Math.sin(this.time.now / 260));
    for (const m of this.men) {
      if (!m.item || !m.a) continue;
      const x = Math.round(m.a.x);
      const y = Math.round(m.a.y - m.a.lift - HEAD - 16 + bob);
      m.item.setPosition(x, y).setDepth(m.a.y + 0.7);
      m.haze?.setPosition(x, y).setDepth(m.a.y + 0.6);
      const b = LIFT_LAYOUT.buttons[m.button];
      // ボタンを紫に塗り、まわりに紫の点(半透明にしない)
      g.fillStyle(PSY[2], 1).fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
      g.fillStyle(PSY[1], 1).fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle(PSY[0], 1).fillRect(b.x, b.y, 2, 1).fillRect(b.x, b.y, 1, 2);
      g.fillStyle(PSY[1], 1).fillRect(b.x - 3, b.y + 1, 1, 1).fillRect(b.x + b.w + 2, b.y + 2, 1, 1).fillRect(b.x + 1, b.y - 3, 1, 1);
    }
  }

  private syncBubble(): void {
    const b = this.heroBubble;
    if (!b) return;
    if (!b.active) { this.heroBubble = undefined; return; }
    const [x, y] = this.bubbleAt();
    if (b.x !== x || b.y !== y) b.pointTo(x, y);
  }

  private updateButtons(): void {
    const st = this.stopHandler !== null;
    if (this.stopBtn.isEnabled !== st) this.stopBtn.setEnabled(st).setColor(UI.stop);
    if (st && this.frameN % 3 === 0) {
      const t = (1 - Math.cos((this.time.now / 1100) * Math.PI * 2)) / 2;
      this.stopBtn.setColor(lighter(UI.stop, t * 0.3));
    }
  }

  // ─── 小さな道具 ───────────────────────────────

  line(key: AnyReactionKey): Speech {
    return say(key, this.rng, this.def.id);
  }

  /** ヒーローの吹き出しのしっぽの先(頭の左上。吹き出しは左へのびて、乗ってくる人の頭の上の小物を隠さない) */
  private bubbleAt(): [number, number] {
    return [Math.round(this.hero.x - 2), Math.round(this.hero.y - this.hero.lift - HEAD - 14)];
  }

  heroSay(sp: Speech | string, ms = 1000): void {
    const text = typeof sp === 'string' ? sp : sp.text;
    this.heroBubble?.destroy();
    const [x, y] = this.bubbleAt();
    this.heroBubble = new Bubble(this, x, y, text, { tail: 'down-right', life: ms });
    this.heroBubble.setDepth(1100);
  }

  opSay(sp: Speech, alarm = false): Promise<void> {
    return this.cut.say(sp.text, sp.face, { who: sp.who, alarm });
  }

  fx(key: string, x: number, y: number, opt: { depth?: number; scale?: number; loop?: boolean; flip?: boolean } = {}): Phaser.GameObjects.Sprite {
    return spawnFx(this, key, x, y, { depth: opt.depth ?? 700, scale: opt.scale, loop: opt.loop, flipX: opt.flip });
  }

  /** 動きを tween で(x、y、lift、それと絵の大きさ) */
  private moveTo(a: Actor, x: number, y: number, ms: number, opt: { lift?: number; scale?: number; ease?: string } = {}): Promise<void> {
    const x0 = a.x, y0 = a.y, s0 = a.sprite.scaleX;
    const o = { t: 0 };
    return new Promise((resolve) => {
      this.tweens.add({
        targets: o, t: 1, duration: ms, ease: opt.ease ?? 'Linear',
        onUpdate: () => {
          if (a.state === 'gone') return;
          a.x = x0 + (x - x0) * o.t;
          a.y = y0 + (y - y0) * o.t;
          if (opt.lift) a.lift = Math.sin(Math.PI * o.t) * opt.lift;
          if (opt.scale !== undefined) a.sprite.setScale(s0 + (opt.scale - s0) * o.t);
        },
        onComplete: () => { if (a.state !== 'gone') { a.x = x; a.y = y; if (opt.lift) a.lift = 0; } resolve(); }
      });
    });
  }

  private showMark(a: Actor): void {
    a.mark?.destroy();
    a.mark = this.add.sprite(a.x, a.y, 'fx_mark_stop').play(animKey('fx_mark_stop', 'play')).setScale(3).setDepth(1200);
    a.sync();
    const mk = a.mark;
    this.time.delayedCall(50, () => mk.active && mk.setScale(2));
    audio.sfx('mark');
  }

  private hideMark(a: Actor): void {
    a.mark?.destroy();
    a.mark = undefined;
  }

  /** 構え(扉の方を向いて、パンチの1コマ目で止める)。ラッシュの間は構えの光を出さない */
  private stance(): void {
    this.hero.faceLeft(false).pose('punch', 0);
  }

  // ─── 流れ ─────────────────────────────────────

  private async play(): Promise<void> {
    const plan = this.plan;
    const h = this.hero;
    // 乗りこむ:扉の口から歩いて入り、扉の方を向く。扉が閉まる
    h.faceLeft(true).play('run', true);
    await this.moveTo(h, LIFT_SPOT.hero.x, LIFT_SPOT.hero.y, 700);
    h.faceLeft(false).play('idle');
    await waitMs(this, 150);
    audio.sfx('door');
    await this.tweenDoor(0, DOOR_MOVE_SEC * 1000);
    if (!plan) { this.leave(); return; }
    await waitMs(this, 250);
    // 帯を出して止める(夜景も止める)。止めている間に説明
    audio.sfx('ding');
    this.viewSpeed = 0;
    const band = rushBand(this, LIFT_BAND);
    const seen = hasSeenRush(this.def.id);
    dev.log.push(`intro:${liftIntroFor(seen).length}`);
    markRushSeen(this.def.id);
    await rushTapIntro({ scene: this, cut: this.cut, icons: this.icons }, liftIntroFor(seen), this.time.now + LIFT.tapLockSec * 1000, LIFT.tapLockSec);
    band.out();
    // タップで始まる
    this.stance();
    audio.playBgm(this.def.bgm.rush ?? this.def.bgm.street);
    this.stats.startLift(plan);
    this.men = plan.riders.map((r, i): LiftMan => ({
      r, b: this.sched.beats[i], state: 'wait', dinged: false, closed: i === 0,
      button: nearestButton(LIFT_SPOT.stop.x, LIFT_SPOT.stop.y - HEAD)
    }));
    this.phase = 'rush';
    this.liftSec = 0;
    await new Promise<void>((resolve) => { this.done = resolve; this.running = true; });
    await this.arrive();
  }

  /** 扉の開き(0〜1)を ms で動かす(ラッシュの外) */
  private tweenDoor(to: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ targets: this, doorOverride: to, duration: ms, ease: 'Linear', onComplete: () => resolve() });
    });
  }

  /** ラッシュの時計で1人ずつ進める */
  private stepLift(): void {
    const sec = this.liftSec;
    for (const m of this.men) {
      const b = m.b;
      if (!m.closed && sec >= b.start) { m.closed = true; audio.sfx('door'); }
      if (!m.dinged && sec >= b.openAt) { m.dinged = true; audio.sfx('ding'); audio.sfx('door', { volume: 0.6 }); }
      const ph = liftPhase(b, sec);
      if (m.state === 'wait' && (ph === 'step' || ph === 'mark' || ph === 'act' || ph === 'done')) this.stepIn(m);
      if (m.state === 'step') {
        const a = m.a!;
        const p = Phaser.Math.Clamp((sec - b.stepInAt) / (b.markAt - b.stepInAt), 0, 1);
        a.x = LIFT_SPOT.door.x + (LIFT_SPOT.stop.x - LIFT_SPOT.door.x) * p;
        a.y = LIFT_SPOT.door.y + (LIFT_SPOT.stop.y - LIFT_SPOT.door.y) * p;
        if (sec >= b.markAt) this.mark(m);
      }
      if (m.state === 'mark' && sec >= b.punchAt) this.punch(m);
    }
    if (sec >= this.sched.totalSec) {
      this.running = false;
      this.liftSec = this.sched.totalSec;
      const d = this.done;
      this.done = null;
      d?.();
    }
  }

  /** 扉の口から乗ってくる。ヴィランは頭の上に小物が浮き、そばのボタンが紫に光る */
  private stepIn(m: LiftMan): void {
    const a = new Actor(this, m.r.sheetKey, LIFT_SPOT.door.x, LIFT_SPOT.door.y);
    a.look = m.r.look;
    a.civ = m.r.truth === 'civ';
    a.faceLeft(true).play('walk', true, 1.5);
    m.a = a;
    m.state = 'step';
    if (m.r.truth === 'bad') {
      m.haze = this.add.sprite(a.x, a.y, 'fx_psy_haze').play(animKey('fx_psy_haze', 'play'));
      if (settings.reduceFx) m.haze.anims.pause();
      m.item = this.add.sprite(a.x, a.y, 'fx_psy_items', LIFT_ITEMS[m.r.index % LIFT_ITEMS.length]);
      audio.sfx('psy', { volume: 0.6 });
    }
  }

  /** 扉の内側で止まった:待てのマーク。ヒーローは全員に同じ一言 */
  private mark(m: LiftMan): void {
    const a = m.a!;
    m.state = 'mark';
    a.x = LIFT_SPOT.stop.x; a.y = LIFT_SPOT.stop.y;
    a.play('sortIdle', true);
    this.showMark(a);
    this.stopAlarm.start();
    this.heroSay(this.line('liftMark'), 1000);
    this.stopHandler = () => this.pass(m);
  }

  private dropLeak(m: LiftMan): void {
    m.item?.destroy(); m.item = undefined;
    m.haze?.destroy(); m.haze = undefined;
  }

  /** 待てを押さなかった:光のパンチで扉の外へ。巻きぞえは出さず、物も壊れない */
  private punch(m: LiftMan): void {
    const a = m.a!;
    const h = this.hero;
    m.state = 'hit';
    this.stopHandler = null;
    this.stopAlarm.stop();
    this.hideMark(a);
    const homeX = LIFT_SPOT.hero.x;
    // 一歩ふみこんで殴る
    h.play('punch', true);
    audio.sfx('punch');
    void this.moveTo(h, a.x - LIFT_SPOT.punchGap, h.y, 90);
    const fist = this.fx('fx_punch', h.x + 16, a.y - 30, { loop: true, depth: 900 });
    this.tweens.add({
      targets: fist, x: a.x - 4, duration: 90,
      onComplete: () => {
        fist.destroy();
        this.fx('fx_hit', a.x - 4, a.y - 30, { depth: 950 });
        this.fx('fx_hit', a.x + 4, a.y - 22, { depth: 950 });
        audio.sfx('hit');
        impact(this, 'small');
        hitStop(this, 80);
        this.dropLeak(m);
        this.stats.liftHit(m.r.truth);
        this.knockOut(m);
        if (m.r.truth === 'civ') {
          // 市民だった:「あれ?」と言って次へ(短い反応だけ)
          this.report();
          this.heroSay(this.line('liftCivHit'), 700);
        }
        this.time.delayedCall(220, () => {
          if (this.phase !== 'rush') return;
          void this.moveTo(h, homeX, LIFT_SPOT.hero.y, 180).then(() => { if (this.phase === 'rush' && !this.stopHandler) this.stance(); });
        });
      }
    });
  }

  /** 殴られた人は、扉の口へ飛んでいって見えなくなる(キラーン) */
  private knockOut(m: LiftMan): void {
    const a = m.a!;
    a.state = 'down';
    a.faceLeft(true).play('knocked', true);
    void this.moveTo(a, LIFT_SPOT.door.x + 2, LIFT_SPOT.door.y + 2, 360, { lift: 30, scale: 0.6, ease: 'Sine.easeOut' }).then(() => {
      if (a.state === 'gone') return;
      this.fx('fx_kiran', a.x, a.y - 30, { depth: DEPTH_DOOR - 1 });
      a.destroy();
      m.state = 'gone';
    });
  }

  /** 待て:急ブレーキで止まり、その人はヒーローの後ろを通って奥(左)へ入って立つ */
  private pass(m: LiftMan): void {
    const a = m.a!;
    const h = this.hero;
    m.state = 'pass';
    this.stopHandler = null;
    this.stopAlarm.stop();
    this.hideMark(a);
    h.play('stop', true);
    audio.sfx('stop');
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 60, () => this.fx('fx_brake', h.x + 6, h.y - 6, { depth: h.y + 1 }));
    this.heroSay(this.line('stop'), 800);
    this.stats.liftStopped(m.r.truth);
    // もれは奥へ入るときに消す(奥の人のもれで、次に乗ってくる人のもれが分からなくならないように)
    this.dropLeak(m);
    if (a.civ) this.fx('fx_sparkle', a.x, a.y - HEAD - 4, { depth: 960 });
    const slot = liftSlot(this.backCount++);
    this.time.delayedCall(250, () => {
      if (!a.standing) return;
      a.faceLeft(true).play('walk', true, 2);
      const ms = (Math.hypot(a.x - slot.x, a.y - slot.y) / WALK_BACK) * 1000;
      void this.moveTo(a, slot.x, slot.y, ms).then(() => {
        if (!a.standing) return;
        a.faceLeft(false).play('idle', true);
        a.sprite.anims.setProgress(this.rng.float(0, 1));
        m.state = 'back';
      });
    });
    this.time.delayedCall(LIFT.actSec * 1000 - 100, () => { if (this.phase === 'rush' && !this.stopHandler) this.stance(); });
  }

  /** ラッシュで市民を殴った場面を「いちばんひどい場面」の候補にする(市民を殴った瞬間と同じ段) */
  private report(): void {
    if (!this.stats.reportScene('civHit', 'punch')) return;
    this.time.delayedCall(90, () => whenNoFlash(this, () => {
      if (!this.sys.isActive()) return;
      const hidden = this.icons as unknown as Phaser.GameObjects.Components.Visible[];
      for (const o of hidden) o.setVisible(false);
      this.stopAlarm.hideNow();
      snapshotLogical(this.game, 0, 0, layout.W, layout.actionH, (img) => { this.run.worstShot = img; });
      this.time.delayedCall(0, () => { for (const o of hidden) if ((o as unknown as Phaser.GameObjects.GameObject).active) o.setVisible(true); });
    }));
  }

  // ─── 着いたとき ───────────────────────────────

  private async arrive(): Promise<void> {
    this.phase = 'arrive';
    this.stopHandler = null;
    const h = this.hero;
    await waitMs(this, 250);
    // 扉が閉まり、50階まで上がって止まる。チン
    this.doorOverride = 1;
    this.floorOverride = liftFloorAt(this.sched.beats, this.sched.totalSec);
    audio.sfx('door');
    await this.tweenDoor(0, DOOR_MOVE_SEC * 1000);
    this.viewSpeed = VIEW_FAST;
    const from = this.floorOverride;
    const steps = LIFT.toFloor - from;
    for (let i = 1; i <= steps; i++) {
      await waitMs(this, 260);
      this.floorOverride = from + i;
    }
    this.viewSpeed = 0;
    audio.sfx('ding');
    await waitMs(this, 300);
    h.play('idle');
    const back = this.men.filter((m) => m.state === 'back' || m.state === 'pass');
    const villains = back.filter((m) => m.r.truth === 'bad');
    const civs = back.filter((m) => m.r.truth === 'civ');
    // 見逃したヴィランがいた:エレベーター全体の明かりが一度だけ紫に光り、そのヴィランが紫の火花を出す
    const sparks: Phaser.GameObjects.Sprite[] = [];
    if (villains.length > 0) {
      dev.log.push('flash');
      this.psyFlash();
      audio.sfx('psy');
      for (const m of villains) {
        const a = m.a!;
        a.play('mischief', true);
        // 奥の人に隠れないように、見逃したヴィランをいちばん手前に描く
        a.depthBias = 30;
        for (const [dx, dy] of [[-9, -40], [10, -30], [-2, -56], [12, -50], [-12, -24]] as const) {
          const s = this.fx('fx_psy_spark', a.x + dx, a.y + dy, { loop: true, depth: a.y + a.depthBias + 0.8 });
          if (settings.reduceFx) s.anims.pause();
          sparks.push(s);
        }
      }
      h.faceLeft(true).play('oops', true);
      await this.opSay(this.line('liftMissed'), true);
      await waitMs(this, 700);
    }
    // 奥に市民が4人以上:定員オーバーのブザー(おまけ。数には関わらない)
    if (civs.length >= LIFT.overCapacityCivs) {
      dev.log.push('buzzer');
      audio.sfx('buzzer');
      h.faceLeft(false).play('idle');
      this.heroSay(this.line('liftFullHero'), 1700);
      await waitMs(this, 800);
      await this.opSay(this.line('liftFull'));
      await waitMs(this, 600);
    }
    // 扉が開くと、パーティ会場の光が差しこむ。見逃したヴィランは走って去る
    audio.sfx('door');
    void this.tweenDoor(1, LIFT.doorSec * 1000);
    this.partyLight();
    dev.log.push('party');
    for (const s of sparks) s.destroy();
    for (const m of villains) {
      const a = m.a!;
      a.faceLeft(false).play('walk', true, 3);
      void this.moveTo(a, LIFT_SPOT.door.x, LIFT_SPOT.door.y, 550).then(() => { a.destroy(); m.state = 'gone'; });
    }
    h.faceLeft(false).play('okay', true);
    audio.sfx('okay');
    const tally = this.stats.liftTally ?? { aliens: 0, aliensDefeated: 0, civs: 0, civsSaved: 0 };
    await this.opSay(liftEndLine(tally, this.rng));
    this.summary(liftSummary(tally));
    dev.log.push(`summary:${liftSummary(tally)}`);
    await waitMs(this, 2400);
    this.leave();
  }

  /** エレベーター全体の明かりが一度だけ紫に光る(画面全体を塗るのは1コマだけ。光と揺れを弱くするときは天井のあかりの色だけ) */
  private psyFlash(): void {
    const { W, actionH } = layout;
    const c = this.ceilingG;
    c.clear().fillStyle(PSY[1], 1).fillRect(8, 5, 160, 3).fillStyle(PSY[0], 1).fillRect(8, 8, 160, 1);
    this.time.delayedCall(900, () => c.clear());
    if (settings.reduceFx) return;
    const full = this.add.rectangle(0, 0, W, actionH, PSY[1]).setOrigin(0).setDepth(1300);
    // 1コマ目は全体、そのあと少しの間は、ガラスに映る紫(1つおきの点)と、ほかは4つに1つの点だけ(半透明にしない)
    const dots = this.add.graphics().setDepth(1300).setVisible(false);
    const gl = LIFT_LAYOUT.glass;
    dots.fillStyle(PSY[1], 1);
    for (let y = 0; y < actionH; y++) {
      const inGlass = y >= gl.y && y < gl.y + gl.h;
      for (let x = 0; x < W; x++) {
        const on = inGlass && x < gl.x + gl.w ? (x + y) % 2 === 0 : x % 2 === 0 && y % 2 === 0 && (x + y) % 4 === 0;
        if (on) dots.fillRect(x, y, 1, 1);
      }
    }
    this.time.delayedCall(40, () => { full.destroy(); dots.setVisible(true); });
    this.time.delayedCall(560, () => dots.destroy());
  }

  /** 扉の口の向こうのパーティ会場の光と、床に差しこむ光(ドットで) */
  private partyLight(): void {
    const g = this.partyG;
    const d = LIFT_LAYOUT.door;
    g.clear();
    g.fillStyle(PARTY[0], 1).fillRect(d.x, d.y, d.w, d.h);
    g.fillStyle(PARTY[1], 1).fillRect(d.x, d.y + d.h - 22, d.w, 22);
    // 紙ふぶきの色の点
    for (let i = 0; i < 18; i++) {
      g.fillStyle(PARTY[i % 3], 1).fillRect(d.x + 2 + ((i * 7) % (d.w - 4)), d.y + 6 + ((i * 13) % (d.h - 30)), 2, 2);
    }
    // 床に差しこむ光:扉の口から左下へ広がる、間を抜いた点
    const floor = LIFT_LAYOUT.floorY;
    g.fillStyle(PARTY[0], 1);
    for (let y = floor + 1; y < layout.actionH; y += 2) {
      const k = (y - floor) / (layout.actionH - floor);
      const x0 = Math.round(d.x - k * 70), x1 = Math.round(d.x + d.w + k * 4);
      for (let x = x0 + ((y >> 1) % 2) * 2; x < x1; x += 4) g.fillRect(x, y, 1, 1);
    }
    g.setDepth(-18);
  }

  /** まとめの1行(アクション部分の上に帯で) */
  private summary(text: string): void {
    const { W } = layout;
    const y = 30;
    const g = this.add.graphics().setDepth(1450);
    g.fillStyle(UI.black, 1).fillRect(0, y, W, 20);
    g.fillStyle(UI.gold, 1).fillRect(0, y + 1, W, 1).fillRect(0, y + 18, W, 1);
    new PixelText(this, Math.floor(W / 2), y + 4, text, { size: FS.small, color: UI.text, outline: true }).setOrigin(0.5, 0).setDepth(1451);
  }

  /** 波4の仕分けへ */
  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.phase = 'leave';
    gotoWhenFree(this, SCENES.sort);
  }
}
