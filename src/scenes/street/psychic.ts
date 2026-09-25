// 結果発表(Street)の部品:ステージ4の念力(STAGE4「念力で運ぶ」「行けを押したとき」「押さなかったとき」)。
// 見逃したヴィランがヒーローを追い抜いて前へ出て、すぐ前の物を念力で持ち上げ、右から歩いてきた市民の上へ運ぶ。
// 行けでヒーローが跳んでヴィランを殴り、物はその場の真下に落ちる(ソファなら何も壊れない)。押さなければ市民に落ちる。
// 時間は PsyQueue(logic/psychic.ts)が数え、段階が変わるたびに onPsy で画面を動かす。念力は1回ずつ(流れは終わるまで待つ)。
// 並べ方(ヴィランが出る所、物の場所と列)は plan.ts の planTower が決める。
// Street のシーンを s として受け取り、そのシーンの道具(s.fx、s.heroSay など)を使って動かす。
// シーンの create のたびに作り直す(回をまたいで状態を持ちこまない)。
//
// 光と揺れを弱くする(settings.reduceFx)ときは、火花のまたたき、もやの入れかわり、運ばれている物の上下のゆれを止める。
// ゆっくりモード(settings.slowMode)では、運ぶ時間(行けのマークが出ている時間)を1.5倍にする。

import Phaser from 'phaser';
import { audio } from '../../audio';
import { animKey } from '../../art/sheets';
import { PSY as PSY_COLORS } from '../../art/world4/palette';
import {
  FLOOR_LOOKS, PSY, formatYen, isBigProp, planPsychic, psyCarryX, resolvePsyDrop, sceneForProp, sheetKeyFor,
  type Look, type PropKind, type PsyDrop, type PsyEvent, type PsyPlan, PsyQueue
} from '../../logic';
import { settings } from '../../settings';
import { hitStop, impact, shake, waitMs } from '../../ui';
import { Actor, HEAD } from './actor';
import { PSY_ROWS, type PsySpot } from './plan';
import type { StreetScene } from '../Street';
import { type PropObj, RUN } from './common';

/** 念力の場面の真ん中を、カメラの真ん中に(ヴィランから右へ) */
const PSY_CAM_DX = 45;
/** ヒーローがヴィランを殴る位置(ヴィランの何ドット手前まで跳ぶか) */
const PUNCH_GAP = 20;
/** 市民の頭の上の端(足から)。物が市民に落ちたときに止まる高さ */
const VICTIM_HEAD = 46;
/**
 * 市民に物が落ちる場面の写真を下へずらす幅を決める所。運ばれている物の下の端から、これだけ上を写真の y126 に合わせる
 * (共有カードは写真の y126〜196 を使う。物の下のほうと、市民の頭が帯に入る)
 */
const DROP_SHOT_ABOVE = 18;
const SHOT_BAND_TOP = 126;
/** 持ち上げた物のまわりの火花の数 */
const SPARKS = 3;

/** 念力1回ぶん(見逃したヴィラン1人ぶん)。時間は PsyQueue が数える */
export interface PsyRun {
  villain: Actor;
  spot: PsySpot;
  /** 並べ方(間の物は、まだ壊れていないものだけ) */
  plan: PsyPlan;
  /** 持ち上げる物 */
  lifted: PropObj;
  /** 間の物(plan.floor と同じ順) */
  floor: PropObj[];
  /** 通りがかりの市民(持ち上げたときに右から歩いてくる) */
  victim?: Actor;
  /** 持ち上げる前の、物の下の端の y */
  restY: number;
  /** 運ばれている物の真ん中の x と、下の端の y */
  x: number;
  y: number;
  outline?: Phaser.GameObjects.Image;
  haze?: Phaser.GameObjects.Sprite;
  sparks: Phaser.GameObjects.Sprite[];
  hand?: Phaser.GameObjects.Sprite;
  mark?: Phaser.GameObjects.Sprite;
  /** 火花を置き直すまでのミリ秒 */
  sparkMs: number;
  /** 市民に落ちる場面の写真(撮っている間は 'pending') */
  shot?: HTMLImageElement | 'pending';
  wantShot?: boolean;
  done: () => void;
}

