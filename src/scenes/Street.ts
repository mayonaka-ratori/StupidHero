// 結果発表。仕分けが終わった波の人たちが並ぶ路地裏を、ヒーローが右へ進みながら、仕分け通りにハデに動く。
// 入口:Sort から(run.waveIndex の波)。出口:波の最後まで来たら nextAfterStreet(run)。
// 波3ではボスの前まで来たら、正体を現す場面を見せて Boss へ(run.scrollX に背景の位置を入れる)。
//
// 画面:上のアクション部分はカメラ world(ヒーローについて動く)、下の操作部分はカメラ ui(street/layers.ts)。
// 流れは run() の async の中で1人ずつ進める。待つのはシーンの時計(this.time)なので、ヒットストップと一時停止で止まる。
// 早送り(▶▶)は、時計、動き(tween)、アニメ、毎フレームの動きをまとめて2倍にする(update の applySpeed)。
// 待てと行けの合図が出ている間だけは、ふつうの速さに戻す(考える時間を減らさないため)。
//
// ステージごとの違いは def.mechanic と def.hasRush で分ける(ステージの名前では比べない)。
// - mechanic 'gang'(ステージ2):見逃したギャングが口笛で仲間を呼び、集まった組を行けでまとめて倒す。車で逃げる
// - mechanic 'ufo'(ステージ3):見逃した宇宙人が空へ合図 → UFOが下りて通りがかりの買い物客を吸い上げる。
//   行けでUFOを殴り落とす(真下の物が壊れる)。押さなければ連れ去られる。時間は UfoQueue(logic/ufo.ts)が数える
// - hasRush(ステージ3の波2):結果発表のあと、答え合わせの前にタイムセールラッシュ。右から8人が走ってきて、
//   ヒーローは全員に光のパンチ。市民にだけ待てを押す。時間は update の stepRush が数える(一時停止とヒットストップで止まる)

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey, originFor } from '../art/sheets';
import { accessorySheet } from '../art/recolor';
import {
  GANG, GangCall, MARK, MISCHIEF_BY_LOOK, MISCHIEF_HURTS_CIV, RUSH, RUSH_BAND_TEXT, UfoQueue, canStop, hasSeenRush, markRushSeen, rushEndLine,
  rushGlitchShowing, rushIntroFor, rushSpawnSec, streetTextsFor, formatYen, gatherMembers, isAttacked, isBigProp, judgeLine,
  mischiefLine, pickAttack, resolveEncounter, rollCivHit, rollGroupWipeProps, rollPropsBroken, say, sceneForCivHit, sceneForProp, shout, tsukkomi,
  MALL_PROP_SIZE, type AnyReactionKey, type AttackKind, type Encounter, type GangPhase, type Look, type PropKind, type ReactionKey, type Rng, type Speech,
  type RushRunner, type StageDef, type StatsTracker, type UfoEvent, type WorstScene
} from '../logic';
import { currentWave, fillUnsorted, getRun, nextAfterStreet, type GameRun } from '../run';
import {
  Bubble, Button, CutIn, EdgeAlarm, FS, IconButton, MuteButton, PauseControl, PixelText, Tag, WindowFrame, addPanel,
  UIX, banner, flash, gotoWhenFree, hitStop, impact, isFrozen, lighter, panelRect, popText, shake, whenNoFlash
} from '../ui';
import { Actor, HEAD } from './street/actor';
import { FastButton } from './street/fastButton';
import { Layers } from './street/layers';
import { HERO_START, UFO_DX, UFO_HALF, UFO_UNDER_KINDS, VAN_Y, planGarage, planMall, planStreet, type GatherSpot } from './street/plan';
import { snapshotLogical } from '../hires';
import { settings } from '../settings';

/** ヒーローの走る速さ(ドット/秒) */
const RUN = 84;
/** ヒーローの画面の中での位置(左寄り) */
const HERO_SCREEN_X = 60;
/** 殴りかかる距離(相手の何ドット手前で技を出すか) */
const ATTACK_GAP = 34;
/** 技を出す前のため(この間も待てが効く)。マークが出てから殴るまで合わせて約1.5秒になるように */
const WINDUP_MS = 1080;
/** ボス出現!の帯の高さ。ヒーローの吹き出し(頭の上)と重ならないように、画面の上のほうに出す */
const BANNER_TOP_Y = 46;
/** 飛び出す金額を、ほかの金額や吹き出しと重ならないようにずらすときの段の数 */
const POP_TRIES = 6;
/** 早送りの倍率 */
const FAST = 2;
/** ヒーローの決めつけの吹き出しを上げるドット数(相手の札と合図の間に入れる) */
const JUDGE_RISE = 8;
/** 本性ちらり(ワルにした人に向かったときに一瞬見せる正体)の長さ */
const PEEK_MS = 700;
/** ステージ3:本性ちらりで光る宇宙人の目の色(黄緑。明るい緑 R0 G255 B0 は使わない) */
const EYE_GLOW = 0x92ff00;
/** ステージ3:人の絵の目の位置(右を向いているとき、足からのずれ)。4つの見た目と親玉の化けた姿で同じ */
const EYE_AT = { dx: 6, dy: -48 };
/** ステージ3:UFOが止まる高さ(連れ去られる買い物客の足から、UFOの下の端まで) */
const UFO_HOVER = 72;
/** ステージ3:UFOを殴り落としたとき、助かった買い物客が横へよける幅(落ちたUFOと重ならないように) */
const SHOPPER_DODGE = 46;
/**
 * ステージ3:さらわれる場面を撮るとき、UFOの上の端を写真の何ドット目に合わせるか(共有カードは写真の y126〜196 を使う)。
 * UFOの丸屋根の上を少し切り、UFO、光、浮いている買い物客の足までを帯に入れる
 */
const ABDUCT_SHOT_TOP = 118;
/**
 * ステージ3:UFOが来ている間、UFOを画面の何ドット目に見せるか(カメラを少し右へ寄せる)。
 * 共有カードの写真で、UFOが上の2つの札(「いちばんひどい場面」とステージの名前)の間に入るように
 */
const UFO_SCREEN_X = 144;
/** ステージ3:さらわれる場面は、吸い上げの時間がどこまで進んだときに撮るか(0〜1。買い物客がいちばん高く浮いたころ) */
const ABDUCT_SHOT_AT = 0.95;
/** ステージ3:落ちたUFOが止まる所(下の端の y)。奥の列の物と手前の人の間 */
const UFO_LAND_Y = 160;
/** ラッシュ:走ってきた人が止まる所(ヒーローの何ドット先か。ヒーローがエスカレーターの前をふさいでいる) */
const RUSH_BLOCK = 28;
/** ラッシュ:待てで通した人が、ヒーローの後ろを抜けていくときにずらす奥行き */
const RUSH_PASS_DY = -10;

/** 早送りのオンとオフ。ページを開いている間は、波や回をまたいで覚えておく */
let fastOn = false;
/** 待てと行けの使い方をもう言ったか(回ごと。その回で初めて合図が出たときだけ言う) */
const taught = new WeakMap<GameRun, Set<'stop' | 'go' | 'ufo'>>();

/**
 * 撮った写真を dy ドット下へずらした、同じ大きさ(撮った高さ + dy)の写真にする。上の空いたところは写真のいちばん上の行
 * (空や天井)をのばしてうめる。結果画面は読みこみ中の写真も待ってから描くので、読みこみを待たずに返してよい
 */
function shiftShot(img: HTMLImageElement, dy: number): HTMLImageElement {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height + dy;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, img.width, 1, 0, 0, img.width, dy);
  g.drawImage(img, 0, dy);
  const out = new Image();
  out.src = c.toDataURL('image/png');
  return out;
}

interface PropObj { kind: PropKind; x: number; y: number; wall: boolean; sprite: Phaser.GameObjects.Sprite; broken: boolean }
interface Walker { toX: number; fromX: number; fromY: number; toY: number; speed: number; resolve: () => void }
interface CivHit { look: Look; collateral: boolean }
/** ステージ2:集まったギャングの組(口笛から、吹き飛ばす・車で止める・逃げられるまで) */
interface GangRun {
  call: GangCall;
  members: Actor[];
  spot: GatherSpot;
  /** 集まったときの並び(members と同じ順) */
  slots: { x: number; y: number }[];
  van: PropObj;
  /** ワゴンが走り出した位置と、画面の右に消える位置 */
  vanX0: number;
  vanEndX: number;
  mark?: Phaser.GameObjects.Sprite;
  count?: PixelText;
  /** 行けを押したあとの動きが終わったら呼ぶ */
  done: () => void;
}
/** ステージ3:来ているUFO1機(宇宙人の合図から、殴り落とす・連れ去られるまで)。時間は UfoQueue が数える */
interface UfoRun {
  alien: Actor;
  /** 連れ去られそうになる通りがかりの買い物客(UFOが下りてくるときに歩いてくる) */
  shopper?: Actor;
  /** UFOの真ん中の x と、止まっているときの下の端の y */
  x: number;
  bottom: number;
  sprite?: Phaser.GameObjects.Sprite;
  beam?: Phaser.GameObjects.Sprite;
  mark?: Phaser.GameObjects.Sprite;
  /** 吸い上げる音を次に鳴らすまでのミリ秒 */
  tractorMs: number;
  /** 吸い上げている間に撮った写真(撮っている間は 'pending')。さらわれたら、いちばんひどい場面の写真にする */
  shot?: HTMLImageElement | 'pending';
  /** 写真ができる前にさらわれたら true(できたときに、いちばんひどい場面の写真にする) */
  wantShot?: boolean;
  /** 殴り落とすか、連れ去られたあとの動きが終わったら呼ぶ */
  done: () => void;
}
/**
 * タイムセールラッシュで走ってくる1人。
 * wait:まだ来ていない / run:走っている / mark:待てのマーク(ヒーローの前で止まってからも) / hit:殴られた / pass:待てで通した / gone:いない
 */
interface RushMan {
  r: RushRunner;
  /** 画面の右に出てくる時刻(ラッシュの時計の秒。ゆっくりモードは間隔が1.5倍) */
  spawnSec: number;
  a?: Actor;
  state: 'wait' | 'run' | 'mark' | 'hit' | 'pass' | 'gone';
  /** マークが出た時刻(ラッシュの時計の秒) */
  markSec: number;
  /** 殴ったか通した時刻(ラッシュの時計の秒)。まだなら undefined */
  doneSec?: number;
  /** 宇宙人のくずれのノイズ(体全体に重ねる) */
  noise?: Phaser.GameObjects.Sprite;
  glitchOn: boolean;
}
type HitMode = 'bad' | 'civ' | 'go' | 'reveal';

