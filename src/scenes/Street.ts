// 結果発表。仕分けが終わった波の人たちが並ぶ路地裏を、ヒーローが右へ進みながら、仕分け通りにハデに動く。
// 入口:Sort から(run.waveIndex の波)。出口:波の最後まで来たら nextAfterStreet(run)。
// 波3ではボスの前まで来たら、正体を現す場面を見せて Boss へ(run.scrollX に背景の位置を入れる)。
//
// 画面:上のアクション部分はカメラ world(ヒーローについて動く)、下の操作部分はカメラ ui(street/layers.ts)。
// 流れは run() の async の中で1人ずつ進める。待つのはシーンの時計(this.time)なので、ヒットストップと一時停止で止まる。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey } from '../art/sheets';
import { accessorySheet } from '../art/recolor';
import {
  GANG, GangCall, MARK, MISCHIEF_BY_LOOK, MISCHIEF_HURTS_CIV, canStop, formatYen, gatherMembers, isAttacked, mischiefLine, pickAttack,
  resolveEncounter, rollCivHit, rollGroupWipeProps, rollPropsBroken, say, sceneForCivHit, sceneForProp, shout, tsukkomi,
  type AnyReactionKey, type AttackKind, type Encounter, type GangPhase, type Look, type PropKind, type ReactionKey, type Rng, type Speech,
  type StageDef, type StatsTracker, type WorstScene
} from '../logic';
import { currentWave, fillUnsorted, getRun, nextAfterStreet, type GameRun } from '../run';
import {
  Bubble, Button, CutIn, EdgeAlarm, FS, IconButton, MuteButton, PauseControl, PixelText, Tag, WindowFrame, addPanel,
  UIX, banner, flash, gotoWhenFree, hitStop, impact, isFrozen, panelRect, popText, shake, whenNoFlash
} from '../ui';
import { Actor, HEAD } from './street/actor';
import { Layers } from './street/layers';
import { HERO_START, VAN_Y, planGarage, planStreet, type GatherSpot } from './street/plan';
import { snapshotLogical } from '../hires';

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

  constructor() { super(SCENES.street); }

  create(): void {
    this.run = getRun(this);
    this.def = this.run.stage.def;
    this.stats = this.run.stats;
    this.rng = this.run.rng;
    fillUnsorted(this.run);
    this.queue = []; this.passers = []; this.props = []; this.bgs = []; this.icons = [];
    this.flickers = new Set();
    this.walker = null; this.slow = 1; this.stopHandler = null; this.goHandler = null;
    this.heroBubble = undefined; this.pops = []; this.opSeq = 0; this.frameN = 0; this.civHits = []; this.civCried = null; this.leaving = false;
    this.shownDamage = this.stats.damage; this.shown = { defeated: -1, hurt: -1, damage: '' };
    this.auraOn = false;
    this.camFocus = null;
    this.gathers = new Map(); this.vans = new Map(); this.stoppedIds = new Set(); this.gang = null;
    const fa = new URLSearchParams(location.search).get('attack');
    this.forceAttack = this.run.debug && (fa === 'charge' || fa === 'punch' || fa === 'stomp' || fa === 'special') ? fa : null;

    this.startedAt = this.time.now;
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
    const plan = this.def.hasGangs
      ? planGarage(wave.people, passBad, this.def.props, this.rng)
      : planStreet(wave.people, passBad, this.rng);

    for (const p of plan.props) {
      const key = `prop_${p.kind}`;
      const sprite = this.add.sprite(p.x, p.y, key, 0);
      const origin = p.wall ? [0.5, 0.5] : [0.5, 1];
      sprite.setOrigin(origin[0], origin[1]).setDepth(p.wall ? -15 : p.y);
      this.props.push({ ...p, sprite, broken: false });
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
      const dt = Math.min(delta, 50) / 1000;
      this.stepWalker(dt);
      if (this.gang) this.stepGang(Math.min(delta, 50));
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
    this.hero.sync();
    this.syncBubble();
    this.updateHud();
    this.updateButtons();
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
    const y = Math.round(this.hero.y - this.hero.lift - HEAD - 2);
    if (b.x !== x || b.y !== y) b.pointTo(x, y);
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
    if (this.stopBtn.isEnabled !== st) this.stopBtn.setEnabled(st);
    if (this.goBtn.isEnabled !== go) this.goBtn.setEnabled(go);
    // 押せるときはボタンを光らせて急がせる
    if (this.frameN % 6 === 0) {
      const lit = this.frameN % 12 === 0;
      if (st) this.stopBtn.setColor(lit ? 0xfff2b0 : UI.stop);
      if (go) this.goBtn.setColor(lit ? 0xff6a50 : UI.go);
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

  private heroSay(sp: Speech | string, ms = 1200): void {
    const text = typeof sp === 'string' ? sp : sp.text;
    this.heroBubble?.destroy();
    const x = this.L.screenX(this.hero.x) + 6;
    const y = this.hero.y - this.hero.lift - HEAD - 2;
    // 画面の座標で置く(Bubble は画面の端からはみ出ないようにずれるため)。札より手前、合図より奥(合図を隠さないように)
    this.heroBubble = new Bubble(this, x, y, text, { tail: 'down-left', life: ms });
    this.heroBubble.setScrollFactor(0).setDepth(1100);
  }

  private opSay(sp: Speech, alarm = false): void {
    this.opSeq++;
    void this.cut.say(sp.text, sp.face, { who: sp.who, alarm });
  }

  /** いちばんひどい場面なら、アクション部分を撮っておく。attack はその場面を起こした技(説明の文を変えるため) */
  private report(scene: WorstScene | null, attack: AttackKind | null = null): void {
    if (!scene || !this.stats.reportScene(scene, attack)) return;
    const icons = this.icons as unknown as Phaser.GameObjects.Components.Visible[];
    // 当たった相手が吹っ飛び始めたところを撮る(ヒットストップのあと少しして)。
    // 画面全体の光(flash)が出ているコマは真っ白に写るので、光が消えるまで待つ
    this.time.delayedCall(90, () => whenNoFlash(this, () => {
      if (!this.sys.isActive()) return;
      for (const i of icons) i.setVisible(false);
      snapshotLogical(this.game, 0, 0, layout.W, layout.actionH, (img) => {
        this.run.worstShot = img;
      });
      // 撮影はこのフレームの描画で行われるので、次のフレームでアイコンを戻す
      this.time.delayedCall(0, () => { for (const i of icons) i.setVisible(true); });
    }));
  }

  private showMark(a: Actor, kind: 'stop' | 'go'): void {
    a.mark?.destroy();
    a.mark = this.add.sprite(a.x, a.y, kind === 'stop' ? 'fx_mark_stop' : 'fx_mark_go')
      .play(animKey(kind === 'stop' ? 'fx_mark_stop' : 'fx_mark_go', 'play')).setScale(2).setDepth(1200);
    a.markKind = kind;
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
    a.markKind = undefined;
  }

  /** 画面に見えている、まだ壊れていない物 */
  private visibleProps(): PropObj[] {
    const l = this.L.left - 8;
    const r = this.L.right + 8;
    // ギャングのワゴンはふつうの攻撃では壊れない(組が乗って逃げる車)
    return this.props.filter((p) => !p.broken && p.kind !== 'van' && p.x >= l && p.x <= r);
  }

  /** 巻きぞえになりうる市民(画面の中で立っている人) */
  private civsNear(except: Actor): Actor[] {
    const l = this.L.left - 8;
    const r = this.L.right + 8;
    return [...this.queue, ...this.passers].filter((a) => a !== except && a.civ && a.standing && a.x >= l && a.x <= r);
  }

  // ─── 流れ ─────────────────────────────────────

  private async play(): Promise<void> {
    void banner(this, `WAVE${this.run.waveIndex + 1} 結果発表`, { hold: 600 });
    this.opSay(this.line('sortDone', this.rng));
    // 「仕分け完了!」がずっと残らないように、ほかのセリフが出ていなければ少ししてオペレーターの一言に替える
    const seq = this.opSeq;
    this.time.delayedCall(2600, () => { if (this.opSeq === seq && !this.leaving) this.opSay(this.line('streetWatch')); });
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

  /** 殴りに行く相手:48ドット手前で合図、ゆっくりになって、待てが効く。押さなければ技を出す */
  private async attackEncounter(a: Actor, enc: Encounter): Promise<boolean> {
    await this.runTo(a.x - MARK.showDistance, { y: this.laneFor(a) });
    this.showMark(a, 'stop');
    this.stopAlarm.start();
    this.slow = MARK.slowmo;
    this.hero.sprite.anims.timeScale = MARK.slowmo;
    const k = this.pickAttack();
    const res = await this.markWindow(a, enc, k);
    this.stopAlarm.stop();
    this.slow = 1;
    this.hero.sprite.anims.timeScale = 1;
    this.hideMark(a);
    this.auraOn = false;
    if (res === 'stop') { await this.doStop(a); return false; }
    if (enc === 'bossFight') {
      await this.attack(a, k, 'reveal');
      await this.bossReveal(a);
      return true;
    }
    await this.attack(a, k, enc === 'hitCiv' ? 'civ' : 'bad');
    await this.afterAttack(k);
    return false;
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

  /** 技を出す前のため。叫びもここで(まだ待てが効く) */
  private windup(k: AttackKind): void {
    const h = this.hero;
    h.sprite.anims.timeScale = 1;
    if (k === 'charge') h.pose('charge', 0);
    else if (k === 'stomp') h.pose('stomp', 0);
    else if (k === 'special') h.pose('special', 2);
    else h.pose('punch', 0);
    this.auraOn = true;
    this.heroSay(shout(k, this.rng), 1300);
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
    this.opSay(this.line('stopOp', this.rng));
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
    const stopAt = props[0];
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
    if (p.broken) return;
    p.broken = true;
    p.sprite.setFrame(1);
    const cy = p.wall ? p.y : p.y - p.sprite.height / 2;
    const groundY = p.wall ? 150 : p.y;
    this.fx('fx_dust', p.x, cy, { depth: 960, scale: p.kind === 'car' || p.kind === 'pillar' ? 2 : 1 });
    this.debris(p.x, cy, groundY);
    audio.sfx('break');
    const bigOne = p.kind === 'car' || p.kind === 'vending' || p.kind === 'pillar';
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

  /** 殴ったあと:市民に当たっていたら「やっちまったー!」→「まあいいか!」→ツッコミ。ワルだけならほめる */
  private async afterAttack(k: AttackKind): Promise<void> {
    const hits = this.civHits;
    this.civHits = [];
    const cried = this.civCried;
    this.civCried = null;
    if (hits.length === 0) {
      this.opSay(this.line('hitBad', this.rng));
      if (this.rng.chance(0.5)) this.heroSay(this.line('hitBadHero', this.rng), 900);
      this.hero.play('idle');
      await this.wait(420);
      return;
    }
    let line: Speech | null = null;
    if (hits.some((h) => h.look === 'granny')) line = this.line('grannyHit', this.rng);
    else if (k === 'special') line = this.line('specialOnCiv', this.rng);
    else if (hits.some((h) => h.collateral)) line = this.line('collateral', this.rng);
    // 当たった瞬間にもう同じ種類の一言を出していたら、言い直さない
    if (cried === this.civLineKey(k, hits)) line = null;
    const first = this.stats.heroMistakes - hits.length === 0;
    await this.oops(line, first);
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
      if (this.def.hasGangs && a.person?.group) await this.gangCall(a);
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

    // 行けの合図
    this.opSay(mischiefLine(look, this.rng), true);
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

  /** 壊れた車から、しばらく黒い煙が上がる */
  private smoke(van: PropObj, ms: number): void {
    const until = this.time.now + ms;
    const ev = this.time.addEvent({
      delay: 240, loop: true, callback: () => {
        if (this.time.now > until || !van.sprite.active) { ev.remove(); return; }
        const x0 = van.sprite.x + this.rng.int(-30, 20);
        const y0 = van.y - 50;
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
    if (this.def.hasGangs) {
      // 地下駐車場:女ボスは手下の車をけしかける。ワゴンが通りを走り抜けて、物を壊していく
      this.thugVans();
    } else {
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
    await this.runTo((last?.x ?? h.x) + 70);
    h.play('okay', true);
    this.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    audio.sfx('okay');
    await banner(this, `WAVE${this.run.waveIndex + 1} CLEAR!`, { hold: 700 });
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
