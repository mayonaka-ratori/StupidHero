// 結果発表。仕分けが終わった波の人たちが並ぶ路地裏を、ヒーローが右へ進みながら、仕分け通りにハデに動く。
// 入口:Sort から(run.waveIndex の波)。出口:波の最後まで来たら nextAfterStreet(run)。
// 波3ではボスの前まで来たら、正体を現す場面を見せて Boss へ(run.scrollX に背景の位置を入れる)。
//
// 画面:上のアクション部分はカメラ world(ヒーローについて動く)、下の操作部分はカメラ ui(street/layers.ts)。
// 流れは run() の async の中で1人ずつ進める。待つのはシーンの時計(this.time)なので、ヒットストップと一時停止で止まる。
// 早送り(▶▶)は、時計、動き(tween)、アニメ、毎フレームの動きをまとめて2倍にする(update の applySpeed)。
// 待てと行けの合図が出ている間だけは、ふつうの速さに戻す(考える時間を減らさないため)。
//
// ステージごとの違いは def.mechanic と def.rush で分ける(ステージの名前では比べない)。
// - mechanic 'gang'(ステージ2):見逃したギャングが口笛で仲間を呼び、集まった組を行けでまとめて倒す。車で逃げる
// - mechanic 'ufo'(ステージ3):見逃した宇宙人が空へ合図 → UFOが下りて通りがかりの買い物客を吸い上げる。
//   行けでUFOを殴り落とす(真下の物が壊れる)。押さなければ連れ去られる。時間は UfoQueue(logic/ufo.ts)が数える
// - rush(ステージ3の波2):結果発表のあと、答え合わせの前にタイムセールラッシュ。右から8人が走ってきて、
//   ヒーローは全員に光のパンチ。市民にだけ待てを押す。時間は update から呼ぶ stepRush が数える(一時停止とヒットストップで止まる)
// - mechanic 'psychic'(ステージ4):見逃したヴィランが念力で物を持ち上げ、右から来た市民の上へ運ぶ。
//   行けでヴィランを殴ると物はその場の真下に落ちる(ソファなら壊れない)。押さなければ市民に落ちる。時間は PsyQueue(logic/psychic.ts)
// 4つの仕組みは部品に分けてある:street/gang.ts(GangPart)、street/ufo.ts(UfoPart)、street/rush.ts(RushPart)、street/psychic.ts(PsyPart)。
// 部品はこのシーンを受け取り、シーンの道具(fx、heroSay、knock など)を使う。部品から使う道具は private にしていない。
//
// フリープレイ(run.mode === 'free'。docs/FREEPLAY.md)は、流れを street/free.ts の FreeStreet が受け持つ(this.free)。
// 背景と置く物は波ごとの背景のステージ、仕組みは人の見た目で決める。技、吹っ飛び、ギャングの組(GangPart)、UFO(UfoPart)は
// ステージと同じものを使い、画面の違い(札を出さない、早送りなし、ステージの流れのオペレーターの一言を出さない、
// ワゴンが右から走ってくる)だけを this.free で分ける

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey } from '../art/sheets';
import { accessorySheet } from '../art/recolor';
import {
  FLOOR_LOOKS, MARK, MISCHIEF_BY_LOOK, PSY, bgForWave, propsForWave, MISCHIEF_HURTS_CIV, canStop, streetTextsFor, formatYen, isAttacked, isBigProp, judgeLine,
  mischiefLine, pickAttack, resolveEncounter, rollCivHit, rollPropsBroken, say, sceneForCivHit, sceneForProp, shout, tsukkomi,
  type AnyReactionKey, type AttackKind, type Encounter, type ReactionKey, type Rng, type Speech, type StageDef,
  type StatsTracker, type WorstScene
} from '../logic';
import { currentWave, fillUnsorted, getRun, nextAfterStreet, type GameRun } from '../run';
import {
  Bubble, Button, CutIn, EdgeAlarm, FS, IconButton, PauseControl, PixelText, Tag,
  CurlSmoke, banner, flash, gotoWhenFree, hitStop, impact, isFrozen, lighter, popText, shake, spawnFx, waitMs
} from '../ui';
import { addMute, drawStageBg, scrollStageBg, unlockOnTap, type StageBgLayers } from './sort/common';
import { Actor, HEAD } from './street/actor';
import { FastButton } from './street/fastButton';
import { FreeStreet } from './street/free';
import { Layers } from './street/layers';
import { shootAction } from './shot';
import { buildStreetPanel, buttonPulse } from './street/panel';
import { HERO_START, planGarage, planMall, planStreet, planTower } from './street/plan';
import { type CivHit, type HitMode, type PropObj, type Walker, ATTACK_GAP, JUDGE_RISE, RUN, smokeColors } from './street/common';
import { GangPart } from './street/gang';
import { UfoPart } from './street/ufo';
import { RushPart } from './street/rush';
import { PsyPart } from './street/psychic';

/** ヒーローの画面の中での位置(左寄り) */
const HERO_SCREEN_X = 60;
/** 技を出す前のため(この間も待てが効く)。マークが出てから殴るまで合わせて約1.5秒になるように */
const WINDUP_MS = 1080;
/** ボス出現!の帯の高さ。ヒーローの吹き出し(頭の上)と重ならないように、画面の上のほうに出す */
const BANNER_TOP_Y = 46;
/** 飛び出す金額を、ほかの金額や吹き出しと重ならないようにずらすときの段の数 */
const POP_TRIES = 6;
/** 早送りの倍率 */
const FAST = 2;
/** 本性ちらり(ワルにした人に向かったときに一瞬見せる正体)の長さ */
const PEEK_MS = 700;
/** ステージ3:本性ちらりで光る宇宙人の目の色(黄緑。明るい緑 R0 G255 B0 は使わない) */
const EYE_GLOW = 0x92ff00;
/** ステージ3:人の絵の目の位置(右を向いているとき、足からのずれ)。4つの見た目と親玉の化けた姿で同じ */
const EYE_AT = { dx: 6, dy: -48 };

/** 早送りのオンとオフ。ページを開いている間は、波や回をまたいで覚えておく */
let fastOn = false;
/** 待てと行けの使い方をもう言ったか(回ごと。その回で初めて合図が出たときだけ言う) */
const taught = new WeakMap<GameRun, Set<'stop' | 'go' | 'ufo' | 'psy'>>();

export class StreetScene extends Phaser.Scene {
  run!: GameRun;
  def!: StageDef;
  stats!: StatsTracker;
  rng!: Rng;
  L!: Layers;
  hero!: Actor;
  aura!: Phaser.GameObjects.Sprite;
  private trail!: Phaser.GameObjects.Sprite;
  auraOn = false;
  queue: Actor[] = [];
  passers: Actor[] = [];
  /** 助けられて立ち去るだけの人(ステージ3の買い物客)。絵は合わせるが、巻きぞえや悪さの相手にはしない */
  safeWalkers: Actor[] = [];
  props: PropObj[] = [];
  private bg!: StageBgLayers;
  private camX = 0;
  /** カメラをここに向ける(ボスが出たとき)。null ならヒーローについて行く */
  camFocus: number | null = null;
  /** 開発用:?attack=special などで技を決める */
  private forceAttack: AttackKind | null = null;
  private startedAt = 0;
  walker: Walker | null = null;
  slow = 1;
  stopHandler: (() => void) | null = null;
  private goFn: (() => void) | null = null;
  /** 行けの合図が出た時刻(フリープレイで、行けのマークが2つあるときに先に出たほうへ効かせる) */
  goSince = 0;
  /** この時間(ミリ秒)だけ、ヒーローは歩くのを止める(フリープレイの空押しの待て)。一時停止の間は減らない */
  holdMs = 0;
  /** フリープレイのときだけ(run.mode === 'free')。ステージのときは null */
  free: FreeStreet | null = null;
  /** 行けの合図が出ている間の、行けを押したときの動き */
  get goHandler(): (() => void) | null { return this.goFn; }
  set goHandler(fn: (() => void) | null) {
    if (fn && !this.goFn) this.goSince = this.time.now;
    this.goFn = fn;
  }
  flickers = new Set<Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject>();
  heroBubble?: Bubble;
  /** ヒーローの吹き出しを、頭の上からさらに何ドット上げるか */
  private heroBubbleRise = 0;
  /** 人について行く小さな吹き出し(本性ちらり)。dx, dy は足からのずれ */
  private peeks: { b: Bubble; a: Actor; dx: number; dy: number }[] = [];
  /** いまの速さ(早送りで2、待てと行けの合図の間は1) */
  private speed = 1;
  /** 出ている飛び出す数字(重ならないようにずらすため) */
  private pops: { t: PixelText; wx: number; y: number; w: number; h: number; rise: number }[] = [];
  /** オペレーターが話した回数(あとから言い替えるとき、間にほかのセリフがあったかを見る) */
  opSeq = 0;
  frameN = 0;
  civHits: CivHit[] = [];
  /** この攻撃で、市民に当たったときにオペレーターが言った一言の種類 */
  civCried: ReactionKey | null = null;
  leaving = false;
  // 下の操作部分
  cut!: CutIn;
  stopBtn!: Button;
  goBtn!: Button;
  icons: Phaser.GameObjects.GameObject[] = [];
  fastBtn!: FastButton;
  private tDefeat!: PixelText;
  private tHurt!: PixelText;
  private tDamage!: PixelText;
  private shownDamage = 0;
  private shown = { defeated: -1, hurt: -1, damage: '' };
  stopAlarm!: EdgeAlarm;
  goAlarm!: EdgeAlarm;