/** 物の絵(そのコマ)のまわりに、紫の1ドットのふちを描いた絵を作る(物の絵より1ドットずつ大きい)。キーを返す */
export function psyOutlineKey(scene: Phaser.Scene, key: string, frame: number): string {
  const out = `${key}__psyline${frame}`;
  if (scene.textures.exists(out)) return out;
  const f = scene.textures.getFrame(key, frame);
  const w = f.cutWidth;
  const h = f.cutHeight;
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const sg = src.getContext('2d')!;
  sg.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, w, h, 0, 0, w, h);
  const px = sg.getImageData(0, 0, w, h).data;
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3] > 0;
  const c = scene.textures.createCanvas(out, w + 2, h + 2)!;
  const g = c.getContext();
  g.fillStyle = PSY_COLORS[1];
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) g.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  c.refresh();
  return out;
}

export class PsyPart {
  constructor(private readonly s: StreetScene) {
    this.psys = new PsyQueue({ carrySec: PSY.carrySec * settings.timeScale });
  }

  psys: PsyQueue;

  psy: PsyRun | null = null;

  /** 見逃したヴィランの id → 念力の場面(並べ方。Street の buildWorld が入れる) */
  readonly spots = new Map<string, PsySpot>();

  /** 念力の場面の物(場面が終わるまで、ふつうの攻撃で壊れない。持ち上げた物は終わったあとも) */
  readonly guarded = new Set<PropObj>();

  /** 並べ方の念力の場面を覚えて、その場面の物をふつうの攻撃から守る */
  addSpot(spot: PsySpot): void {
    this.spots.set(spot.villainId, spot);
    for (const p of this.propsOf(spot)) if (p) this.guarded.add(p);
  }

  /** 並べ方の物に当たる、通りの物(持ち上げる物、間の物の順。見つからなければ null) */
  private propsOf(spot: PsySpot): (PropObj | null)[] {
    const find = (kind: PropKind, x: number): PropObj | null => this.s.props.find((p) => p.kind === kind && p.x === x) ?? null;
    return [find(spot.plan.lift.kind, spot.plan.lift.x), ...spot.plan.floor.map((f) => find(f.kind, f.x))];
  }

  /** 見逃したヴィラン:念力で物を持ち上げて、市民の上へ運ぶ。行けで倒すか、市民に落ちたあとの動きが終わるまで待つ */
  psyCall(a: Actor): Promise<void> {
    return new Promise((resolve) => {
      const spot = this.spots.get(a.person!.id) ?? this.makeSpot(a);
      const [lifted, ...floor] = this.propsOf(spot);
      // 並べ方の物がないとき(開発用に途中から始めたときなど)は、その場に置く
      const liftObj = lifted ?? this.spawnProp(spot.plan.lift.kind, spot.plan.lift.x, PSY_ROWS.back);
      const floorObjs = spot.plan.floor.map((f, i) => floor[i] ?? this.spawnProp(f.kind, f.x, spot.floorY[i] ?? PSY_ROWS.back));
      // 前の攻撃で壊れていた物(ソファ以外)は、念力の場面の物から外す(床とみなす)
      const keep = spot.plan.floor.map((_, i) => !floorObjs[i].broken);
      const plan: PsyPlan = { ...spot.plan, floor: spot.plan.floor.filter((_, i) => keep[i]) };
      const done = (): void => {
        this.s.camFocus = null;
        for (const p of floorObjs) this.guarded.delete(p);
        resolve();
      };
      this.guarded.add(liftObj);
      for (const p of floorObjs) this.guarded.add(p);
      this.psy = {
        villain: a, spot, plan, lifted: liftObj, floor: floorObjs.filter((_, i) => keep[i]), restY: liftObj.y,
        x: liftObj.x, y: liftObj.y, sparks: [], sparkMs: 0, done
      };
      this.psys.add(a.person!.id);
    });
  }

  /** 並べ方に念力の場面がないとき(ふつうは来ない):その場で決める */
  private makeSpot(a: Actor): PsySpot {
    const plan = planPsychic(a.x + 40, [PSY.cushionProp, 'plant'], this.s.rng);
    return { villainId: a.person!.id, plan, floorY: plan.floor.map(() => PSY_ROWS.back) };
  }

