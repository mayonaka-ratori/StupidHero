// 結果発表(Street)の部品:ステージ3のUFO(見逃した宇宙人が空へ合図し、UFOが買い物客を吸い上げる。行けで殴り落とす)。
// Street のシーンを s として受け取り、そのシーンの道具(s.fx、s.heroSay など)を使って動かす。
// シーンの create のたびに作り直す(回をまたいで状態を持ちこまない)。
//
// 流れ:見逃した宇宙人が空へ合図 → UFOが下りてくる(通りがかりの買い物客が歩いてくる) → 光で吸い上げる(UFOの上に行けの合図)。
// 行けでヒーローが跳んでUFOを殴り落とす(真下の物が1つ壊れる。市民は巻きこまない)。押さなければ乗せて去る。
// 時間は UfoQueue(logic/ufo.ts)が数え、段階が変わるたびに onUfo で画面を動かす。UFOは1機ずつ(流れは終わるまで待つ)。

import Phaser from 'phaser';
import { layout } from '../../layout';
import { audio } from '../../audio';
import { animKey, originFor } from '../../art/sheets';
import { UfoQueue, formatYen, mischiefLine, MALL_PROP_SIZE, type UfoEvent } from '../../logic';
import { HermiteSparks, hitStop, impact, shake, waitMs } from '../../ui';
import { Actor, HEAD } from './actor';
import { UFO_DX, UFO_HALF, UFO_UNDER_KINDS } from './plan';
import type { StreetScene } from '../Street';
import { type PropObj, RUN } from './common';

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

/** ステージ3:来ているUFO1機(宇宙人の合図から、殴り落とす・連れ去られるまで)。時間は UfoQueue が数える */
export interface UfoRun {
  alien: Actor;
  /** フリープレイ:待てで止めた宇宙人が呼んだUFO(落とすと取り返し) */
  recovered?: boolean;
  /** 連れ去られそうになる通りがかりの買い物客(UFOが下りてくるときに歩いてくる) */
  shopper?: Actor;
  /** UFOの真ん中の x と、止まっているときの下の端の y */
  x: number;
  bottom: number;
  sprite?: Phaser.GameObjects.Sprite;
  beam?: Phaser.GameObjects.Sprite;
  /** 吸い上げる光の中を、UFOの口へ吸いこまれていく光の粒 */
  sparks?: HermiteSparks;
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

export class UfoPart {
  /** フリープレイでは、吸い上げの長さをゆっくりモードに合わせる(s.free を決めたあとに作る) */
  constructor(private readonly s: StreetScene) {
    this.ufos = this.newQueue();
  }

  ufos: UfoQueue;

  ufo: UfoRun | null = null;

  /** 行けのマークの前ぶれの間か(宇宙人が合図を送ってから、UFOが下りてくるまで。フリープレイが見る) */
  get goWarning(): boolean {
    const ph = this.ufo ? this.ufos.current?.phase : undefined;
    return ph === 'signal' || ph === 'descend';
  }

  private newQueue(): UfoQueue {
    return new UfoQueue(this.s.free ? { beamSec: this.s.free.timing.ufoBeamSec } : {});
  }

  /**
   * 見逃した宇宙人:UFOを呼ぶ。殴り落とすか、連れ去られたあとの動きが終わるまで待つ。
   * recovered はフリープレイだけ:待てで止めた宇宙人が呼んだUFO(落とすと取り返し)
   */
  ufoCall(a: Actor, recovered = false): Promise<void> {
    // フリープレイ:UFOは1機ずつ(ヒーローが待つ)なので、呼ぶたびに今のゆっくりモードの吸い上げの長さで作り直す
    if (this.s.free && this.ufos.idle) this.ufos = this.newQueue();
    return new Promise((resolve) => {
      // UFOが下りてくる所は、並べ方(plan.ts の planMall)が真下に物を置く所と同じにする
      // UFOが来ている間は、カメラを寄せてUFOを画面の UFO_SCREEN_X に見せる(終わったら戻す)
      const done = (): void => { this.s.camFocus = null; resolve(); };
      this.ufo = { alien: a, x: a.x + UFO_DX, bottom: 0, tractorMs: 0, done, recovered };
      this.ufos.add(a.person!.id);
    });
  }

