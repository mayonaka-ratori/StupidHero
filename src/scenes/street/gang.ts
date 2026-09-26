// 結果発表(Street)の部品:ステージ2のギャングの組(口笛で仲間を呼び、集まった組を行けでまとめて倒す。ワゴンで逃げる)。
// Street のシーンを s として受け取り、そのシーンの道具(s.fx、s.heroSay など)を使って動かす。
// シーンの create のたびに作り直す(回をまたいで状態を持ちこまない)。
//
// 流れ:見逃したギャングが口笛 → 同じ組の仲間が走ってきて集まる → 頭の上に大きな行けの合図。
// 行けでまとめて吹き飛ばす。押さないと3秒でワゴンに乗りこみ、走り出す。走っている間の行けは車ごと止める。
// 時間は GangCall(logic/gang.ts)が数える。カメラは組とワゴンが画面の中に入るように向ける。

import Phaser from 'phaser';
import { UI } from '../../config';
import { layout } from '../../layout';
import { audio } from '../../audio';
import {
  GANG, GangCall, MARK, formatYen, gatherMembers, mischiefLine, rollGroupWipeProps, sceneForProp, type GangPhase
} from '../../logic';
import { currentWave } from '../../run';
import { FS, PixelText, hitStop, impact, shake, waitMs } from '../../ui';
import { Actor, HEAD } from './actor';
import { VAN_Y, type GatherSpot } from './plan';
import type { StreetScene } from '../Street';
import { type PropObj, RUN } from './common';

/** ステージ2:集まったギャングの組(口笛から、吹き飛ばす・車で止める・逃げられるまで) */
export interface GangRun {
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

export class GangPart {
  constructor(private readonly s: StreetScene) {}

  /** 口笛を吹く人の id → 組が集まる場所 */
  gathers = new Map<string, GatherSpot>();

  /** 組の id → 組が乗るワゴン */
  vans = new Map<string, PropObj>();

  /** 待てで止めた人の id(組に呼ばれても来ない) */
  stoppedIds = new Set<string>();

  gang: GangRun | null = null;

  /** 口笛を吹いている人(組ができるか、1人のまま行けの合図が終わるまで) */
  private whistler: Actor | null = null;

  /** 行けのマークの前ぶれの間か(口笛が鳴ってから、組が集まり終わるまで。フリープレイが見る) */
  get goWarning(): boolean {
    return (this.whistler?.standing ?? false) || this.gang?.call.phase === 'gather';
  }

  /** 組に呼ばれても来ない人(もう倒した、待てで止めた、もういない) */
  private goneFromGang(id: string): boolean {
    const a = this.s.actorOf(id);
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
    const sprite = this.s.add.sprite(spot.vanX, spot.vanY, 'prop_van', 0).setOrigin(0.5, 1).setDepth(spot.vanY);
    const van: PropObj = { kind: 'van', x: spot.vanX, y: spot.vanY, wall: false, sprite, broken: false };
    this.s.props.push(van);
    this.vans.set(spot.groupId, van);
    return van;
  }

  /**
   * フリープレイ:ワゴンが画面の右から走ってきて、集まる場所の先に止まる(口笛から仲間が集まるまでの間に)。
   * 車の位置(van.x)ははじめから止まる所にしておき、絵だけを走らせる
   */
  private vanArrive(spot: GatherSpot): PropObj {
    const van = this.addVan(spot);
    const sp = van.sprite;
    const x0 = Math.max(spot.vanX + 80, this.s.L.right + 80);
    sp.setX(x0).setFrame(1);
    audio.sfx('engine');
    const o = { x: x0 };
    this.s.tweens.add({
      targets: o, x: spot.vanX, duration: (GANG.whistleSec + GANG.gatherSec) * 800, ease: 'Quad.easeOut',
      onUpdate: () => {
        if (van.broken || this.gang?.call.phase === 'drive') return;
        sp.setX(Math.round(o.x)).setFrame(1 + (Math.floor(this.s.frameN / 3) % 2));
        if (this.s.frameN % 5 === 0) this.s.fx('fx_dust', o.x + 60, van.y - 6, { depth: van.y - 1 });
      },
      onComplete: () => {
        if (van.broken || this.gang?.call.phase === 'drive') return;
        sp.setX(spot.vanX).setFrame(0);
        audio.sfx('skid', { volume: 0.6 });
      }
    });
    return van;
  }