  private spawnProp(kind: PropKind, x: number, y: number): PropObj {
    const sprite = this.s.add.sprite(x, y, `prop_${kind}`, 0).setOrigin(0.5, 1).setDepth(y);
    const p: PropObj = { kind, x, y, wall: false, sprite, broken: false };
    this.s.props.push(p);
    return p;
  }

  // ─── 毎フレーム ───────────────────────────────

  stepPsy(ms: number): void {
    const u = this.psy;
    if (!u) return;
    for (const e of this.psys.update(ms)) this.onPsy(u, e);
    const c = this.psys.current;
    if (this.psy !== u || !c) return;
    const p = c.progress;
    const reduce = settings.reduceFx;
    if (c.phase === 'lift') {
      // ゆっくり浮き上がる(はじめは少しためてから)
      const e = p < 0.2 ? 0 : 1 - (1 - (p - 0.2) / 0.8) ** 2;
      u.x = u.plan.lift.x;
      u.y = u.restY + (PSY_ROWS.hover - u.restY) * e;
    } else if (c.phase === 'carry') {
      u.x = psyCarryX(u.plan, p);
      u.y = PSY_ROWS.hover + (reduce ? 0 : Math.round(Math.sin(this.s.time.now / 160) * 1.5));
      // 市民に落ちる場面の写真を、運ぶ時間の終わりのほうで先に撮っておく(落ちたときだけ使う)
      if (!u.shot && c.photoDue) this.shootDrop(u);
    } else if (c.phase === 'fall') {
      // 市民の頭の上へ落ちる
      const v = u.victim;
      const to = v ? v.y - VICTIM_HEAD : PSY_ROWS.floor;
      u.x = u.plan.victimX;
      u.y = PSY_ROWS.hover + (to - PSY_ROWS.hover) * p * p;
      if (!u.shot) this.shootDrop(u);
    }
    if (c.phase === 'lift' || c.phase === 'carry' || c.phase === 'fall') {
      this.placeLifted(u);
      u.sparkMs -= ms;
      if (u.sparkMs <= 0 && !reduce) { u.sparkMs += 260; this.moveSparks(u); }
    }
  }

  /** 運ばれている物と、ふち、もや、火花、行けのマークを今の位置に合わせる */
  private placeLifted(u: PsyRun): void {
    const x = Math.round(u.x);
    const y = Math.round(u.y);
    const sp = u.lifted.sprite;
    sp.setPosition(x, y);
    u.lifted.x = x;
    u.outline?.setPosition(x, y + 1);
    u.haze?.setPosition(x, Math.round(y - sp.height / 2));
    u.mark?.setPosition(x, Math.round(y - sp.height - 20));
    if (settings.reduceFx) this.moveSparks(u, true);
  }

  /** 火花を物のまわりに置き直す(fixed なら決まった所。光と揺れを弱くするとき) */
  private moveSparks(u: PsyRun, fixed = false): void {
    const sp = u.lifted.sprite;
    const w = sp.width;
    const h = sp.height;
    u.sparks.forEach((s, i) => {
      const dx = fixed ? [-0.55, 0.55, 0.1][i % 3] * w : this.s.rng.float(-0.6, 0.6) * w;
      const dy = fixed ? [0.3, 0.6, 1.05][i % 3] * h : this.s.rng.float(0.1, 1.1) * h;
      s.setPosition(Math.round(sp.x + dx), Math.round(sp.y - dy));
    });
  }

  private onPsy(u: PsyRun, e: PsyEvent): void {
    if (e.phase === 'raise') void this.psyRaise(u);
    else if (e.phase === 'lift') this.psyLift(u);
    else if (e.phase === 'carry') this.psyCarry(u);
    else if (e.phase === 'fall') this.psyFall(u);
    else if (e.phase === 'hit') void this.psyHit(u);
  }