  stepUfo(ms: number): void {
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
    if (c.phase === 'descend' || c.phase === 'leave') u.sprite.setFrame(Math.floor(this.s.frameN / 5) % 2);
    if (c.phase === 'beam') {
      // 買い物客がじわじわ浮いていく。吸い上げる音は0.5秒ごと(続けて鳴らすとつながる)
      const s = u.shopper;
      if (s?.standing) s.lift = Math.max(0, Math.round(p * 30 + Math.sin(this.s.time.now / 90) * 1.5));
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
    const h = this.s.hero;
    h.play('idle');
    a.showTag(true);
    a.faceLeft(false).play('walk', true, 2.4);
    this.s.fx('fx_dust', a.x - 6, a.y - 8, { depth: a.y });
    await this.s.moveTo(a, Math.max(a.x, u.x - 26), a.y, 300);
    if (!a.standing || this.ufo !== u) return;
    a.faceLeft(false).play('mischief', true);
    this.s.opSay(mischiefLine(a.look!, this.s.rng), true);
    h.pose('oops', 1);
    this.s.heroSay(this.s.line('mischiefHero', this.s.rng), 1300);
    this.s.time.delayedCall(260, () => {
      if (!a.standing) return;
      audio.sfx('beep', { pitch: 1.4, volume: 0.6 });
      for (let i = 0; i < 4; i++) {
        this.s.time.delayedCall(i * 60, () => this.s.fx('fx_sparkle', a.x + 8, a.y - 62 - i * 22, { depth: 960, flicker: i > 0 }));
      }
    });
  }

  /** UFOが下りてくる。通りがかりの買い物客が、UFOの下へ歩いてくる */
  private ufoDescend(u: UfoRun): void {
    const a = u.alien;
    if (a.standing) a.faceLeft(false).play('idle');
    const sy = a.y < 192 ? 204 : 182;
    u.bottom = sy - UFO_HOVER;
    this.s.camFocus = u.x - (UFO_SCREEN_X - layout.W / 2);
    // 空から下りてくる間は人より手前に(落ちたら奥行きの順に戻す)
    u.sprite = this.s.add.sprite(u.x, -4, 'prop_ufo', 0).setOrigin(0.5, 1).setDepth(800);
    audio.sfx('ufoDown');
    this.s.opSay(this.s.line('ufoArrive', this.s.rng), true);
    // フリープレイ:並べ方がUFOの真下に置いた通りがかりの市民がいれば、その人がねらわれる
    const here = this.s.free?.ufoVictim(u.x);
    if (here) {
      u.shopper = here;
      here.faceLeft(a.x < here.x);
      this.s.hero.play('idle');
      return;
    }
    // 買い物客は宇宙人と違う見た目にする(同じだと、どちらが連れ去られるのか分かりにくい)
    let s: Actor;
    if (this.s.free) s = this.s.free.makePasser(this.s.L.right + 20, sy);
    else {
      const look = this.s.rng.pick(this.s.def.looks.filter((l) => l !== a.look));
      s = new Actor(this.s, `${look}_civ`, this.s.L.right + 20, sy);
      s.look = look; s.civ = true;
      s.faceLeft(true);
      this.s.passers.push(s);
    }
    s.play('walk', true);
    u.shopper = s;
    void this.s.moveTo(s, u.x, sy, 850, 'Linear').then(() => { if (s.standing && s.lift === 0) s.play('idle'); });
    this.s.hero.play('idle');
  }

  /** 光で吸い上げる。UFOの上に行けの合図(初めてのときは行けの使い方を言う) */
  private ufoBeam(u: UfoRun): void {
    const s = u.shopper;
    if (s) { this.s.tweens.killTweensOf(s); s.x = u.x; s.pose('surprised'); }
    u.sprite?.setFrame(2).setPosition(u.x, u.bottom);
    u.beam = this.s.add.sprite(u.x, u.bottom - 4, 'fx_ufobeam').setOrigin(...originFor('fx_ufobeam')).setDepth((s?.y ?? u.bottom + UFO_HOVER) + 0.5);
    u.beam.play(animKey('fx_ufobeam', 'play'));
    this.s.flickers.add(u.beam);
    // 光の粒が買い物客の足と胴のあたりから出て、左右に大きくふくらんでから、UFOの口へ下からまっすぐ吸いこまれる。
    // 顔のあたりからは出さない(顔にかけない)。色は宇宙人の黄緑から白(UFOの光なので使ってよい)。
    // いちばん暗い黄緑(0x49b600)は光のふちの色と同じで見分けにくいので使わない。
    // 行き先はUFOの絵の今の位置(去っていくUFOにも吸いこまれる)
    u.sparks = new HermiteSparks(this.s, {
      from: () => {
        const sh = u.shopper?.standing ? u.shopper : null;
        const feet = sh ? sh.y - sh.lift : u.bottom + UFO_HOVER;
        return { x: (sh?.x ?? u.x) + (Math.random() * 2 - 1) * 6, y: feet - 4 - Math.random() * 30 };
      },
      to: () => (u.sprite?.active ? { x: u.sprite.x, y: u.sprite.y - 3 } : { x: u.x, y: u.bottom - 3 }),
      depth: (s?.y ?? u.bottom + UFO_HOVER) + 0.6,
      colors: [0x92ff00, 0xdbff92, 0xffffff], rate: 60, bulge: 260, pull: 110
    });
    u.mark = this.s.bigMark(u.x, u.bottom - 32 - 18, 2);
    u.tractorMs = 0;
    // 吹き出しが大きな合図に重ならないように消す
    this.s.heroBubble?.destroy();
    this.s.heroBubble = undefined;
    this.s.goAlarm.start();
    this.s.opSay(this.s.firstTime('ufo') ? this.s.line('teachUfo') : this.s.line('ufoBeam', this.s.rng), true);
    this.s.free?.goMarkShown();
    this.s.goHandler = () => this.ufoGo();
  }

  /** 行けを押さなかった:買い物客と宇宙人をUFOに吸いこんで去る */
  private ufoLeave(u: UfoRun): void {
    this.s.goHandler = null;
    this.s.stopGoAlarm();
    u.mark?.destroy(); u.mark = undefined;
    u.beam?.destroy(); u.beam = undefined;
    // 出ている粒は、そのままUFOに吸いこまれて消える
    u.sparks?.stop(); u.sparks = undefined;
    u.sprite?.setFrame(0);
    for (const m of [u.shopper, u.alien]) {
      if (!m || !m.standing) continue;
      this.s.tweens.killTweensOf(m);
      m.pose('surprised');
      m.showTag(false);
      this.s.tweens.add({
        targets: m, x: u.x, lift: Math.max(0, m.y - u.bottom + 6), duration: 320, ease: 'Quad.easeIn',
        onComplete: () => m.sprite.setVisible(false)
      });
    }
    audio.sfx('tractor', { pitch: 1.5 });
    // いちばんひどい場面は、吸い上げている間に撮った写真を使う(このあとは必ず連れ去られる)。
    // 撮れていなければ(吸い上げの途中で止まったときなど)、今の場面を撮る
    if (!this.s.stats.reportScene('abducted', null)) return;
    if (u.shot === 'pending') u.wantShot = true;
    else if (u.shot) this.s.run.worstShot = u.shot;
    else this.s.time.delayedCall(90, () => this.s.shoot(this.abductShift(u), (img) => { this.s.run.worstShot = img; }));
  }

  /** さらわれる場面の写真を下へずらす幅(UFOの上の端を ABDUCT_SHOT_TOP に合わせる) */
  private abductShift(u: UfoRun): number {
    return ABDUCT_SHOT_TOP - (u.bottom - MALL_PROP_SIZE.ufo.h);
  }

  /** 吸い上げている光、UFO、浮いている買い物客を撮っておく(光は点滅しているので、撮るコマでは必ず出す) */
  private shootAbduction(u: UfoRun): void {
    u.shot = 'pending';
    this.s.shoot(this.abductShift(u), (img) => {
      if (u.wantShot) this.s.run.worstShot = img;
      else u.shot = img;
    }, u.beam ? [u.beam] : []);
  }

  /** 連れ去られた(去りきった) */
  private ufoAbducted(u: UfoRun): void {
    this.ufo = null;
    this.s.stats.ufoEscaped();
    this.s.free?.ufoEscaped(u.alien.look);
    u.sprite?.destroy();
    u.alien.destroy();
    u.shopper?.destroy();
    this.s.opSay(this.s.line('ufoAbducted', this.s.rng));
    this.s.hero.play('idle');
    this.s.time.delayedCall(600, () => u.done());
  }

  private ufoGo(): void {
    const u = this.ufo;
    if (!u || !this.ufos.go()) return;
    this.ufo = null;
    this.s.goHandler = null;
    this.s.stopGoAlarm();
    u.mark?.destroy(); u.mark = undefined;
    audio.sfx('go');
    void this.ufoDown(u).then(() => u.done());
  }

  /**
   * 行け:ヒーローが跳んでUFOを殴り落とす。UFOはその場の真下に落ち、真下の物を1つ壊す。
   * 宇宙人も一緒に倒れる(stats.ufoDowned)。買い物客は無事に下りる。落ちたUFOは市民を巻きこまない
   */
  private async ufoDown(u: UfoRun): Promise<void> {
    const h = this.s.hero;
    const ufo = u.sprite!;
    const s = u.shopper;
    const a = u.alien;
    // 助かった買い物客は、立ち去るまで巻きぞえや悪さの相手にしない
    if (s) {
      this.s.passers = this.s.passers.filter((p) => p !== s);
      this.s.safeWalkers.push(s);
    }
    this.s.heroSay(this.s.line('ufoGo', this.s.rng), 1000);
    this.s.auraOn = true;
    // UFOの横まで走って、UFOの高さまで跳ぶ
    await this.s.runTo(u.x - 70, { speed: RUN * 3 });
    h.play('stomp', true);
    audio.sfx('stomp', { pitch: 1.3 });
    const rise = Math.max(20, h.y - u.bottom - 6);
    const x0 = h.x;
    const up = { t: 0 };
    await new Promise<void>((resolve) => this.s.tweens.add({
      targets: up, t: 1, duration: 260, ease: 'Quad.easeOut',
      onUpdate: () => { h.x = x0 + (u.x - 38 - x0) * up.t; h.lift = rise * up.t; },
      onComplete: () => resolve()
    }));
    // 殴る
    h.play('punch', true);
    audio.sfx('punch');
    audio.sfx('ufoFall');
    u.beam?.destroy(); u.beam = undefined;
    u.sparks?.destroy(); u.sparks = undefined;
    ufo.setFrame(3);
    this.s.fx('fx_hit', u.x - 26, u.bottom - 16, { scale: 2, depth: 960 });
    this.s.fx('fx_hit', u.x - 8, u.bottom - 24, { depth: 960 });
    impact(this.s, 'big');
    hitStop(this.s, 120);
    // 買い物客は無事に下りて、落ちてくるUFOをよける(右へ跳ぶ)
    if (s?.standing) {
      this.s.tweens.killTweensOf(s);
      this.s.tweens.add({ targets: s, lift: 0, duration: 380, ease: 'Bounce.easeOut' });
      this.s.tweens.add({ targets: s, x: u.x + SHOPPER_DODGE, duration: 300, ease: 'Quad.easeOut' });
    }
    // ヒーローは着地
    const x1 = h.x;
    const down = { t: 0 };
    this.s.tweens.add({
      targets: down, t: 1, duration: 360, delay: 120, ease: 'Quad.easeIn',
      onUpdate: () => { h.x = x1 - 14 * down.t; h.lift = rise * (1 - down.t); },
      onComplete: () => { h.lift = 0; }
    });
    // UFOは真下に落ちる(殴ってから0.5秒ほどで、ufoFall の地面に当たる音が入る)
    await new Promise<void>((resolve) => this.s.tweens.add({
      targets: ufo, y: UFO_LAND_Y, duration: 480, ease: 'Quad.easeIn', onComplete: () => resolve()
    }));
    ufo.setDepth(UFO_LAND_Y);
    shake(this.s, 6, 400);
    this.s.fx('fx_dust', u.x - 18, UFO_LAND_Y - 8, { scale: 2, depth: 960 });
    this.s.fx('fx_dust', u.x + 18, UFO_LAND_Y - 6, { scale: 2, depth: 960 });
    this.s.debris(u.x, UFO_LAND_Y - 16, UFO_LAND_Y + 6, 6, 40);
    const wreck: PropObj = { kind: 'ufo', x: u.x, y: UFO_LAND_Y, wall: false, sprite: ufo, broken: true };
    this.s.props.push(wreck);
    this.s.smoke(wreck, 5000, 26);
    const cost = this.s.stats.ufoDowned(u.recovered ?? false);
    this.s.free?.goDone(u.recovered ?? false);
    this.s.pop(u.x, UFO_LAND_Y - 36, formatYen(cost), true);
    // 真下の物を1つ壊す(いちばん近いもの)。壊れるのはUFOの幅の中の小さな物だけ(エスカレーターと噴水は壊さない)
    const under = this.s.props
      .filter((p) => !p.broken && UFO_UNDER_KINDS.includes(p.kind) && Math.abs(p.x - u.x) < UFO_HALF)
      .sort((p, q) => Math.abs(p.x - u.x) - Math.abs(q.x - u.x))[0];
    if (under) this.s.breakProp(under);
    // 宇宙人も一緒に倒れる(撃破は ufoDowned で数えた)
    if (a.standing) {
      this.s.fx('fx_hit', a.x, a.y - 30, { depth: 950 });
      this.s.knock(a, 28, 22, -1);
    }
    await waitMs(this.s, 500);
    this.s.auraOn = false;
    this.s.opSay(this.s.line('ufoDowned', this.s.rng));
    h.play('okay', true);
    audio.sfx('okay');
    this.s.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    // 買い物客はほっとして、右へ歩いて去る
    if (s?.standing) {
      s.play('idle');
      void this.s.arc(s, s.x, 6, 220);
      this.s.fx('fx_sparkle', s.x, s.y - HEAD - 4, { depth: 960 });
      this.s.time.delayedCall(700, () => {
        if (!s.standing) return;
        s.faceLeft(false).play('walk', true);
        void this.s.moveTo(s, this.s.L.right + 40, s.y, 1600, 'Linear').then(() => s.destroy());
      });
    }
    await waitMs(this.s, 900);
    h.play('idle');
  }
}