  /** 化けた女ボスの金の小物(首や腕のあたり)が、ときどき小さく光る。正体を現したら止める */
  goldGlint(a: Actor): void {
    const disguise = a.sprite.texture.key;
    const ev = this.s.time.addEvent({
      delay: 1300, loop: true, startAt: this.s.rng.int(0, 1200), callback: () => {
        if (!a.sprite.active || a.sprite.texture.key !== disguise) { ev.remove(); return; }
        if (!a.standing || !a.sprite.visible) return;
        const dx = a.sprite.flipX ? -4 : 4;
        this.s.fx('fx_sparkle', a.x + dx, a.y - 38 - a.lift, { depth: a.y + 0.6 });
      }
    });
  }

  /** 口笛の音符。口元から右上へ、点滅しながら上がっていく */
  private whistleNotes(a: Actor): void {
    for (let i = 0; i < 3; i++) {
      this.s.time.delayedCall(i * 160, () => {
        if (!a.sprite.active) return;
        const g = this.s.add.graphics().setDepth(1150);
        const dark = 0x1a1420;
        const c = i % 2 === 0 ? 0xffffff : 0xfff2b0;
        // ふち → 玉と棒と旗
        g.fillStyle(dark, 1).fillRect(-1, 3, 5, 4).fillRect(1, -1, 3, 6).fillRect(2, -1, 4, 3);
        g.fillStyle(c, 1).fillRect(0, 4, 3, 2).fillRect(2, 0, 1, 5).fillRect(3, 0, 2, 1);
        const x0 = a.x + 8 + i * 3;
        const y0 = a.y - 44;
        g.setPosition(Math.round(x0), Math.round(y0));
        this.s.flickers.add(g);
        const o = { t: 0 };
        this.s.tweens.add({
          targets: o, t: 1, duration: 620,
          onUpdate: () => g.setPosition(Math.round(x0 + o.t * 14 + Math.sin(o.t * 9) * 2), Math.round(y0 - o.t * 22)),
          onComplete: () => g.destroy()
        });
      });
    }
  }