  /** ヴィランがヒーローを追い抜いて前へ出て、手を前に出す。右から通りがかりの市民が歩いてくる */
  private async psyRaise(u: PsyRun): Promise<void> {
    const a = u.villain;
    const h = this.s.hero;
    h.play('idle');
    a.showTag(true);
    a.faceLeft(false).play('walk', true, 2.4);
    this.s.fx('fx_dust', a.x - 6, a.y - 8, { depth: a.y });
    this.s.camFocus = u.plan.villainX + PSY_CAM_DX;
    this.walkVictim(u);
    await this.s.moveTo(a, u.plan.villainX, PSY_ROWS.villain, 300);
    if (!a.standing || this.psy !== u) return;
    a.faceLeft(false).play('mischief', true);
    h.pose('oops', 1);
    this.s.heroSay(this.s.line('mischiefHero', this.s.rng), 1300);
  }

  /** 通りがかりの市民(ヴィランと違う、その階の市民の見た目)が右から歩いてきて、市民が止まる所で止まる */
  private walkVictim(u: PsyRun): void {
    const no = this.s.run.stage.waves[this.s.run.waveIndex]?.no ?? 1;
    const looks = (FLOOR_LOOKS[no - 1] ?? FLOOR_LOOKS[0]).filter((l) => l !== u.villain.look);
    const look: Look = this.s.rng.pick(looks.length > 0 ? looks : FLOOR_LOOKS[3]);
    const v = new Actor(this.s, sheetKeyFor(look, 'civ', 'tower'), this.s.L.right + 24, PSY_ROWS.victim);
    v.look = look; v.civ = true;
    v.faceLeft(true).play('walk', true);
    this.s.passers.push(v);
    u.victim = v;
    const dist = v.x - u.plan.victimX;
    void this.s.moveTo(v, u.plan.victimX, PSY_ROWS.victim, Math.max(600, dist * 14), 'Linear')
      .then(() => { if (v.standing && this.psy === u) v.play('idle'); });
  }

  /** 物が浮き上がる。紫のふち、もや、火花を付ける */
  private psyLift(u: PsyRun): void {
    const sp = u.lifted.sprite;
    const reduce = settings.reduceFx;
    audio.sfx('psy');
    sp.setDepth(850);
    const frame = Number(sp.frame.name) || 0;
    u.outline = this.s.add.image(sp.x, sp.y + 1, psyOutlineKey(this.s, sp.texture.key, frame)).setOrigin(0.5, 1).setDepth(849.9);
    // もやは物を包む大きさに(ドットが崩れないように、整数倍で広げる)
    const sx = Math.max(2, Math.ceil((sp.width + 12) / 16));
    const sy = Math.max(2, Math.ceil((sp.height + 10) / 14));
    u.haze = this.s.add.sprite(sp.x, sp.y - sp.height / 2, 'fx_psy_haze', 0).setScale(sx, sy).setDepth(849.8);
    if (!reduce) u.haze.play(animKey('fx_psy_haze', 'play'));
    for (let i = 0; i < SPARKS; i++) u.sparks.push(this.spark(sp.x, sp.y, 850.1));
    this.moveSparks(u, reduce);
    // ヴィランの手の先にも火花
    const a = u.villain;
    u.hand = this.spark(a.x + 14, a.y - 30, a.y + 0.6);
    this.s.opSay(this.s.line('psyLift', this.s.rng), true);
  }

  /** 紫の小さな火花(光と揺れを弱くするときは、またたかずに1コマ目で止める) */
  spark(x: number, y: number, depth: number): Phaser.GameObjects.Sprite {
    const s = this.s.add.sprite(Math.round(x), Math.round(y), 'fx_psy_spark', 0).setDepth(depth);
    if (!settings.reduceFx) s.play({ key: animKey('fx_psy_spark', 'play'), startFrame: this.s.rng.int(0, 3) });
    return s;
  }

  /** 物が市民の上へ運ばれる。物の上に大きな行けのマーク(その回で初めてなら行けの使い方を言う) */
  private psyCarry(u: PsyRun): void {
    const sp = u.lifted.sprite;
    u.mark = this.s.bigMark(sp.x, sp.y - sp.height - 20, 2);
    this.s.heroBubble?.destroy();
    this.s.heroBubble = undefined;
    this.s.goAlarm.start();
    this.s.opSay(this.s.firstTime('psy') ? this.s.line('teachPsy') : this.s.line('psyCarry', this.s.rng), true);
    this.s.goHandler = () => this.psyGo();
  }

