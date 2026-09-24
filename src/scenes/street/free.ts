// フリープレイの通り(docs/FREEPLAY.md。run.mode === 'free')。Street のシーンの中で、フリープレイだけの流れを受け持つ。
// 仕分けはなく、ヒーローが波の始めに見た目だけでルールを決めつけ、その通りに殴りかかったり素通りしたりする。
// プレイヤーは待てと行けだけで直す。Street の技、吹っ飛び、ギャングの組、UFO の動きはそのまま使う。
//
// 流れ(play):
//   「WAVE1」の帯 → 決めつけ(ヒーローとオペレーター。タップで飛ばせる。この間は時計を止める)
//   → 1人ずつ:ルール(ruleAt)で殴りかかる人には待てのマーク(attackOne)、ほかは素通り(passOne)
//     波3は redeclare.after 人目が通ったら、時計を止めてルールを言い直す
//   → 最後の人が通り、悪さがみな終わったら時計を止めて「WAVE1 CLEAR!」→ nextAfterFreeStreet(run)
//
// 仕組みは人の見た目で決める:fp_mohawk はナイフで脅す(threaten)、fp_gang は口笛で仲間を呼ぶ(Street の gangCall)、
// fp_alien は UFO を呼ぶ(Street の ufoCall)。ギャングの集合と UFO はヒーローが待つので、同時には出ない。
// 波3のモヒカンの悪さだけは、ヒーローが待たずに歩き続ける。行けのマークが2つ出ていたら、先に出たほうに効く。
// ヒーローが待てのマークの最中(ため)なら、行けはその場から光の拳を飛ばして倒す(ためは続く)。
//
// 待てと行けのボタンは、マークがないときも押せる(空押し。DryPress)。空押しのあと1秒は効かない(ボタンを暗くする)。
// オペレーターの一言は毎回は言わず、1つの波で4回くらいにする(opEvent)。
// 時計は run.free.clockMs に積み上げる(決めつけと言い直しの間、一時停止の間、画面が切りかわる間は足さない)。

import Phaser from 'phaser';
import { UI } from '../../config';
import { audio } from '../../audio';
import { animKey } from '../../art/sheets';
import { accessorySheet } from '../../art/recolor';
import { FREE_ITEM_ICONS } from '../../art/free/items';
import {
  ACCESSORY_COLORS, DryPress, FREE, MARK, STAGES, createFreeLines, formatClearTime, freeRoleOf, freeTiming, freeWaveScene, heroChoice,
  ruleAt, shout, type AttackKind, type FreeItem, type FreeLines, type FreeOpContext, type FreeOpKey, type FreeRule, type FreeTiming,
  type FreeWave, type GangCallOptions, type Look, type Person, type StageDef, type StageId
} from '../../logic';
import { currentFreeWave, nextAfterFreeStreet, setSort, type GameRun } from '../../run';
import { settings } from '../../settings';
import { banner, gotoWhenFree, impact, lighter, waitMs } from '../../ui';
import type { StreetScene } from '../Street';
import { Actor, HEAD } from './actor';
import { ATTACK_GAP, JUDGE_RISE, RUN } from './common';
import { FreeItems } from './freeItems';
import { THREAT_DX, planFree, type PasserLook, type StreetPlan } from './plan';
import { RuleSign } from './ruleSign';

/** ヒーローが今何をしているか(行けで走って殴れるか、光の拳を飛ばすかを決める) */
type HeroMode = 'walk' | 'wait' | 'waitMech' | 'mark' | 'busy';

/** ナイフで脅しているモヒカン1人(行けのマークが出ている) */
interface Threat {
  a: Actor;
  victim: Actor;
  /** マークが出た時刻(行けは先に出たほうに効く) */
  since: number;
  /** 待てで止めたあとの悪さ(行けで倒すと取り返し) */
  recovered: boolean;
  timer: Phaser.Time.TimerEvent | null;
  /** 行けで倒されたか、逃げたあとの動きが終わったら呼ぶ */
  resolve: () => void;
}

/** 行けが効く相手(モヒカンの悪さ、ギャングの組、UFO)。since の小さいほうから効く */
interface GoTarget { since: number; fire: () => void }

/** 1つの波で、オペレーターの一言(フリープレイの場面)を言う回数のめやす */
const OP_PER_WAVE = 4;
/** 2回目からの場面は、この割合で言う(言いすぎないように) */
const OP_CHANCE = 0.4;
/** オペレーターの一言と一言の間は、少なくともこれだけあける(ミリ秒) */
const OP_GAP_MS = 2500;
/** 押すべきマークを何回続けて逃したら、あきらめの一言(idle)にするか */
const IDLE_STREAK = 2;
/** ためのいちばん最後のこの割合で待てを押したら「ギリギリセーフ」 */
const CLOSE_CALL = 0.2;
/** 決めつけの一言を出しておく時間(ミリ秒。タップで飛ばせる) */
const DECLARE_HERO_MS = 1600;
const DECLARE_OP_MS = 1800;
/** 空押しで立ち止まる時間(待て)、振り向いている時間(行け) */
const DRY_STOP_MS = 450;
const DRY_GO_MS = 300;
/** 光の拳の速さ(ドット/秒) */
const FIST_SPEED = 420;

/** 同じ回の中で、セリフを選ぶもの(波をまたいで、同じ文を続けないように) */
const linesOf = new WeakMap<GameRun, FreeLines>();
/** その回でオペレーターがもう言った場面(初めての場面は必ず言う) */
const spokenOf = new WeakMap<GameRun, Set<string>>();
/** その回で行けの使い方をもう言ったか */
const taughtGo = new WeakSet<GameRun>();
/** 開発用:その回で場面が何回起きたか(光の拳、走って殴る、ギリギリセーフ、行けのマークが2つ、ワルに待て) */
interface Seen { fist: number; runHit: number; closeCall: number; twoGo: number; recover: number }
const seenOf = new WeakMap<GameRun, Seen>();