  /** 見逃したギャング:前へ出て口笛で仲間を呼ぶ。組が集まったら行けでまとめて吹き飛ばす */
  async gangCall(a: Actor): Promise<void> {
    const h = this.s.hero;
    const person = a.person!;
    const group = currentWave(this.s.run).groups.find((g) => g.id === person.group);
    const spot = this.gathers.get(person.id)
      ?? { groupId: person.group!, whistlerId: person.id, x: a.x + 76, y: 192, vanX: a.x + 116, vanY: VAN_Y };
    // フリープレイはワゴンを止めておかず、右から走ってくる
    const van = this.vans.get(spot.groupId) ?? (this.s.free ? this.vanArrive(spot) : this.addVan(spot));
    const ids = gatherMembers(group?.memberIds ?? [person.id], (id) => this.goneFromGang(id));
    const mates = ids.filter((id) => id !== person.id).map((id) => this.s.actorOf(id)).filter((m): m is Actor => !!m);
    const members = [a, ...mates];
    for (const m of members) m.called = true;
    // 仲間がもう倒されている(または待てで止めた)ときは、口笛を吹いても誰も来ない。組にはならない
    const alone = members.length < GANG.groupSize.min;
    const slots = this.gatherSlots(spot, members.length);
    h.play('idle');
    // カメラ:ヒーローと、集まる場所と、ワゴンが1つの画面に入るように(1人のときはワゴンに乗らないので、ヒーローについて行く)
    const half = layout.W / 2;
    const vanRight = van.x + 64;
    if (!alone) this.s.camFocus = Phaser.Math.Clamp((h.x + vanRight) / 2 - 8, vanRight + 6 - half, h.x - 24 + half);

    // 前へ出て、口笛
    a.showTag(true);
    a.faceLeft(false).play('walk', true, 2.4);
    this.s.fx('fx_dust', a.x - 6, a.y - 8, { depth: a.y });
    await this.s.moveTo(a, slots[0].x, slots[0].y, 480);
    a.faceLeft(false).play('mischief', true);
    audio.sfx('whistle');
    this.whistler = a;
    this.whistleNotes(a);
    this.s.opSay(mischiefLine(a.look!, this.s.rng), true);
    h.pose('oops', 1);
    this.s.heroSay(this.s.line('mischiefHero', this.s.rng), 1300);
    await waitMs(this.s, GANG.whistleSec * 1000);
    if (alone) {
      // 1人のときは、行けの合図が出て終わるまで前ぶれのまま(合図が出た瞬間に、覚えている行けが効く)
      await this.s.aloneWhistle(a);
      this.whistler = null;
      return;
    }

    // 仲間が通りのどこからでも走ってくる(時間は GangCall が数える)
    const call = new GangCall(members.map((m) => m.person!.id), this.s.free?.gangOpts);
    let done!: () => void;
    const finished = new Promise<void>((r) => { done = r; });
    this.gang = { call, members, spot, slots, van, vanX0: van.x, vanEndX: van.x, done };
    this.whistler = null;
    a.faceLeft(true).play('idle');
    const runs = mates.map((m, i) => {
      const s = slots[i + 1];
      m.showTag(true);
      m.faceLeft(s.x < m.x).play('walk', true, 3.2);
      const dist = Phaser.Math.Distance.Between(m.x, m.y, s.x, s.y);
      const ms = Phaser.Math.Clamp(dist / 0.26, 320, GANG.gatherSec * 1000 - 200);
      for (let k = 0; k * 130 < ms; k++) {
        this.s.time.delayedCall(k * 130, () => { if (m.standing) this.s.fx('fx_dust', m.x + (m.sprite.flipX ? 8 : -8), m.y - 6, { depth: m.y - 1 }); });
      }
      return this.s.moveTo(m, s.x, s.y, ms, 'Linear').then(() => {
        if (call.phase === 'gather' || call.phase === 'wait') m.faceLeft(true).play(call.phase === 'wait' ? 'sortIdle' : 'idle', true);
      });
    });
    await Promise.all(runs);
    if (call.gathered()) this.onGangPhase('wait');
    await finished;
  }