  /** 行けを押さなかった:物が市民の上に落ちる */
  private psyFall(u: PsyRun): void {
    this.s.goHandler = null;
    this.s.stopGoAlarm();
    u.mark?.destroy(); u.mark = undefined;
    u.victim?.pose('surprised');
  }

  /** 市民に落ちる場面を撮っておく(物を下へずらして、共有カードの帯に物の下のほうと市民の頭が入るように) */
  private shootDrop(u: PsyRun): void {
    u.shot = 'pending';
    const shift = SHOT_BAND_TOP - (PSY_ROWS.hover - DROP_SHOT_ABOVE);
    this.s.shoot(shift, (img) => {
      if (u.wantShot) this.s.run.worstShot = img;
      else u.shot = img;
    }, [...u.sparks, ...(u.haze ? [u.haze] : [])]);
  }

  /** 撮っておいた写真を、いちばんひどい場面の写真にする(撮れていなければ今撮る) */
  private useDropShot(u: PsyRun): void {
    if (u.shot === 'pending') u.wantShot = true;
    else if (u.shot) this.s.run.worstShot = u.shot;
    else {
      u.wantShot = true;
      this.shootDrop(u);
    }
  }

  /** 浮いていた物のふち、もや、火花を消す */
  private clearGlow(u: PsyRun): void {
    u.outline?.destroy(); u.outline = undefined;
    u.haze?.destroy(); u.haze = undefined;
    for (const s of u.sparks) s.destroy();
    u.sparks = [];
    u.hand?.destroy(); u.hand = undefined;
    u.mark?.destroy(); u.mark = undefined;
  }

  /** 押さなかった:市民はのびる。物ははずんで床に落ちるが壊れない。ヴィランは右へ走って逃げる */
  private async psyHit(u: PsyRun): Promise<void> {
    this.psy = null;
    const v = u.victim;
    const a = u.villain;
    this.clearGlow(u);
    audio.sfx('hit', { pitch: 0.7 });
    audio.sfx('thud');
    shake(this.s, 3, 200);
    this.s.stats.psyEscaped();
    if (this.s.stats.reportScene('dropped', null)) this.useDropShot(u);
    if (v?.standing) {
      this.s.fx('fx_hit', v.x, v.y - VICTIM_HEAD + 4, { depth: 960 });
      this.s.knock(v, 10, 6, -1);
    }
    this.s.opSay(this.s.line('psyHit', this.s.rng), true);
    // 物は市民の上ではずんで、横の床に落ちる(壊れない)
    void this.bounceTo(u.lifted, u.plan.victimX + 22, (v?.y ?? PSY_ROWS.victim) + 3);
    // ヴィランは右へ走って逃げる
    if (a.standing) {
      a.showTag(false);
      a.faceLeft(false).play('walk', true, 2.8);
      const escX = this.s.L.right + 60;
      this.s.tweens.add({ targets: a, x: escX, duration: Math.max(500, (escX - a.x) * 6), onComplete: () => a.destroy() });
    }
    this.s.hero.play('idle');
    await waitMs(this.s, 1200);
    u.done();
  }

  /** 物を山なりに動かして、床に置く(壊さない) */
  private bounceTo(p: PropObj, x: number, y: number): Promise<void> {
    const sp = p.sprite;
    const x0 = sp.x;
    const y0 = sp.y;
    const o = { t: 0 };
    return new Promise((resolve) => this.s.tweens.add({
      targets: o, t: 1, duration: 420, ease: 'Linear',
      onUpdate: () => {
        sp.setPosition(Math.round(x0 + (x - x0) * o.t), Math.round(y0 + (y - y0) * o.t - Math.sin(Math.PI * o.t) * 14));
      },
      onComplete: () => {
        sp.setPosition(x, y).setDepth(y);
        p.x = x; p.y = y;
        this.s.fx('fx_dust', x, y - 6, { depth: y + 1 });
        audio.sfx('thud', { pitch: 1.2, volume: 0.6 });
        resolve();
      }
    }));
  }