/** 開いているステージの市民の絵(悪さの相手)。地下駐車場の市民の小物はオレンジか紫 */
function passerLooks(unlocked: readonly StageId[]): PasserLook[] {
  const out: PasserLook[] = [];
  if (unlocked.includes('alley')) for (const look of ['hoodie', 'suit', 'shopper', 'granny'] as const) out.push({ key: `${look}_civ`, look });
  if (unlocked.includes('garage')) {
    (['guard', 'mechanic', 'clubber', 'officelady'] as const).forEach((look, i) => {
      out.push({ key: `${look}_civ`, look, color: ACCESSORY_COLORS[FREE.garageCivColors[i % FREE.garageCivColors.length]].color });
    });
  }
  if (unlocked.includes('mall')) for (const look of ['mascot', 'clerk', 'dancer', 'uncle'] as const) out.push({ key: `${look}_civ`, look });
  return out;
}

export class FreeStreet {
  readonly fw: FreeWave;
  readonly bgDef: StageDef;
  readonly lines: FreeLines;
  readonly items: FreeItems;
  timing: FreeTiming;
  sign!: RuleSign;
  /** ボタンを押せるか(決めつけの間と、波の終わりは押せない) */
  inputOpen = false;
  heroMode: HeroMode = 'busy';
  /** ヒーローのまわりの光の形。殴りかかる相手に向かうときは 'attack'、素通りのときは 'pass' */
  auraKind: 'attack' | 'pass' | null = null;
  private run: GameRun;
  private rule: FreeRule;
  private clockRunning = false;
  private redeclared = false;
  private dryStop = new DryPress();
  private dryGo = new DryPress();
  private dryReacting = false;
  private threats: Threat[] = [];
  private missStreak = 0;
  private waveSpoken = 0;
  private lastOpAt = Number.NEGATIVE_INFINITY;
  private penaltyUnits = 0;
  private passerPool: PasserLook[];
  private auras: Partial<Record<'attack' | 'pass' | 'attackLine' | 'passLine', Phaser.GameObjects.Sprite>> = {};
  private bubbleIcon: Phaser.GameObjects.Container | null = null;
  /** 小物の絵を付けた吹き出し(ヒーローの吹き出しが替わったら、絵を消す) */
  private iconBubble: Phaser.GameObjects.Container | null = null;
  /** 始まったが、まだ終わっていないモヒカンの悪さの数(相手の所へ走っている間も数える) */
  private pendingMischief = 0;
  /** 行けで殴りに行っている途中の数(走って殴る、光の拳) */
  private pendingGo = 0;
  /** 一時停止の間は進まない時計(ミリ秒)。空押しの効かない間を数える */
  private playMs = 0;
  /** 言い直しで止めている間 true(悪さの時計も止める。押した待てと行けは覚えておき、止めが終わったら効かせる) */
  held = false;
  /** 言い直しの間に押した待てと行け(マークが出ていたときだけ) */
  private queued = { stop: false, go: false };
  /** 前のコマで待てと行けのマークがあったか(消えた瞬間を知るため) */
  private hadStop = false;
  private hadGo = false;
  /** 開発用:モヒカンが逃げるまでの秒数を決める(?threat=8。行けのマークが2つ出る場面を作るため)。ふつうは null */
  private threatSecDebug: number | null = null;
  private offSettings: (() => void) | null = null;
  /** ためを数えている時計(ためのときだけ) */
  private windupEv: Phaser.Time.TimerEvent | null = null;
  /** 開発用:その回で場面が何回起きたか(tools/free_play.mjs が見る) */
  readonly seen: Seen;

