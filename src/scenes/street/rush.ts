// 結果発表(Street)の部品:ステージ3の波2のあとのタイムセールラッシュ(右から8人が走ってきて、市民にだけ待てを押す)。
// Street のシーンを s として受け取り、そのシーンの道具(s.fx、s.heroSay など)を使って動かす。
// シーンの create のたびに作り直す(回をまたいで状態を持ちこまない)。

import Phaser from 'phaser';
import { UI } from '../../config';
import { layout } from '../../layout';
import { audio } from '../../audio';
import { animKey } from '../../art/sheets';
import {
  RUSH, RUSH_BAND, hasSeenRush, markRushSeen, rushEndLine, rushGlitchShowing, rushIntroFor, rushSpawnSec, type Speech,
  type RushRunner
} from '../../logic';
import { currentWave } from '../../run';
import { FS, PixelText, hitStop, impact, waitMs } from '../../ui';
import { Actor, HEAD } from './actor';
import { settings } from '../../settings';
import type { StreetScene } from '../Street';
import { type PropObj } from './common';

/** ラッシュ:走ってきた人が止まる所(ヒーローの何ドット先か。ヒーローがエスカレーターの前をふさいでいる) */
const RUSH_BLOCK = 28;
/** ラッシュ:待てで通した人が、ヒーローの後ろを抜けていくときにずらす奥行き */
const RUSH_PASS_DY = -10;

/**
 * タイムセールラッシュで走ってくる1人。
 * wait:まだ来ていない / run:走っている / mark:待てのマーク(ヒーローの前で止まってからも) / hit:殴られた / pass:待てで通した / gone:いない
 */
export interface RushMan {
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

export class RushPart {
  constructor(private readonly s: StreetScene) {}

  /** ラッシュでヒーローが立つ所(ラッシュのない波は null) */
  rushX: number | null = null;

  /** ラッシュでヒーローが立つ所の後ろのエスカレーター。ラッシュが終わるまで、どの攻撃でも壊れない */
  rushGuard: PropObj | null = null;

  /** ラッシュの間 true(早送りを切り、行けのボタンを暗くする) */
  rushOn = false;

  /** ラッシュの時計が進んでいるか(帯と説明の間は止めている) */
  rushRunning = false;

  rushSec = 0;

  rushMen: RushMan[] = [];

  /** ラッシュの全員が終わったら呼ぶ */
  rushDone: (() => void) | null = null;

  /** 帯を出して止めている間に止めた絵(始めたら動かし直す) */
  rushHeld: Phaser.GameObjects.Sprite[] = [];

  rushHeldTweens: Phaser.Tweens.Tween[] = [];

  rushHeldEvents: Phaser.Time.TimerEvent[] = [];

  /** この波の結果発表のあとにタイムセールラッシュがあるか */
  rushThisWave(): boolean {
    return this.s.def.hasRush && this.s.run.stage.rush !== null && currentWave(this.s.run).no === RUSH.afterWave;
  }

  async saleRush(): Promise<void> {
    const plan = this.s.run.stage.rush!;
    const h = this.s.hero;
    h.faceLeft(false).play('idle');
    this.rushOn = true;
    this.s.fastBtn.refresh();
    // 館内放送のチャイムと帯。帯が出た瞬間にゲームを止める
    audio.stopBgm();
    audio.sfx('chime');
    // 先に止めてから帯を出す(帯が入ってくる動きは止めない)
    this.holdWorld(true);
    const band = this.saleBand();
    const seen = hasSeenRush(this.s.def.id);
    markRushSeen(this.s.def.id);
    await this.rushIntro(rushIntroFor(seen), this.s.time.now + RUSH.tapLockSec * 1000);
    // タップで始まる
    band.out();
    this.holdWorld(false);
    audio.playBgm(this.s.def.bgm.rush ?? this.s.def.bgm.street);
    this.s.stats.startRush(plan);
    const slow = settings.slowMode;
    this.rushMen = plan.runners.map((r): RushMan => ({
      r, spawnSec: slow ? rushSpawnSec(r.index, true) : r.spawnSec, state: 'wait', markSec: 0, glitchOn: false
    }));
    this.rushSec = 0;
    await new Promise<void>((resolve) => { this.rushDone = resolve; this.rushRunning = true; });
    this.rushRunning = false;
    await waitMs(this.s, 400);
    this.s.opSay(rushEndLine(this.s.stats.rushTally ?? { civs: 0, civsSaved: 0 }, this.s.rng));
    h.play('okay', true);
    audio.sfx('okay');
    this.s.fx('fx_kiran', h.x + 10, h.y - HEAD, { scale: 2, depth: 960 });
    await waitMs(this.s, 1700);
    this.rushOn = false;
    this.rushGuard = null;
    this.s.fastBtn.refresh();
  }