  stepGang(ms: number): void {
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
      g.van.sprite.setX(Math.round(x)).setFrame(1 + (Math.floor(this.s.frameN / 3) % 2));
      if (this.s.frameN % 5 === 0) this.s.fx('fx_dust', x - 66, g.van.y - 6, { depth: g.van.y - 1 });
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
      g.mark = this.s.bigMark(cx, top, 4);
      // ヒーローの吹き出しが大きな合図と札に重ならないように消す
      this.s.heroBubble?.destroy();
      this.s.heroBubble = undefined;
      this.s.hero.play('idle');
      g.count = new PixelText(this.s, Math.round(cx) + 42, Math.round(top) + 4, String(GANG.escapeSec), { size: FS.big, color: UI.gold, outline: true })
        .setOrigin(0.5, 0.5).setDepth(1200);
      this.s.goAlarm.start();
      // 「行けでまとめて!」が行けの使い方の代わり
      this.s.firstTime('go');
      this.s.opSay(this.s.line('gathered', this.s.rng), true);
      this.s.free?.goMarkShown();
      this.s.goHandler = () => this.gangGo();
    } else if (e === 'board') {
      // ワゴンに乗りこむ(乗った人は車の中に消える)
      g.count?.destroy(); g.count = undefined;
      g.mark?.destroy();
      g.mark = this.s.bigMark(van.x, van.y - 64 - 22, 3);
      // 乗りこむ(0.5秒)と走り出すのセリフが上書きされて読めないので、つなげて出す:
      // 「乗りこんだ」を出し終えて少し読ませてから、まだ走っていれば「走り出した!今なら行け!」
      this.s.opSay(this.s.line('board', this.s.rng), true);
      const seq = this.s.opSeq;
      this.s.time.delayedCall(1100, () => {
        if (this.gang === g && g.call.phase === 'drive' && this.s.opSeq === seq) this.s.opSay(this.s.line('drive', this.s.rng), true);
      });
      const doorX = van.x - 22;
      g.members.forEach((m, i) => {
        this.s.tweens.killTweensOf(m);
        m.faceLeft(false).play('walk', true, 3.2);
        void this.s.moveTo(m, doorX + i * 8, van.y + 3, GANG.boardSec * 800, 'Linear').then(() => {
          if (g.call.phase !== 'board' && g.call.phase !== 'drive') return;
          this.hideInVan(m);
          audio.sfx('hit', { pitch: 0.5, volume: 0.5 });
          van.sprite.setFrame(1);
          this.s.time.delayedCall(80, () => { if (g.call.phase === 'board') van.sprite.setFrame(0); });
        });
      });
    } else if (e === 'drive') {
      for (const m of g.members) { this.s.tweens.killTweensOf(m); this.hideInVan(m); }
      g.vanX0 = van.x;
      g.vanEndX = this.s.L.right + 80;
      audio.sfx('engine');
      audio.sfx('skid');
      shake(this.s, 2, 200);
      for (let i = 0; i < 3; i++) this.s.fx('fx_dust', van.x - 60 + i * 6, van.y - 4 - i * 4, { depth: van.y + 1, scale: 1.5 });
      // フリープレイ:ヒーローは笑顔で手を振って見送る
      this.s.free?.gangDrive();
    } else if (e === 'escaped') {
      // 逃げきられた
      this.s.goHandler = null;
      this.s.stopGoAlarm();
      g.mark?.destroy(); g.mark = undefined;
      van.sprite.setVisible(false);
      van.broken = true;
      for (const m of g.members) m.destroy();
      this.s.stats.groupEscaped(g.call.size);
      this.s.free?.gangEscaped();
      audio.sfx('horn');
      this.s.opSay(this.s.line('vanEscaped', this.s.rng));
      this.s.hero.pose('oops', 1);
      this.s.time.delayedCall(900, () => { this.s.hero.play('idle'); this.endGang(); });
    }
  }

  private gangGo(): void {
    const g = this.gang;
    if (!g) return;
    const r = g.call.go();
    if (!r) return;
    this.s.goHandler = null;
    this.s.stopGoAlarm();
    g.count?.destroy(); g.count = undefined;
    g.mark?.destroy(); g.mark = undefined;
    audio.sfx('go');
    this.s.free?.goDone(false);
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
    const h = this.s.hero;
    const i = this.s.queue.indexOf(g.members[0]);
    const next = this.s.queue.slice(i + 1).find((q) => q.standing && !q.called);
    this.s.camFocus = null;
    if (!next || h.x <= next.x - MARK.showDistance - 4) return;
    h.faceLeft(true).play('stomp', true);
    await this.s.arc(h, next.x - MARK.showDistance - 12, 34, 380, 'Sine.easeInOut');
    h.faceLeft(false).play('idle');
    await waitMs(this.s, 120);
  }