  constructor(private s: StreetScene) {
    const run = s.run;
    this.run = run;
    this.fw = currentFreeWave(run);
    this.bgDef = STAGES[this.fw.bgStage];
    this.rule = this.fw.rule;
    let lines = linesOf.get(run);
    if (!lines) { lines = createFreeLines(run.rng); linesOf.set(run, lines); }
    this.lines = lines;
    let seen = seenOf.get(run);
    if (!seen) { seen = { fist: 0, runHit: 0, closeCall: 0, twoGo: 0, recover: 0 }; seenOf.set(run, seen); }
    this.seen = seen;
    this.items = new FreeItems(s);
    this.timing = freeTiming(this.fw.no, settings.slowMode);
    this.passerPool = passerLooks(run.free!.plan.unlocked);
    // 前の波までの、逃がしたワル、市民のけが、ワルへの待ての数(時間に足す分)から始める
    this.penaltyUnits = this.penaltyNow();
    if (run.debug) {
      const t = Number(new URLSearchParams(location.search).get('threat'));
      if (t > 0) this.threatSecDebug = t;
    }
    // ヒーローが決めた通りの仕分けを残す(結果画面と共有の文が使う。fillUnsorted は使わない)
    for (const p of s.run.stage.waves[run.waveIndex].people) setSort(run, p, heroChoice(ruleAt(this.fw, p.index), p));
    // 途中でゆっくりモードにしたら、ゆっくりの記録にし、これからの時間を1.5倍にする
    if (settings.slowMode) this.markSlow();
    this.offSettings = settings.onChange((st) => {
      this.timing = freeTiming(this.fw.no, st.slowMode);
      if (st.slowMode) this.markSlow();
    });
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.offSettings?.(); this.offSettings = null; });
  }

  private markSlow(): void {
    if (this.run.free) this.run.free.slow = true;
    this.s.stats.setFreeSlow(true);
  }

  /** 曲(波ごとに少しずつ速い) */
  get bgm(): 'free1' | 'free2' | 'free3' {
    return `free${this.fw.no}` as const;
  }

  /** ギャングの組の時間(ゆっくりモードは長く) */
  get gangOpts(): GangCallOptions {
    return { escapeSec: this.timing.gangEscapeSec, driveSec: this.timing.gangDriveSec };
  }

  // ─── 作る ─────────────────────────────────────

  /** 並べ方。悪さの相手は、素通りされるモヒカンとUFOを呼ぶ宇宙人の先に置く */
  plan(people: readonly Person[]): StreetPlan {
    const victims = new Map<string, 'threat' | 'ufo'>();
    for (const p of people) {
      if (freeRoleOf(this.fw, p) !== 'go') continue;
      if (p.look === 'fp_mohawk') victims.set(p.id, 'threat');
      else if (p.look === 'fp_alien') victims.set(p.id, 'ufo');
    }
    return planFree(people, {
      gap: this.timing.gapPx, bg: this.fw.bgStage, props: this.bgDef.props, victims, passerLooks: this.passerPool
    }, this.s.rng);
  }

  /** 左上の札と、ヒーローの光(殴りかかるときと素通りのとき) */
  build(): void {
    const s = this.s;
    this.sign = new RuleSign(s, this.fw.no);
    this.sign.setTime(formatClearTime(this.clockSec));
    const make = (key: string, anim: boolean): Phaser.GameObjects.Sprite | undefined => {
      if (!s.textures.exists(key)) return undefined;
      const sp = s.add.sprite(0, 0, key, 0).setVisible(false);
      if (anim && s.anims.exists(animKey(key, 'play'))) sp.play(animKey(key, 'play'));
      return sp;
    };
    this.auras = {
      attack: make('fx_aura_attack', true), pass: make('fx_aura_pass', true),
      attackLine: make('fx_aura_attack_line', false), passLine: make('fx_aura_pass_line', false)
    };
  }

  /** 悪さの相手の絵を1つ選ぶ(見た目が同じだと分かりにくいので、ワルと違う見た目) */
  passerLook(): PasserLook {
    const pool = this.passerPool.length > 0 ? this.passerPool : [{ key: 'suit_civ', look: 'suit' as Look }];
    return this.s.rng.pick(pool);
  }

  /** 通りがかりの市民を1人作る(右の端から歩いてくる人など) */
  makePasser(x: number, y: number): Actor {
    const s = this.s;
    const l = this.passerLook();
    const a = new Actor(s, accessorySheet(s, l.key, l.color), x, y);
    a.look = l.look; a.civ = true;
    a.faceLeft(true).play('idle');
    s.passers.push(a);
    return a;
  }

  /** UFOの真下に立っている悪さの相手(並べ方が置いた人。いなければ null) */
  ufoVictim(x: number): Actor | null {
    return this.s.passers.find((p) => p.standing && Math.abs(p.x - x) < 12) ?? null;
  }

  // ─── 毎フレーム ───────────────────────────────

  get clockSec(): number {
    return (this.run.free?.clockMs ?? 0) / 1000;
  }

  update(deltaMs: number): void {
    const s = this.s;
    const f = this.run.free;
    // 1コマは長くても50ミリ秒で切る(ヒーローの歩みと同じ。遅い端末で時計だけが進みすぎないように)
    const ms = Math.min(deltaMs, 50);
    this.playMs += ms;
    if (f && this.clockRunning && !s.leaving) f.clockMs += ms;
    // マークが消えたら覚えておく(直後の押しは、遅れた押しとして空押しにしない)
    const stopMark = s.stopHandler !== null;
    const goMark = this.goTarget() !== null;
    if (this.hadStop && !stopMark) this.dryStop.markGone(this.playMs);
    if (this.hadGo && !goMark) this.dryGo.markGone(this.playMs);
    this.hadStop = stopMark;
    this.hadGo = goMark;
    // 逃がしたワル、市民のけが、ワルへの待ての分(1つ3秒)も足した時間を出す。増えたら「+3」を飛ばす
    if (s.frameN % 10 === 0 || !this.sign) {
      const units = this.penaltyNow();
      if (units > this.penaltyUnits && this.sign) this.sign.penalty((units - this.penaltyUnits) * FREE.penaltySec);
      this.penaltyUnits = units;
    }
    this.sign?.setTime(formatClearTime(this.clockSec + this.penaltyUnits * FREE.penaltySec));
  }

  /** 時間に足す分の数(逃がしたワル、市民のけが、ワルへの待て。stats の clearSec と同じ数え方) */
  private penaltyNow(): number {
    const snap = this.s.stats.snapshot();
    return snap.escaped + snap.civHurt + snap.badSparedByStop;
  }

  /** 人を合わせたあとに呼ぶ(小物) */
  syncAfter(): void {
    this.items.sync();
    this.syncBubbleIcon();
  }

  /**
   * ヒーローの光を合わせる。殴りかかるか素通りの相手に向かっているときは、その形の光を出して true を返す
   * (Street の光は出さない)。光と揺れを弱くするときは、点滅しないふち取りにする
   */
  syncAura(hx: number, hy: number, depth: number, on: boolean): boolean {
    const kind = this.auraKind;
    const reduce = settings.reduceFx;
    const want = kind === null ? undefined : kind === 'attack' ? (reduce ? this.auras.attackLine : this.auras.attack) : (reduce ? this.auras.passLine : this.auras.pass);
    for (const sp of Object.values(this.auras)) if (sp && sp !== want) sp.setVisible(false);
    if (!want) return false;
    want.setPosition(hx, hy - 26).setDepth(depth).setVisible(reduce || on);
    return true;
  }

  /** ボタンの見た目(押せるか、空押しで効かない間は暗く、マークがあればゆっくり光る) */
  updateButtons(): void {
    const s = this.s;
    const now = this.playMs;
    const pairs: [typeof s.stopBtn, DryPress, boolean, number][] = [
      [s.stopBtn, this.dryStop, s.stopHandler !== null, UI.stop],
      [s.goBtn, this.dryGo, this.goTarget() !== null, UI.go]
    ];
    for (const [btn, dry, mark, color] of pairs) {
      if (btn.isEnabled !== this.inputOpen) btn.setEnabled(this.inputOpen).setColor(color);
      const alpha = this.inputOpen && dry.locked(now) ? 0.45 : 1;
      if (btn.alpha !== alpha) btn.setAlpha(alpha);
      if (s.frameN % 3 === 0 && this.inputOpen) {
        const t = mark && alpha === 1 ? (1 - Math.cos((now / 1100) * Math.PI * 2)) / 2 : 0;
        btn.setColor(lighter(color, t * 0.3));
      }
    }
  }

  // ─── 待てと行け ───────────────────────────────

  pressStop(): void {
    if (!this.inputOpen) return;
    const s = this.s;
    const has = s.stopHandler !== null;
    // 言い直しの間は、マークが出ていれば覚えておき、止めが終わったら効かせる(空押しには数えない)
    if (this.held) { if (has) this.queued.stop = true; return; }
    if (!this.dryStop.press(this.playMs, has)) { if (!has) this.dry('stop'); return; }
    s.stopHandler?.();
  }

  pressGo(): void {
    if (!this.inputOpen) return;
    const t = this.goTarget();
    if (this.held) { if (t) this.queued.go = true; return; }
    if (!this.dryGo.press(this.playMs, t !== null)) { if (!t) this.dry('go'); return; }
    if (t) this.fireGo(t);
  }

  /** ためがどこまで進んだか(0〜1。ためでなければ null。開発用) */
  get windupProgress(): number | null {
    return this.windupEv && !this.windupEv.hasDispatched ? this.windupEv.getProgress() : null;
  }

  /** 行けが効く相手のうち、いちばん先にマークが出たもの */
  goTarget(): GoTarget | null {
    const s = this.s;
    const list: GoTarget[] = this.threats.map((t) => ({ since: t.since, fire: () => this.hitThreat(t) }));
    const h = s.goHandler;
    if (h) list.push({ since: s.goSince, fire: h });
    if (list.length === 0) return null;
    return list.reduce((a, b) => (b.since < a.since ? b : a));
  }

  /** 行けを押した(2つ出ていたら数えておく) */
  private fireGo(t: GoTarget): void {
    if (this.threats.length + (this.s.goHandler ? 1 : 0) > 1) this.seen.twoGo++;
    t.fire();
  }

  /** 空押し:ヒーローが「?」と振り向く(待ては少し立ち止まる) */
  private dry(kind: 'stop' | 'go'): void {
    const s = this.s;
    audio.sfx('dryPress');
    s.stats.dryPress();
    if (this.dryReacting) return;
    const h = s.hero;
    // 歩いているときと待っているときだけ振り向く(技やためのときは、ヒーローの一言を消さない)
    if (this.heroMode !== 'walk' && this.heroMode !== 'wait') return;
    this.dryReacting = true;
    s.heroSay(this.lines.heroDryPress(), 700);
    h.faceLeft(true);
    const ms = kind === 'stop' ? DRY_STOP_MS : DRY_GO_MS;
    if (kind === 'stop') {
      s.holdMs = ms;
      if (s.walker) h.play('idle');
    }
    s.time.delayedCall(ms, () => {
      this.dryReacting = false;
      h.faceLeft(false);
      if (s.walker && h.anim === 'idle') h.play('run');
    });
  }

  // ─── オペレーター ─────────────────────────────

  /**
   * その場面が起きた(回数を数える)。言うかどうかは、1つの波で OP_PER_WAVE 回まで、初めての場面は必ず、
   * 2回目からは OP_CHANCE の割合(前の一言から OP_GAP_MS あける)
   */
  opEvent(key: FreeOpKey, ctx?: FreeOpContext): void {
    const s = this.s;
    const f = this.run.free;
    if (!f) return;
    const n = (f.opCounts[key] ?? 0) + 1;
    f.opCounts[key] = n;
    let spoken = spokenOf.get(this.run);
    if (!spoken) { spoken = new Set(); spokenOf.set(this.run, spoken); }
    if (this.waveSpoken >= OP_PER_WAVE) return;
    const now = s.time.now;
    const first = !spoken.has(key);
    if (!first && (now - this.lastOpAt < OP_GAP_MS || !s.rng.chance(OP_CHANCE))) return;
    spoken.add(key);
    this.waveSpoken++;
    this.lastOpAt = now;
    const sp = this.lines.op(key, n, ctx);
    s.opSay(sp, sp.face === 'panic', true);
  }

  /** 押すべきマークを押さずに逃した。続けて逃しているときは、だんだんあきらめる一言(idle)にする */
  private miss(key: FreeOpKey, ctx?: FreeOpContext): void {
    this.missStreak++;
    if (this.missStreak >= IDLE_STREAK) this.opEvent('idle');
    else this.opEvent(key, ctx);
  }

  /** 待てや行けが効いた */
  private hit(key: FreeOpKey): void {
    this.missStreak = 0;
    this.opEvent(key);
  }

  /** 行けのマークが出た。その回で初めてなら、行けの使い方を言う(短い一言) */
  goMarkShown(): void {
    if (taughtGo.has(this.run)) return;
    taughtGo.add(this.run);
    this.s.opSay(this.s.line('teachGo'), true, true);
    this.lastOpAt = this.s.time.now;
  }

  /** ギャングの組やUFOを行けで決めた(数は Street が stats に入れる) */
  goDone(recovered: boolean): void {
    this.hit(recovered ? 'recovered' : 'goDone');
  }

  /** UFOに連れ去られた */
  ufoEscaped(look?: Look): void {
    this.miss('escaped', { look });
  }

  /** ギャングの車が走り出した:ヒーローは笑顔で手を振って見送る(その場面を先に撮っておく) */
  gangDrive(): void {
    const s = this.s;
    const h = s.hero;
    h.faceLeft(false).play('pass', true);
    audio.sfx('sparkle');
    for (let i = 0; i < 3; i++) s.time.delayedCall(i * 110, () => s.fx('fx_sparkle', h.x + 12, h.y - 48 + i * 4, { depth: 960 }));
    this.gangShot = 'pending';
    s.time.delayedCall(250, () => s.shoot(0, (img) => {
      if (this.gangShot === 'want') this.run.worstShot = img;
      else this.gangShot = img;
    }));
  }

  private gangShot: HTMLImageElement | 'pending' | 'want' | null = null;

  /** ギャングの車に逃げきられた:手を振って見送った場面にする */
  gangEscaped(): void {
    const s = this.s;
    if (s.stats.reportFreeScene('waveGang')) {
      if (this.gangShot instanceof HTMLImageElement) this.run.worstShot = this.gangShot;
      else if (this.gangShot === 'pending') this.gangShot = 'want';
      else s.shoot(0, (img) => { this.run.worstShot = img; });
    }
    this.gangShot = null;
    this.miss('escaped', { look: 'fp_gang' });
  }

  // ─── 流れ ─────────────────────────────────────

  async play(): Promise<void> {
    const s = this.s;
    await this.declare();
    for (const a of s.queue) {
      if (s.leaving) return;
      if (!a.standing || !a.person || a.called) continue;
      const p = a.person;
      if (this.fw.redeclare && !this.redeclared && p.index >= this.fw.redeclare.after) await this.redeclare(this.fw.redeclare.rule);
      const rule = ruleAt(this.fw, p.index);
      if (heroChoice(rule, p) === 'bad') await this.attackOne(a, rule);
      else await this.passOne(a);
    }
    await this.settle();
    await this.waveClear();
  }

  /** 画面をタップしたら true になる(決めつけを飛ばす)。中断と音のボタンは除く */
  private listenSkip(): { skipped: () => boolean; off: () => void } {
    const s = this.s;
    let skipped = false;
    const onDown = (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void => {
      if (over.some((o) => o.parentContainer && s.icons.includes(o.parentContainer))) return;
      skipped = true;
      if (s.cut.isTyping) s.cut.skip();
    };
    s.input.on('pointerdown', onDown);
    const off = (): void => { s.input.off('pointerdown', onDown); };
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    return { skipped: () => skipped, off };
  }

  /** ms たつか、タップされるまで待つ(シーンの時計で数えるので、一時停止の間は進まない) */
  private async waitOrSkip(ms: number, skipped: () => boolean): Promise<void> {
    const step = 50;
    for (let left = ms; left > 0 && !skipped() && !this.s.leaving; left -= step) await waitMs(this.s, step);
  }

  /** 波の始め:「WAVE1」の帯、ヒーローの決めつけとオペレーターのツッコミ、ルールの札。時計は止めておく */
  private async declare(): Promise<void> {
    const s = this.s;
    const h = s.hero;
    this.clockRunning = false;
    this.inputOpen = false;
    const sk = this.listenSkip();
    void banner(s, `WAVE${this.fw.no}`, { hold: 600 });
    await this.waitOrSkip(950, sk.skipped);
    const d = this.lines.declare(this.fw.bgStage, this.rule);
    audio.sfx(this.rule.kind === 'allCiv' ? 'declarePass' : 'declareBad');
    this.sign.setRule(this.rule);
    h.play('win_arms', true);
    s.heroSay(d.hero, DECLARE_HERO_MS + DECLARE_OP_MS);
    await this.waitOrSkip(DECLARE_HERO_MS, sk.skipped);
    s.opSay(d.op, false, true);
    await this.waitOrSkip(DECLARE_OP_MS, sk.skipped);
    sk.off();
    s.heroBubble?.destroy();
    s.heroBubble = undefined;
    h.play('idle');
    this.lastOpAt = s.time.now;
    this.inputOpen = true;
    this.clockRunning = true;
  }

  /** 波3:ルールを言い直す。時計を止めて、札が変わるのを見せる */
  private async redeclare(next: FreeRule): Promise<void> {
    const s = this.s;
    const h = s.hero;
    this.redeclared = true;
    const from = this.rule;
    this.clockRunning = false;
    this.heroMode = 'busy';
    // 止めている間は、悪さの時計(モヒカンが逃げるまで、ギャング、UFO)も止める。押した待てと行けは、止めが終わってから効かせる
    this.hold(true);
    h.faceLeft(false).play('win_arms', true);
    if (from.kind === 'item' && next.kind === 'item') {
      const d = this.lines.redeclare(from.item, next.item);
      s.heroSay(d.hero, 2200);
      s.opSay(d.op, true, true);
    }
    audio.sfx('declareBad');
    this.rule = next;
    this.sign.setRule(next, true);
    s.stats.setFreeRule(next);
    if (this.run.free) this.run.free.opCounts.redeclare = (this.run.free.opCounts.redeclare ?? 0) + 1;
    this.lastOpAt = s.time.now;
    await waitMs(s, this.timing.redeclarePauseSec * 1000);
    h.play('idle');
    this.hold(false);
    this.clockRunning = true;
  }

  /** 言い直しの間、悪さの時計を止める(on=false で動かし直し、その間に押された待てと行けを効かせる) */
  private hold(on: boolean): void {
    this.held = on;
    for (const t of this.threats) if (t.timer) t.timer.paused = on;
    if (on) { this.queued = { stop: false, go: false }; return; }
    const q = this.queued;
    this.queued = { stop: false, go: false };
    if (q.stop) this.pressStop();
    if (q.go) this.pressGo();
  }

  /** 次の人へ歩く(行けで走って殴るときは、途中で止めて、あとで続きを歩く) */
  private async walkTo(x: number, y: number): Promise<void> {
    this.heroMode = 'walk';
    await this.s.runTo(x, { y });
    this.heroMode = 'busy';
  }

  /** 殴りかかる相手:待てのマーク。押さなければ技を出す */
  private async attackOne(a: Actor, rule: FreeRule): Promise<void> {
    const s = this.s;
    const h = s.hero;
    const look = a.look!;
    this.auraKind = 'attack';
    await this.walkTo(a.x - MARK.showDistance, s.laneFor(a));
    // 歩いている間に、行けの巻きぞえで倒れていたら、とばす
    if (!a.standing) { this.auraKind = null; return; }
    s.showMark(a, 'stop');
    s.stopAlarm.start();
    s.slow = this.timing.markSlowmo;
    h.sprite.anims.timeScale = this.timing.markSlowmo;
    const item = rule.kind === 'item' ? rule.item : undefined;
    this.heroSayItem(this.lines.heroAttack(look, rule), item, a);
    if (a.civ) this.opEvent('hitCivRule', { look, item });
    const k = s.pickAttack();
    const res = await this.markWindow(a, k);
    s.stopAlarm.stop();
    s.slow = 1;
    h.sprite.anims.timeScale = 1;
    s.hideMark(a);
    s.auraOn = false;
    this.auraKind = null;
    this.heroMode = 'busy';
    if (res.stop) { await this.stopped(a, res.close); return; }
    s.heroSay(shout(k, s.rng), 900);
    await s.attack(a, k, a.civ ? 'civ' : 'bad');
    await this.afterAttack();
  }

  /** 待てのマークの間。ためのいちばん最後に止めたら close(ギリギリセーフ) */
  private markWindow(a: Actor, k: AttackKind): Promise<{ stop: boolean; close: boolean }> {
    const s = this.s;
    return new Promise((resolve) => {
      let done = false;
      let ev: Phaser.Time.TimerEvent | null = null;
      const finish = (stop: boolean, close = false): void => {
        if (done) return;
        done = true;
        s.stopHandler = null;
        // 近づいている途中なら、その歩きを終わったことにする(下の then は done を見て何もしない)
        const w = s.walker;
        s.walker = null;
        w?.resolve();
        ev?.remove();
        this.windupEv = null;
        resolve({ stop, close });
      };
      s.stopHandler = () => finish(true, !!ev && ev.getProgress() >= 1 - CLOSE_CALL);
      this.heroMode = 'mark';
      void s.runTo(a.x - ATTACK_GAP, { anim: null }).then(() => {
        if (done) return;
        s.windup(k);
        ev = s.time.delayedCall(this.timing.windupSec * 1000, () => finish(false));
        this.windupEv = ev;
      });
    });
  }

  /** 決めつけの一言。波3は吹き出しの左に小物の絵も出す(「風船だからワル!」) */
  private heroSayItem(sp: { text: string }, item: FreeItem | undefined, target: Actor): void {
    const s = this.s;
    // マークが出ている間(近づく間とため)は出しておく
    const markMs = ((MARK.showDistance - ATTACK_GAP) / (RUN * this.timing.markSlowmo) + this.timing.windupSec) * 1000;
    // 相手が風船を持っていたら、吹き出しを風船の上まで上げる(風船に重ならないように)
    let rise = JUDGE_RISE;
    const top = this.items.topOf(target);
    if (top !== null) {
      const h = s.hero;
      // 吹き出しの下の端(しっぽの付け根)は、頭の上 HEAD + 2 からさらに rise 上、しっぽの長さ5ドットの上
      rise = Math.max(rise, Math.ceil(h.y - h.lift - HEAD - 2 - 5 - (top - 2)));
    }
    s.heroSay(sp.text, Math.max(1600, Math.round(markMs) + 200), rise);
    this.bubbleIcon?.destroy();
    this.bubbleIcon = null;
    const key = item ? FREE_ITEM_ICONS[item] : null;
    const b = s.heroBubble;
    this.iconBubble = b ?? null;
    if (!key || !b || !s.textures.exists(key)) return;
    const c = s.add.container(0, 0).setScrollFactor(0).setDepth(b.depth);
    const g = s.add.graphics();
    g.fillStyle(UI.black, 1).fillRect(-1, 0, 22, 20).fillRect(0, -1, 20, 22);
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 20, 20);
    c.add([g, s.add.image(2, 2, key, 0).setOrigin(0, 0)]);
    this.bubbleIcon = c;
    this.syncBubbleIcon();
  }

  /** 小物の絵を、吹き出しの左(はみ出すなら右)につける */
  private syncBubbleIcon(): void {
    const c = this.bubbleIcon;
    if (!c) return;
    const b = this.s.heroBubble;
    // ほかの一言(叫び、素通りの一言など)に替わったら、絵も消す
    if (!b || !b.active || b !== this.iconBubble) { c.destroy(); this.bubbleIcon = null; this.iconBubble = null; return; }
    const r = b.boxRect();
    const x = r.x >= 24 ? r.x - 21 : r.right + 1;
    c.setPosition(Math.round(x), Math.round(r.centerY - 10)).setVisible(b.visible).setScale(b.scaleX);
  }

  /** 待てで止めた。市民なら守った。ワルならすぐ悪さを始める(行けで取り返せる) */
  private async stopped(a: Actor, close: boolean): Promise<void> {
    const s = this.s;
    if (a.civ) {
      // 拳が当たる寸前に止めた:ギリギリセーフの場面
      if (close) this.seen.closeCall++;
      if (close && s.stats.reportFreeScene('closeCall')) s.time.delayedCall(60, () => s.shoot(0, (img) => { this.run.worstShot = img; }));
      this.hit('saved');
      await s.doStop(a);
      return;
    }
    this.missStreak = 0;
    this.seen.recover++;
    await s.doStop(a);
    if (!a.standing) return;
    // ほら、やっぱりワル:止めたワルはすぐ悪さを始める
    s.heroSay(this.lines.heroToldYou(), 1300);
    s.hero.pose('oops', 1);
    if (a.look === 'fp_alien') {
      this.heroMode = 'waitMech';
      await s.ufoPart.ufoCall(a, true);
      this.heroMode = 'busy';
    } else await this.threatenFlow(a, true);
  }

  /** 殴ったあと。市民を殴っても謝らない(でもルール通りだし!)。巻きぞえだけなら「やっちまった」 */
  private async afterAttack(): Promise<void> {
    const s = this.s;
    const h = s.hero;
    const hits = s.civHits;
    s.civHits = [];
    s.civCried = null;
    if (hits.length === 0) {
      h.play('idle');
      await waitMs(s, 380);
      return;
    }
    const direct = hits.find((c) => !c.collateral);
    if (direct) {
      await waitMs(s, 250);
      h.play('win_arms', true);
      audio.sfx('okay');
      s.heroSay(this.lines.heroStubborn(), 1100);
      this.miss('hitCiv', { look: direct.look });
      await waitMs(s, 900);
      h.play('idle');
      return;
    }
    // 巻きぞえだけ:やっちまった → まあいいか
    h.play('oops', true);
    audio.sfx('oops');
    s.heroSay(s.line('oops', s.rng), 800);
    await waitMs(s, 800);
    h.play('okay', true);
    audio.sfx('okay');
    s.heroSay(s.line('okay', s.rng), 700);
    await waitMs(s, 500);
    h.play('idle');
  }

  /** 素通り:笑顔で手を振る。ワルなら、そのあと見た目ごとの悪さ */
  private async passOne(a: Actor): Promise<void> {
    const s = this.s;
    const h = s.hero;
    const look = a.look!;
    this.auraKind = 'pass';
    const passY = a.y < 190 ? a.y + 12 : a.y - 12;
    await this.walkTo(a.x - 22, passY);
    if (!a.standing) { this.auraKind = null; return; }
    h.play('pass', true);
    audio.sfx('sparkle');
    s.heroSay(this.lines.heroPass(look), 1000);
    for (let i = 0; i < 4; i++) {
      s.time.delayedCall(i * 110, () => s.fx('fx_sparkle', h.x + 12 + s.rng.int(-6, 10), h.y - 48 + s.rng.int(-8, 8), { depth: 960 }));
    }
    if (a.civ) {
      void s.arc(a, a.x, 7, 200).then(() => s.arc(a, a.x, 5, 180));
      s.time.delayedCall(150, () => s.fx('fx_sparkle', a.x, a.y - HEAD - 6, { depth: 960 }));
    } else {
      this.opEvent('passBadRule', { look });
      // ワルに笑顔で手を振った瞬間(ギャングは車を見送る瞬間にする)
      if (look !== 'fp_gang' && s.stats.reportFreeScene(freeWaveScene(look))) {
        s.time.delayedCall(120, () => s.shoot(0, (img) => { this.run.worstShot = img; }));
      }
    }
    await s.runTo(a.x + 14, { speed: RUN * 0.55, anim: null });
    this.auraKind = null;
    if (a.civ) return;
    if (look === 'fp_gang' && a.person?.group) {
      this.heroMode = 'waitMech';
      await s.gangPart.gangCall(a);
    } else if (look === 'fp_alien') {
      this.heroMode = 'waitMech';
      await s.ufoPart.ufoCall(a);
    } else await this.threatenFlow(a, false);
    this.heroMode = 'busy';
  }

  /** モヒカンの悪さ。波3はヒーローが待たずに歩き続ける。波1と波2は終わるまで待つ */
  private async threatenFlow(a: Actor, recovered: boolean): Promise<void> {
    const p = this.threaten(a, recovered);
    if (this.fw.no === 3) return;
    this.heroMode = 'wait';
    this.s.hero.play('idle');
    await p;
    this.heroMode = 'busy';
  }

  /**
   * ナイフで脅す(けがはさせない)。行けのマークが出て、押さずに escapeSec たつと財布を奪って逃げる
   * (市民のけがも数える)。行けで倒されるか逃げたあとの動きが終わったら解決する
   */
  private threaten(a: Actor, recovered: boolean): Promise<void> {
    const s = this.s;
    // 呼んだ時点から終わるまでを数える(相手の所へ走っている間も、波を終えないように)
    this.pendingMischief++;
    return new Promise((done) => {
      let over = false;
      const resolve = (): void => { if (over) return; over = true; this.pendingMischief--; done(); };
      void (async () => {
        let v = s.passers.find((p) => p.standing && p.x > a.x + 24 && p.x < a.x + 110);
        let meetX = v?.x ?? 0;
        if (!v) {
          // 相手がいなければ、右の端から歩いてくる(モヒカンは相手が着く所へ走る)
          const vy = a.y < 192 ? 204 : 178;
          meetX = Math.max(a.x + THREAT_DX, s.hero.x + 60);
          v = this.makePasser(s.L.right + 20, vy);
          v.play('walk', true);
          const nv = v;
          void s.moveTo(nv, meetX, vy, 700, 'Linear').then(() => { if (nv.standing) nv.play('idle'); });
        }
        const victim = v;
        // 脅されている相手は、巻きぞえにしない(助かったあとも。UFOの買い物客と同じ)
        s.passers = s.passers.filter((p) => p !== victim);
        s.safeWalkers.push(victim);
        a.faceLeft(false).play('walk', true, 2.4);
        s.fx('fx_dust', a.x - 6, a.y - 8, { depth: a.y });
        await s.moveTo(a, Math.max(a.x, meetX - 18), victim.y, 620);
        if (!a.standing) { resolve(); return; }
        a.faceLeft(false).play('mischief', true);
        audio.sfx('swipeBad');
        s.time.delayedCall(300, () => { if (victim.standing) victim.faceLeft(true).pose('surprised'); });
        if (!recovered) s.heroSay(s.line('mischiefHero', s.rng), 1100);
        const t: Threat = { a, victim, since: s.time.now, recovered, timer: null, resolve };
        this.threats.push(t);
        s.showMark(a, 'go');
        s.goAlarm.start();
        this.goMarkShown();
        t.timer = s.time.delayedCall((this.threatSecDebug ?? this.timing.escapeSec) * 1000, () => this.threatEscape(t));
        if (this.held) t.timer.paused = true;
      })();
    });
  }

  /** 行けのマークが1つもなくなったら、画面の端の点滅を止める */
  private endThreat(t: Threat): void {
    this.threats = this.threats.filter((x) => x !== t);
    t.timer?.remove();
    t.timer = null;
    this.s.hideMark(t.a);
    if (!this.goTarget()) this.s.goAlarm.stop();
  }

  /** 行けを押さなかった:財布を奪って逃げる(逃がした、市民のけが) */
  private threatEscape(t: Threat): void {
    const s = this.s;
    if (!this.threats.includes(t)) return;
    this.endThreat(t);
    const { a, victim: v } = t;
    // 相手がもう倒れていれば、けがはもう数えてあるので、逃がしただけを数える
    const robbed = v.standing;
    if (robbed) {
      s.fx('fx_hit', v.x - 4, v.y - 30, { depth: 950 });
      audio.sfx('hit', { pitch: 0.7 });
      s.knock(v, 20, 10, 1);
    }
    s.stats.escaped(robbed);
    a.faceLeft(false).play('walk', true, 2.8);
    const escX = s.L.right + 50;
    s.tweens.add({ targets: a, x: escX, duration: Math.max(500, (escX - a.x) * 6), onComplete: () => a.destroy() });
    this.miss('escaped', { look: 'fp_mohawk' });
    s.time.delayedCall(500, () => t.resolve());
  }

  /** 行けが効いた:ヒーローが走って殴るか、その場から光の拳を飛ばす */
  private hitThreat(t: Threat): void {
    const s = this.s;
    if (!this.threats.includes(t)) return;
    this.endThreat(t);
    audio.sfx('go');
    this.goDone(t.recovered);
    t.a.pose('surprised');
    const canRun = (this.heroMode === 'walk' || this.heroMode === 'wait') && t.a.x - ATTACK_GAP >= s.hero.x - 2;
    if (canRun) this.seen.runHit++;
    else this.seen.fist++;
    // 殴り終わるまでを数える(波の終わりの歩きと重ならないように)
    this.pendingGo++;
    void (canRun ? this.runAndHit(t) : this.fistShot(t)).then(() => {
      this.pendingGo--;
      const v = t.victim;
      if (v.standing) {
        v.play('idle');
        void s.arc(v, v.x, 6, 220);
        s.fx('fx_sparkle', v.x, v.y - HEAD - 4, { depth: 960 });
      }
      t.resolve();
    });
  }

  /** 走って殴る(歩いている途中なら、歩くのを止めて、殴ったあとに続きを歩く) */
  private async runAndHit(t: Threat): Promise<void> {
    const s = this.s;
    const h = s.hero;
    const saved = s.walker;
    s.walker = null;
    const prev = this.heroMode;
    this.heroMode = 'busy';
    s.heroSay(s.line('go', s.rng), 800);
    await s.runTo(t.a.x - ATTACK_GAP, { speed: RUN * 3, y: t.a.y });
    const k = s.pickAttack();
    s.heroSay(shout(k, s.rng), 900);
    await s.attack(t.a, k, t.recovered ? 'recover' : 'go');
    await this.afterAttack();
    this.heroMode = prev;
    if (!saved) return;
    if (h.x >= saved.toX) { saved.resolve(); return; }
    h.play('run');
    s.walker = { ...saved, fromX: h.x, fromY: h.y };
  }

  /** その場から光の拳を飛ばして倒す(ためは続ける。ヒーローの動きは変えない) */
  private fistShot(t: Threat): Promise<void> {
    const s = this.s;
    const h = s.hero;
    const a = t.a;
    const dir = a.x >= h.x ? 1 : -1;
    const x0 = h.x + 16 * dir;
    const y0 = h.y - h.lift - 30;
    const fist = s.fx('fx_punch', x0, y0, { loop: true, depth: 900, flip: dir < 0 });
    audio.sfx('punch');
    const o = { x: x0, y: y0 };
    const toX = a.x - 4 * dir;
    const toY = a.y - 30;
    const dur = Math.max(120, (Math.hypot(toX - x0, toY - y0) / FIST_SPEED) * 1000);
    return new Promise((resolve) => {
      s.tweens.add({
        targets: o, x: toX, y: toY, duration: dur,
        onUpdate: () => fist.setPosition(Math.round(o.x), Math.round(o.y)),
        onComplete: () => {
          fist.destroy();
          s.fx('fx_hit', a.x - 4 * dir, a.y - 30, { depth: 950 });
          audio.sfx('hit');
          impact(s, 'small');
          if (a.standing) {
            s.knock(a, 60, 26, dir);
            s.stats.defeatBad('go', t.recovered);
          }
          s.time.delayedCall(300, () => resolve());
        }
      });
    });
  }

  /** 最後の人のあと、悪さ(モヒカン、ギャング、UFO)がみな終わるまで待つ */
  private async settle(): Promise<void> {
    const s = this.s;
    this.heroMode = 'wait';
    if (this.pendingMischief > 0) s.hero.play('idle');
    while (!s.leaving && (this.pendingMischief > 0 || this.pendingGo > 0 || this.threats.length > 0 || s.gangPart.gang || s.ufoPart.ufo)) await waitMs(s, 100);
    this.heroMode = 'busy';
  }

  /** 波の終わり:時計を止めて「WAVE1 CLEAR!」。次の波か結果画面へ */
  private async waveClear(): Promise<void> {
    const s = this.s;
    const h = s.hero;
    this.clockRunning = false;
    this.inputOpen = false;
    const last = s.queue[s.queue.length - 1];
    await s.runTo(Math.max(h.x, (last?.x ?? h.x) + 70), { y: 192 });
    h.faceLeft(false).play('okay', true);
    s.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    audio.sfx('okay');
    await banner(s, `WAVE${this.fw.no} CLEAR!`, { hold: 700 });
    if (s.leaving) return;
    s.leaving = true;
    s.devLog('free wave clear');
    s.run.scrollX = s.L.world.scrollX;
    gotoWhenFree(s, nextAfterFreeStreet(s.run));
  }
}