  /** 「タイムセール開始!」の大きな帯。タップで始めるまで出しておき、out() で左へ去る */
  private saleBand(): { out: () => void } {
    const { W } = layout;
    const bandH = 34;
    const c = this.s.add.container(W, 52).setDepth(1500).setScrollFactor(0);
    const g = this.s.add.graphics();
    g.fillStyle(UI.black, 1).fillRect(0, 0, W, bandH);
    g.fillStyle(UI.gold, 1).fillRect(0, 2, W, 2).fillRect(0, bandH - 4, W, 2);
    g.fillStyle(UI.bad, 1).fillRect(0, 5, W, 1).fillRect(0, bandH - 6, W, 1);
    const label = new PixelText(this.s, Math.floor(W / 2), 9, RUSH_BAND, { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0);
    c.add([g, label]);
    const slide = (x: number, ms: number, ease: string, done?: () => void): void => {
      this.s.tweens.add({ targets: c, x, duration: ms, ease, onUpdate: () => { c.x = Math.round(c.x); }, onComplete: () => done?.() });
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
      this.rushHeld = this.s.children.list.filter((o): o is Phaser.GameObjects.Sprite => o instanceof Phaser.GameObjects.Sprite && o.anims.isPlaying);
      for (const s of this.rushHeld) s.anims.pause();
      this.rushHeldTweens = this.s.tweens.getTweens().filter((t) => !t.isPaused());
      for (const t of this.rushHeldTweens) t.pause();
      // Phaser の時計には出来事の一覧を返す関数がないので、中の一覧を読む(待っている出来事も入れる)
      const clock = this.s.time as unknown as { _active: Phaser.Time.TimerEvent[]; _pendingInsertion: Phaser.Time.TimerEvent[] };
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
      if (this.s.time.now < lock) return;
      // 中断、音、早送りのボタンは、それぞれのボタンとして効かせる
      if (over.some((o) => o.parentContainer && this.s.icons.includes(o.parentContainer))) return;
      if (this.s.cut.isTyping) {
        // カットインを押したときは、カットインが自分で文字送りを飛ばす
        if (!over.some((o) => o.parentContainer === this.s.cut)) this.s.cut.skip();
        return;
      }
      tapped?.();
    };
    const onResume = (): void => { lock = Math.max(lock, this.s.time.now + RUSH.tapLockSec * 1000); };
    this.s.input.on('pointerdown', onDown);
    this.s.events.on(Phaser.Scenes.Events.RESUME, onResume);
    // 説明の途中でシーンを出たとき(タイトルへ、など)も外す
    const off = (): void => {
      this.s.input.off('pointerdown', onDown);
      this.s.events.off(Phaser.Scenes.Events.RESUME, onResume);
    };
    this.s.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    /** タップを待つ(ms を渡すと、その時間がたっても進む) */
    const waitTap = (ms?: number): Promise<void> => new Promise((resolve) => {
      let over = false;
      const go = (): void => { if (over) return; over = true; tapped = null; resolve(); };
      tapped = go;
      if (ms !== undefined) this.s.time.delayedCall(ms, go);
    });
    for (let i = 0; i < lines.length; i++) {
      const sp = lines[i];
      await this.s.cut.say(sp.text, sp.face, { who: sp.who, alarm: sp.face === 'panic' });
      if (i < lines.length - 1) await waitTap(1200);
    }
    // ▼タップ(ゆっくり点滅)
    const { W, actionH } = layout;
    const tip = new PixelText(this.s, W - 6, actionH - 18, '▼タップ', { size: FS.big, color: UI.gold, outline: true })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(1500);
    const blinkEv = this.s.time.addEvent({ delay: 420, loop: true, callback: () => tip.setVisible(!tip.visible) });
    await waitTap();
    blinkEv.remove();
    tip.destroy();
    off();
    this.s.events.off(Phaser.Scenes.Events.SHUTDOWN, off);
    audio.unlock();
  }

  stepRush(ms: number): void {
    const dt = ms / 1000;
    this.rushSec += dt;
    const hx = this.s.hero.x;
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
        if (on && !m.glitchOn && a.x < this.s.L.right) audio.sfx('glitch', { volume: 0.7 });
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
  syncNoise(): void {
    const on = this.s.frameN % 2 === 0;
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
    const y = this.s.hero.y + this.s.rng.int(-3, 3);
    const a = new Actor(this.s, m.r.sheetKey, this.s.L.right + 24, y);
    a.look = m.r.look;
    a.civ = m.r.truth === 'civ';
    a.faceLeft(true).play('walk', true, 2);
    m.a = a;
    m.state = 'run';
    if (m.r.truth === 'bad') {
      m.noise = this.s.add.sprite(a.x, a.y - 28, 'fx_glitch').play(animKey('fx_glitch', 'play')).setVisible(false);
    }
  }

  /** 48ドット手前:待てのマーク。ヒーローは全員に同じ一言で構える(ちらりと決めつけは出さない) */
  private rushMark(m: RushMan): void {
    const a = m.a!;
    m.state = 'mark';
    m.markSec = this.rushSec;
    this.s.showMark(a, 'stop');
    this.s.stopAlarm.start();
    this.s.heroSay(this.s.line('rushMark', this.s.rng), 1000);
    this.s.hero.pose('punch', 0);
    this.s.auraOn = true;
    this.s.stopHandler = () => this.rushStop(m);
  }

  /** 待てを押さなかった:光のパンチ。巻きぞえは出さず、物も壊れない */
  private rushPunch(m: RushMan): void {
    const a = m.a!;
    const h = this.s.hero;
    m.state = 'hit';
    m.glitchOn = false;
    this.s.stopHandler = null;
    this.s.stopAlarm.stop();
    this.s.hideMark(a);
    h.play('punch', true);
    audio.sfx('punch');
    const fist = this.s.fx('fx_punch', h.x + 16, a.y - 30, { loop: true, depth: 900 });
    this.s.tweens.add({
      targets: fist, x: a.x - 4, duration: 80,
      onComplete: () => {
        fist.destroy();
        this.s.fx('fx_hit', a.x - 4, a.y - 30, { depth: 950 });
        this.s.fx('fx_hit', a.x + 4, a.y - 22, { depth: 950 });
        audio.sfx('hit');
        impact(this.s, 'small');
        hitStop(this.s, 80);
        m.noise?.destroy();
        m.noise = undefined;
        this.s.knock(a, 64, 26, 1);
        m.doneSec = this.rushSec;
        this.s.stats.rushHit(m.r.truth);
        if (m.r.truth === 'civ') {
          // 市民だった:「あれ?」と言って次へ(言いはる、ツッコミ、やっちまったーは出さない)
          this.s.report('civHit', 'punch');
          this.s.heroSay(this.s.line('rushCivHit', this.s.rng), 700);
        }
        this.s.auraOn = false;
        this.s.time.delayedCall(260, () => { if (this.rushOn && m.state === 'hit') h.play('idle'); });
        // のびた人は、少しして煙になって消える(次の人の邪魔にならないように)
        this.s.time.delayedCall(RUSH.goneSec * 1000, () => {
          if (a.state === 'gone') return;
          this.s.fx('fx_dust', a.x, a.y - 8, { depth: a.y + 1 });
          a.destroy();
          m.state = 'gone';
        });
      }
    });
  }

  /** 待て:急ブレーキで止まり、相手を通す(ヒーローの後ろを抜けて左へ走っていく) */
  private rushStop(m: RushMan): void {
    const a = m.a!;
    const h = this.s.hero;
    m.state = 'pass';
    m.doneSec = this.rushSec;
    this.s.stopHandler = null;
    this.s.stopAlarm.stop();
    this.s.hideMark(a);
    this.s.auraOn = false;
    h.play('stop', true);
    audio.sfx('stop');
    for (let i = 0; i < 3; i++) this.s.time.delayedCall(i * 60, () => this.s.fx('fx_brake', h.x + 6, h.y - 6, { depth: h.y + 1 }));
    this.s.heroSay(this.s.line('stop', this.s.rng), 800);
    this.s.stats.rushStopped(m.r.truth);
    if (a.civ) this.s.fx('fx_sparkle', a.x, a.y - HEAD - 4, { depth: 960 });
    this.s.time.delayedCall(250, () => {
      if (!a.standing) return;
      a.faceLeft(true).play('walk', true, 2);
      const toX = this.s.L.left - 30;
      void this.s.moveTo(a, toX, a.y + RUSH_PASS_DY, Math.max(300, ((a.x - toX) / (RUSH.runSpeed * 1.4)) * 1000), 'Linear').then(() => {
        a.destroy();
        m.noise?.destroy();
        m.noise = undefined;
        m.state = 'gone';
      });
    });
    this.s.time.delayedCall(RUSH.brakeSec * 1000, () => { if (this.rushOn && !this.s.stopHandler) h.play('idle'); });
  }
}