  /** 行け(集まったところ):高く跳んで組の真ん中に落ち、衝撃波で全員まとめて吹き飛ばす。巻きぞえは組の中だけ */
  private async groupWipe(g: GangRun): Promise<void> {
    const h = this.s.hero;
    const ms = g.members.filter((m) => m.standing);
    const cx = ms.reduce((s, m) => s + m.x, 0) / Math.max(1, ms.length);
    const cy = ms.reduce((s, m) => s + m.y, 0) / Math.max(1, ms.length);
    for (const m of ms) { this.s.tweens.killTweensOf(m); m.pose('surprised'); }
    this.s.heroSay(this.s.line('wipe', this.s.rng), 1100);
    this.s.auraOn = true;
    await this.s.runTo(Math.min(...ms.map((m) => m.x)) - 44, { speed: RUN * 3.5, y: Math.round(cy) + 4 });
    h.play('stomp', true);
    audio.sfx('charge', { pitch: 1.3 });
    audio.sfx('stomp', { pitch: 1.3 });
    await this.s.arc(h, cx - 4, 100, 460, 'Sine.easeInOut');
    // 着地
    impact(this.s, 'huge');
    shake(this.s, 8, 700);
    hitStop(this.s, 180);
    audio.sfx('bigHit');
    audio.sfx('stomp');
    this.s.fx('fx_shockwave', cx, cy - 12, { depth: cy + 2, scale: 3 });
    this.s.fx('fx_shockwave', cx - 34, cy - 6, { depth: cy + 2, scale: 2, flip: true });
    this.s.fx('fx_shockwave', cx + 34, cy - 6, { depth: cy + 2, scale: 2 });
    this.s.fx('fx_dust', cx - 20, cy - 8, { depth: cy + 3, scale: 2 });
    this.s.fx('fx_dust', cx + 20, cy - 8, { depth: cy + 3, scale: 2 });
    ms.forEach((m, i) => {
      this.s.fx('fx_hit', m.x, m.y - 30, { depth: 950, scale: 2 });
      const dir = i === 0 ? -1 : 1;
      this.s.knock(m, 30 + i * 22, 64 + i * 18, dir);
    });
    this.s.stats.groupWiped(ms.length);
    // 「N人撃破!」は、吹き飛んだ人が落ちてから出す(飛んでいる人や、物が壊れた金額と重ならないように)
    this.s.time.delayedCall(560, () => this.s.pop(cx, cy - 70, `${ms.length}人撃破!`, true));
    const props = rollGroupWipeProps(this.s.visibleProps(), cx, this.s.rng).sort((p, q) => Math.abs(p.x - cx) - Math.abs(q.x - cx));
    props.forEach((p, i) => this.s.time.delayedCall(80 + i * 90, () => this.s.breakProp(p)));
    await waitMs(this.s, 750);
    this.s.auraOn = false;
    h.play('okay', true);
    audio.sfx('okay');
    this.s.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    this.s.opSay(this.s.line('wipeOp', this.s.rng));
    await waitMs(this.s, 1000);
    h.play('idle');
  }