export class StreetScene extends Phaser.Scene {
  private run!: GameRun;
  private def!: StageDef;
  private stats!: StatsTracker;
  private rng!: Rng;
  private L!: Layers;
  private hero!: Actor;
  private aura!: Phaser.GameObjects.Sprite;
  private trail!: Phaser.GameObjects.Sprite;
  private auraOn = false;
  private queue: Actor[] = [];
  private passers: Actor[] = [];
  /** 助けられて立ち去るだけの人(ステージ3の買い物客)。絵は合わせるが、巻きぞえや悪さの相手にはしない */
  private safeWalkers: Actor[] = [];
  private props: PropObj[] = [];
  private bgs: { s: Phaser.GameObjects.TileSprite; f: number }[] = [];
  private camX = 0;
  /** カメラをここに向ける(ボスが出たとき)。null ならヒーローについて行く */
  private camFocus: number | null = null;
  /** 開発用:?attack=special などで技を決める */
  private forceAttack: AttackKind | null = null;
  private startedAt = 0;
  private walker: Walker | null = null;
  private slow = 1;
  private stopHandler: (() => void) | null = null;
  private goHandler: (() => void) | null = null;
  private flickers = new Set<Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject>();
  private heroBubble?: Bubble;
  /** ヒーローの吹き出しを、頭の上からさらに何ドット上げるか */
  private heroBubbleRise = 0;
  /** 人について行く小さな吹き出し(本性ちらり)。dx, dy は足からのずれ */
  private peeks: { b: Bubble; a: Actor; dx: number; dy: number }[] = [];
  /** いまの速さ(早送りで2、待てと行けの合図の間は1) */
  private speed = 1;
  /** 出ている飛び出す数字(重ならないようにずらすため) */
  private pops: { t: PixelText; wx: number; y: number; w: number; h: number; rise: number }[] = [];
  /** オペレーターが話した回数(あとから言い替えるとき、間にほかのセリフがあったかを見る) */
  private opSeq = 0;
  private frameN = 0;
  private civHits: CivHit[] = [];
  /** この攻撃で、市民に当たったときにオペレーターが言った一言の種類 */
  private civCried: ReactionKey | null = null;
  private leaving = false;
  // 下の操作部分
  private cut!: CutIn;
  private stopBtn!: Button;
  private goBtn!: Button;
  private icons: Phaser.GameObjects.GameObject[] = [];
  private fastBtn!: FastButton;
  private tDefeat!: PixelText;
  private tHurt!: PixelText;
  private tDamage!: PixelText;
  private shownDamage = 0;
  private shown = { defeated: -1, hurt: -1, damage: '' };
  private stopAlarm!: EdgeAlarm;
  private goAlarm!: EdgeAlarm;
  // ステージ2:ギャングの組
  /** 口笛を吹く人の id → 組が集まる場所 */
  private gathers = new Map<string, GatherSpot>();
  /** 組の id → 組が乗るワゴン */
  private vans = new Map<string, PropObj>();
  /** 待てで止めた人の id(組に呼ばれても来ない) */
  private stoppedIds = new Set<string>();
  private gang: GangRun | null = null;
  // ステージ3:UFO
  private ufos = new UfoQueue();
  private ufo: UfoRun | null = null;
  // ステージ3:タイムセールラッシュ
  /** ラッシュでヒーローが立つ所(ラッシュのない波は null) */
  private rushX: number | null = null;
  /** ラッシュでヒーローが立つ所の後ろのエスカレーター。ラッシュが終わるまで、どの攻撃でも壊れない */
  private rushGuard: PropObj | null = null;
  /** ラッシュの間 true(早送りを切り、行けのボタンを暗くする) */
  private rushOn = false;
  /** ラッシュの時計が進んでいるか(帯と説明の間は止めている) */
  private rushRunning = false;
  private rushSec = 0;
  private rushMen: RushMan[] = [];
  /** ラッシュの全員が終わったら呼ぶ */
  private rushDone: (() => void) | null = null;
  /** 帯を出して止めている間に止めた絵(始めたら動かし直す) */
  private rushHeld: Phaser.GameObjects.Sprite[] = [];
  private rushHeldTweens: Phaser.Tweens.Tween[] = [];
  private rushHeldEvents: Phaser.Time.TimerEvent[] = [];

  constructor() { super(SCENES.street); }