  /** 行け:ヒーローが跳んでヴィランを殴る。物はその場の真下に落ちる */
  private psyGo(): void {
    const u = this.psy;
    if (!u) return;
    const hit = this.psys.go();
    if (!hit) return;
    this.psy = null;
    this.s.goHandler = null;
    this.s.stopGoAlarm();
    u.mark?.destroy(); u.mark = undefined;
    audio.sfx('go');
    const drop = resolvePsyDrop(u.plan, psyCarryX(u.plan, hit.at));
    void this.psyDown(u, drop).then(() => u.done());
  }

  private async psyDown(u: PsyRun, drop: PsyDrop): Promise<void> {
    const h = this.s.hero;
    const a = u.villain;
    const v = u.victim;
    this.s.heroSay(this.s.line('psyGo', this.s.rng), 1000);
    this.s.auraOn = true;
    a.pose('surprised');
    // ヴィランの手前まで走って、跳んで殴る
    await this.s.runTo(a.x - PUNCH_GAP - 30, { speed: RUN * 3 });
    h.play('stomp', true);
    audio.sfx('stomp', { pitch: 1.3 });
    await this.s.arc(h, a.x - PUNCH_GAP, 22, 240, 'Sine.easeOut');
    h.play('punch', true);
    audio.sfx('punch');
    this.s.fx('fx_hit', a.x - 4, a.y - 30, { scale: 2, depth: 950 });
    this.s.fx('fx_hit', a.x + 4, a.y - 22, { depth: 950 });
    impact(this.s, 'big');
    hitStop(this.s, 110);
    this.s.knock(a, 34, 20, 1);
    // 念力が切れて、物がその場の真下に落ちる
    const cost = this.s.stats.psyDowned(drop);
    await this.dropAt(u, drop, cost);
    this.s.auraOn = false;
    h.play('okay', true);
    audio.sfx('okay');
    this.s.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    // 市民に落ちなかったら、落ちる音におどろいてはずみ、右へ去る
    if (v?.standing) {
      this.s.passers = this.s.passers.filter((p) => p !== v);
      this.s.safeWalkers.push(v);
      this.s.tweens.killTweensOf(v);
      v.pose('surprised');
      await this.s.arc(v, v.x, 8, 240);
      if (v.standing) {
        v.faceLeft(false).play('walk', true, 1.6);
        void this.s.moveTo(v, this.s.L.right + 40, v.y, 1500, 'Linear').then(() => v.destroy());
      }
    }
    await waitMs(this.s, 700);
    h.play('idle');
  }