  /** ステージ2:ギャングの組(street/gang.ts) */
  gangPart!: GangPart;
  /** ステージ3:UFO(street/ufo.ts) */
  ufoPart!: UfoPart;
  /** ステージ3:タイムセールラッシュ(street/rush.ts) */
  rushPart!: RushPart;
  /** ステージ4:念力(street/psychic.ts) */
  psyPart!: PsyPart;

  constructor() { super(SCENES.street); }

  create(): void {
    this.run = getRun(this);
    this.def = this.run.stage.def;
    this.stats = this.run.stats;
    this.rng = this.run.rng;
    this.holdMs = 0;
    // フリープレイ:背景と置く物は波ごとの背景のステージ。仕分けはヒーローの決めつけ(FreeStreet が入れる)
    this.free = this.run.mode === 'free' && this.run.free ? new FreeStreet(this) : null;
    if (this.free) this.def = this.free.bgDef;
    else fillUnsorted(this.run);
    this.queue = []; this.passers = []; this.safeWalkers = []; this.props = []; this.icons = [];
    this.flickers = new Set();
    this.walker = null; this.slow = 1; this.stopHandler = null; this.goHandler = null;
    this.heroBubble = undefined; this.peeks = []; this.speed = 1; this.pops = []; this.opSeq = 0; this.frameN = 0; this.civHits = []; this.civCried = null; this.leaving = false;
    this.shownDamage = this.stats.damage; this.shown = { defeated: -1, hurt: -1, damage: '' };
    this.auraOn = false;
    this.camFocus = null;
    // ステージごとの仕組み(ギャング、UFO、タイムセールラッシュ)。回ごとに作り直す(this.free を決めたあとに作る)
    this.gangPart = new GangPart(this);
    this.ufoPart = new UfoPart(this);
    this.rushPart = new RushPart(this);
    this.psyPart = new PsyPart(this);
    const fa = new URLSearchParams(location.search).get('attack');
    this.forceAttack = this.run.debug && (fa === 'charge' || fa === 'punch' || fa === 'stomp' || fa === 'special') ? fa : null;

    this.startedAt = this.time.now;
    // アニメの速さはゲーム全体の設定なので、次のシーンへ持ちこまないように戻す
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.anims.globalTimeScale = 1; });
    this.L = new Layers(this);
    this.buildWorld();
    this.buildPanel();

    audio.playBgm(this.free ? this.free.bgm : this.def.bgm.street);
    unlockOnTap(this);
    // 開発中だけ、自動テストから中身をさわれるようにする
    if (import.meta.env.DEV) (window as unknown as { streetDev?: unknown }).streetDev = this;
    void this.play();
  }

  // ─── 作る ─────────────────────────────────────

  private buildWorld(): void {
    const { actionH } = layout;
    this.bg = drawStageBg(this, bgForWave(this.def, currentWave(this.run).no), 0, { depth: { far: -30, wall: -20, ground: -10 } });
    for (const s of Object.values(this.bg)) s.setScrollFactor(0);

    const wave = currentWave(this.run);
    const encOf = (id: string, truth: 'bad' | 'civ' | 'boss'): Encounter => resolveEncounter(truth, this.run.sorts[id] ?? 'civ');
    const passBad = new Set(wave.people.filter((p) => encOf(p.id, p.truth) === 'passBad').map((p) => p.id));
    // 置く物はステージの仕組みごと(ステージ3はモールの物。ラッシュのある波はヒーローが立つ所にエスカレーター)
    const plan = this.free
      ? this.free.plan(wave.people)
      : this.def.mechanic === 'gang'
        ? planGarage(wave.people, passBad, propsForWave(this.def, wave.no), this.rng)
        : this.def.mechanic === 'ufo'
          ? planMall(wave.people, passBad, propsForWave(this.def, wave.no), this.rng, this.rushPart.rushThisWave())
          : this.def.mechanic === 'psychic'
            ? planTower(wave.people, passBad, propsForWave(this.def, wave.no), FLOOR_LOOKS[wave.no - 1] ?? [], wave.no - 1, this.rng)
            : planStreet(wave.people, passBad, this.rng);
    this.rushPart.rushX = plan.rushX ?? null;

    for (const p of plan.props) {
      const key = `prop_${p.kind}`;
      const sprite = this.add.sprite(p.x, p.y, key, p.frame ?? 0);
      const origin = p.wall ? [0.5, 0.5] : [0.5, 1];
      sprite.setOrigin(origin[0], origin[1]).setDepth(p.wall ? -15 : p.y);
      this.props.push({ ...p, sprite, broken: false });
    }
    // ラッシュのある波:立つ所の後ろのエスカレーターは、ラッシュの前に巻きぞえで壊れないようにする
    const rushX = this.rushPart.rushX;
    if (rushX !== null) {
      this.rushPart.rushGuard = this.props.find((p) => p.kind === 'escalator' && Math.abs(p.x - rushX) < 24) ?? null;
    }
    // ステージ4:念力の場面(その場面の物は、場面が終わるまでふつうの攻撃で壊れない)
    for (const spot of plan.psy ?? []) this.psyPart.addSpot(spot);
    for (const g of plan.gathers) {
      this.gangPart.gathers.set(g.whistlerId, g);
      const van = this.props.find((p) => p.kind === 'van' && p.x === g.vanX && p.y === g.vanY);
      if (van) this.gangPart.vans.set(g.groupId, van);
    }
    for (const s of plan.passers) {
      const a = new Actor(this, accessorySheet(this, s.key, s.color), s.x, s.y);
      a.look = s.look; a.civ = true;
      a.faceLeft(true).play('idle');
      this.passers.push(a);
    }
    for (const s of plan.people) {
      const a = new Actor(this, accessorySheet(this, s.person.sheetKey, s.person.accessory?.color), s.x, s.y);
      a.person = s.person; a.look = s.person.look; a.civ = s.person.truth === 'civ';
      a.faceLeft(true).play('idle');
      a.sprite.anims.setProgress(this.rng.float(0, 1));
      // フリープレイは仕分けの札を出さない。波3の人には小物を重ねる
      if (this.free) {
        if (s.person.item) this.free.items.attach(a, s.person.item);
      } else {
        const choice = this.run.sorts[s.person.id] ?? 'civ';
        a.tag = new Tag(this, s.x, s.y - HEAD, choice).follow(a.sprite, -HEAD);
      }
      this.queue.push(a);
      // 化けた女ボスの金の小物は、ときどきキラッと光らせる(1色だとオレンジに見えるため)
      if (s.person.truth === 'boss' && s.person.accessory) this.gangPart.goldGlint(a);
    }

    this.hero = new Actor(this, 'hero', HERO_START.x, HERO_START.y);
    this.hero.depthBias = 0.5;
    this.hero.play('idle');
    this.aura = this.add.sprite(0, 0, 'fx_aura').play(animKey('fx_aura', 'play')).setVisible(false);
    this.trail = this.add.sprite(0, 0, 'fx_trail').play(animKey('fx_trail', 'play')).setVisible(false);
    this.camX = this.hero.x - HERO_SCREEN_X;
    this.L.world.scrollX = Math.round(this.camX);

    this.stopAlarm = new EdgeAlarm(this, 0, actionH, UI.stop);
    this.goAlarm = new EdgeAlarm(this, 0, actionH, UI.go);
    // フリープレイは、波の数の代わりにルールの札とクリアまでの時間(札は撮る写真には入れない)
    if (this.free) {
      this.free.build();
      this.icons.push(...(this.free.sign.shotHidden as unknown as Phaser.GameObjects.GameObject[]));
    } else {
      new PixelText(this, 6, 5, `WAVE${this.run.waveIndex + 1}`, { size: FS.body, color: UI.gold, outline: true })
        .setScrollFactor(0).setDepth(1400);
    }
  }

  private buildPanel(): void {
    const { W } = layout;
    this.L.inUi(() => {
      const pause = new PauseControl(this);
      this.icons.push(new IconButton(this, W - 12, 12, 'pause', () => pause.pause()));
      this.icons.push(addMute(this, W - 34, 12));
      // フリープレイは早送りを使えない(ボタンも出さない)
      if (!this.free) {
        this.fastBtn = new FastButton(this, W - 56, 12, {
          isOn: () => fastOn, toggle: () => { audio.unlock(); fastOn = !fastOn; }, locked: () => this.rushPart.rushOn
        });
        this.icons.push(this.fastBtn);
      }

      const p = buildStreetPanel(this, this.stats,
        () => { audio.unlock(); if (this.free) this.free.pressStop(); else this.stopHandler?.(); },
        () => { audio.unlock(); if (this.free) this.free.pressGo(); else this.goHandler?.(); });
      ({ tDefeat: this.tDefeat, tHurt: this.tHurt, tDamage: this.tDamage, cut: this.cut, stopBtn: this.stopBtn, goBtn: this.goBtn } = p);
    });
    this.updateHud(true);
  }

  // ─── 毎フレーム ───────────────────────────────

  override update(_t: number, delta: number): void {
    this.frameN++;
    const frozen = isFrozen(this);
    if (!frozen) {
      this.applySpeed();
      const ms = Math.min(delta, 50) * this.speed;
      const dt = ms / 1000;
      this.free?.update(delta);
      this.stepWalker(dt);
      // フリープレイの言い直しの間は、悪さの時計(ギャング、UFO)も止める
      const held = this.free?.held ?? false;
      if (this.gangPart.gang && !held) this.gangPart.stepGang(ms);
      if (this.ufoPart.ufo && !held) this.ufoPart.stepUfo(ms);
      if (this.psyPart.psy) this.psyPart.stepPsy(ms);
      if (this.rushPart.rushRunning) this.rushPart.stepRush(ms);
      // カメラはヒーローについて行く(少し遅れて)
      const target = this.camFocus !== null ? this.camFocus - layout.W / 2 : this.hero.x - HERO_SCREEN_X;
      this.camX += (target - this.camX) * Math.min(1, dt * 6);
      this.L.world.scrollX = Math.round(this.camX);
      scrollStageBg(this.bg, this.L.world.scrollX);
      // 光は半透明にせず、1コマおきに点滅させる
      const on = this.frameN % 2 === 0;
      for (const s of this.flickers) {
        if (!s.active) { this.flickers.delete(s); continue; }
        s.setVisible(on);
      }
    }
    this.syncHero();
    for (const a of this.queue) if (a.state !== 'gone') a.sync();
    for (const a of this.passers) if (a.state !== 'gone') a.sync();
    for (const a of this.safeWalkers) if (a.state !== 'gone') a.sync();
    for (const m of this.rushPart.rushMen) if (m.a && m.a.state !== 'gone') m.a.sync();
    this.rushPart.syncNoise();
    this.hero.sync();
    this.free?.syncAfter();
    this.syncBubble();
    this.syncPeeks();
    this.updateHud();
    this.updateButtons();
  }

  /**
   * 早送りの速さを、時計、動き、アニメにかける。待てと行けの合図が出ている間はふつうの速さ。
   * ヒットストップ(fx.ts)は止めたあと速さを1に戻すので、止まっていないときに毎フレーム合わせ直す
   */
  private applySpeed(): void {
    const deciding = this.stopHandler !== null || this.goHandler !== null;
    // タイムセールラッシュの間は早送りを切る(終わったら、覚えている fastOn に戻る)
    const sp = fastOn && !deciding && !this.rushPart.rushOn && !this.free ? FAST : 1;
    this.speed = sp;
    if (this.time.timeScale !== sp) this.time.timeScale = sp;
    if (this.tweens.timeScale !== sp) this.tweens.timeScale = sp;
    if (this.anims.globalTimeScale !== sp) this.anims.globalTimeScale = sp;
  }

  private stepWalker(dt: number): void {
    const w = this.walker;
    if (!w) return;
    if (this.holdMs > 0) { this.holdMs -= dt * 1000; return; }
    const h = this.hero;
    h.x = Math.min(w.toX, h.x + w.speed * this.slow * dt);
    const span = w.toX - w.fromX;
    const p = span <= 0 ? 1 : Phaser.Math.Clamp((h.x - w.fromX) / span, 0, 1);
    h.y = w.fromY + (w.toY - w.fromY) * p;
    if (h.x >= w.toX) {
      this.walker = null;
      w.resolve();
    }
  }

  private syncHero(): void {
    const h = this.hero;
    const anim = h.anim;
    const on = this.frameN % 2 === 0;
    const hx = Math.round(h.x);
    const hy = Math.round(h.y - h.lift);
    // 待機と、ためのときは光がゆらめく。走るときは光の尾
    const aura = this.auraOn || (anim === 'idle' && h.sprite.anims.isPlaying);
    // フリープレイで殴りかかる相手や素通りの相手に向かっているときは、その形の光を出す(free.ts)
    const typed = this.free?.syncAura(hx, hy, h.y + 0.4, on) ?? false;
    this.aura.setPosition(hx, hy - 26).setDepth(h.y + 0.4).setVisible(aura && on && !typed);
    const trail = this.auraOn || anim === 'run' || anim === 'charge';
    this.trail.setPosition(hx - 30, hy - 26).setDepth(h.y + 0.3).setVisible(trail && !on);
  }

  private syncBubble(): void {
    const b = this.heroBubble;
    if (!b) return;
    if (!b.active) { this.heroBubble = undefined; return; }
    const x = Math.round(this.L.screenX(this.hero.x) + 6);
    const y = Math.round(this.hero.y - this.hero.lift - HEAD - 2 - this.heroBubbleRise);
    if (b.x !== x || b.y !== y) b.pointTo(x, y);
  }

  private syncPeeks(): void {
    if (this.peeks.length === 0) return;
    this.peeks = this.peeks.filter((p) => p.b.active);
    for (const p of this.peeks) {
      const x = Math.round(this.L.screenX(p.a.x) + p.dx);
      const y = Math.round(p.a.y + p.dy);
      if (p.b.x !== x || p.b.y !== y) p.b.pointTo(x, y);
    }
  }

  private updateHud(force = false): void {
    const s = this.stats;
    const d = s.damage;
    if (this.shownDamage < d) this.shownDamage = Math.min(d, this.shownDamage + Math.max(10_000, Math.ceil((d - this.shownDamage) * 0.12)));
    const txt = formatYen(this.shownDamage);
    if (force || txt !== this.shown.damage) { this.shown.damage = txt; this.tDamage.setText(txt); }
    if (force || s.defeated !== this.shown.defeated) { this.shown.defeated = s.defeated; this.tDefeat.setText(String(s.defeated)); }
    if (force || s.civHurt !== this.shown.hurt) { this.shown.hurt = s.civHurt; this.tHurt.setText(String(s.civHurt)); }
  }

  private updateButtons(): void {
    if (this.free) { this.free.updateButtons(); return; }
    const st = this.stopHandler !== null;
    const go = this.goHandler !== null;
    if (this.stopBtn.isEnabled !== st) this.stopBtn.setEnabled(st).setColor(UI.stop);
    if (this.goBtn.isEnabled !== go) this.goBtn.setEnabled(go).setColor(UI.go);
    // タイムセールラッシュでは行けを使わないので、ボタンを暗くしておく
    const goAlpha = this.rushPart.rushOn ? 0.4 : 1;
    if (this.goBtn.alpha !== goAlpha) this.goBtn.setAlpha(goAlpha);
    // 押せるときは、ボタンをゆっくり明るくしたり戻したりする
    if (this.frameN % 3 === 0 && (st || go)) {
      const t = buttonPulse(this.time.now);
      if (st) this.stopBtn.setColor(lighter(UI.stop, t * 0.3));
      if (go) this.goBtn.setColor(lighter(UI.go, t * 0.25));
    }
  }

  // ─── 小さな道具 ───────────────────────────────

  pickAttack(): AttackKind {
    const k = pickAttack(this.rng);
    return this.forceAttack ?? k;
  }

  /**
   * 飛び出す数字(画面の端で切れないように寄せる)。続けて出たときはほかの数字と重ならないように上下にずらし、
   * ヒーローの吹き出しにも重ならない位置を選ぶ。それでも重なるときは吹き出しの奥に出す(セリフを隠さない)
   */
  pop(x: number, y: number, text: string, big = false): void {
    const px = Phaser.Math.Clamp(x, this.L.left + 34, this.L.right - 34);
    const size = big ? FS.big : FS.body;
    const rise = big ? 20 : 14;
    // 字の幅はおおよそ(半角は半分)で見積もる
    const w = Array.from(text).reduce((s, ch) => s + (ch.charCodeAt(0) < 0x100 ? size / 2 : size), 0) + 4;
    const h = size + 2;
    const sx = px - this.L.left;
    const rectAt = (py: number): Phaser.Geom.Rectangle => new Phaser.Geom.Rectangle(sx - w / 2, py - h - rise, w, h + rise);
    this.pops = this.pops.filter((p) => p.t.active);
    const others = this.pops.map((p) => new Phaser.Geom.Rectangle(p.wx - this.L.left - p.w / 2, p.y - p.h - p.rise, p.w, p.h + p.rise));
    const bubble = this.heroBubble?.active ? this.heroBubble.boxRect() : null;
    const free = (py: number): boolean => {
      const r = rectAt(py);
      if (bubble && Phaser.Geom.Intersects.RectangleToRectangle(r, bubble)) return false;
      return !others.some((o) => Phaser.Geom.Intersects.RectangleToRectangle(r, o));
    };
    const y0 = Math.max(44, y);
    const step = h + 1;
    const tries: number[] = [y0];
    for (let i = 1; i <= POP_TRIES; i++) tries.push(y0 - step * i, y0 + step * i);
    const top = 30 + h + rise;
    const bottom = layout.actionH - 2;
    const py = tries.find((t) => t >= top && t <= bottom && free(t)) ?? y0;
    const t = popText(this, px, py, text, { color: UI.danger, size, ms: big ? 1500 : 900, rise });
    // 吹き出し(1100)より奥、人や火花より手前
    t.setDepth(1050);
    this.pops.push({ t, wx: px, y: py, w, h, rise });
  }

  /** ヒーローを右へ走らせる(戻ることはしない)。anim を null にすると動きを変えない */
  runTo(x: number, opt: { speed?: number; y?: number; anim?: string | null } = {}): Promise<void> {
    const h = this.hero;
    if (opt.anim !== null) h.play(opt.anim ?? 'run');
    return new Promise((resolve) => {
      if (x <= h.x) {
        if (opt.y !== undefined) h.y = opt.y;
        resolve();
        return;
      }
      // 前の歩きを上書きするときは、前の歩きを待っている流れが止まったままにならないように、終わったことにする
      const prev = this.walker;
      this.walker = { toX: x, fromX: h.x, fromY: h.y, toY: opt.y ?? h.y, speed: opt.speed ?? RUN, resolve };
      prev?.resolve();
    });
  }

  /** 行けの合図の、画面の端の点滅を止める(フリープレイでは、ほかの行けのマークが残っていれば止めない) */
  stopGoAlarm(): void {
    if (this.free?.goTarget()) return;
    this.goAlarm.stop();
  }

  /** 1回だけ流れて消えるエフェクト */
  fx(key: string, x: number, y: number, opt: { depth?: number; scale?: number; flip?: boolean; loop?: boolean; flicker?: boolean } = {}): Phaser.GameObjects.Sprite {
    const s = spawnFx(this, key, x, y, { depth: opt.depth ?? 700, scale: opt.scale, flipX: opt.flip, loop: opt.loop });
    if (opt.flicker) this.flickers.add(s);
    return s;
  }

  /** x から toX へ、高さ h の山なりに動かす */
  arc(a: { x: number; lift: number }, toX: number, h: number, ms: number, ease = 'Linear'): Promise<void> {
    const x0 = a.x;
    const o = { t: 0 };
    return new Promise((resolve) => {
      this.tweens.add({
        targets: o, t: 1, duration: ms, ease,
        onUpdate: () => { a.x = x0 + (toX - x0) * o.t; a.lift = Math.sin(Math.PI * o.t) * h; },
        onComplete: () => { a.x = toX; a.lift = 0; resolve(); }
      });
    });
  }

  /** このステージのセリフ(地下駐車場は言い方が変わるものがある) */
  line(key: AnyReactionKey, rng?: Rng): Speech {
    return say(key, rng, this.def.id);
  }

  /** rise は吹き出しを上げるドット数(合図の相手の札を隠さないとき) */
  heroSay(sp: Speech | string, ms = 1200, rise = 0): void {
    const text = typeof sp === 'string' ? sp : sp.text;
    this.heroBubble?.destroy();
    this.heroBubbleRise = rise;
    const x = this.L.screenX(this.hero.x) + 6;
    const y = this.hero.y - this.hero.lift - HEAD - 2 - rise;
    // 画面の座標で置く(Bubble は画面の端からはみ出ないようにずれるため)。札より手前、合図より奥(合図を隠さないように)
    this.heroBubble = new Bubble(this, x, y, text, { tail: 'down-left', life: ms });
    this.heroBubble.setScrollFactor(0).setDepth(1100);
  }

  /** force はフリープレイで言うとき。フリープレイでは、ステージの流れ(ギャング、UFO など)のオペレーターの一言は出さない */
  opSay(sp: Speech, alarm = false, force = false): void {
    if (this.free && !force) return;
    this.opSeq++;
    void this.cut.say(sp.text, sp.face, { who: sp.who, alarm });
  }

  /**
   * いちばんひどい場面なら、アクション部分を撮っておく。attack はその場面を起こした技(説明の文を変えるため)。
   * shiftY を渡すと、写真を下へずらして撮る(上の端は空の色でうめる)。共有カードは写真の下の方の帯しか使わないので、
   * 高いところで起きた場面(UFOにさらわれる)を帯に入れるため
   */
  report(scene: WorstScene | null, attack: AttackKind | null = null, shiftY = 0): void {
    if (!scene || !this.stats.reportScene(scene, attack)) return;
    // 当たった相手が吹っ飛び始めたところを撮る(ヒットストップのあと少しして)
    this.time.delayedCall(90, () => this.shoot(shiftY, (img) => { this.run.worstShot = img; }));
  }

  /**
   * 通りの画面を撮る(shiftY ドット下へずらす)。画面全体の光(flash)が出ているコマは真っ白に写るので、光が消えるまで待つ。
   * 中断などのボタン、頭の上の札、画面の端の点滅は写さない(札は共有カードの説明の字と重なるため)。
   * show に渡したもの(1コマおきに点滅する光など)は、撮るコマでは必ず出す
   */
  shoot(shiftY: number, cb: (img: HTMLImageElement) => void, show: Phaser.GameObjects.Components.Visible[] = []): void {
    // 隠す札は撮る瞬間に決める(光が消えるのを待つ間に、札が出たり消えたりするため)
    const hide = (): Phaser.GameObjects.Components.Visible[] => [
      ...(this.icons as unknown as Phaser.GameObjects.Components.Visible[]),
      ...this.children.list.filter((o): o is Tag => o instanceof Tag && o.visible)
    ];
    shootAction(this, cb, { hide, alarms: [this.stopAlarm, this.goAlarm], show, shiftY });
  }

  /** 画面に見えている、まだ壊れていない物(攻撃で壊れうる物) */
  visibleProps(): PropObj[] {
    const l = this.L.left - 8;
    const r = this.L.right + 8;
    // ギャングのワゴンはふつうの攻撃では壊れない(組が乗って逃げる車)。ラッシュの前のエスカレーターも壊れない
    // ステージ4の念力の場面の物も、場面が終わるまで壊れない
    return this.props.filter((p) => !p.broken && p.kind !== 'van' && p !== this.rushPart.rushGuard && !this.psyPart.guarded.has(p) && p.x >= l && p.x <= r);
  }

  /**
   * 巻きぞえになりうる市民(画面の中で立っている人)。
   * フリープレイでは通りがかりの市民だけ(並んだ人は巻きぞえで倒れない。待てのチャンスの数がいつも同じになるように)
   */
  private civsNear(except: Actor): Actor[] {
    const l = this.L.left - 8;
    const r = this.L.right + 8;
    return [...(this.free ? [] : this.queue), ...this.passers].filter((a) => a !== except && a.civ && a.standing && a.x >= l && a.x <= r);
  }

  // ─── 流れ ─────────────────────────────────────

  private async play(): Promise<void> {
    if (this.free) { await this.free.play(); return; }
    // 見ているだけの画面だと思われないように、帯は「待てと行けの出番」と言い切る(波の数は左上に小さく出ている)
    // 早送りでも帯は読めるように、出ている時間はふつうの速さのときと同じにする
    void banner(this, streetTextsFor(this.def.id).band, { hold: fastOn ? 600 * FAST : 600 });
    this.opSay(this.line('sortDone', this.rng));
    await waitMs(this, 700);
    for (const a of this.queue) {
      if (!a.standing || !a.person) continue;
      const enc = resolveEncounter(a.person.truth, this.run.sorts[a.person.id] ?? 'civ');
      if (isAttacked(enc)) {
        const toBoss = await this.attackEncounter(a, enc);
        if (toBoss) return;
      } else {
        const toBoss = await this.passEncounter(a, enc);
        if (toBoss) return;
      }
    }
    await this.waveClear();
  }

  laneFor(a: Actor): number {
    return Math.round(a.y);
  }

  /**
   * 殴りに行く相手:48ドット手前で合図、ゆっくりになって、待てが効く。押さなければ技を出す。
   * 合図と同時に、相手は本性を一瞬だけ見せ(本性ちらり)、ヒーローは見た目から「ワルで間違いない!」と決めつける
   */
  private async attackEncounter(a: Actor, enc: Encounter): Promise<boolean> {
    await this.runTo(a.x - MARK.showDistance, { y: this.laneFor(a) });
    this.markStart(a, MARK.slowmo);
    const k = this.pickAttack();
    this.peek(a);
    // 決めつけは技を出すまで出しておく(叫びは技を出す瞬間に替える)。
    // 横に長いので相手の頭の上にかかる。札(ワル)を隠さないように、合図との間まで上げる
    this.heroSay(judgeLine(a.person?.disguise ?? a.look, this.rng), 1600, JUDGE_RISE);
    // その回で初めての合図なら、待ての使い方を言う
    if (this.firstTime('stop')) this.opSay(this.line('teachStop'));
    const res = await this.markWindow(a, enc, k);
    this.markEnd(a);
    if (res === 'stop') { await this.doStop(a); return false; }
    this.heroSay(shout(k, this.rng), 900);
    if (enc === 'bossFight') {
      await this.attack(a, k, 'reveal');
      await this.bossReveal(a);
      return true;
    }
    await this.attack(a, k, enc === 'hitCiv' ? 'civ' : 'bad');
    await this.afterAttack(k, true);
    return false;
  }

  /** 待てのマークを出して、ヒーローをゆっくりにする(slowmo はゆっくりの倍率。フリープレイも使う) */
  markStart(a: Actor, slowmo: number): void {
    a.showMark('stop');
    this.stopAlarm.start();
    this.slow = slowmo;
    this.hero.sprite.anims.timeScale = slowmo;
  }

  /** 待てのマークを消して、ヒーローをふつうの速さに戻す(ための光も消す) */
  markEnd(a: Actor): void {
    this.stopAlarm.stop();
    this.slow = 1;
    this.hero.sprite.anims.timeScale = 1;
    a.hideMark();
    this.auraOn = false;
  }

  /** 本性ちらり:ワルにした人に向かったとき、本当はワル(ボスも)なら何かをさっと隠し(宇宙人は目が光る)、市民なら小さくおじぎする */
  private peek(a: Actor): void {
    const bad = !a.civ;
    const dx = 9;
    const dy = -40;
    const texts = streetTextsFor(this.def.id);
    const b = new Bubble(this, this.L.screenX(a.x) + dx, a.y + dy, bad ? texts.peekBad : texts.peekCiv,
      { tail: 'left', size: FS.small, life: PEEK_MS });
    b.setScrollFactor(0).setDepth(1100);
    this.peeks.push({ b, a, dx, dy });
    if (bad && this.def.mechanic === 'ufo') {
      // 宇宙人:目が一瞬光って「ピピッ…」
      this.eyeGlow(a);
      audio.sfx('beep');
    } else if (bad && this.def.mechanic === 'psychic') {
      // 超能力のヴィラン:指先に紫の火花がともって「フッ…」(ヒーローの方を向いているので、火花は左の手の先)
      this.fingerSpark(a);
      audio.sfx('psy', { volume: 0.4 });
    } else if (bad) {
      // くるっと背を向けて、すぐ戻る(何かを隠す)
      a.faceLeft(false);
      a.x += 1;
      this.time.delayedCall(170, () => { if (a.standing) { a.faceLeft(true); a.x -= 1; } });
    } else {
      // 1〜2ドットだけ頭を下げる
      const steps: [number, number][] = [[0, -1], [70, -2], [430, -1], [510, 0]];
      for (const [t, l] of steps) this.time.delayedCall(t, () => { if (a.standing && a.lift <= 0) a.lift = l; });
    }
  }

  /** 宇宙人の目が一瞬光る(黄緑。2回またたいて消える)。光は半透明にせず、ふちの点で広がって見せる */
  private eyeGlow(a: Actor): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 1);
    g.fillStyle(EYE_GLOW, 1).fillRect(-1, -1, 4, 1).fillRect(-1, 1, 4, 1).fillRect(-2, 0, 1, 1).fillRect(2, 0, 2, 1);
    g.fillStyle(EYE_GLOW, 1).fillRect(-4, 0, 1, 1).fillRect(5, 0, 1, 1);
    const place = (): void => {
      const dx = a.sprite.flipX ? -EYE_AT.dx - 1 : EYE_AT.dx;
      g.setPosition(Math.round(a.x + dx), Math.round(a.y - a.lift + EYE_AT.dy)).setDepth(a.y + 0.6);
    };
    place();
    const steps: [number, boolean][] = [[0, true], [110, false], [170, true], [330, false]];
    for (const [t, on] of steps) this.time.delayedCall(t, () => { if (g.active) { place(); g.setVisible(on && a.standing); } });
    this.time.delayedCall(360, () => g.destroy());
  }

  /** 超能力のヴィランの指先に、紫の火花が一瞬ともる(本性ちらり) */
  private fingerSpark(a: Actor): void {
    const dx = a.sprite.flipX ? -13 : 13;
    // 小さい火花は人の絵にまぎれるので、2倍で出す
    const s = this.psyPart.spark(a.x + dx, a.y - 29, a.y + 0.6).setScale(2);
    this.time.delayedCall(PEEK_MS - 150, () => s.destroy());
  }

  /** 待てや行けの使い方を、その回でまだ言っていなければ true(言ったことにする)。'ufo' はUFOを行けで落とすこと、'psy' は念力の物を行けで落とすこと */
  firstTime(kind: 'stop' | 'go' | 'ufo' | 'psy'): boolean {
    let set = taught.get(this.run);
    if (!set) { set = new Set(); taught.set(this.run, set); }
    if (set.has(kind)) return false;
    set.add(kind);
    return true;
  }

  private markWindow(a: Actor, enc: Encounter, k: AttackKind): Promise<'stop' | 'attack'> {
    return new Promise((resolve) => {
      let done = false;
      let failShown = false;
      const finish = (r: 'stop' | 'attack'): void => {
        if (done) return;
        done = true;
        this.stopHandler = null;
        // 近づいている途中なら、その歩きを終わったことにする(下の then は done を見て何もしない)
        const w = this.walker;
        this.walker = null;
        w?.resolve();
        resolve(r);
      };
      this.stopHandler = () => {
        if (canStop(enc)) { finish('stop'); return; }
        // ボスには待ては効かない
        if (!failShown) { failShown = true; this.heroSay(this.line('stopFailBoss', this.rng), 900); }
      };
      void this.runTo(a.x - ATTACK_GAP, { anim: null }).then(() => {
        if (done) return;
        this.windup(k);
        this.time.delayedCall(WINDUP_MS, () => finish('attack'));
      });
    });
  }

  /** 技を出す前のため(まだ待てが効く)。この間はヒーローの決めつけの吹き出しが出ている */
  windup(k: AttackKind): void {
    const h = this.hero;
    h.sprite.anims.timeScale = 1;
    if (k === 'charge') h.pose('charge', 0);
    else if (k === 'stomp') h.pose('stomp', 0);
    else if (k === 'special') h.pose('special', 2);
    else h.pose('punch', 0);
    this.auraOn = true;
    if (k === 'special') { shake(this, 2, WINDUP_MS); audio.sfx('charge', { pitch: 0.7 }); }
  }

  /** 待てで止まる:急ブレーキで火花、足あとが焦げる、敬礼 */
  async doStop(a: Actor): Promise<void> {
    const h = this.hero;
    h.play('stop', true);
    audio.sfx('stop');
    this.stats.stopped(a.person!.truth);
    this.gangPart.stoppedIds.add(a.person!.id);
    const x0 = h.x;
    const slide = { x: h.x };
    this.tweens.add({
      targets: slide, x: x0 + 12, duration: 260, ease: 'Quad.easeOut',
      onUpdate: () => { h.x = slide.x; }
    });
    const burn = this.add.graphics().setDepth(2);
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 60, () => {
        this.fx('fx_brake', h.x + 6, h.y - 6, { depth: h.y + 1 });
        burn.fillStyle(0x1a1420, 1).fillRect(Math.round(h.x) - 6, Math.round(h.y) - 1, 5, 2).fillRect(Math.round(h.x) + 2, Math.round(h.y), 5, 2);
      });
    }
    a.pose('surprised');
    this.heroSay(this.line('stop', this.rng), 1000);
    // 止めた人が本当はワルだったら、オペレーターが小さく気づく(逃がしたに数える)
    this.opSay(this.line(a.person!.truth === 'bad' ? 'stopBad' : 'stopOp', this.rng));
    await waitMs(this, 900);
    if (a.standing) a.play('idle');
    // 市民だったら、ほっとしてぴょんと跳ぶ
    if (a.civ) { void this.arc(a, a.x, 6, 220); this.fx('fx_sparkle', a.x, a.y - HEAD - 4); }
    await waitMs(this, 150);
  }

  // ─── 技 ───────────────────────────────────────

  async attack(t: Actor, k: AttackKind, mode: HitMode): Promise<void> {
    const h = this.hero;
    const withSide = mode !== 'reveal';
    if (k === 'charge') {
      audio.sfx('charge');
      h.play('charge', true);
      this.auraOn = true;
      await waitMs(this, 70);
      const props = withSide ? rollPropsBroken('charge', this.visibleProps(), t.x, this.rng) : [];
      const pending = new Set(props);
      const toX = t.x - 12;
      const o = { x: h.x };
      await new Promise<void>((resolve) => this.tweens.add({
        targets: o, x: toX, duration: 170, ease: 'Quad.easeIn',
        onUpdate: () => {
          h.x = o.x;
          for (const p of pending) if (p.x <= h.x + 14) { pending.delete(p); this.breakProp(p); }
        },
        onComplete: () => resolve()
      }));
      for (const p of pending) this.breakProp(p);
      this.hitTarget(t, k, mode);
      await waitMs(this, 260);
      this.auraOn = false;
      await waitMs(this, 200);
    } else if (k === 'punch') {
      h.play('punch', true);
      audio.sfx('punch');
      await waitMs(this, 190);
      this.hitTarget(t, k, mode);
      if (withSide) await this.flyFist(t);
      await waitMs(this, 250);
    } else if (k === 'stomp') {
      h.play('stomp', true);
      audio.sfx('stomp', { pitch: 1.3 });
      await this.arc(h, t.x - 6, 64, 330, 'Sine.easeInOut');
      this.fx('fx_shockwave', t.x, t.y - 12, { depth: t.y + 2 });
      audio.sfx('stomp');
      this.hitTarget(t, k, mode);
      if (withSide) {
        for (const p of rollPropsBroken('stomp', this.visibleProps(), t.x, this.rng)) this.breakProp(p);
        for (const c of this.civsNear(t)) if (rollCivHit('stomp', c.x - t.x, this.rng)) this.collateral(c, k, c.x < t.x ? -1 : 1);
      }
      await waitMs(this, 420);
    } else {
      h.play('special', true);
      this.auraOn = true;
      audio.sfx('charge');
      await waitMs(this, 300);
      await this.fireBeam(t, withSide);
      this.hitTarget(t, k, mode);
      await waitMs(this, 750);
      this.auraOn = false;
    }
  }

  /** 光のパンチの拳:相手を突き抜けて右へ。いちばん近い物に当たって止まる。通り道の市民に当たることがある */
  private flyFist(t: Actor): Promise<void> {
    const props = this.visibleProps().filter((p) => p.x > t.x).sort((a, b) => a.x - b.x);
    const broken = new Set(rollPropsBroken('punch', props, t.x, this.rng));
    // ラッシュの前のエスカレーターは壊れないが、拳はそこに当たって止まる(突き抜けて奥へ飛んでいかないように)
    const g = this.rushPart.rushGuard;
    const guardFirst = g && g.x > t.x && g.x <= this.L.right + 8 && (!props[0] || g.x < props[0].x);
    const stopAt = guardFirst ? g : props[0];
    const endX = stopAt ? stopAt.x : this.L.right + 24;
    const civs = this.civsNear(t).filter((c) => c.x > t.x && c.x < endX);
    const hits = new Set(civs.filter((c) => rollCivHit('punch', c.x - t.x, this.rng)));
    const y = t.y - 30;
    const fist = this.fx('fx_punch', t.x + 10, y, { loop: true, depth: 900 });
    const o = { x: t.x + 10, y };
    const toY = stopAt ? (stopAt.wall ? stopAt.y : stopAt.y - 14) : y;
    const dur = Math.max(120, ((endX - o.x) / 420) * 1000);
    return new Promise((resolve) => {
      this.tweens.add({
        targets: o, x: endX, y: toY, duration: dur,
        onUpdate: () => {
          fist.setPosition(Math.round(o.x), Math.round(o.y));
          for (const c of hits) if (c.x <= o.x) { hits.delete(c); this.collateral(c, 'punch', 1); }
        },
        onComplete: () => {
          fist.destroy();
          if (stopAt && broken.has(stopAt)) this.breakProp(stopAt);
          else if (stopAt) { this.fx('fx_hit', endX, toY); audio.sfx('hit', { pitch: 1.5, volume: 0.6 }); }
          resolve();
        }
      });
    });
  }

  /** 必殺技の光線:横につなげて画面の端まで。通り道の物は全部壊れ、市民にも当たる */
  private async fireBeam(t: Actor, withSide: boolean): Promise<void> {
    const h = this.hero;
    const y = Math.round(h.y - 30);
    const x0 = Math.round(h.x + 20);
    const x1 = this.L.right + 20;
    const parts: Phaser.GameObjects.Sprite[] = [];
    audio.sfx('beam');
    // 画面全体の光は impact の1回だけ(光に弱い人のため、白く光るのは1コマ)
    impact(this, 'huge');
    for (let x = x0; x < x1 - 24; x += 32) {
      const s = this.add.sprite(x, y, 'fx_beam').setOrigin(0, 0.5).setDepth(h.y - 0.2).play(animKey('fx_beam', 'play'));
      parts.push(s);
    }
    const head = this.add.sprite(x1 - 24, y, 'fx_beam_head').setDepth(h.y - 0.1).play(animKey('fx_beam_head', 'play'));
    parts.push(head);
    // 画面の端まで一気にのびる
    parts.forEach((p, i) => { p.setVisible(false); this.time.delayedCall(i * 18, () => p.active && p.setVisible(true)); });
    if (withSide) {
      const props = rollPropsBroken('special', this.visibleProps(), t.x, this.rng).sort((a, b) => a.x - b.x);
      props.forEach((p, i) => this.time.delayedCall(80 + i * 70, () => this.breakProp(p)));
      for (const c of this.civsNear(t)) {
        if (c.x > t.x && rollCivHit('special', c.x - t.x, this.rng)) this.time.delayedCall(60 + (c.x - t.x) / 2, () => this.collateral(c, 'special', 1));
      }
    }
    this.time.delayedCall(900, () => {
      for (const p of parts) p.destroy();
    });
    this.time.delayedCall(200, () => { for (const p of parts) this.flickers.add(p); });
    shake(this, 7, 900);
    await waitMs(this, 60);
  }

  /** 殴った相手に当たった瞬間 */
  private hitTarget(t: Actor, k: AttackKind, mode: HitMode): void {
    if (mode === 'reveal') {
      this.fx('fx_hit', t.x - 6, t.y - 30, { scale: 2 });
      audio.sfx('bigHit');
      impact(this, 'big');
      return;
    }
    const big = k === 'special' || k === 'stomp';
    this.fx('fx_hit', t.x - 4, t.y - 30, { scale: big ? 2 : 1, depth: 950 });
    this.fx('fx_hit', t.x + 4, t.y - 22, { depth: 950 });
    audio.sfx(big ? 'bigHit' : 'hit');
    if (k !== 'special') impact(this, 'big');
    hitStop(this, k === 'special' ? 160 : 110);
    this.knock(t, k === 'special' ? 110 : k === 'charge' ? 80 : 60, k === 'stomp' ? 14 : 30);
    if (mode === 'civ') {
      this.stats.hurtCiv('hero', t.look);
      this.civHits.push({ look: t.look!, collateral: false });
      if (!this.free) this.civCry(this.civLineKey(k));
      this.report(sceneForCivHit(t.look!, k), k);
    } else {
      this.stats.defeatBad(mode === 'go' || mode === 'recover' ? 'go' : 'sort', mode === 'recover');
    }
  }

  /** 吹っ飛んで、のびる */
  knock(a: Actor, dist: number, height: number, dir = 1): void {
    a.state = 'down';
    a.showTag(false);
    a.hideMark();
    a.faceLeft(dir > 0);
    a.play('knocked', true);
    void this.arc(a, a.x + dist * dir, height, 380 + dist, 'Sine.easeOut').then(() => {
      if (a.state === 'gone') return;
      a.play('down', true);
      this.fx('fx_dust', a.x, a.y - 8, { depth: a.y + 1 });
      a.stars?.destroy();
      a.stars = this.add.sprite(a.x, a.y, 'fx_stars').play(animKey('fx_stars', 'play')).setDepth(a.y + 1);
      a.sync();
    });
  }

  /** 巻きぞえ */
  private collateral(c: Actor, k: AttackKind, dir: number): void {
    if (!c.standing) return;
    this.fx('fx_hit', c.x, c.y - 30, { depth: 950 });
    audio.sfx('hit', { pitch: 0.8 });
    shake(this, 3, 160);
    this.knock(c, 40, 20, dir);
    this.stats.hurtCiv('collateral', c.look);
    this.civHits.push({ look: c.look!, collateral: true });
    if (!this.free) this.civCry(this.civLineKey(k));
    this.report(sceneForCivHit(c.look!, k), k);
  }

  /**
   * 物が壊れる。count=false は被害額をここで数えないとき(ボスが暴れたときは bossRampage に、
   * ステージ4の念力で落ちた物は psyDowned に含まれている)。ソファ(ステージ4)は壊れない
   */
  breakProp(p: PropObj, count = true): void {
    if (p.broken || p === this.rushPart.rushGuard || p.kind === PSY.cushionProp) return;
    p.broken = true;
    p.sprite.setFrame(1);
    const cy = p.wall ? p.y : p.y - p.sprite.height / 2;
    const groundY = p.wall ? 150 : p.y;
    // 大きな物(車、自販機、柱、噴水、エスカレーター)は、ほこりも揺れも大きく
    const bigOne = isBigProp(p.kind);
    this.fx('fx_dust', p.x, cy, { depth: 960, scale: bigOne && p.kind !== 'vending' ? 2 : 1 });
    this.debris(p.x, cy, groundY);
    audio.sfx('break');
    if (bigOne) { shake(this, 5, 300); hitStop(this, 60); this.fx('fx_hit', p.x, cy, { scale: 2, depth: 960 }); }
    else shake(this, 2, 120);
    if (!count) return;
    const cost = this.stats.breakProp(p.kind);
    const top = p.wall ? p.y - 14 : p.y - p.sprite.height;
    this.pop(p.x, top, formatYen(cost), bigOne);
    this.report(sceneForProp(p.kind));
  }

  /** 破片が4つ飛び散って、groundY に落ちる */
  debris(x: number, cy: number, groundY: number, n = 4, spread = 28): void {
    for (let i = 0; i < n; i++) {
      const d = this.fx('fx_debris', x, cy, { depth: 960, loop: true });
      const toX = x + this.rng.int(-spread, spread);
      const h = this.rng.int(10, 30);
      const tw = { t: 0 };
      this.tweens.add({
        targets: tw, t: 1, duration: 420 + i * 40,
        onUpdate: () => {
          const y = cy + (groundY - cy) * tw.t * tw.t - Math.sin(Math.PI * tw.t) * h;
          d.setPosition(Math.round(x + (toX - x) * tw.t), Math.round(y));
        },
        onComplete: () => d.destroy()
      });
    }
  }

  /** 市民に当たったときのオペレーターの一言の種類(おばあさん > 必殺技 > 巻きぞえ > 直接) */
  private civLineKey(k: AttackKind, hits: readonly CivHit[] = this.civHits): ReactionKey {
    if (hits.some((h) => h.look === 'granny')) return 'grannyHit';
    if (k === 'special') return 'specialOnCiv';
    if (hits.some((h) => h.collateral)) return 'collateral';
    return 'hitCiv';
  }

  /** 市民に当たった瞬間:オペレーターがあわてる(前の「ナイス!」などを残さない)。同じ攻撃では、より強い一言に変わるときだけ言い直す */
  private civCry(key: ReactionKey): void {
    const rank: ReactionKey[] = ['hitCiv', 'collateral', 'specialOnCiv', 'grannyHit'];
    if (this.civCried && rank.indexOf(key) <= rank.indexOf(this.civCried)) return;
    this.civCried = key;
    this.opSay(this.line(key), true);
  }

  /**
   * 殴ったあと。ワルだけならほめる。ワルにした人が市民だったら、謝らずに言いはる(stubborn)。
   * 巻きぞえだけなら「やっちまったー!」→「まあいいか!」→ツッコミ(ヒーローの雑さのせい)。
   * judged は、ヒーローが決めつけて向かった相手か(行けで追いかけた相手なら false)
   */
  private async afterAttack(k: AttackKind, judged = false): Promise<void> {
    const hits = this.civHits;
    this.civHits = [];
    const cried = this.civCried;
    this.civCried = null;
    if (hits.length === 0) {
      this.opSay(this.line('hitBad', this.rng));
      // 決めつけが当たったときは、最初から分かってた顔
      if (judged) this.heroSay(this.line('judgeRight', this.rng), 1000);
      else if (this.rng.chance(0.5)) this.heroSay(this.line('hitBadHero', this.rng), 900);
      this.hero.play('idle');
      await waitMs(this, 420);
      return;
    }
    const first = this.stats.heroMistakes - hits.length === 0;
    if (hits.some((h) => !h.collateral)) { await this.stubborn(first); return; }
    // 当たった瞬間にもう同じ種類の一言を出していたら、言い直さない(セリフは比べる前に選ぶ。乱数を使う順を変えないため)
    const key = this.civLineKey(k, hits);
    const line = this.line(key, this.rng);
    await this.oops(cried === key ? null : line, first);
  }

  /**
   * ワルにした人が市民だった:オペレーターの「市民だってば!」(当たった瞬間に出ている)のあと、
   * ヒーローは腕組みで「でも怪しかった!」と言いはり、オペレーターは仕分けたのが自分だと気づく
   */
  private async stubborn(first: boolean): Promise<void> {
    const h = this.hero;
    await waitMs(this, first ? 350 : 200);
    h.play('win_arms', true);
    audio.sfx('okay');
    this.heroSay(this.line('stubborn', this.rng), first ? 1200 : 900);
    await waitMs(this, first ? 1000 : 700);
    this.opSay(this.line('ownFault', this.rng));
    await waitMs(this, first ? 800 : 450);
  }

  private async oops(line: Speech | null, first: boolean): Promise<void> {
    const h = this.hero;
    await waitMs(this, first ? 250 : 120);
    h.play('oops', true);
    audio.sfx('oops');
    const gaan = this.fx('fx_gaan', h.x, h.y - 30, { loop: true, depth: h.y - 1 });
    const gaan2 = this.fx('fx_gaan', h.x - 20, h.y - 36, { loop: true, depth: h.y - 1, flip: true });
    this.flickers.add(gaan2);
    this.heroSay(this.line('oops', this.rng), first ? 1000 : 700);
    if (line) this.opSay(line, true);
    await waitMs(this, first ? 1000 : 650);
    gaan.destroy(); gaan2.destroy();
    h.play('okay', true);
    audio.sfx('okay');
    this.fx('fx_kiran', h.x + 10, h.y - HEAD + 2, { depth: 960, scale: 2 });
    this.fx('fx_kiran', h.x - 12, h.y - 30, { depth: 960 });
    this.heroSay(this.line('okay', this.rng), first ? 1000 : 700);
    await waitMs(this, first ? 700 : 450);
    this.opSay(tsukkomi(first ? 1 : 2, this.rng));
    await waitMs(this, first ? 650 : 250);
  }

  // ─── 素通り ───────────────────────────────────

  private async passEncounter(a: Actor, enc: Encounter): Promise<boolean> {
    await this.runTo(a.x - 22, { y: this.passLane(a) });
    this.passGreet(a, this.line('pass', this.rng), enc === 'passCiv');
    await this.passOn(a);
    if (enc === 'passCiv') return false;
    if (enc === 'passBad') {
      // 地下駐車場のギャングは悪さの代わりに口笛で仲間を呼ぶ
      if (this.def.mechanic === 'gang' && a.person?.group) await this.gangPart.gangCall(a);
      // ショッピングモールの宇宙人は、悪さの代わりに空へ合図を送ってUFOを呼ぶ
      else if (this.def.mechanic === 'ufo') await this.ufoPart.ufoCall(a);
      // 高層ビルのヴィランは、念力で物を持ち上げて通りがかりの市民の上へ運ぶ
      else if (this.def.mechanic === 'psychic') await this.psyPart.psyCall(a);
      else await this.mischief(a);
      return false;
    }
    await this.rampage(a);
    return true;
  }

  /** 素通りで相手の手前に立つときの y(相手の列から12ドットずらす。フリープレイも使う) */
  passLane(a: Actor): number {
    return a.y < 190 ? a.y + 12 : a.y - 12;
  }

  /** 素通り:笑顔で手を振ってきらきら。happy なら相手はうれしそうに2回跳ねる(フリープレイも使う) */
  passGreet(a: Actor, sp: Speech | string, happy: boolean): void {
    const h = this.hero;
    h.play('pass', true);
    audio.sfx('sparkle');
    this.heroSay(sp, 1000);
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 110, () => this.fx('fx_sparkle', h.x + 12 + this.rng.int(-6, 10), h.y - 48 + this.rng.int(-8, 8), { depth: 960 }));
    }
    if (happy) {
      void this.arc(a, a.x, 7, 200).then(() => this.arc(a, a.x, 5, 180));
      this.time.delayedCall(150, () => this.fx('fx_sparkle', a.x, a.y - HEAD - 6, { depth: 960 }));
    }
  }

  /** 素通りのあと、相手の少し先までゆっくり歩く(フリープレイも使う) */
  passOn(a: Actor): Promise<void> {
    return this.runTo(a.x + 14, { speed: RUN * 0.55, anim: null });
  }

  /** 右の画面の外へ走って逃げて、消える。past は画面の右の端からどれだけ先まで走るか(部品とフリープレイも使う) */
  runAway(a: Actor, past = 50): void {
    a.faceLeft(false).play('walk', true, 2.8);
    const escX = this.L.right + past;
    this.tweens.add({ targets: a, x: escX, duration: Math.max(500, (escX - a.x) * 6), onComplete: () => a.destroy() });
  }

  /** 見逃したワル:ヒーローを追い抜いて前へ走り、悪さをする。3秒以内に行けで追い打ち */
  private async mischief(a: Actor): Promise<void> {
    const h = this.hero;
    const look = a.look!;
    h.play('idle');
    // 悪さの相手
    let victim = this.passers.find((p) => p.standing && p.x > a.x + 24 && p.x < a.x + 96);
    if (!victim) {
      victim = new Actor(this, 'suit_civ', a.x + 72, a.y < 192 ? 204 : 178);
      victim.look = 'suit'; victim.civ = true;
      victim.faceLeft(true).play('idle');
      this.passers.push(victim);
    }
    const v = victim;
    a.showTag(true);
    a.faceLeft(false).play('walk', true, 2.4);
    this.fx('fx_dust', a.x - 6, a.y - 8, { depth: a.y });
    await new Promise<void>((resolve) => this.tweens.add({
      targets: a, x: v.x - 18, y: v.y, duration: 620, ease: 'Sine.easeInOut', onComplete: () => resolve()
    }));
    a.play('mischief', true);
    await waitMs(this, 330);
    const cost = this.stats.mischief(look);
    this.pop(v.x, v.y - 20, formatYen(cost));
    this.fx('fx_hit', v.x - 4, v.y - 30, { depth: 950 });
    audio.sfx('hit', { pitch: 0.7 });
    shake(this, 2, 150);
    const kind = MISCHIEF_BY_LOOK[look];
    if (kind && MISCHIEF_HURTS_CIV[kind] && v.standing) this.knock(v, 30, 12, 1);
    else if (v.standing) v.pose('surprised');

    // 行けの合図。その回で初めてなら、行けの使い方を言う
    this.opSay(this.firstTime('go') ? this.line('teachGo') : mischiefLine(look, this.rng), true);
    h.pose('oops', 1);
    this.heroSay(this.line('mischiefHero', this.rng), 1300);
    await this.chaseOrEscape(a);
    if (v.standing) v.play('idle');
  }

  /**
   * 見逃したワルの頭の上に行けの合図。3秒以内に行けで追い打ち(撃破)、押さなければ走って逃げる(逃がした)。
   * ステージ1の悪さのあとと、ステージ2で口笛を吹いても仲間が誰も来なかったときに使う
   */
  private async chaseOrEscape(a: Actor): Promise<void> {
    const h = this.hero;
    a.showMark('go');
    this.goAlarm.start();
    const res = await new Promise<'go' | 'timeout'>((resolve) => {
      const timer = this.time.delayedCall(MARK.escapeSec * 1000, () => { this.goHandler = null; resolve('timeout'); });
      this.goHandler = () => { timer.remove(); this.goHandler = null; resolve('go'); };
    });
    this.goAlarm.stop();
    a.hideMark();
    if (res === 'go') {
      audio.sfx('go');
      this.heroSay(this.line('go', this.rng), 800);
      this.opSay(this.line('goOp', this.rng));
      a.pose('surprised');
      await this.runTo(a.x - ATTACK_GAP, { speed: RUN * 3, y: a.y });
      const k = this.pickAttack();
      this.heroSay(shout(k, this.rng), 900);
      await this.attack(a, k, 'go');
      await this.afterAttack(k);
      return;
    }
    // 逃げられた
    this.runAway(a);
    this.stats.escaped();
    this.opSay(this.line('escaped', this.rng));
    h.play('idle');
    await waitMs(this, 500);
  }

  /** 口笛を吹いたが、仲間が誰も来ない:きょろきょろして、1人のワルとして行けの合図(ステージ1の見逃したワルと同じ) */
  async aloneWhistle(a: Actor): Promise<void> {
    a.faceLeft(false).play('idle');
    // きょろきょろ(左右を見る)
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 170, () => { if (a.standing) a.faceLeft(i % 2 === 0); });
    }
    // 「今なら行け!」が行けの使い方の代わり
    this.firstTime('go');
    this.opSay(this.line('alone', this.rng), true);
    this.heroSay(this.line('aloneHero', this.rng), 1300);
    await waitMs(this, 420);
    a.faceLeft(true);
    this.hero.play('idle');
    await this.chaseOrEscape(a);
  }

  actorOf(id: string): Actor | undefined {
    return this.queue.find((q) => q.person?.id === id);
  }

  moveTo(a: Actor, x: number, y: number, ms: number, ease = 'Sine.easeInOut'): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ targets: a, x, y, duration: ms, ease, onComplete: () => resolve() }));
  }

  /** 壊れた車(や落ちたUFO)から、しばらく黒い煙が上がる。top は煙が出る高さ(下の端から) */
  smoke(van: PropObj, ms: number, top = 50): void {
    // 煙のかたまり(砂ぼこりの絵)の上に、渦を巻いて上る細かい煙を重ねる。風で少し左へ流れる。
    // 壊れたものより奥に置いて、後ろから上って見せる(UFOの上でのびている宇宙人にかけない)。
    // 色は、モールは背景が明るいので黒、地下駐車場は背景が暗いので灰色
    const fine = new CurlSmoke(this, {
      x: () => van.sprite.x - 5, y: () => van.y - top, depth: van.y - 0.1,
      colors: smokeColors(this.def.id),
      spread: 22, rate: 110, life: [1.1, 1.9], wind: -10, embers: 0.1, max: 240
    }).stopAfter(ms);
    const until = this.time.now + ms;
    const ev = this.time.addEvent({
      delay: 240, loop: true, callback: () => {
        if (this.time.now > until || !van.sprite.active) { ev.remove(); fine.stop(); return; }
        const x0 = van.sprite.x + this.rng.int(-30, 20);
        const y0 = van.y - top;
        const d = this.add.sprite(x0, y0, 'fx_dust').setDepth(van.y + 0.5).setTint(0x3a3448);
        d.play(animKey('fx_dust', 'play'));
        const o = { t: 0 };
        this.tweens.add({
          targets: o, t: 1, duration: 700,
          onUpdate: () => d.setPosition(Math.round(x0 - o.t * 6), Math.round(y0 - o.t * 22)),
          onComplete: () => d.destroy()
        });
        d.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => d.destroy());
      }
    });
  }

  /** 大きな行けの合図(組の頭の上、ワゴンの上) */
  bigMark(x: number, y: number, scale: number): Phaser.GameObjects.Sprite {
    const m = this.add.sprite(Math.round(x), Math.round(y), 'fx_mark_go').play(animKey('fx_mark_go', 'play')).setDepth(1200);
    m.setScale(scale + 1.5);
    this.time.delayedCall(60, () => m.active && m.setScale(scale));
    audio.sfx('mark');
    return m;
  }

  // ─── ボス ─────────────────────────────────────

  /** ボスが正体を現す(fx_dust で包んで boss.reveal) */
  private async revealBoss(a: Actor): Promise<void> {
    audio.sfx('reveal');
    a.showTag(false);
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 60, () => this.fx('fx_dust', a.x + this.rng.int(-16, 16), a.y - this.rng.int(6, 50), { scale: 2, depth: a.y + 2 }));
    }
    shake(this, 4, 400);
    await waitMs(this, 200);
    flash(this, 0xffffff, 2);
    a.setKey(this.def.bossSheet);
    a.shadowW = 1.8;
    a.faceLeft(this.hero.x < a.x);
    a.play('reveal', true);
    a.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => a.play('idle'));
    await waitMs(this, 450);
  }

  /** ワルに仕分けたボス:殴りかかった瞬間に正体を現す */
  private async bossReveal(a: Actor): Promise<void> {
    const h = this.hero;
    const backX = h.x - 26;
    void this.arc(h, backX, 20, 300);
    // 高層ビル:正体を現すと、会場のグラスや料理が念力でいっせいに浮く(見た目だけ。浮いたままボス戦へ)。
    // 小物は正体を現し始めたときに床やテーブルに置いておき、正体を現したら浮かせる。
    // 置く所は、ヒーローが下がったあとの画面(カメラはヒーローの HERO_SCREEN_X 後ろを追う)
    const psychic = this.def.mechanic === 'psychic';
    if (psychic) this.psyPart.setParty(a, { left: backX - HERO_SCREEN_X, heroX: backX });
    await this.revealBoss(a);
    if (psychic) this.psyPart.liftAround(a);
    void banner(this, 'ボス出現!', { hold: 900, y: BANNER_TOP_Y });
    this.opSay(this.line('bossReveal', this.rng), true);
    h.play('idle');
    await waitMs(this, 900);
    this.heroSay(this.line('bossRevealHero', this.rng), 1200);
    await waitMs(this, 1100);
    this.opSay(this.line('bossRevealOp2', this.rng));
    await waitMs(this, 900);
    this.leave('to boss');
  }

  /** 市民に仕分けたボス:素通りのあと正体を現して、周りを壊して暴れる */
  private async rampage(a: Actor): Promise<void> {
    const h = this.hero;
    await this.runTo(a.x + 34, { speed: RUN * 0.8 });
    h.play('idle');
    await waitMs(this, 200);
    this.camFocus = (a.x + h.x) / 2;
    await this.revealBoss(a);
    a.play('rampage', true);
    audio.sfx('rampage');
    const cost = this.stats.bossRampage();
    this.pop(a.x, a.y - 80, formatYen(cost), true);
    void banner(this, 'ボス出現!', { hold: 900, y: BANNER_TOP_Y });
    if (this.def.mechanic === 'gang') {
      // 地下駐車場:女ボスは手下の車をけしかける。ワゴンが通りを走り抜けて、物を壊していく
      this.gangPart.thugVans();
    } else if (this.def.mechanic === 'psychic') {
      // 高層ビル:親玉が会場の家具を念力でいっせいに浮かせて、窓の外へ投げる
      this.psyPart.flingFurniture(a);
    } else {
      // ショッピングモール:母艦の光線でモールを焼く
      if (this.def.mechanic === 'ufo') audio.sfx('shipBeam');
      const near = this.visibleProps().filter((p) => Math.abs(p.x - a.x) < 130).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x));
      near.forEach((p, i) => this.time.delayedCall(150 + i * 170, () => { this.breakProp(p, false); shake(this, 4, 200); }));
    }
    h.faceLeft(true).play('oops', true);
    const gaan = this.fx('fx_gaan', h.x, h.y - 30, { loop: true, depth: h.y - 1 });
    this.heroSay(this.line('bossRampageHero', this.rng), 1400);
    this.opSay(this.line('bossRampage', this.rng), true);
    await waitMs(this, 1400);
    audio.sfx('rampage');
    shake(this, 6, 500);
    await waitMs(this, 1100);
    gaan.destroy();
    this.leave('to boss');
  }

  /**
   * 次のシーン(答え合わせかボス戦)へ。背景のずれを持っていく。
   * next は行き先を決める関数(フリープレイは nextAfterFreeStreet。波を進めるので、出ていくと決まってから呼ぶ)
   */
  leave(what: string, next: (run: GameRun) => string = nextAfterStreet): void {
    if (this.leaving) return;
    this.leaving = true;
    this.devLog(what);
    this.run.scrollX = this.L.world.scrollX;
    gotoWhenFree(this, next(this.run));
  }

  /** 波の終わり:決めポーズでキラーン、「WAVE1 CLEAR!」の帯(no は波の番号。フリープレイも使う) */
  async clearPose(no: number): Promise<void> {
    const h = this.hero;
    h.play('okay', true);
    this.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    audio.sfx('okay');
    await banner(this, `WAVE${no} CLEAR!`, { hold: 700 });
  }

  private async waveClear(): Promise<void> {
    const h = this.hero;
    const last = this.queue[this.queue.length - 1];
    const rush = this.rushPart.rushThisWave();
    // ラッシュのある波は、エスカレーターの前(rushX)で止まる
    if (rush && this.rushPart.rushX !== null) await this.runTo(this.rushPart.rushX, { y: HERO_START.y });
    else await this.runTo((last?.x ?? h.x) + 70);
    await this.clearPose(this.run.waveIndex + 1);
    // 波2の結果発表が終わったあと、答え合わせの前に1回だけ
    if (rush && !this.leaving) await this.rushPart.saleRush();
    this.leave('wave clear');
  }

  /** 開発用:かかった時間を出す(途中から始めたときだけ) */
  devLog(what: string): void {
    if (this.run.debug) console.info(`[street] ${what} ${(this.time.now - this.startedAt) / 1000}s`);
  }
}