  create(): void {
    this.run = getRun(this);
    this.def = this.run.stage.def;
    this.stats = this.run.stats;
    this.rng = this.run.rng;
    fillUnsorted(this.run);
    this.queue = []; this.passers = []; this.safeWalkers = []; this.props = []; this.bgs = []; this.icons = [];
    this.flickers = new Set();
    this.walker = null; this.slow = 1; this.stopHandler = null; this.goHandler = null;
    this.heroBubble = undefined; this.peeks = []; this.speed = 1; this.pops = []; this.opSeq = 0; this.frameN = 0; this.civHits = []; this.civCried = null; this.leaving = false;
    this.shownDamage = this.stats.damage; this.shown = { defeated: -1, hurt: -1, damage: '' };
    this.auraOn = false;
    this.camFocus = null;
    this.gathers = new Map(); this.vans = new Map(); this.stoppedIds = new Set(); this.gang = null;
    this.ufos = new UfoQueue(); this.ufo = null;
    this.rushX = null; this.rushGuard = null; this.rushOn = false; this.rushRunning = false; this.rushSec = 0; this.rushMen = []; this.rushDone = null; this.rushHeld = []; this.rushHeldTweens = []; this.rushHeldEvents = [];
    const fa = new URLSearchParams(location.search).get('attack');
    this.forceAttack = this.run.debug && (fa === 'charge' || fa === 'punch' || fa === 'stomp' || fa === 'special') ? fa : null;

    this.startedAt = this.time.now;
    // アニメの速さはゲーム全体の設定なので、次のシーンへ持ちこまないように戻す
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.anims.globalTimeScale = 1; });
    this.L = new Layers(this);
    this.buildWorld();
    this.buildPanel();

    audio.playBgm(this.def.bgm.street);
    this.input.on('pointerdown', () => audio.unlock());
    // 開発中だけ、自動テストから中身をさわれるようにする
    if (import.meta.env.DEV) (window as unknown as { streetDev?: unknown }).streetDev = this;
    void this.play();
  }

  // ─── 作る ─────────────────────────────────────

  private buildWorld(): void {
    const { W, actionH } = layout;
    const add = (key: string, y: number, h: number, f: number, depth: number): void => {
      const s = this.add.tileSprite(0, y, W, h, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
      this.bgs.push({ s, f });
    };
    add(this.def.bg.far, 0, actionH, 0.25, -30);
    add(this.def.bg.wall, 0, 130, 1, -20);
    add(this.def.bg.ground, 124, 90, 1, -10);

    const wave = currentWave(this.run);
    const encOf = (id: string, truth: 'bad' | 'civ' | 'boss'): Encounter => resolveEncounter(truth, this.run.sorts[id] ?? 'civ');
    const passBad = new Set(wave.people.filter((p) => encOf(p.id, p.truth) === 'passBad').map((p) => p.id));
    // 置く物はステージの仕組みごと(ステージ3はモールの物。ラッシュのある波はヒーローが立つ所にエスカレーター)
    const plan = this.def.mechanic === 'gang'
      ? planGarage(wave.people, passBad, this.def.props, this.rng)
      : this.def.mechanic === 'ufo'
        ? planMall(wave.people, passBad, this.def.props, this.rng, this.rushThisWave())
        : planStreet(wave.people, passBad, this.rng);
    this.rushX = plan.rushX ?? null;

    for (const p of plan.props) {
      const key = `prop_${p.kind}`;
      const sprite = this.add.sprite(p.x, p.y, key, 0);
      const origin = p.wall ? [0.5, 0.5] : [0.5, 1];
      sprite.setOrigin(origin[0], origin[1]).setDepth(p.wall ? -15 : p.y);
      this.props.push({ ...p, sprite, broken: false });
    }
    // ラッシュのある波:立つ所の後ろのエスカレーターは、ラッシュの前に巻きぞえで壊れないようにする
    const rushX = this.rushX;
    if (rushX !== null) {
      this.rushGuard = this.props.find((p) => p.kind === 'escalator' && Math.abs(p.x - rushX) < 24) ?? null;
    }
    for (const g of plan.gathers) {
      this.gathers.set(g.whistlerId, g);
      const van = this.props.find((p) => p.kind === 'van' && p.x === g.vanX && p.y === g.vanY);
      if (van) this.vans.set(g.groupId, van);
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
      const choice = this.run.sorts[s.person.id] ?? 'civ';
      a.tag = new Tag(this, s.x, s.y - HEAD, choice).follow(a.sprite, -HEAD);
      this.queue.push(a);
      // 化けた女ボスの金の小物は、ときどきキラッと光らせる(1色だとオレンジに見えるため)
      if (s.person.truth === 'boss' && s.person.accessory) this.goldGlint(a);
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
    new PixelText(this, 6, 5, `WAVE${this.run.waveIndex + 1}`, { size: FS.body, color: UI.gold, outline: true })
      .setScrollFactor(0).setDepth(1400);
  }

  private buildPanel(): void {
    const { W } = layout;
    this.L.inUi(() => {
      const pause = new PauseControl(this);
      this.icons.push(new IconButton(this, W - 12, 12, 'pause', () => pause.pause()));
      this.icons.push(new MuteButton(this, W - 34, 12, { isMuted: () => audio.isMuted(), toggle: () => audio.toggleMuted() }));
      this.fastBtn = new FastButton(this, W - 56, 12, {
        isOn: () => fastOn, toggle: () => { audio.unlock(); fastOn = !fastOn; }, locked: () => this.rushOn
      });
      this.icons.push(this.fastBtn);

      addPanel(this);
      // 縦に余裕があれば(縦長の画面)、横いっぱいに使い、セリフを大きな字にして、ボタンも大きくする
      const tall = panelRect().h >= 200;
      const r = tall ? panelRect(4) : panelRect();
      const hudH = 40;
      new WindowFrame(this, r.x, r.y, r.w, hudH, 'win');
      const lx = r.x + 7;
      new PixelText(this, lx, r.y + 4, '撃破', { size: FS.big });
      this.tDefeat = new PixelText(this, lx + 36, r.y + 4, '0', { size: FS.big, color: UI.gold });
      new PixelText(this, lx + 92, r.y + 4, '負傷', { size: FS.big });
      this.tHurt = new PixelText(this, lx + 128, r.y + 4, '0', { size: FS.big, color: UI.danger });
      new PixelText(this, lx, r.y + 21, '被害額', { size: FS.big });
      this.tDamage = new PixelText(this, r.right - 7, r.y + 21, '', { size: FS.big, color: UI.gold }).setOrigin(1, 0);

      const cutY = r.y + hudH + 4;
      const cutH = tall ? 80 : 46;
      this.cut = new CutIn(this, r.x, cutY, r.w, cutH, tall ? { size: FS.big, faceTop: true } : {});
      // ボタンは親指が届く下の端にそろえる
      const bh = Math.max(40, Math.min(tall ? 120 : 72, r.bottom - (cutY + cutH + 5)));
      const by = r.bottom - bh;
      const bw = Math.floor((r.w - 8) / 2);
      this.stopBtn = new Button(this, r.x, by, bw, bh, '待て!', { color: 'stop', textColor: UIX.stopText, onPress: () => { audio.unlock(); this.stopHandler?.(); } });
      this.goBtn = new Button(this, r.x + bw + 8, by, bw, bh, '行け!', { color: 'go', onPress: () => { audio.unlock(); this.goHandler?.(); } });
      this.stopBtn.setEnabled(false);
      this.goBtn.setEnabled(false);
    });
    this.updateHud(true);
  }

  // ─── 毎フレーム ───────────────────────────────

  update(_t: number, delta: number): void {
    this.frameN++;
    const frozen = isFrozen(this);
    if (!frozen) {
      this.applySpeed();
      const ms = Math.min(delta, 50) * this.speed;
      const dt = ms / 1000;
      this.stepWalker(dt);
      if (this.gang) this.stepGang(ms);
      if (this.ufo) this.stepUfo(ms);
      if (this.rushRunning) this.stepRush(ms);
      // カメラはヒーローについて行く(少し遅れて)
      const target = this.camFocus !== null ? this.camFocus - layout.W / 2 : this.hero.x - HERO_SCREEN_X;
      this.camX += (target - this.camX) * Math.min(1, dt * 6);
      this.L.world.scrollX = Math.round(this.camX);
      for (const b of this.bgs) b.s.tilePositionX = Math.round(this.L.world.scrollX * b.f);
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
    for (const m of this.rushMen) if (m.a && m.a.state !== 'gone') m.a.sync();
    this.syncNoise();
    this.hero.sync();
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
    const sp = fastOn && !deciding && !this.rushOn ? FAST : 1;
    this.speed = sp;
    if (this.time.timeScale !== sp) this.time.timeScale = sp;
    if (this.tweens.timeScale !== sp) this.tweens.timeScale = sp;
    if (this.anims.globalTimeScale !== sp) this.anims.globalTimeScale = sp;
  }

  private stepWalker(dt: number): void {
    const w = this.walker;
    if (!w) return;
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
    this.aura.setPosition(hx, hy - 26).setDepth(h.y + 0.4).setVisible(aura && on);
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
    const st = this.stopHandler !== null;
    const go = this.goHandler !== null;
    if (this.stopBtn.isEnabled !== st) this.stopBtn.setEnabled(st).setColor(UI.stop);
    if (this.goBtn.isEnabled !== go) this.goBtn.setEnabled(go).setColor(UI.go);
    // タイムセールラッシュでは行けを使わないので、ボタンを暗くしておく
    const goAlpha = this.rushOn ? 0.4 : 1;
    if (this.goBtn.alpha !== goAlpha) this.goBtn.setAlpha(goAlpha);
    // 押せるときは、ボタンをゆっくり明るくしたり戻したりする。
    // 強く点滅させると、正しくワルにした人にも待てを押したくなるので、やさしく光らせるだけにする
    if (this.frameN % 3 === 0 && (st || go)) {
      const t = (1 - Math.cos((this.time.now / 1100) * Math.PI * 2)) / 2;
      if (st) this.stopBtn.setColor(lighter(UI.stop, t * 0.3));
      if (go) this.goBtn.setColor(lighter(UI.go, t * 0.25));
    }
  }

  // ─── 小さな道具 ───────────────────────────────

  private pickAttack(): AttackKind {
    const k = pickAttack(this.rng);
    return this.forceAttack ?? k;
  }

  /**
   * 飛び出す数字(画面の端で切れないように寄せる)。続けて出たときはほかの数字と重ならないように上下にずらし、
   * ヒーローの吹き出しにも重ならない位置を選ぶ。それでも重なるときは吹き出しの奥に出す(セリフを隠さない)
   */
  private pop(x: number, y: number, text: string, big = false): void {
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

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, () => r()));
  }

  /** ヒーローを右へ走らせる(戻ることはしない)。anim を null にすると動きを変えない */
  private runTo(x: number, opt: { speed?: number; y?: number; anim?: string | null } = {}): Promise<void> {
    const h = this.hero;
    if (opt.anim !== null) h.play(opt.anim ?? 'run');
    return new Promise((resolve) => {
      if (x <= h.x) {
        if (opt.y !== undefined) h.y = opt.y;
        resolve();
        return;
      }
      this.walker = { toX: x, fromX: h.x, fromY: h.y, toY: opt.y ?? h.y, speed: opt.speed ?? RUN, resolve };
    });
  }

  /** 1回だけ流れて消えるエフェクト */
  private fx(key: string, x: number, y: number, opt: { depth?: number; scale?: number; flip?: boolean; loop?: boolean; flicker?: boolean } = {}): Phaser.GameObjects.Sprite {
    const s = this.add.sprite(Math.round(x), Math.round(y), key).setDepth(opt.depth ?? 700).setScale(opt.scale ?? 1).setFlipX(!!opt.flip);
    s.play(animKey(key, 'play'));
    if (!opt.loop) s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
    if (opt.flicker) this.flickers.add(s);
    return s;
  }

  /** x から toX へ、高さ h の山なりに動かす */
  private arc(a: { x: number; lift: number }, toX: number, h: number, ms: number, ease = 'Linear'): Promise<void> {
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
  private line(key: AnyReactionKey, rng?: Rng): Speech {
    return say(key, rng, this.def.id);
  }

  /** rise は吹き出しを上げるドット数(合図の相手の札を隠さないとき) */
  private heroSay(sp: Speech | string, ms = 1200, rise = 0): void {
    const text = typeof sp === 'string' ? sp : sp.text;
    this.heroBubble?.destroy();
    this.heroBubbleRise = rise;
    const x = this.L.screenX(this.hero.x) + 6;
    const y = this.hero.y - this.hero.lift - HEAD - 2 - rise;
    // 画面の座標で置く(Bubble は画面の端からはみ出ないようにずれるため)。札より手前、合図より奥(合図を隠さないように)
    this.heroBubble = new Bubble(this, x, y, text, { tail: 'down-left', life: ms });
    this.heroBubble.setScrollFactor(0).setDepth(1100);
  }

  private opSay(sp: Speech, alarm = false): void {
    this.opSeq++;
    void this.cut.say(sp.text, sp.face, { who: sp.who, alarm });
  }

  /**
   * いちばんひどい場面なら、アクション部分を撮っておく。attack はその場面を起こした技(説明の文を変えるため)。
   * shiftY を渡すと、写真を下へずらして撮る(上の端は空の色でうめる)。共有カードは写真の下の方の帯しか使わないので、
   * 高いところで起きた場面(UFOにさらわれる)を帯に入れるため
   */
  private report(scene: WorstScene | null, attack: AttackKind | null = null, shiftY = 0): void {
    if (!scene || !this.stats.reportScene(scene, attack)) return;
    // 当たった相手が吹っ飛び始めたところを撮る(ヒットストップのあと少しして)
    this.time.delayedCall(90, () => this.shoot(shiftY, (img) => { this.run.worstShot = img; }));
  }

  /**
   * 通りの画面を撮る(shiftY ドット下へずらす)。画面全体の光(flash)が出ているコマは真っ白に写るので、光が消えるまで待つ。
   * 中断などのボタン、頭の上の札、画面の端の点滅は写さない(札は共有カードの説明の字と重なるため)。
   * show に渡したもの(1コマおきに点滅する光など)は、撮るコマでは必ず出す
   */
  private shoot(shiftY: number, cb: (img: HTMLImageElement) => void, show: Phaser.GameObjects.Components.Visible[] = []): void {
    whenNoFlash(this, () => {
      if (!this.sys.isActive()) return;
      const icons = this.icons as unknown as Phaser.GameObjects.Components.Visible[];
      const tags = this.children.list.filter((o): o is Tag => o instanceof Tag && o.visible);
      const hidden = [...icons, ...tags];
      for (const o of hidden) o.setVisible(false);
      this.stopAlarm.hideNow();
      this.goAlarm.hideNow();
      for (const o of show) o.setVisible(true);
      const dy = Math.max(0, Math.round(shiftY));
      snapshotLogical(this.game, 0, 0, layout.W, layout.actionH - dy, (img) => cb(dy ? shiftShot(img, dy) : img));
      // 撮影はこのフレームの描画で行われるので、次のフレームで戻す(戻すまでに消えたものは戻さない)
      this.time.delayedCall(0, () => { for (const o of hidden) if ((o as unknown as Phaser.GameObjects.GameObject).active) o.setVisible(true); });
    });
  }

  private showMark(a: Actor, kind: 'stop' | 'go'): void {
    a.mark?.destroy();
    a.mark = this.add.sprite(a.x, a.y, kind === 'stop' ? 'fx_mark_stop' : 'fx_mark_go')
      .play(animKey(kind === 'stop' ? 'fx_mark_stop' : 'fx_mark_go', 'play')).setScale(2).setDepth(1200);
    a.sync();
    // ぴょんと出る
    const m = a.mark;
    m.setScale(3);
    this.time.delayedCall(50, () => m.active && m.setScale(2));
    audio.sfx('mark');
  }

  private hideMark(a: Actor): void {
    a.mark?.destroy();
    a.mark = undefined;
  }

  /** 画面に見えている、まだ壊れていない物(攻撃で壊れうる物) */
  private visibleProps(): PropObj[] {
    const l = this.L.left - 8;
    const r = this.L.right + 8;
    // ギャングのワゴンはふつうの攻撃では壊れない(組が乗って逃げる車)。ラッシュの前のエスカレーターも壊れない
    return this.props.filter((p) => !p.broken && p.kind !== 'van' && p !== this.rushGuard && p.x >= l && p.x <= r);
  }

  /** 巻きぞえになりうる市民(画面の中で立っている人) */
  private civsNear(except: Actor): Actor[] {
    const l = this.L.left - 8;
    const r = this.L.right + 8;
    return [...this.queue, ...this.passers].filter((a) => a !== except && a.civ && a.standing && a.x >= l && a.x <= r);
  }

  // ─── 流れ ─────────────────────────────────────

  private async play(): Promise<void> {
    // 見ているだけの画面だと思われないように、帯は「待てと行けの出番」と言い切る(波の数は左上に小さく出ている)
    // 早送りでも帯は読めるように、出ている時間はふつうの速さのときと同じにする
    void banner(this, streetTextsFor(this.def.id).band, { hold: fastOn ? 600 * FAST : 600 });
    this.opSay(this.line('sortDone', this.rng));
    await this.wait(700);
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

  private laneFor(a: Actor): number {
    return Math.round(a.y);
  }

  /**
   * 殴りに行く相手:48ドット手前で合図、ゆっくりになって、待てが効く。押さなければ技を出す。
   * 合図と同時に、相手は本性を一瞬だけ見せ(本性ちらり)、ヒーローは見た目から「ワルで間違いない!」と決めつける
   */
  private async attackEncounter(a: Actor, enc: Encounter): Promise<boolean> {
    await this.runTo(a.x - MARK.showDistance, { y: this.laneFor(a) });
    this.showMark(a, 'stop');
    this.stopAlarm.start();
    this.slow = MARK.slowmo;
    this.hero.sprite.anims.timeScale = MARK.slowmo;
    const k = this.pickAttack();
    this.peek(a);
    // 決めつけは技を出すまで出しておく(叫びは技を出す瞬間に替える)。
    // 横に長いので相手の頭の上にかかる。札(ワル)を隠さないように、合図との間まで上げる
    this.heroSay(judgeLine(a.person?.disguise ?? a.look, this.rng), 1600, JUDGE_RISE);
    // その回で初めての合図なら、待ての使い方を言う
    if (this.firstTime('stop')) this.opSay(this.line('teachStop'));
    const res = await this.markWindow(a, enc, k);
    this.stopAlarm.stop();
    this.slow = 1;
    this.hero.sprite.anims.timeScale = 1;
    this.hideMark(a);
    this.auraOn = false;
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

  /** 待てや行けの使い方を、その回でまだ言っていなければ true(言ったことにする)。'ufo' はUFOを行けで落とすこと */
  private firstTime(kind: 'stop' | 'go' | 'ufo'): boolean {
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
        this.walker = null;
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
  private windup(k: AttackKind): void {
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
  private async doStop(a: Actor): Promise<void> {
    const h = this.hero;
    h.play('stop', true);
    audio.sfx('stop');
    this.stats.stopped(a.person!.truth);
    this.stoppedIds.add(a.person!.id);
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
    await this.wait(900);
    if (a.standing) a.play('idle');
    // 市民だったら、ほっとしてぴょんと跳ぶ
    if (a.civ) { void this.arc(a, a.x, 6, 220); this.fx('fx_sparkle', a.x, a.y - HEAD - 4); }
    await this.wait(150);
  }

  // ─── 技 ───────────────────────────────────────

  private async attack(t: Actor, k: AttackKind, mode: HitMode): Promise<void> {
    const h = this.hero;
    const withSide = mode !== 'reveal';
    if (k === 'charge') {
      audio.sfx('charge');
      h.play('charge', true);
      this.auraOn = true;
      await this.wait(70);
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
      await this.wait(260);
      this.auraOn = false;
      await this.wait(200);
    } else if (k === 'punch') {
      h.play('punch', true);
      audio.sfx('punch');
      await this.wait(190);
      this.hitTarget(t, k, mode);
      if (withSide) await this.flyFist(t);
      await this.wait(250);
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
      await this.wait(420);
    } else {
      h.play('special', true);
      this.auraOn = true;
      audio.sfx('charge');
      await this.wait(300);
      await this.fireBeam(t, withSide);
      this.hitTarget(t, k, mode);
      await this.wait(750);
      this.auraOn = false;
    }
  }

  /** 光のパンチの拳:相手を突き抜けて右へ。いちばん近い物に当たって止まる。通り道の市民に当たることがある */
  private flyFist(t: Actor): Promise<void> {
    const props = this.visibleProps().filter((p) => p.x > t.x).sort((a, b) => a.x - b.x);
    const broken = new Set(rollPropsBroken('punch', props, t.x, this.rng));
    // ラッシュの前のエスカレーターは壊れないが、拳はそこに当たって止まる(突き抜けて奥へ飛んでいかないように)
    const g = this.rushGuard;
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
    await this.wait(60);
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
      this.civCry(this.civLineKey(k));
      this.report(sceneForCivHit(t.look!, k), k);
    } else {
      this.stats.defeatBad(mode === 'go' ? 'go' : 'sort');
    }
  }

  /** 吹っ飛んで、のびる */
  private knock(a: Actor, dist: number, height: number, dir = 1): void {
    a.state = 'down';
    a.showTag(false);
    this.hideMark(a);
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
    this.civCry(this.civLineKey(k));
    this.report(sceneForCivHit(c.look!, k), k);
  }

  /** 物が壊れる。count=false はボスが暴れたとき(被害額は bossRampage に含まれている) */
  private breakProp(p: PropObj, count = true): void {
    if (p.broken || p === this.rushGuard) return;
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
  private debris(x: number, cy: number, groundY: number, n = 4, spread = 28): void {
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
      await this.wait(420);
      return;
    }
    const first = this.stats.heroMistakes - hits.length === 0;
    if (hits.some((h) => !h.collateral)) { await this.stubborn(first); return; }
    let line: Speech | null = null;
    if (hits.some((h) => h.look === 'granny')) line = this.line('grannyHit', this.rng);
    else if (k === 'special') line = this.line('specialOnCiv', this.rng);
    else if (hits.some((h) => h.collateral)) line = this.line('collateral', this.rng);
    // 当たった瞬間にもう同じ種類の一言を出していたら、言い直さない
    if (cried === this.civLineKey(k, hits)) line = null;
    await this.oops(line, first);
  }

  /**
   * ワルにした人が市民だった:オペレーターの「市民だってば!」(当たった瞬間に出ている)のあと、
   * ヒーローは腕組みで「でも怪しかった!」と言いはり、オペレーターは仕分けたのが自分だと気づく
   */
  private async stubborn(first: boolean): Promise<void> {
    const h = this.hero;
    await this.wait(first ? 350 : 200);
    h.play('win_arms', true);
    audio.sfx('okay');
    this.heroSay(this.line('stubborn', this.rng), first ? 1200 : 900);
    await this.wait(first ? 1000 : 700);
    this.opSay(this.line('ownFault', this.rng));
    await this.wait(first ? 800 : 450);
  }

  private async oops(line: Speech | null, first: boolean): Promise<void> {
    const h = this.hero;
    await this.wait(first ? 250 : 120);
    h.play('oops', true);
    audio.sfx('oops');
    const gaan = this.fx('fx_gaan', h.x, h.y - 30, { loop: true, depth: h.y - 1 });
    const gaan2 = this.fx('fx_gaan', h.x - 20, h.y - 36, { loop: true, depth: h.y - 1, flip: true });
    this.flickers.add(gaan2);
    this.heroSay(this.line('oops', this.rng), first ? 1000 : 700);
    if (line) this.opSay(line, true);
    await this.wait(first ? 1000 : 650);
    gaan.destroy(); gaan2.destroy();
    h.play('okay', true);
    audio.sfx('okay');
    this.fx('fx_kiran', h.x + 10, h.y - HEAD + 2, { depth: 960, scale: 2 });
    this.fx('fx_kiran', h.x - 12, h.y - 30, { depth: 960 });
    this.heroSay(this.line('okay', this.rng), first ? 1000 : 700);
    await this.wait(first ? 700 : 450);
    this.opSay(tsukkomi(first ? 1 : 2, this.rng));
    await this.wait(first ? 650 : 250);
  }

  // ─── 素通り ───────────────────────────────────

  private async passEncounter(a: Actor, enc: Encounter): Promise<boolean> {
    const passY = a.y < 190 ? a.y + 12 : a.y - 12;
    await this.runTo(a.x - 22, { y: passY });
    const h = this.hero;
    h.play('pass', true);
    audio.sfx('sparkle');
    this.heroSay(this.line('pass', this.rng), 1000);
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 110, () => this.fx('fx_sparkle', h.x + 12 + this.rng.int(-6, 10), h.y - 48 + this.rng.int(-8, 8), { depth: 960 }));
    }
    if (enc === 'passCiv') {
      // うれしそうに2回跳ねる
      void this.arc(a, a.x, 7, 200).then(() => this.arc(a, a.x, 5, 180));
      this.time.delayedCall(150, () => this.fx('fx_sparkle', a.x, a.y - HEAD - 6, { depth: 960 }));
    }
    await this.runTo(a.x + 14, { speed: RUN * 0.55, anim: null });
    if (enc === 'passCiv') return false;
    if (enc === 'passBad') {
      // 地下駐車場のギャングは悪さの代わりに口笛で仲間を呼ぶ
      if (this.def.mechanic === 'gang' && a.person?.group) await this.gangCall(a);
      // ショッピングモールの宇宙人は、悪さの代わりに空へ合図を送ってUFOを呼ぶ
      else if (this.def.mechanic === 'ufo') await this.ufoCall(a);
      else await this.mischief(a);
      return false;
    }
    await this.rampage(a);
    return true;
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
    await this.wait(330);
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
    this.showMark(a, 'go');
    this.goAlarm.start();
    const res = await new Promise<'go' | 'timeout'>((resolve) => {
      const timer = this.time.delayedCall(MARK.escapeSec * 1000, () => { this.goHandler = null; resolve('timeout'); });
      this.goHandler = () => { timer.remove(); this.goHandler = null; resolve('go'); };
    });
    this.goAlarm.stop();
    this.hideMark(a);
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
    a.faceLeft(false).play('walk', true, 2.8);
    const escX = this.L.right + 50;
    this.tweens.add({ targets: a, x: escX, duration: Math.max(500, (escX - a.x) * 6), onComplete: () => a.destroy() });
    this.stats.escaped();
    this.opSay(this.line('escaped', this.rng));
    h.play('idle');
    await this.wait(500);
  }

  /** 口笛を吹いたが、仲間が誰も来ない:きょろきょろして、1人のワルとして行けの合図(ステージ1の見逃したワルと同じ) */
  private async aloneWhistle(a: Actor): Promise<void> {
    a.faceLeft(false).play('idle');
    // きょろきょろ(左右を見る)
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 170, () => { if (a.standing) a.faceLeft(i % 2 === 0); });
    }
    // 「今なら行け!」が行けの使い方の代わり
    this.firstTime('go');
    this.opSay(this.line('alone', this.rng), true);
    this.heroSay(this.line('aloneHero', this.rng), 1300);
    await this.wait(420);
    a.faceLeft(true);
    this.hero.play('idle');
    await this.chaseOrEscape(a);
  }

  // ─── ステージ2:ギャングの組 ─────────────────────
  // 見逃したギャングが口笛 → 同じ組の仲間が走ってきて集まる → 頭の上に大きな行けの合図。
  // 行けでまとめて吹き飛ばす。押さないと3秒でワゴンに乗りこみ、走り出す。走っている間の行けは車ごと止める。
  // 時間は GangCall(logic/gang.ts)が数える。カメラは組とワゴンが画面の中に入るように向ける。

  private actorOf(id: string): Actor | undefined {
    return this.queue.find((q) => q.person?.id === id);
  }

  /** 組に呼ばれても来ない人(もう倒した、待てで止めた、もういない) */
  private goneFromGang(id: string): boolean {
    const a = this.actorOf(id);
    return !a || !a.standing || this.stoppedIds.has(id);
  }

  /** 集まったときの並び。口笛を吹いた人がいちばん前(ヒーローの側) */
  private gatherSlots(spot: GatherSpot, n: number): { x: number; y: number }[] {
    // 札(市民/ワル)が重ならないように、横に28ドットずつあける
    const all = [{ x: -18, y: 2 }, { x: 10, y: -10 }, { x: 38, y: 8 }, { x: 52, y: -8 }];
    return all.slice(0, n).map((o) => ({ x: spot.x + o.x, y: spot.y + o.y }));
  }

  /** 計画にワゴンがなかったとき(ふつうは起きない)、その場に置く */
  private addVan(spot: GatherSpot): PropObj {
    const sprite = this.add.sprite(spot.vanX, spot.vanY, 'prop_van', 0).setOrigin(0.5, 1).setDepth(spot.vanY);
    const van: PropObj = { kind: 'van', x: spot.vanX, y: spot.vanY, wall: false, sprite, broken: false };
    this.props.push(van);
    this.vans.set(spot.groupId, van);
    return van;
  }

  private moveTo(a: Actor, x: number, y: number, ms: number, ease = 'Sine.easeInOut'): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ targets: a, x, y, duration: ms, ease, onComplete: () => resolve() }));
  }

  /** 化けた女ボスの金の小物(首や腕のあたり)が、ときどき小さく光る。正体を現したら止める */
  private goldGlint(a: Actor): void {
    const disguise = a.sprite.texture.key;
    const ev = this.time.addEvent({
      delay: 1300, loop: true, startAt: this.rng.int(0, 1200), callback: () => {
        if (!a.sprite.active || a.sprite.texture.key !== disguise) { ev.remove(); return; }
        if (!a.standing || !a.sprite.visible) return;
        const dx = a.sprite.flipX ? -4 : 4;
        this.fx('fx_sparkle', a.x + dx, a.y - 38 - a.lift, { depth: a.y + 0.6 });
      }
    });
  }

  /** 壊れた車(や落ちたUFO)から、しばらく黒い煙が上がる。top は煙が出る高さ(下の端から) */
  private smoke(van: PropObj, ms: number, top = 50): void {
    const until = this.time.now + ms;
    const ev = this.time.addEvent({
      delay: 240, loop: true, callback: () => {
        if (this.time.now > until || !van.sprite.active) { ev.remove(); return; }
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
  private bigMark(x: number, y: number, scale: number): Phaser.GameObjects.Sprite {
    const m = this.add.sprite(Math.round(x), Math.round(y), 'fx_mark_go').play(animKey('fx_mark_go', 'play')).setDepth(1200);
    m.setScale(scale + 1.5);
    this.time.delayedCall(60, () => m.active && m.setScale(scale));
    audio.sfx('mark');
    return m;
  }

  /** 口笛の音符。口元から右上へ、点滅しながら上がっていく */
  private whistleNotes(a: Actor): void {
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 160, () => {
        if (!a.sprite.active) return;
        const g = this.add.graphics().setDepth(1150);
        const dark = 0x1a1420;
        const c = i % 2 === 0 ? 0xffffff : 0xfff2b0;
        // ふち → 玉と棒と旗
        g.fillStyle(dark, 1).fillRect(-1, 3, 5, 4).fillRect(1, -1, 3, 6).fillRect(2, -1, 4, 3);
        g.fillStyle(c, 1).fillRect(0, 4, 3, 2).fillRect(2, 0, 1, 5).fillRect(3, 0, 2, 1);
        const x0 = a.x + 8 + i * 3;
        const y0 = a.y - 44;
        g.setPosition(Math.round(x0), Math.round(y0));
        this.flickers.add(g);
        const o = { t: 0 };
        this.tweens.add({
          targets: o, t: 1, duration: 620,
          onUpdate: () => g.setPosition(Math.round(x0 + o.t * 14 + Math.sin(o.t * 9) * 2), Math.round(y0 - o.t * 22)),
          onComplete: () => g.destroy()
        });
      });
    }
  }

  /** 見逃したギャング:前へ出て口笛で仲間を呼ぶ。組が集まったら行けでまとめて吹き飛ばす */
  private async gangCall(a: Actor): Promise<void> {
    const h = this.hero;
    const person = a.person!;
    const group = currentWave(this.run).groups.find((g) => g.id === person.group);
    const spot = this.gathers.get(person.id)
      ?? { groupId: person.group!, whistlerId: person.id, x: a.x + 76, y: 192, vanX: a.x + 116, vanY: VAN_Y };
    const van = this.vans.get(spot.groupId) ?? this.addVan(spot);
    const ids = gatherMembers(group?.memberIds ?? [person.id], (id) => this.goneFromGang(id));
    const mates = ids.filter((id) => id !== person.id).map((id) => this.actorOf(id)).filter((m): m is Actor => !!m);
    const members = [a, ...mates];
    for (const m of members) m.called = true;
    // 仲間がもう倒されている(または待てで止めた)ときは、口笛を吹いても誰も来ない。組にはならない
    const alone = members.length < GANG.groupSize.min;
    const slots = this.gatherSlots(spot, members.length);
    h.play('idle');
    // カメラ:ヒーローと、集まる場所と、ワゴンが1つの画面に入るように(1人のときはワゴンに乗らないので、ヒーローについて行く)
    const half = layout.W / 2;
    const vanRight = van.x + 64;
    if (!alone) this.camFocus = Phaser.Math.Clamp((h.x + vanRight) / 2 - 8, vanRight + 6 - half, h.x - 24 + half);

    // 前へ出て、口笛
    a.showTag(true);
    a.faceLeft(false).play('walk', true, 2.4);
    this.fx('fx_dust', a.x - 6, a.y - 8, { depth: a.y });
    await this.moveTo(a, slots[0].x, slots[0].y, 480);
    a.faceLeft(false).play('mischief', true);
    audio.sfx('whistle');
    this.whistleNotes(a);
    this.opSay(mischiefLine(a.look!, this.rng), true);
    h.pose('oops', 1);
    this.heroSay(this.line('mischiefHero', this.rng), 1300);
    await this.wait(GANG.whistleSec * 1000);
    if (alone) { await this.aloneWhistle(a); return; }

    // 仲間が通りのどこからでも走ってくる(時間は GangCall が数える)
    const call = new GangCall(members.map((m) => m.person!.id));
    let done!: () => void;
    const finished = new Promise<void>((r) => { done = r; });
    this.gang = { call, members, spot, slots, van, vanX0: van.x, vanEndX: van.x, done };
    a.faceLeft(true).play('idle');
    const runs = mates.map((m, i) => {
      const s = slots[i + 1];
      m.showTag(true);
      m.faceLeft(s.x < m.x).play('walk', true, 3.2);
      const dist = Phaser.Math.Distance.Between(m.x, m.y, s.x, s.y);
      const ms = Phaser.Math.Clamp(dist / 0.26, 320, GANG.gatherSec * 1000 - 200);
      for (let k = 0; k * 130 < ms; k++) {
        this.time.delayedCall(k * 130, () => { if (m.standing) this.fx('fx_dust', m.x + (m.sprite.flipX ? 8 : -8), m.y - 6, { depth: m.y - 1 }); });
      }
      return this.moveTo(m, s.x, s.y, ms, 'Linear').then(() => {
        if (call.phase === 'gather' || call.phase === 'wait') m.faceLeft(true).play(call.phase === 'wait' ? 'sortIdle' : 'idle', true);
      });
    });
    await Promise.all(runs);
    if (call.gathered()) this.onGangPhase('wait');
    await finished;
  }

  private stepGang(ms: number): void {
    const g = this.gang;
    if (!g) return;
    for (const e of g.call.update(ms)) this.onGangPhase(e);
    if (this.gang !== g) return;
    const ph = g.call.phase;
    if (ph === 'wait' && g.count) g.count.setText(String(Math.max(1, Math.ceil(g.call.secondsToBoard ?? 0))));
    if (ph === 'drive') {
      // だんだん速くなって、画面の右へ
      const p = g.call.progress;
      const x = g.vanX0 + (g.vanEndX - g.vanX0) * p * p;
      g.van.x = x;
      g.van.sprite.setX(Math.round(x)).setFrame(1 + (Math.floor(this.frameN / 3) % 2));
      if (this.frameN % 5 === 0) this.fx('fx_dust', x - 66, g.van.y - 6, { depth: g.van.y - 1 });
    }
    if (g.mark && (ph === 'board' || ph === 'drive')) g.mark.setPosition(Math.round(g.van.x), g.van.y - 64 - 22);
  }

  private hideInVan(m: Actor): void {
    m.sprite.setVisible(false);
    m.showTag(false);
  }

  private onGangPhase(e: GangPhase): void {
    const g = this.gang;
    if (!g) return;
    const van = g.van;
    if (e === 'wait') {
      // 集まった:ヒーローのほうを向いて、指で合図。頭の上に大きな行けの合図
      // まだ走っている人は、着いたところで合図を始める(gangCall の中)
      g.members.forEach((m, i) => {
        const s = g.slots[i];
        if (m.standing && Math.abs(m.x - s.x) < 1 && Math.abs(m.y - s.y) < 1) m.faceLeft(true).play('sortIdle', true);
      });
      const cx = g.slots.reduce((s, p) => s + p.x, 0) / g.slots.length;
      const top = Math.min(...g.slots.map((p) => p.y)) - HEAD - 50;
      g.mark = this.bigMark(cx, top, 4);
      // ヒーローの吹き出しが大きな合図と札に重ならないように消す
      this.heroBubble?.destroy();
      this.heroBubble = undefined;
      this.hero.play('idle');
      g.count = new PixelText(this, Math.round(cx) + 42, Math.round(top) + 4, String(GANG.escapeSec), { size: FS.big, color: UI.gold, outline: true })
        .setOrigin(0.5, 0.5).setDepth(1200);
      this.goAlarm.start();
      // 「行けでまとめて!」が行けの使い方の代わり
      this.firstTime('go');
      this.opSay(this.line('gathered', this.rng), true);
      this.goHandler = () => this.gangGo();
    } else if (e === 'board') {
      // ワゴンに乗りこむ(乗った人は車の中に消える)
      g.count?.destroy(); g.count = undefined;
      g.mark?.destroy();
      g.mark = this.bigMark(van.x, van.y - 64 - 22, 3);
      // 乗りこむ(0.5秒)と走り出すのセリフが上書きされて読めないので、つなげて出す:
      // 「乗りこんだ」を出し終えて少し読ませてから、まだ走っていれば「走り出した!今なら行け!」
      this.opSay(this.line('board', this.rng), true);
      const seq = this.opSeq;
      this.time.delayedCall(1100, () => {
        if (this.gang === g && g.call.phase === 'drive' && this.opSeq === seq) this.opSay(this.line('drive', this.rng), true);
      });
      const doorX = van.x - 22;
      g.members.forEach((m, i) => {
        this.tweens.killTweensOf(m);
        m.faceLeft(false).play('walk', true, 3.2);
        void this.moveTo(m, doorX + i * 8, van.y + 3, GANG.boardSec * 800, 'Linear').then(() => {
          if (g.call.phase !== 'board' && g.call.phase !== 'drive') return;
          this.hideInVan(m);
          audio.sfx('hit', { pitch: 0.5, volume: 0.5 });
          van.sprite.setFrame(1);
          this.time.delayedCall(80, () => { if (g.call.phase === 'board') van.sprite.setFrame(0); });
        });
      });
    } else if (e === 'drive') {
      for (const m of g.members) { this.tweens.killTweensOf(m); this.hideInVan(m); }
      g.vanX0 = van.x;
      g.vanEndX = this.L.right + 80;
      audio.sfx('engine');
      audio.sfx('skid');
      shake(this, 2, 200);
      for (let i = 0; i < 3; i++) this.fx('fx_dust', van.x - 60 + i * 6, van.y - 4 - i * 4, { depth: van.y + 1, scale: 1.5 });
    } else if (e === 'escaped') {
      // 逃げきられた
      this.goHandler = null;
      this.goAlarm.stop();
      g.mark?.destroy(); g.mark = undefined;
      van.sprite.setVisible(false);
      van.broken = true;
      for (const m of g.members) m.destroy();
      this.stats.groupEscaped(g.call.size);
      audio.sfx('horn');
      this.opSay(this.line('vanEscaped', this.rng));
      this.hero.pose('oops', 1);
      this.time.delayedCall(900, () => { this.hero.play('idle'); this.endGang(); });
    }
  }

  private gangGo(): void {
    const g = this.gang;
    if (!g) return;
    const r = g.call.go();
    if (!r) return;
    this.goHandler = null;
    this.goAlarm.stop();
    g.count?.destroy(); g.count = undefined;
    g.mark?.destroy(); g.mark = undefined;
    audio.sfx('go');
    void (r === 'wipe' ? this.groupWipe(g) : this.vanStop(g)).then(() => this.endGang());
  }

  private endGang(): void {
    const g = this.gang;
    if (!g) return;
    this.gang = null;
    void this.hopBack(g).then(() => g.done());
  }

  /** 車を追いかけて次の人より先まで来ていたら、跳んで戻る(次の人に左から近づけるように) */
  private async hopBack(g: GangRun): Promise<void> {
    const h = this.hero;
    const i = this.queue.indexOf(g.members[0]);
    const next = this.queue.slice(i + 1).find((q) => q.standing && !q.called);
    this.camFocus = null;
    if (!next || h.x <= next.x - MARK.showDistance - 4) return;
    h.faceLeft(true).play('stomp', true);
    await this.arc(h, next.x - MARK.showDistance - 12, 34, 380, 'Sine.easeInOut');
    h.faceLeft(false).play('idle');
    await this.wait(120);
  }

  /** 行け(集まったところ):高く跳んで組の真ん中に落ち、衝撃波で全員まとめて吹き飛ばす。巻きぞえは組の中だけ */
  private async groupWipe(g: GangRun): Promise<void> {
    const h = this.hero;
    const ms = g.members.filter((m) => m.standing);
    const cx = ms.reduce((s, m) => s + m.x, 0) / Math.max(1, ms.length);
    const cy = ms.reduce((s, m) => s + m.y, 0) / Math.max(1, ms.length);
    for (const m of ms) { this.tweens.killTweensOf(m); m.pose('surprised'); }
    this.heroSay(this.line('wipe', this.rng), 1100);
    this.auraOn = true;
    await this.runTo(Math.min(...ms.map((m) => m.x)) - 44, { speed: RUN * 3.5, y: Math.round(cy) + 4 });
    h.play('stomp', true);
    audio.sfx('charge', { pitch: 1.3 });
    audio.sfx('stomp', { pitch: 1.3 });
    await this.arc(h, cx - 4, 100, 460, 'Sine.easeInOut');
    // 着地
    impact(this, 'huge');
    shake(this, 8, 700);
    hitStop(this, 180);
    audio.sfx('bigHit');
    audio.sfx('stomp');
    this.fx('fx_shockwave', cx, cy - 12, { depth: cy + 2, scale: 3 });
    this.fx('fx_shockwave', cx - 34, cy - 6, { depth: cy + 2, scale: 2, flip: true });
    this.fx('fx_shockwave', cx + 34, cy - 6, { depth: cy + 2, scale: 2 });
    this.fx('fx_dust', cx - 20, cy - 8, { depth: cy + 3, scale: 2 });
    this.fx('fx_dust', cx + 20, cy - 8, { depth: cy + 3, scale: 2 });
    ms.forEach((m, i) => {
      this.fx('fx_hit', m.x, m.y - 30, { depth: 950, scale: 2 });
      const dir = i === 0 ? -1 : 1;
      this.knock(m, 30 + i * 22, 64 + i * 18, dir);
    });
    this.stats.groupWiped(ms.length);
    // 「N人撃破!」は、吹き飛んだ人が落ちてから出す(飛んでいる人や、物が壊れた金額と重ならないように)
    this.time.delayedCall(560, () => this.pop(cx, cy - 70, `${ms.length}人撃破!`, true));
    const props = rollGroupWipeProps(this.visibleProps(), cx, this.rng).sort((p, q) => Math.abs(p.x - cx) - Math.abs(q.x - cx));
    props.forEach((p, i) => this.time.delayedCall(80 + i * 90, () => this.breakProp(p)));
    await this.wait(750);
    this.auraOn = false;
    h.play('okay', true);
    audio.sfx('okay');
    this.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    this.opSay(this.line('wipeOp', this.rng));
    await this.wait(1000);
    h.play('idle');
  }

  /** 行け(乗りこむところ、走っている間):追いついて車ごと殴って止める。組の全員がのびて出てくる */
  private async vanStop(g: GangRun): Promise<void> {
    const h = this.hero;
    const van = g.van;
    for (const m of g.members) { this.tweens.killTweensOf(m); this.hideInVan(m); }
    van.sprite.setFrame(1);
    this.heroSay(this.line('vanStop', this.rng), 1100);
    this.opSay(this.line('goOp', this.rng));
    this.camFocus = van.x - 24;
    // 光の突撃で、ワゴンの後ろに追いつく
    h.play('charge', true);
    this.auraOn = true;
    audio.sfx('charge');
    await this.wait(70);
    const toX = Math.max(h.x, van.x - 64 - 8);
    const o = { x: h.x, y: h.y };
    await new Promise<void>((resolve) => this.tweens.add({
      targets: o, x: toX, y: van.y + 12, duration: Math.max(180, (toX - h.x) / 0.8), ease: 'Quad.easeIn',
      onUpdate: () => { h.x = o.x; h.y = o.y; },
      onComplete: () => resolve()
    }));
    h.play('punch', true);
    audio.sfx('punch');
    await this.wait(110);
    // 車ごと
    van.sprite.setFrame(3);
    van.broken = true;
    audio.sfx('crash');
    audio.sfx('bigHit');
    impact(this, 'huge');
    shake(this, 8, 800);
    hitStop(this, 200);
    const vy = van.y - 30;
    this.fx('fx_hit', van.x - 54, vy, { scale: 3, depth: 960 });
    this.fx('fx_hit', van.x - 20, vy - 14, { scale: 2, depth: 960 });
    this.fx('fx_dust', van.x, vy, { scale: 3, depth: 960 });
    this.fx('fx_dust', van.x + 40, vy + 10, { scale: 2, depth: 960 });
    this.debris(van.x, vy, van.y + 8, 8, 60);
    van.x += 16;
    this.tweens.add({ targets: van.sprite, x: Math.round(van.x), duration: 260, ease: 'Quad.easeOut' });
    const cost = this.stats.vanStopped(g.call.size);
    this.pop(van.x, van.y - 66, formatYen(cost), true);
    this.smoke(van, 6000);
    this.report(sceneForProp('van'));
    // 組の全員がのびて出てくる
    g.members.forEach((m, i) => {
      if (m.state === 'gone') return;
      m.x = van.x - 8 + i * 14;
      m.y = van.y + 10 + i * 9;
      m.sprite.setVisible(true);
      m.state = 'stand';
      this.knock(m, 34 + i * 20, 44 + i * 12, i === 1 ? -1 : 1);
    });
    await this.wait(750);
    this.auraOn = false;
    this.opSay(this.line('vanStopOp', this.rng));
    h.play('okay', true);
    audio.sfx('okay');
    this.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    await this.wait(1000);
    h.play('idle');
  }

  /** 女ボスを市民に仕分けていたとき:手下のワゴンが通りを走り抜けて、まわりを壊していく(額は bossRampage に含まれる) */
  private thugVans(): void {
    const near = this.visibleProps().sort((p, q) => p.x - q.x);
    audio.sfx('horn');
    // 1台目は手前をかすめて(ヒーローが跳んでよける)、2台目は奥を走り抜ける
    [214, 150].forEach((y, i) => this.time.delayedCall(200 + i * 420, () => {
      const mine = near.filter((_, k) => k % 2 === i);
      const x0 = this.L.left - 70;
      const x1 = this.L.right + 80;
      const van = this.add.sprite(x0, y, 'prop_van', 1).setOrigin(0.5, 1).setDepth(y);
      audio.sfx('engine');
      audio.sfx(i === 0 ? 'skid' : 'horn');
      const o = { x: x0 };
      let dodged = i !== 0;
      this.tweens.add({
        targets: o, x: x1, duration: 950, ease: 'Quad.easeIn',
        onUpdate: () => {
          van.setX(Math.round(o.x)).setFrame(1 + (Math.floor(this.frameN / 3) % 2));
          if (!dodged && o.x > this.hero.x - 110) { dodged = true; void this.arc(this.hero, this.hero.x, 30, 420); }
          if (this.frameN % 4 === 0) this.fx('fx_dust', o.x - 66, y - 6, { depth: y - 1 });
          for (const p of mine) if (!p.broken && p.x <= o.x + 60) { this.breakProp(p, false); shake(this, 4, 200); }
        },
        onComplete: () => van.destroy()
      });
    }));
  }

  // ─── ステージ3:UFO ────────────────────────────
  // 見逃した宇宙人が空へ合図 → UFOが下りてくる(通りがかりの買い物客が歩いてくる) → 光で吸い上げる(UFOの上に行けの合図)。
  // 行けでヒーローが跳んでUFOを殴り落とす(真下の物が1つ壊れる。市民は巻きこまない)。押さなければ乗せて去る。
  // 時間は UfoQueue(logic/ufo.ts)が数え、段階が変わるたびに onUfo で画面を動かす。UFOは1機ずつ(流れは終わるまで待つ)。

  /** 見逃した宇宙人:UFOを呼ぶ。殴り落とすか、連れ去られたあとの動きが終わるまで待つ */
  private ufoCall(a: Actor): Promise<void> {
    return new Promise((resolve) => {
      // UFOが下りてくる所は、並べ方(plan.ts の planMall)が真下に物を置く所と同じにする
      // UFOが来ている間は、カメラを寄せてUFOを画面の UFO_SCREEN_X に見せる(終わったら戻す)
      const done = (): void => { this.camFocus = null; resolve(); };
      this.ufo = { alien: a, x: a.x + UFO_DX, bottom: 0, tractorMs: 0, done };
      this.ufos.add(a.person!.id);
    });
  }

  private stepUfo(ms: number): void {
    const u = this.ufo;
    if (!u) return;
    for (const e of this.ufos.update(ms)) this.onUfo(u, e);
    const c = this.ufos.current;
    if (this.ufo !== u || !c || !u.sprite) return;
    const p = c.progress;
    if (c.phase === 'descend') {
      // 空から、だんだんゆっくり下りてくる
      const e = 1 - (1 - p) * (1 - p);
      u.sprite.setY(Math.round(-4 + (u.bottom + 4) * e));
    }
    if (c.phase === 'descend' || c.phase === 'leave') u.sprite.setFrame(Math.floor(this.frameN / 5) % 2);
    if (c.phase === 'beam') {
      // 買い物客がじわじわ浮いていく。吸い上げる音は0.5秒ごと(続けて鳴らすとつながる)
      const s = u.shopper;
      if (s?.standing) s.lift = Math.max(0, Math.round(p * 30 + Math.sin(this.time.now / 90) * 1.5));
      // さらわれる場面の写真は、買い物客が光の中で高く浮いたところで先に撮っておく(さらわれたときだけ使う)
      if (!u.shot && p >= ABDUCT_SHOT_AT) this.shootAbduction(u);
      u.tractorMs -= ms;
      if (u.tractorMs <= 0) { u.tractorMs += 500; audio.sfx('tractor'); }
    }
    if (c.phase === 'leave') {
      // 右上へ、だんだん速く去る
      u.sprite.setPosition(Math.round(u.x + p * p * 80), Math.round(u.bottom - p * p * (u.bottom + 8)));
    }
  }

  private onUfo(u: UfoRun, e: UfoEvent): void {
    if (e.phase === 'signal') void this.ufoSignal(u);
    else if (e.phase === 'descend') this.ufoDescend(u);
    else if (e.phase === 'beam') this.ufoBeam(u);
    else if (e.phase === 'leave') this.ufoLeave(u);
    else if (e.phase === 'abducted') this.ufoAbducted(u);
  }

  /** 空へ合図:ヒーローを追い抜いて前へ出て、指を空に向ける(当たりのコマで指先が光り、光が空へのぼる) */
  private async ufoSignal(u: UfoRun): Promise<void> {
    const a = u.alien;
    const h = this.hero;
    h.play('idle');
    a.showTag(true);
    a.faceLeft(false).play('walk', true, 2.4);
    this.fx('fx_dust', a.x - 6, a.y - 8, { depth: a.y });
    await this.moveTo(a, Math.max(a.x, u.x - 26), a.y, 300);
    if (!a.standing || this.ufo !== u) return;
    a.faceLeft(false).play('mischief', true);
    this.opSay(mischiefLine(a.look!, this.rng), true);
    h.pose('oops', 1);
    this.heroSay(this.line('mischiefHero', this.rng), 1300);
    this.time.delayedCall(260, () => {
      if (!a.standing) return;
      audio.sfx('beep', { pitch: 1.4, volume: 0.6 });
      for (let i = 0; i < 4; i++) {
        this.time.delayedCall(i * 60, () => this.fx('fx_sparkle', a.x + 8, a.y - 62 - i * 22, { depth: 960, flicker: i > 0 }));
      }
    });
  }

  /** UFOが下りてくる。通りがかりの買い物客が、UFOの下へ歩いてくる */
  private ufoDescend(u: UfoRun): void {
    const a = u.alien;
    if (a.standing) a.faceLeft(false).play('idle');
    const sy = a.y < 192 ? 204 : 182;
    u.bottom = sy - UFO_HOVER;
    this.camFocus = u.x - (UFO_SCREEN_X - layout.W / 2);
    // 空から下りてくる間は人より手前に(落ちたら奥行きの順に戻す)
    u.sprite = this.add.sprite(u.x, -4, 'prop_ufo', 0).setOrigin(0.5, 1).setDepth(800);
    audio.sfx('ufoDown');
    this.opSay(this.line('ufoArrive', this.rng), true);
    // 買い物客は宇宙人と違う見た目にする(同じだと、どちらが連れ去られるのか分かりにくい)
    const look = this.rng.pick(this.def.looks.filter((l) => l !== a.look));
    const s = new Actor(this, `${look}_civ`, this.L.right + 20, sy);
    s.look = look; s.civ = true;
    s.faceLeft(true).play('walk', true);
    this.passers.push(s);
    u.shopper = s;
    void this.moveTo(s, u.x, sy, 850, 'Linear').then(() => { if (s.standing && s.lift === 0) s.play('idle'); });
    this.hero.play('idle');
  }

  /** 光で吸い上げる。UFOの上に行けの合図(初めてのときは行けの使い方を言う) */
  private ufoBeam(u: UfoRun): void {
    const s = u.shopper;
    if (s) { this.tweens.killTweensOf(s); s.x = u.x; s.pose('surprised'); }
    u.sprite?.setFrame(2).setPosition(u.x, u.bottom);
    u.beam = this.add.sprite(u.x, u.bottom - 4, 'fx_ufobeam').setOrigin(...originFor('fx_ufobeam')).setDepth((s?.y ?? u.bottom + UFO_HOVER) + 0.5);
    u.beam.play(animKey('fx_ufobeam', 'play'));
    this.flickers.add(u.beam);
    u.mark = this.bigMark(u.x, u.bottom - 32 - 18, 2);
    u.tractorMs = 0;
    // 吹き出しが大きな合図に重ならないように消す
    this.heroBubble?.destroy();
    this.heroBubble = undefined;
    this.goAlarm.start();
    this.opSay(this.firstTime('ufo') ? this.line('teachUfo') : this.line('ufoBeam', this.rng), true);
    this.goHandler = () => this.ufoGo();
  }

  /** 行けを押さなかった:買い物客と宇宙人をUFOに吸いこんで去る */
  private ufoLeave(u: UfoRun): void {
    this.goHandler = null;
    this.goAlarm.stop();
    u.mark?.destroy(); u.mark = undefined;
    u.beam?.destroy(); u.beam = undefined;
    u.sprite?.setFrame(0);
    for (const m of [u.shopper, u.alien]) {
      if (!m || !m.standing) continue;
      this.tweens.killTweensOf(m);
      m.pose('surprised');
      m.showTag(false);
      this.tweens.add({
        targets: m, x: u.x, lift: Math.max(0, m.y - u.bottom + 6), duration: 320, ease: 'Quad.easeIn',
        onComplete: () => m.sprite.setVisible(false)
      });
    }
    audio.sfx('tractor', { pitch: 1.5 });
    // いちばんひどい場面は、吸い上げている間に撮った写真を使う(このあとは必ず連れ去られる)。
    // 撮れていなければ(吸い上げの途中で止まったときなど)、今の場面を撮る
    if (!this.stats.reportScene('abducted', null)) return;
    if (u.shot === 'pending') u.wantShot = true;
    else if (u.shot) this.run.worstShot = u.shot;
    else this.time.delayedCall(90, () => this.shoot(this.abductShift(u), (img) => { this.run.worstShot = img; }));
  }

  /** さらわれる場面の写真を下へずらす幅(UFOの上の端を ABDUCT_SHOT_TOP に合わせる) */
  private abductShift(u: UfoRun): number {
    return ABDUCT_SHOT_TOP - (u.bottom - MALL_PROP_SIZE.ufo.h);
  }

  /** 吸い上げている光、UFO、浮いている買い物客を撮っておく(光は点滅しているので、撮るコマでは必ず出す) */
  private shootAbduction(u: UfoRun): void {
    u.shot = 'pending';
    this.shoot(this.abductShift(u), (img) => {
      if (u.wantShot) this.run.worstShot = img;
      else u.shot = img;
    }, u.beam ? [u.beam] : []);
  }

  /** 連れ去られた(去りきった) */
  private ufoAbducted(u: UfoRun): void {
    this.ufo = null;
    this.stats.ufoEscaped();
    u.sprite?.destroy();
    u.alien.destroy();
    u.shopper?.destroy();
    this.opSay(this.line('ufoAbducted', this.rng));
    this.hero.play('idle');
    this.time.delayedCall(600, () => u.done());
  }

  private ufoGo(): void {
    const u = this.ufo;
    if (!u || !this.ufos.go()) return;
    this.ufo = null;
    this.goHandler = null;
    this.goAlarm.stop();
    u.mark?.destroy(); u.mark = undefined;
    audio.sfx('go');
    void this.ufoDown(u).then(() => u.done());
  }

  /**
   * 行け:ヒーローが跳んでUFOを殴り落とす。UFOはその場の真下に落ち、真下の物を1つ壊す。
   * 宇宙人も一緒に倒れる(stats.ufoDowned)。買い物客は無事に下りる。落ちたUFOは市民を巻きこまない
   */
  private async ufoDown(u: UfoRun): Promise<void> {
    const h = this.hero;
    const ufo = u.sprite!;
    const s = u.shopper;
    const a = u.alien;
    // 助かった買い物客は、立ち去るまで巻きぞえや悪さの相手にしない
    if (s) {
      this.passers = this.passers.filter((p) => p !== s);
      this.safeWalkers.push(s);
    }
    this.heroSay(this.line('ufoGo', this.rng), 1000);
    this.auraOn = true;
    // UFOの横まで走って、UFOの高さまで跳ぶ
    await this.runTo(u.x - 70, { speed: RUN * 3 });
    h.play('stomp', true);
    audio.sfx('stomp', { pitch: 1.3 });
    const rise = Math.max(20, h.y - u.bottom - 6);
    const x0 = h.x;
    const up = { t: 0 };
    await new Promise<void>((resolve) => this.tweens.add({
      targets: up, t: 1, duration: 260, ease: 'Quad.easeOut',
      onUpdate: () => { h.x = x0 + (u.x - 38 - x0) * up.t; h.lift = rise * up.t; },
      onComplete: () => resolve()
    }));
    // 殴る
    h.play('punch', true);
    audio.sfx('punch');
    audio.sfx('ufoFall');
    u.beam?.destroy(); u.beam = undefined;
    ufo.setFrame(3);
    this.fx('fx_hit', u.x - 26, u.bottom - 16, { scale: 2, depth: 960 });
    this.fx('fx_hit', u.x - 8, u.bottom - 24, { depth: 960 });
    impact(this, 'big');
    hitStop(this, 120);
    // 買い物客は無事に下りて、落ちてくるUFOをよける(右へ跳ぶ)
    if (s?.standing) {
      this.tweens.killTweensOf(s);
      this.tweens.add({ targets: s, lift: 0, duration: 380, ease: 'Bounce.easeOut' });
      this.tweens.add({ targets: s, x: u.x + SHOPPER_DODGE, duration: 300, ease: 'Quad.easeOut' });
    }
    // ヒーローは着地
    const x1 = h.x;
    const down = { t: 0 };
    this.tweens.add({
      targets: down, t: 1, duration: 360, delay: 120, ease: 'Quad.easeIn',
      onUpdate: () => { h.x = x1 - 14 * down.t; h.lift = rise * (1 - down.t); },
      onComplete: () => { h.lift = 0; }
    });
    // UFOは真下に落ちる(殴ってから0.5秒ほどで、ufoFall の地面に当たる音が入る)
    await new Promise<void>((resolve) => this.tweens.add({
      targets: ufo, y: UFO_LAND_Y, duration: 480, ease: 'Quad.easeIn', onComplete: () => resolve()
    }));
    ufo.setDepth(UFO_LAND_Y);
    shake(this, 6, 400);
    this.fx('fx_dust', u.x - 18, UFO_LAND_Y - 8, { scale: 2, depth: 960 });
    this.fx('fx_dust', u.x + 18, UFO_LAND_Y - 6, { scale: 2, depth: 960 });
    this.debris(u.x, UFO_LAND_Y - 16, UFO_LAND_Y + 6, 6, 40);
    const wreck: PropObj = { kind: 'ufo', x: u.x, y: UFO_LAND_Y, wall: false, sprite: ufo, broken: true };
    this.props.push(wreck);
    this.smoke(wreck, 5000, 26);
    const cost = this.stats.ufoDowned();
    this.pop(u.x, UFO_LAND_Y - 36, formatYen(cost), true);
    // 真下の物を1つ壊す(いちばん近いもの)。壊れるのはUFOの幅の中の小さな物だけ(エスカレーターと噴水は壊さない)
    const under = this.props
      .filter((p) => !p.broken && UFO_UNDER_KINDS.includes(p.kind) && Math.abs(p.x - u.x) < UFO_HALF)
      .sort((p, q) => Math.abs(p.x - u.x) - Math.abs(q.x - u.x))[0];
    if (under) this.breakProp(under);
    // 宇宙人も一緒に倒れる(撃破は ufoDowned で数えた)
    if (a.standing) {
      this.fx('fx_hit', a.x, a.y - 30, { depth: 950 });
      this.knock(a, 28, 22, -1);
    }
    await this.wait(500);
    this.auraOn = false;
    this.opSay(this.line('ufoDowned', this.rng));
    h.play('okay', true);
    audio.sfx('okay');
    this.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    // 買い物客はほっとして、右へ歩いて去る
    if (s?.standing) {
      s.play('idle');
      void this.arc(s, s.x, 6, 220);
      this.fx('fx_sparkle', s.x, s.y - HEAD - 4, { depth: 960 });
      this.time.delayedCall(700, () => {
        if (!s.standing) return;
        s.faceLeft(false).play('walk', true);
        void this.moveTo(s, this.L.right + 40, s.y, 1600, 'Linear').then(() => s.destroy());
      });
    }
    await this.wait(900);
    h.play('idle');
  }

  // ─── タイムセールラッシュ(ステージ3の波2のあと) ─────────
  // チャイムと「タイムセール開始!」の帯 → ゲームを止めて(曲、動き、ラッシュの時計)オペレーターが説明 → ▼タップで始める。
  // ヒーローはエスカレーターの前で立ち止まり、右から8人が走ってくる。48ドット手前で待てのマーク(約1秒。ゆっくりにしない)。
  // 待てなし=光のパンチで殴る、待て=止まって通す。ちらりと決めつけは出さず、全員に「セールを荒らすなーっ!」。
  // 巻きぞえなし、物は壊れない。数え方は stats.startRush / rushHit / rushStopped(ほかの数字には入れない)。
  // 時計は update の stepRush で進める(一時停止、画面を離れたとき、ヒットストップで止まる)。早送りは切る。

  /** この波の結果発表のあとにタイムセールラッシュがあるか */
  private rushThisWave(): boolean {
    return this.def.hasRush && this.run.stage.rush !== null && currentWave(this.run).no === RUSH.afterWave;
  }

  private async saleRush(): Promise<void> {
    const plan = this.run.stage.rush!;
    const h = this.hero;
    h.faceLeft(false).play('idle');
    this.rushOn = true;
    this.fastBtn.refresh();
    // 館内放送のチャイムと帯。帯が出た瞬間にゲームを止める
    audio.stopBgm();
    audio.sfx('chime');
    // 先に止めてから帯を出す(帯が入ってくる動きは止めない)
    this.holdWorld(true);
    const band = this.saleBand();
    const seen = hasSeenRush(this.def.id);
    markRushSeen(this.def.id);
    await this.rushIntro(rushIntroFor(seen), this.time.now + RUSH.tapLockSec * 1000);
    // タップで始まる
    band.out();
    this.holdWorld(false);
    audio.playBgm(this.def.bgm.rush ?? this.def.bgm.street);
    this.stats.startRush(plan);
    const slow = settings.slowMode;
    this.rushMen = plan.runners.map((r): RushMan => ({
      r, spawnSec: slow ? rushSpawnSec(r.index, true) : r.spawnSec, state: 'wait', markSec: 0, glitchOn: false
    }));
    this.rushSec = 0;
    await new Promise<void>((resolve) => { this.rushDone = resolve; this.rushRunning = true; });
    this.rushRunning = false;
    await this.wait(400);
    this.opSay(rushEndLine(this.stats.rushTally ?? { civs: 0, civsSaved: 0 }, this.rng));
    h.play('okay', true);
    audio.sfx('okay');
    this.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    await this.wait(1700);
    this.rushOn = false;
    this.rushGuard = null;
    this.fastBtn.refresh();
  }

  /** 「タイムセール開始!」の大きな帯。タップで始めるまで出しておき、out() で左へ去る */
  private saleBand(): { out: () => void } {
    const { W } = layout;
    const bandH = 34;
    const c = this.add.container(W, 52).setDepth(1500).setScrollFactor(0);
    const g = this.add.graphics();
    g.fillStyle(UI.black, 1).fillRect(0, 0, W, bandH);
    g.fillStyle(UI.gold, 1).fillRect(0, 2, W, 2).fillRect(0, bandH - 4, W, 2);
    g.fillStyle(UI.bad, 1).fillRect(0, 5, W, 1).fillRect(0, bandH - 6, W, 1);
    const label = new PixelText(this, Math.floor(W / 2), 9, RUSH_BAND_TEXT, { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0);
    c.add([g, label]);
    const slide = (x: number, ms: number, ease: string, done?: () => void): void => {
      this.tweens.add({ targets: c, x, duration: ms, ease, onUpdate: () => { c.x = Math.round(c.x); }, onComplete: () => done?.() });
    };
    slide(0, 180, 'Cubic.easeOut');
    return { out: () => slide(-W, 160, 'Cubic.easeIn', () => c.destroy()) };
  }

  /**
   * 帯を出している間、通りの絵の動き、tween、時計の出来事を止める(on=false で動かし直す)。
   * 止めるのはこの時にあったものだけ。あとから作る帯、説明のカットインの文字送り、▼タップの点滅は動かしたまま。
   * カットインの顔はコンテナの中なので止めない
   */
  private holdWorld(on: boolean): void {
    if (on) {
      this.rushHeld = this.children.list.filter((o): o is Phaser.GameObjects.Sprite => o instanceof Phaser.GameObjects.Sprite && o.anims.isPlaying);
      for (const s of this.rushHeld) s.anims.pause();
      this.rushHeldTweens = this.tweens.getTweens().filter((t) => !t.isPaused());
      for (const t of this.rushHeldTweens) t.pause();
      // Phaser の時計には出来事の一覧を返す関数がないので、中の一覧を読む(待っている出来事も入れる)
      const clock = this.time as unknown as { _active: Phaser.Time.TimerEvent[]; _pendingInsertion: Phaser.Time.TimerEvent[] };
      this.rushHeldEvents = [...clock._active, ...clock._pendingInsertion].filter((e) => !e.paused);
      for (const e of this.rushHeldEvents) e.paused = true;
    } else {
      for (const s of this.rushHeld) if (s.active) s.anims.resume();
      for (const t of this.rushHeldTweens) if (!t.isDestroyed()) t.resume();
      for (const e of this.rushHeldEvents) e.paused = false;
      this.rushHeld = []; this.rushHeldTweens = []; this.rushHeldEvents = [];
    }
  }

  /**
   * 説明のカットイン(初めては2つ、見たことがあれば1つ)と、▼タップ。
   * 止めてから lockUntil まではタップを受けない。始めるタップは待てや行けに効かない(このあいだは合図がないので、ボタンは押せない)。
   * 一時停止のメニューの「つづける」のタップでも始まらないように、戻ってから少しの間も受けない
   */
  private async rushIntro(lines: readonly Speech[], lockUntil: number): Promise<void> {
    let lock = lockUntil;
    let tapped: (() => void) | null = null;
    const onDown = (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void => {
      if (this.time.now < lock) return;
      // 中断、音、早送りのボタンは、それぞれのボタンとして効かせる
      if (over.some((o) => o.parentContainer && this.icons.includes(o.parentContainer))) return;
      if (this.cut.isTyping) {
        // カットインを押したときは、カットインが自分で文字送りを飛ばす
        if (!over.some((o) => o.parentContainer === this.cut)) this.cut.skip();
        return;
      }
      tapped?.();
    };
    const onResume = (): void => { lock = Math.max(lock, this.time.now + RUSH.tapLockSec * 1000); };
    this.input.on('pointerdown', onDown);
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    // 説明の途中でシーンを出たとき(タイトルへ、など)も外す
    const off = (): void => {
      this.input.off('pointerdown', onDown);
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    /** タップを待つ(ms を渡すと、その時間がたっても進む) */
    const waitTap = (ms?: number): Promise<void> => new Promise((resolve) => {
      let over = false;
      const go = (): void => { if (over) return; over = true; tapped = null; resolve(); };
      tapped = go;
      if (ms !== undefined) this.time.delayedCall(ms, go);
    });
    for (let i = 0; i < lines.length; i++) {
      const sp = lines[i];
      await this.cut.say(sp.text, sp.face, { who: sp.who, alarm: sp.face === 'panic' });
      if (i < lines.length - 1) await waitTap(1200);
    }
    // ▼タップ(ゆっくり点滅)
    const { W, actionH } = layout;
    const tip = new PixelText(this, W - 6, actionH - 18, '▼タップ', { size: FS.big, color: UI.gold, outline: true })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(1500);
    const blinkEv = this.time.addEvent({ delay: 420, loop: true, callback: () => tip.setVisible(!tip.visible) });
    await waitTap();
    blinkEv.remove();
    tip.destroy();
    off();
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, off);
    audio.unlock();
  }

  private stepRush(ms: number): void {
    const dt = ms / 1000;
    this.rushSec += dt;
    const hx = this.hero.x;
    for (const m of this.rushMen) {
      if (m.state === 'wait' && this.rushSec >= m.spawnSec) this.rushSpawn(m);
      const a = m.a;
      if (!a || !a.standing) continue;
      if (m.state === 'run' || m.state === 'mark') {
        // ヒーローがエスカレーターの前をふさいでいるので、目の前で止まって、それぞれのぎこちない動き
        const stopX = hx + RUSH_BLOCK;
        if (a.x > stopX) {
          a.x = Math.max(stopX, a.x - RUSH.runSpeed * dt);
          if (a.x === stopX) a.play('sortIdle', true);
        }
        if (m.state === 'run' && a.x <= hx + RUSH.markDistance) this.rushMark(m);
        else if (m.state === 'mark' && this.rushSec - m.markSec >= RUSH.markSec) this.rushPunch(m);
      }
      // セールに夢中の宇宙人は、0.3秒に1回くずれる(体全体にノイズ)
      if (m.r.truth === 'bad') {
        const on = m.state !== 'hit' && rushGlitchShowing(this.rushSec - m.spawnSec);
        if (on && !m.glitchOn && a.x < this.L.right) audio.sfx('glitch', { volume: 0.7 });
        m.glitchOn = on;
      }
    }
    // 最後の人を殴るか通してから少しで終わる(のびた人が消える、通した人が去るのは、終わりの一言と重ねてよい)
    if (this.rushMen.every((m) => m.state === 'gone' || (m.doneSec !== undefined && this.rushSec - m.doneSec >= RUSH.settleSec))) {
      this.rushRunning = false;
      const d = this.rushDone;
      this.rushDone = null;
      d?.();
    }
  }

  /** くずれのノイズを体に合わせる(光は半透明にせず、1コマおきに点滅) */
  private syncNoise(): void {
    const on = this.frameN % 2 === 0;
    for (const m of this.rushMen) {
      const n = m.noise;
      if (!n || !m.a) continue;
      if (!n.active) { m.noise = undefined; continue; }
      const a = m.a;
      n.setPosition(Math.round(a.x), Math.round(a.y - a.lift - 28)).setDepth(a.y + 0.5);
      n.setVisible(m.glitchOn && on && a.standing && a.sprite.visible);
    }
  }

  /** 右から走ってくる */
  private rushSpawn(m: RushMan): void {
    const y = this.hero.y + this.rng.int(-3, 3);
    const a = new Actor(this, m.r.sheetKey, this.L.right + 24, y);
    a.look = m.r.look;
    a.civ = m.r.truth === 'civ';
    a.faceLeft(true).play('walk', true, 2);
    m.a = a;
    m.state = 'run';
    if (m.r.truth === 'bad') {
      m.noise = this.add.sprite(a.x, a.y - 28, 'fx_glitch').play(animKey('fx_glitch', 'play')).setVisible(false);
    }
  }

  /** 48ドット手前:待てのマーク。ヒーローは全員に同じ一言で構える(ちらりと決めつけは出さない) */
  private rushMark(m: RushMan): void {
    const a = m.a!;
    m.state = 'mark';
    m.markSec = this.rushSec;
    this.showMark(a, 'stop');
    this.stopAlarm.start();
    this.heroSay(this.line('rushMark', this.rng), 1000);
    this.hero.pose('punch', 0);
    this.auraOn = true;
    this.stopHandler = () => this.rushStop(m);
  }

  /** 待てを押さなかった:光のパンチ。巻きぞえは出さず、物も壊れない */
  private rushPunch(m: RushMan): void {
    const a = m.a!;
    const h = this.hero;
    m.state = 'hit';
    m.glitchOn = false;
    this.stopHandler = null;
    this.stopAlarm.stop();
    this.hideMark(a);
    h.play('punch', true);
    audio.sfx('punch');
    const fist = this.fx('fx_punch', h.x + 16, a.y - 30, { loop: true, depth: 900 });
    this.tweens.add({
      targets: fist, x: a.x - 4, duration: 80,
      onComplete: () => {
        fist.destroy();
        this.fx('fx_hit', a.x - 4, a.y - 30, { depth: 950 });
        this.fx('fx_hit', a.x + 4, a.y - 22, { depth: 950 });
        audio.sfx('hit');
        impact(this, 'small');
        hitStop(this, 80);
        m.noise?.destroy();
        m.noise = undefined;
        this.knock(a, 64, 26, 1);
        m.doneSec = this.rushSec;
        this.stats.rushHit(m.r.truth);
        if (m.r.truth === 'civ') {
          // 市民だった:「あれ?」と言って次へ(言いはる、ツッコミ、やっちまったーは出さない)
          this.report('civHit', 'punch');
          this.heroSay(this.line('rushCivHit', this.rng), 700);
        }
        this.auraOn = false;
        this.time.delayedCall(260, () => { if (this.rushOn && m.state === 'hit') h.play('idle'); });
        // のびた人は、少しして煙になって消える(次の人の邪魔にならないように)
        this.time.delayedCall(RUSH.goneSec * 1000, () => {
          if (a.state === 'gone') return;
          this.fx('fx_dust', a.x, a.y - 8, { depth: a.y + 1 });
          a.destroy();
          m.state = 'gone';
        });
      }
    });
  }

  /** 待て:急ブレーキで止まり、相手を通す(ヒーローの後ろを抜けて左へ走っていく) */
  private rushStop(m: RushMan): void {
    const a = m.a!;
    const h = this.hero;
    m.state = 'pass';
    m.doneSec = this.rushSec;
    this.stopHandler = null;
    this.stopAlarm.stop();
    this.hideMark(a);
    this.auraOn = false;
    h.play('stop', true);
    audio.sfx('stop');
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 60, () => this.fx('fx_brake', h.x + 6, h.y - 6, { depth: h.y + 1 }));
    this.heroSay(this.line('stop', this.rng), 800);
    this.stats.rushStopped(m.r.truth);
    if (a.civ) this.fx('fx_sparkle', a.x, a.y - HEAD - 4, { depth: 960 });
    this.time.delayedCall(250, () => {
      if (!a.standing) return;
      a.faceLeft(true).play('walk', true, 2);
      const toX = this.L.left - 30;
      void this.moveTo(a, toX, a.y + RUSH_PASS_DY, Math.max(300, ((a.x - toX) / (RUSH.runSpeed * 1.4)) * 1000), 'Linear').then(() => {
        a.destroy();
        m.noise?.destroy();
        m.noise = undefined;
        m.state = 'gone';
      });
    });
    this.time.delayedCall(RUSH.brakeSec * 1000, () => { if (this.rushOn && !this.stopHandler) h.play('idle'); });
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
    await this.wait(200);
    flash(this, 0xffffff, 2);
    a.setKey(this.def.bossSheet);
    a.shadowW = 1.8;
    a.faceLeft(this.hero.x < a.x);
    a.play('reveal', true);
    a.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => a.play('idle'));
    await this.wait(450);
  }

  /** ワルに仕分けたボス:殴りかかった瞬間に正体を現す */
  private async bossReveal(a: Actor): Promise<void> {
    const h = this.hero;
    void this.arc(h, h.x - 26, 20, 300);
    await this.revealBoss(a);
    void banner(this, 'ボス出現!', { hold: 900, y: BANNER_TOP_Y });
    this.opSay(this.line('bossReveal', this.rng), true);
    h.play('idle');
    await this.wait(900);
    this.heroSay(this.line('bossRevealHero', this.rng), 1200);
    await this.wait(1100);
    this.opSay(this.line('bossRevealOp2', this.rng));
    await this.wait(900);
    this.toBoss();
  }

  /** 市民に仕分けたボス:素通りのあと正体を現して、周りを壊して暴れる */
  private async rampage(a: Actor): Promise<void> {
    const h = this.hero;
    await this.runTo(a.x + 34, { speed: RUN * 0.8 });
    h.play('idle');
    await this.wait(200);
    this.camFocus = (a.x + h.x) / 2;
    await this.revealBoss(a);
    a.play('rampage', true);
    audio.sfx('rampage');
    const cost = this.stats.bossRampage();
    this.pop(a.x, a.y - 80, formatYen(cost), true);
    void banner(this, 'ボス出現!', { hold: 900, y: BANNER_TOP_Y });
    if (this.def.mechanic === 'gang') {
      // 地下駐車場:女ボスは手下の車をけしかける。ワゴンが通りを走り抜けて、物を壊していく
      this.thugVans();
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
    await this.wait(1400);
    audio.sfx('rampage');
    shake(this, 6, 500);
    await this.wait(1100);
    gaan.destroy();
    this.toBoss();
  }

  private toBoss(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.devLog('to boss');
    this.run.scrollX = this.L.world.scrollX;
    gotoWhenFree(this, nextAfterStreet(this.run));
  }

  private async waveClear(): Promise<void> {
    const h = this.hero;
    const last = this.queue[this.queue.length - 1];
    const rush = this.rushThisWave();
    // ラッシュのある波は、エスカレーターの前(rushX)で止まる
    if (rush && this.rushX !== null) await this.runTo(this.rushX, { y: HERO_START.y });
    else await this.runTo((last?.x ?? h.x) + 70);
    h.play('okay', true);
    this.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    audio.sfx('okay');
    await banner(this, `WAVE${this.run.waveIndex + 1} CLEAR!`, { hold: 700 });
    // 波2の結果発表が終わったあと、答え合わせの前に1回だけ
    if (rush && !this.leaving) await this.saleRush();
    if (this.leaving) return;
    this.leaving = true;
    this.devLog('wave clear');
    this.run.scrollX = this.L.world.scrollX;
    gotoWhenFree(this, nextAfterStreet(this.run));
  }

  /** 開発用:かかった時間を出す(途中から始めたときだけ) */
  private devLog(what: string): void {
    if (this.run.debug) console.info(`[street] ${what} ${(this.time.now - this.startedAt) / 1000}s`);
  }
}