  /** 物が落ちる。落ちた先で壊れたり、ソファで止まったり、市民に当たったりする(数は psyDowned で数えてある) */
  private async dropAt(u: PsyRun, drop: PsyDrop, cost: number): Promise<void> {
    const sp = u.lifted.sprite;
    const x = sp.x;
    const target = drop.target ? u.floor.find((p) => p.kind === drop.target!.kind && p.x === drop.target!.x) ?? null : null;
    const v = u.victim;
    // 落ちて止まる所(物の下の端)
    let toY: number;
    if (drop.on === 'sofa' && target) toY = target.y - 9;
    else if (drop.on === 'prop' && target) toY = target.y - target.sprite.height + 4;
    else if (drop.on === 'citizen' && v) toY = v.y - VICTIM_HEAD;
    else toY = PSY_ROWS.floor;
    this.clearGlow(u);
    await new Promise<void>((resolve) => this.s.tweens.add({
      targets: sp, y: toY, duration: Math.max(160, (toY - sp.y) * 3), ease: 'Quad.easeIn', onComplete: () => resolve()
    }));
    u.lifted.y = toY;
    if (drop.on === 'sofa' && target) {
      // ソファがふかっと沈んで受け止める。何も壊れない
      sp.setDepth(target.y + 0.5);
      audio.sfx('thud');
      this.s.tweens.add({ targets: target.sprite, scaleY: 0.86, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      this.s.tweens.add({ targets: sp, y: toY + 2, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      this.s.fx('fx_sparkle', x, toY - sp.height, { depth: 960 });
      this.s.pop(x, toY - sp.height - 4, formatYen(0));
      this.s.opSay(this.s.line('psySofa', this.s.rng), true);
    } else if (drop.on === 'citizen' && v) {
      // 押すのが遅れて、市民の真上だった。ヴィランは倒れたが、市民に当たる(物は壊れない)
      audio.sfx('hit', { pitch: 0.7 });
      audio.sfx('thud');
      shake(this.s, 3, 200);
      if (this.s.stats.reportScene('dropped', null)) this.useDropShot(u);
      if (v.standing) {
        this.s.fx('fx_hit', v.x, v.y - VICTIM_HEAD + 4, { depth: 960 });
        this.s.knock(v, 10, 6, -1);
      }
      this.s.opSay(this.s.line('psyHit', this.s.rng), true);
      await this.bounceTo(u.lifted, u.plan.victimX + 22, v.y + 3);
    } else {
      // ほかの物の上か床:落ちた物が壊れる(ほかの物の上なら、その物も)
      const bigOne = drop.broken.some(isBigProp);
      audio.sfx(bigOne ? 'smash' : 'break');
      if (target) this.s.breakProp(target, false);
      this.s.breakProp(u.lifted, false);
      // 壊れた物は床へ(落ちた先の物の手前)
      if (target) {
        const fy = target.y + 2;
        this.s.tweens.add({ targets: sp, y: fy, duration: 160, ease: 'Quad.easeIn', onComplete: () => sp.setDepth(fy) });
        u.lifted.y = fy;
      } else sp.setDepth(toY);
      if (cost > 0) this.s.pop(x, toY - 24, formatYen(cost), bigOne);
      // 大きな物(水槽、ピアノ)が壊れたら「ビルがこわれた!」
      for (const k of drop.broken) this.s.report(sceneForProp(k));
      this.s.opSay(this.s.line('psyBroke', this.s.rng), true);
    }
    await waitMs(this.s, 500);
  }

  // ─── 親玉が暴れる ─────────────────────────────

  /**
   * 市民に仕分けた親玉が正体を現したあと:会場の家具を念力で浮かせて、窓の外(右上)へ投げる。
   * 被害額は bossRampage の¥2,000万に含まれている(ここでは数えない)
   */
  flingFurniture(boss: Actor): void {
    const near = this.s.props
      .filter((p) => !p.broken && !p.wall && Math.abs(p.x - boss.x) < 150)
      .sort((p, q) => Math.abs(p.x - boss.x) - Math.abs(q.x - boss.x));
    audio.sfx('psy');
    near.forEach((p, i) => this.s.time.delayedCall(150 + i * 220, () => this.fling(p, i)));
  }

  private fling(p: PropObj, i: number): void {
    if (p.broken) return;
    p.broken = true;
    this.guarded.delete(p);
    const sp = p.sprite;
    const frame = Number(sp.frame.name) || 0;
    const line = this.s.add.image(sp.x, sp.y + 1, psyOutlineKey(this.s, sp.texture.key, frame)).setOrigin(0.5, 1);
    const s = this.spark(sp.x, sp.y - sp.height / 2, 961);
    sp.setDepth(900 + i * 0.1);
    line.setDepth(sp.depth - 0.01);
    const x0 = sp.x;
    const y0 = sp.y;
    const rise = 24 + (i % 3) * 8;
    const spin = settings.reduceFx ? 0 : (i % 2 === 0 ? 1 : -1) * 0.8;
    const o = { t: 0 };
    audio.sfx('psy', { pitch: 1 + (i % 3) * 0.15, volume: 0.5 });
    this.s.tweens.add({
      targets: o, t: 1, duration: 1500, ease: 'Linear',
      onUpdate: () => {
        // はじめの3割で浮き上がり、そのあと右上の窓の外へ飛んでいく
        const up = Math.min(1, o.t / 0.3);
        const fly = Math.max(0, (o.t - 0.3) / 0.7);
        const x = x0 + fly * fly * 260;
        const y = y0 - rise * (1 - (1 - up) ** 2) - fly * fly * 90;
        sp.setPosition(Math.round(x), Math.round(y)).setRotation(spin * fly);
        line.setPosition(sp.x, sp.y + 1).setRotation(sp.rotation);
        s.setPosition(Math.round(x), Math.round(y - sp.height / 2));
      },
      onComplete: () => { sp.setVisible(false); line.destroy(); s.destroy(); }
    });
  }
}