  /** 行け(乗りこむところ、走っている間):追いついて車ごと殴って止める。組の全員がのびて出てくる */
  private async vanStop(g: GangRun): Promise<void> {
    const h = this.s.hero;
    const van = g.van;
    for (const m of g.members) { this.s.tweens.killTweensOf(m); this.hideInVan(m); }
    van.sprite.setFrame(1);
    this.s.heroSay(this.s.line('vanStop', this.s.rng), 1100);
    this.s.opSay(this.s.line('goOp', this.s.rng));
    this.s.camFocus = van.x - 24;
    // 光の突撃で、ワゴンの後ろに追いつく
    h.play('charge', true);
    this.s.auraOn = true;
    audio.sfx('charge');
    await waitMs(this.s, 70);
    const toX = Math.max(h.x, van.x - 64 - 8);
    const o = { x: h.x, y: h.y };
    await new Promise<void>((resolve) => this.s.tweens.add({
      targets: o, x: toX, y: van.y + 12, duration: Math.max(180, (toX - h.x) / 0.8), ease: 'Quad.easeIn',
      onUpdate: () => { h.x = o.x; h.y = o.y; },
      onComplete: () => resolve()
    }));
    h.play('punch', true);
    audio.sfx('punch');
    await waitMs(this.s, 110);
    // 車ごと
    van.sprite.setFrame(3);
    van.broken = true;
    audio.sfx('crash');
    audio.sfx('bigHit');
    impact(this.s, 'huge');
    shake(this.s, 8, 800);
    hitStop(this.s, 200);
    const vy = van.y - 30;
    this.s.fx('fx_hit', van.x - 54, vy, { scale: 3, depth: 960 });
    this.s.fx('fx_hit', van.x - 20, vy - 14, { scale: 2, depth: 960 });
    this.s.fx('fx_dust', van.x, vy, { scale: 3, depth: 960 });
    this.s.fx('fx_dust', van.x + 40, vy + 10, { scale: 2, depth: 960 });
    this.s.debris(van.x, vy, van.y + 8, 8, 60);
    van.x += 16;
    this.s.tweens.add({ targets: van.sprite, x: Math.round(van.x), duration: 260, ease: 'Quad.easeOut' });
    const cost = this.s.stats.vanStopped(g.call.size);
    this.s.pop(van.x, van.y - 66, formatYen(cost), true);
    this.s.smoke(van, 6000);
    this.s.report(sceneForProp('van'));
    // 組の全員がのびて出てくる
    g.members.forEach((m, i) => {
      if (m.state === 'gone') return;
      m.x = van.x - 8 + i * 14;
      m.y = van.y + 10 + i * 9;
      m.sprite.setVisible(true);
      m.state = 'stand';
      this.s.knock(m, 34 + i * 20, 44 + i * 12, i === 1 ? -1 : 1);
    });
    await waitMs(this.s, 750);
    this.s.auraOn = false;
    this.s.opSay(this.s.line('vanStopOp', this.s.rng));
    h.play('okay', true);
    audio.sfx('okay');
    this.s.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    await waitMs(this.s, 1000);
    h.play('idle');
  }

  /** 女ボスを市民に仕分けていたとき:手下のワゴンが通りを走り抜けて、まわりを壊していく(額は bossRampage に含まれる) */
  thugVans(): void {
    const near = this.s.visibleProps().sort((p, q) => p.x - q.x);
    audio.sfx('horn');
    // 1台目は手前をかすめて(ヒーローが跳んでよける)、2台目は奥を走り抜ける
    [214, 150].forEach((y, i) => this.s.time.delayedCall(200 + i * 420, () => {
      const mine = near.filter((_, k) => k % 2 === i);
      const x0 = this.s.L.left - 70;
      const x1 = this.s.L.right + 80;
      const van = this.s.add.sprite(x0, y, 'prop_van', 1).setOrigin(0.5, 1).setDepth(y);
      audio.sfx('engine');
      audio.sfx(i === 0 ? 'skid' : 'horn');
      const o = { x: x0 };
      let dodged = i !== 0;
      this.s.tweens.add({
        targets: o, x: x1, duration: 950, ease: 'Quad.easeIn',
        onUpdate: () => {
          van.setX(Math.round(o.x)).setFrame(1 + (Math.floor(this.s.frameN / 3) % 2));
          if (!dodged && o.x > this.s.hero.x - 110) { dodged = true; void this.s.arc(this.s.hero, this.s.hero.x, 30, 420); }
          if (this.s.frameN % 4 === 0) this.s.fx('fx_dust', o.x - 66, y - 6, { depth: y - 1 });
          for (const p of mine) if (!p.broken && p.x <= o.x + 60) { this.s.breakProp(p, false); shake(this.s, 4, 200); }
        },
        onComplete: () => van.destroy()
      });
    }));
  }
}
