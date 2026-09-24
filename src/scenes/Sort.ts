// 仕分け。人が1人ずつスポットライトの下に出てくる。左にスワイプ(◀ワル)でワル、右(市民▶)で市民。
// 時間は波ごと(wave.seconds。ゆっくりモードなら settings.timeScale 倍)。残り5秒で画面の端が赤く点滅し、オペレーターが急かす。
// 全員仕分けたらすぐ結果発表(Street)へ。時間切れなら残りをヒーローが気まぐれで決めて Street へ。
// 1人3秒くらいで決めるゲームなので、入れ替わりは0.2秒くらいにして待たせない。
//
// 読むものはぜんぶ下の窓にまとめる:名前と年齢、プロフィール、細い線の下にオペレーターの小さな顔と一言。
// プロフィールと一言は1文字ずつ出し、出している間は時計を止める(読む速さで不利にならないように)。
// 止まっている間は、時間の下に「時計ストップ中」の札を出す。
// 上の右:音と中断のボタン(ほかの画面と同じ位置)。その下(ステージ2だけ)に、その波で見た人の小物の色の札。
// 人の右に「持ち物」の窓。いまの人の手がかりの場所を3倍にして見せる(src/art/clueSpots.ts)。
// ステージ3の宇宙人(person.glitch がある人)は、その人が出てから進んだ時計の秒数で、ときどき動きがくずれる
// (glitchShowing。文字送りの間と一時停止の間は時計と一緒に止まる)。「持ち物」の窓も同じコマを映すので、くずれが窓にも出る。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { settings } from '../settings';
import { animKey, originFor } from '../art/sheets';
import { accessorySheet } from '../art/recolor';
import { HURRY_AT_SEC, glitchCount, glitchShowing, say, waveIntroFor, type Person, type SortChoice, type Speech } from '../logic';
import { currentWave, fillUnsorted, getRun, setSort, type GameRun } from '../run';
import {
  Button, EdgeAlarm, FS, IconButton, PauseControl, PixelText, SwipeInput, TimeBar, UIX, WindowFrame,
  addPanel, banner, flash, gotoWhenFree, panelRect, shake, waitMs
} from '../ui';
import {
  BLUE, BLUE_LIGHT, RED, Z, addMute, devHook, drawLightPool, drawStageBg, edgeGlow, spotlightDim, unlockOnTap
} from './sort/common';
import { makeStamp, popStamp } from './sort/stamp';
import { drawHand } from './sort/introDemo';
import { RemarkRow, Typer } from './sort/remark';
import { ClueZoom } from './sort/clueZoom';
import { SeenStrip } from './sort/seenStrip';

const CX = 108;
const FEET_Y = 204;
const SCALE = 2;
/** 入れ替わりの時間(ミリ秒) */
const OUT_MS = 140;
const IN_MS = 130;
const IN_DELAY = 50;
/** 人の絵の上の、ハンコを押す高さ */
const STAMP_Y = FEET_Y - 74;
/** プロフィールと一言の文字送りの速さ(1秒に出す字の数) */
const PROFILE_CPS = 90;
const REMARK_CPS = 60;
/** 「持ち物」の窓の左上。人(右の端は x=138 くらい)と、右の端の「▶市民」(x=199から)の間 */
const ZOOM_X = 140;
const ZOOM_Y = 90;
/** 「見た小物」の左上(左の時間の列の右) */
const STRIP_X = 72;
const STRIP_Y = 21;

type State = 'intro' | 'play' | 'timeup' | 'done';

export class SortScene extends Phaser.Scene {
  private run!: GameRun;
  private people: Person[] = [];
  private idx = 0;
  private state: State = 'intro';
  private totalMs = 0;
  private leftMs = 0;
  private hurried = false;
  private lastTickSec = 99;
  /** 入れ替わりの途中で、次の人がまだ真ん中に来ていない */
  private locked = true;
  private dragDx = 0;
  private glowKick: { side: 'left' | 'right'; until: number } | null = null;
  private introSkip = false;
  private introWake: (() => void) | null = null;
  private hintTimer?: Phaser.Time.TimerEvent;
  /** いまの人のプロフィールと一言の文字送りの間は時計を止める(急かす一言のときは止めない) */
  private holdClock = false;
  /** 文字送りの番号(人が替わったら古い文字送りの続きをしない) */
  private typeSeq = 0;
  /** 文字送りを飛ばした(窓をタップした)ときの番号 */
  private skipSeq = -1;
  /** 人が真ん中で仕分けの動きをしている(「持ち物」の窓を同じコマにする) */
  private idle = false;
  /** いまの人が出てから進んだ仕分けの時計(秒)。くずれを出すかどうかはこれで決める */
  private personSec = 0;
  /** いまの人がくずれの行を出している */
  private glitching = false;
  /** いまの人のくずれが何回始まったか(コマ落ちしても、1回ぶんのくずれを飛ばさないように数える) */
  private glitchStarts = 0;

  private cards: Phaser.GameObjects.Sprite[] = [];
  private card!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Sprite;
  private countText!: PixelText;
  private secText!: PixelText;
  private timeBar!: TimeBar;
  private stopTag!: Phaser.GameObjects.Container;
  private nameText!: PixelText;
  private lineText!: PixelText;
  private profTyper!: Typer;
  private remark!: RemarkRow;
  private zoom!: ClueZoom;
  private strip?: SeenStrip;
  private glow!: Phaser.GameObjects.Graphics;
  private glowKey = '';
  private edgeLabels: PixelText[] = [];
  private alarm!: EdgeAlarm;
  private swipe!: SwipeInput;
  private btnBad!: Button;
  private btnCiv!: Button;
  private pause!: PauseControl;
  /** 指で引っぱって「離せば決まる」ところまで来たら出すハンコ */
  private preview!: Record<SortChoice, Phaser.GameObjects.Container>;
  /** 初めての人向け:最初の1人の上で左右に動く手 */
  private guideHand?: Phaser.GameObjects.Graphics;

  constructor() { super(SCENES.sort); }

  create(): void {
    const { W } = layout;
    this.run = getRun(this);
    const wave = currentWave(this.run);
    this.people = wave.people;
    this.idx = this.people.findIndex((p) => !this.run.sorts[p.id]);
    if (this.idx < 0) this.idx = this.people.length;
    this.state = 'intro';
    this.totalMs = this.waveSeconds() * 1000;
    this.leftMs = this.totalMs;
    this.hurried = false;
    this.lastTickSec = 99;
    this.locked = true;
    this.dragDx = 0;
    this.glowKick = null;
    this.introSkip = false;
    this.introWake = null;
    this.glowKey = '';
    this.edgeLabels = [];
    this.holdClock = false;
    this.typeSeq = 0;
    this.skipSeq = -1;
    this.idle = false;
    this.personSec = 0;
    this.glitching = false;
    this.glitchStarts = 0;
    // シーンは波ごとに作り直すので、前の波の絵を持ち越さない
    this.cards = [];
    this.strip = undefined;
    this.guideHand = undefined;
    this.hintTimer = undefined;
    unlockOnTap(this);
    audio.playBgm('sort');

    this.buildAction(W);
    this.buildPanel();

    this.swipe = new SwipeInput(this, new Phaser.Geom.Rectangle(CX - 56, 76, 112, 138), {
      onMove: (dx) => this.onDrag(dx),
      onSwipe: (dir) => this.decide(dir === 'left' ? 'bad' : 'civ'),
      onCancel: () => this.snapBack(),
      distance: 36
    });

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.state === 'intro' && over.length === 0) this.skipIntro();
    });
    this.input.keyboard?.on('keydown-LEFT', () => this.press('bad'));
    this.input.keyboard?.on('keydown-RIGHT', () => this.press('civ'));

    devHook(this, {
      press: (c: SortChoice) => this.press(c),
      skipIntro: () => this.skipIntro(),
      skipTyping: () => this.skipTyping(),
      buttons: () => [this.btnBad, this.btnCiv].map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })),
      setLeft: (ms: number) => { this.leftMs = ms; },
      state: () => ({
        state: this.state, idx: this.idx, total: this.people.length, leftMs: Math.round(this.leftMs), locked: this.locked,
        clockStopped: this.clockStopped(), personSec: this.personSec, glitching: this.glitching, sorts: { ...this.run.sorts }, random: [...this.run.randomSorted], wave: this.run.waveIndex + 1
      })
    });

    void this.playIntro();
  }

  /** この波の時間(秒)。ゆっくりモードなら長くなる */
  private waveSeconds(): number {
    return Math.round(currentWave(this.run).seconds * settings.timeScale);
  }

  // ─── 画面を組む ─────────────────────────────────

  private buildAction(W: number): void {
    // 暗くしたステージの背景と、真ん中のスポットライト
    drawStageBg(this, this.run.stage.def.bg);
    this.add.image(0, 0, spotlightDim(this, CX, FEET_Y)).setOrigin(0).setDepth(Z.dim);
    const pool = this.add.graphics().setDepth(Z.dim + 0.5);
    drawLightPool(pool, CX, FEET_Y + 1, 46, 7);
    // 左右の端の光(左が赤でワル、右が青で市民)
    this.glow = this.add.graphics().setDepth(Z.glow);
    const lbl = (x: number, text: string, color: number, ox: number): PixelText =>
      new PixelText(this, x, 140, text, { size: FS.body, color, outline: true, align: 'center', lineSpacing: 1 }).setOrigin(ox, 0.5).setDepth(Z.glow + 1);
    this.edgeLabels = [lbl(5, '◀\nワ\nル', 0xff8a80, 0), lbl(W - 5, '▶\n市\n民', 0x9ac4ff, 1)];

    // 「持ち物」の窓。人より奥に置く(モヒカンのナイフの先が少しかかっても、人を隠さないように)
    this.zoom = new ClueZoom(this, ZOOM_X, ZOOM_Y, Z.glow + 0.5);

    // 人(2人ぶん用意して、出ていく人と入ってくる人を入れ替えて使う)
    this.shadow = this.add.sprite(CX, FEET_Y, 'fx_shadow').setScale(SCALE).setOrigin(0.5, 0.5).setDepth(Z.shadow);
    for (let i = 0; i < 2; i++) {
      const s = this.add.sprite(-200, FEET_Y, 'hoodie_civ').setOrigin(...originFor('hoodie_civ')).setScale(SCALE).setDepth(Z.actor);
      s.setVisible(false);
      this.cards.push(s);
    }
    this.card = this.cards[0];
    this.preview = {
      bad: makeStamp(this, 'bad', FS.body).setDepth(Z.stamp).setVisible(false),
      civ: makeStamp(this, 'civ', FS.body).setDepth(Z.stamp).setVisible(false)
    };

    // 左上:ステージ、何人目、時間。時計が止まっている間は、時間の下に札を出す
    new PixelText(this, 4, 3, `STAGE${this.run.stage.def.no}`, { size: FS.body, color: UI.gold, outline: true });
    this.countText = new PixelText(this, 4, 18, '', { size: FS.body, outline: true });
    this.timeBar = new TimeBar(this, 4, 35, 40, 6);
    this.secText = new PixelText(this, 4, 44, '', { size: FS.big, outline: true });
    this.stopTag = this.makeStopTag(4, 63);
    // 右上:音、中断(Street と Boss と同じ位置)。中断中は、人とプロフィールとヒントを隠す(止めて考えられないように)
    this.pause = new PauseControl(this, {
      onPause: () => this.hideForPause(true),
      onResume: () => { this.hideForPause(false); audio.unlock(); }
    });
    new IconButton(this, W - 12, 12, 'pause', () => this.pause.pause());
    addMute(this, W - 34, 12);
    this.alarm = new EdgeAlarm(this);

    // ステージ2(小物のある人たち)だけ、その波で見た人の小物の色を並べる
    if (this.people.some((p) => p.accessory)) this.strip = new SeenStrip(this, STRIP_X, STRIP_Y);
    this.updateHud();
  }

  /** 「時計ストップ中」の金色の札(左上が x, y) */
  private makeStopTag(x: number, y: number): Phaser.GameObjects.Container {
    const t = new PixelText(this, 4, 3, '時計\nストップ中', { size: FS.body, color: UIX.stopText, lineSpacing: 2 });
    const w = Math.ceil(t.width) + 8, h = Math.ceil(t.height) + 5;
    const g = new Phaser.GameObjects.Graphics(this);
    g.fillStyle(UI.black, 1).fillRect(0, 0, w, h);
    g.fillStyle(UI.gold, 1).fillRect(1, 1, w - 2, h - 2);
    g.fillStyle(0xfff0b0, 1).fillRect(2, 1, w - 4, 1);
    const box = this.add.container(x, y, [g, t]).setDepth(1000).setVisible(false);
    return box;
  }

  private buildPanel(): void {
    addPanel(this);
    const r = panelRect();
    const hintH = 16;
    // 縦に余裕があれば、名前とプロフィールを大きな字(16)にする。一言はいつも12
    const big = r.h >= 200;
    const profH = big ? 104 : 84;
    const bh = Phaser.Math.Clamp(r.h - profH - 8 - hintH, 40, 116);
    new WindowFrame(this, r.x, r.y, r.w, profH, 'win');
    this.nameText = new PixelText(this, r.x + 7, r.y + (big ? 6 : 5), '', { size: big ? FS.big : FS.body, color: UI.gold });
    this.lineText = new PixelText(this, r.x + 7, r.y + (big ? 26 : 20), '', { size: big ? FS.big : FS.body, wrap: r.w - 14, lineSpacing: big ? 3 : 2 });
    this.profTyper = new Typer(this, this.lineText);
    // プロフィールの下に細い線、その下にオペレーターの小さな顔と一言
    const lineY = r.y + (big ? 66 : 50);
    this.add.graphics().setDepth(1000).fillStyle(UIX.winInner, 1).fillRect(r.x + 6, lineY, r.w - 12, 1);
    const rowY = lineY + 4;
    this.remark = new RemarkRow(this, r.x + 6, rowY, r.w - 12);
    // 窓をタップすると文字送りを飛ばす(波の始まりなら掛け合いを飛ばす)
    this.add.zone(r.x, r.y, r.w, profH).setOrigin(0, 0).setInteractive()
      .on('pointerdown', () => { if (this.state === 'intro') this.skipIntro(); else this.skipTyping(); });
    // ボタンは親指が届く下のほうに
    const by = r.bottom - hintH - bh;
    const bw = Math.floor((r.w - 8) / 2);
    this.btnBad = new Button(this, r.x, by, bw, bh, '◀ワル', { color: 'bad', onPress: () => this.press('bad') });
    this.btnCiv = new Button(this, r.x + bw + 8, by, bw, bh, '市民▶', { color: 'civ', onPress: () => this.press('civ') });
    new PixelText(this, Math.round(layout.W / 2), by + bh + 4, '左右にスワイプでもOK', { size: FS.body, color: UI.textDim }).setOrigin(0.5, 0);
  }

  private hiddenForPause: { o: Phaser.GameObjects.Components.Visible; v: boolean }[] = [];

  /** 中断中に見せないもの(人、影、ハンコの見本、手、プロフィール、一言、持ち物、見た小物)を隠す/戻す */
  private hideForPause(hide: boolean): void {
    if (hide) {
      const objs: Phaser.GameObjects.Components.Visible[] = [
        ...this.cards, this.shadow, this.preview.bad, this.preview.civ, this.nameText, this.lineText,
        ...this.remark.objects, ...this.zoom.objects, ...(this.strip?.objects ?? [])
      ];
      if (this.guideHand) objs.push(this.guideHand);
      this.hiddenForPause = objs.map((o) => ({ o, v: o.visible }));
      for (const o of objs) o.setVisible(false);
      return;
    }
    for (const { o, v } of this.hiddenForPause) if ((o as unknown as Phaser.GameObjects.GameObject).active) o.setVisible(v);
    this.hiddenForPause = [];
  }

  private updateHud(): void {
    const n = Math.min(this.idx + 1, this.people.length);
    this.countText.setText(`${n}/${this.people.length}人目`);
    const sec = Math.max(0, Math.ceil(this.leftMs / 1000));
    const color = this.hurried ? UI.danger : UI.text;
    // 文字は描き直しが重いので、変わったときだけ
    if (this.secText.style.color !== color) this.secText.setColor(color);
    this.secText.setText(`${sec}秒`);
    this.timeBar.setValue(this.leftMs / this.totalMs).setDanger(this.hurried);
  }

  // ─── 波の始まり ─────────────────────────────────

  private async playIntro(): Promise<void> {
    const wave = currentWave(this.run);
    this.nameText.setText(`WAVE ${wave.no}`);
    this.lineText.setText(`{gold}${this.people.length}人{/}を仕分けて！\n時間は{gold}${this.waveSeconds()}秒{/}`);
    audio.sfx('reveal', { volume: 0.6 });
    void banner(this, `WAVE ${wave.no}`, { hold: 700, y: 128 });
    await this.sleep(200);
    for (const s of waveIntroFor(this.run.stage.id, wave.no)) {
      if (this.introSkip) break;
      await this.remark.say(s.text, s.face, { who: s.who, speed: 45 });
      await this.sleep(450);
    }
    this.startPlay();
  }

  private skipIntro(): void {
    if (this.state !== 'intro') return;
    this.introSkip = true;
    this.remark.skip();
    this.introWake?.();
  }

  /** 待つ。波の始まりを飛ばしたときはすぐ終わる */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.introSkip) { resolve(); return; }
      const t = this.time.delayedCall(ms, () => { this.introWake = null; resolve(); });
      this.introWake = () => { t.remove(); this.introWake = null; resolve(); };
    });
  }

  private startPlay(): void {
    if (this.state !== 'intro') return;
    this.state = 'play';
    if (this.idx >= this.people.length) { this.finish(); return; }
    this.enter(this.idx, 0);
    if (this.run.waveIndex === 0 && this.idx === 0) this.showGuide();
  }

  /** 最初の1人だけ、人の上で手が左右にスワイプして見せる(何をすればいいか迷わないように) */
  private showGuide(): void {
    const g = this.add.graphics().setDepth(Z.stamp + 1);
    drawHand(g);
    // 手がかりの絵を隠さないように、足もとで動かす
    g.setScale(2).setPosition(CX, FEET_Y - 6);
    this.guideHand = g;
    this.tweens.add({
      targets: g, x: { from: CX + 30, to: CX - 30 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300,
      onUpdate: () => { g.x = Math.round(g.x); }
    });
  }

  private hideGuide(): void {
    if (!this.guideHand) return;
    this.tweens.killTweensOf(this.guideHand);
    this.guideHand.destroy();
    this.guideHand = undefined;
  }

  // ─── 人の入れ替わり ─────────────────────────────

  /** i番目の人を、横から真ん中へすっと入れる。from は入ってくる側(前の人が飛んでいった側の反対) */
  private enter(i: number, delay = IN_DELAY, fast = false, from: 'left' | 'right' = 'right'): void {
    const p = this.people[i];
    const s = this.cards.find((c) => c !== this.card) ?? this.cards[0];
    this.card = s;
    this.idle = false;
    this.personSec = 0;
    this.glitching = false;
    this.glitchStarts = 0;
    this.tweens.killTweensOf(s);
    // ステージ2の人は、小物(腕章、首の布など)をその人の色に塗った絵にする
    const key = accessorySheet(this, p.sheetKey, p.accessory?.color);
    s.setTexture(key).setOrigin(...originFor(p.sheetKey)).setAngle(0).setDepth(Z.actor);
    const sx = from === 'right' ? CX + 64 : CX - 64;
    s.setPosition(sx, FEET_Y).setVisible(true).setFlipX(from === 'right');
    s.play(animKey(key, 'walk'));
    this.shadow.setVisible(true).setX(sx);
    this.zoom.setPerson(key, p.sheetKey);
    this.strip?.show(this.people, i);
    if (this.state === 'timeup') this.showProfile(p);
    else void this.typeProfile(p);
    this.updateHud();
    const ms = fast ? 80 : IN_MS;
    this.tweens.add({
      targets: [s, this.shadow], x: CX, delay, duration: ms, ease: 'Quad.easeOut',
      onUpdate: () => { s.x = Math.round(s.x); this.shadow.x = s.x; },
      onComplete: () => {
        s.setFlipX(false);
        s.play(animKey(key, 'sortIdle'));
        this.idle = true;
        if (this.state === 'play') this.locked = false;
      }
    });
  }

  /** 名前、プロフィール、一言をすぐに出す(時間切れのとき) */
  private showProfile(p: Person): void {
    this.typeSeq++;
    this.holdClock = false;
    this.nameText.setText(`${p.profile.name}{dim}(${p.profile.age})`);
    this.profTyper.show(p.profile.line);
  }

  /** 名前を出し、プロフィールと一言を1文字ずつ出す。その間は時計が止まる */
  private async typeProfile(p: Person): Promise<void> {
    const seq = ++this.typeSeq;
    this.hintTimer?.remove();
    this.holdClock = true;
    this.nameText.setText(`${p.profile.name}{dim}(${p.profile.age})`);
    this.remark.clear();
    await this.profTyper.type(p.profile.line, PROFILE_CPS);
    if (seq !== this.typeSeq) return;
    await this.remark.say(p.hint.text, p.hint.face, { speed: REMARK_CPS, instant: this.skipSeq === seq });
    if (seq === this.typeSeq) this.holdClock = false;
  }

  /** 文字送りを飛ばす(プロフィールも一言も全部すぐ出す) */
  private skipTyping(): void {
    this.skipSeq = this.typeSeq;
    this.profTyper.skip();
    this.remark.skip();
  }

  /** いま時計が止まっているか */
  private clockStopped(): boolean {
    return this.state === 'play' && this.holdClock && (this.profTyper.isTyping || this.remark.isTyping);
  }

  // ─── 指で動かす ─────────────────────────────────

  private onDrag(dx: number): void {
    if (this.state !== 'play' || this.locked) return;
    this.hideGuide();
    this.dragDx = dx;
    this.card.x = CX + dx;
    this.card.angle = Phaser.Math.Clamp(Math.round(dx / 4), -14, 14);
    this.shadow.x = this.card.x;
    const ready = Math.abs(dx) >= 36;
    this.preview.bad.setVisible(ready && dx < 0).setPosition(this.card.x, STAMP_Y);
    this.preview.civ.setVisible(ready && dx > 0).setPosition(this.card.x, STAMP_Y);
  }

  private hidePreview(): void {
    this.preview.bad.setVisible(false);
    this.preview.civ.setVisible(false);
  }

  private snapBack(): void {
    if (this.state !== 'play') return;
    this.dragDx = 0;
    this.hidePreview();
    const s = this.card;
    this.tweens.add({
      targets: s, x: CX, angle: 0, duration: 90, ease: 'Quad.easeOut',
      onUpdate: () => { s.x = Math.round(s.x); this.shadow.x = s.x; }
    });
  }

  // ─── 仕分け ─────────────────────────────────────

  /** ボタンやキーで仕分け */
  private press(choice: SortChoice): void {
    if (this.state === 'intro') { this.skipIntro(); return; }
    this.decide(choice);
  }

  private decide(choice: SortChoice): void {
    if (this.state !== 'play' || this.locked) return;
    const p = this.people[this.idx];
    this.hideGuide();
    setSort(this.run, p, choice);
    audio.sfx(choice === 'bad' ? 'swipeBad' : 'swipeCiv');
    this.stampAndThrow(choice);
    this.idx++;
    this.dragDx = 0;
    if (this.idx >= this.people.length) {
      this.locked = true;
      this.time.delayedCall(OUT_MS + 40, () => this.finish());
      return;
    }
    this.locked = true;
    this.enter(this.idx, IN_DELAY, false, choice === 'bad' ? 'right' : 'left');
  }

  /** いまの人にハンコを押して、左右へ飛ばす */
  private stampAndThrow(choice: SortChoice, mark = ''): void {
    const s = this.card;
    const dir = choice === 'bad' ? -1 : 1;
    this.hidePreview();
    this.tweens.killTweensOf(s);
    this.idle = false;
    this.glitching = false;
    this.zoom.clear();
    const stamp = makeStamp(this, choice, FS.big, mark).setDepth(Z.stamp);
    stamp.setPosition(Math.round(s.x), STAMP_Y);
    popStamp(this, stamp);
    shake(this, 2, 90);
    this.glowKick = { side: dir < 0 ? 'left' : 'right', until: this.time.now + 220 };
    this.shadow.setVisible(false);
    const endX = dir < 0 ? -70 : layout.W + 70;
    const dist = endX - s.x;
    this.tweens.add({
      targets: s, x: endX, angle: dir * 40, duration: OUT_MS, delay: 40, ease: 'Quad.easeIn',
      onUpdate: () => { s.x = Math.round(s.x); },
      onComplete: () => s.setVisible(false)
    });
    this.tweens.add({
      targets: stamp, x: `+=${dist}`, duration: OUT_MS, delay: 40, ease: 'Quad.easeIn',
      onComplete: () => stamp.destroy()
    });
  }

  // ─── 時間 ───────────────────────────────────────

  override update(_t: number, dt: number): void {
    this.drawGlow();
    this.zoom.sync(this.card, this.idle);
    const stopped = this.clockStopped() && this.idx < this.people.length;
    if (this.stopTag.visible !== stopped) this.stopTag.setVisible(stopped);
    // 全員決めたら時計を止める(次へ行くまでの間に「時間切れ」にならないように)
    if (this.state !== 'play' || this.idx >= this.people.length) return;
    // プロフィールと一言を出している間は、時計を進めない
    if (stopped) return;
    this.leftMs -= dt;
    this.personSec += dt / 1000;
    this.updateGlitch();
    const sec = Math.ceil(this.leftMs / 1000);
    if (!this.hurried && this.leftMs <= HURRY_AT_SEC * 1000) this.hurry();
    if (this.hurried && sec < this.lastTickSec && sec > 0) {
      this.lastTickSec = sec;
      audio.sfx('tick');
    }
    this.updateHud();
    if (this.leftMs <= 0) { this.leftMs = 0; this.updateHud(); void this.timeUp(); }
  }

  /**
   * 宇宙人のくずれ。glitchShowing の間はくずれの行(4コマ)を出し、終わったら仕分けの動きに戻す。
   * くずれの長さ(ふつう0.2秒、練習用は0.3秒)で4コマを出し切るように、コマの速さをその人に合わせる。
   * 時計が進んだときだけ呼ぶ(止まっている間は、くずれも出始めない)。
   * 重い端末でコマが落ちて、0.2秒のくずれの間に一度も描かれないことがないように、始まった回数で出し始める
   */
  private updateGlitch(): void {
    const p = this.people[this.idx];
    if (!p?.glitch) return;
    const count = glitchCount(p.glitch, this.personSec);
    const fresh = count > this.glitchStarts;
    this.glitchStarts = count;
    // 横から入ってくる途中は出さない
    if (!this.idle) return;
    const key = this.card.texture.key;
    const show = glitchShowing(p.glitch, this.personSec);
    if (fresh || (show && !this.glitching)) {
      this.glitching = true;
      this.card.play({ key: animKey(key, 'glitch'), frameRate: 4 / p.glitch.showSec });
      audio.sfx('glitch');
    } else if (this.glitching && !show) {
      this.glitching = false;
      this.card.play(animKey(key, 'sortIdle'));
    } else {
      return;
    }
    // 「持ち物」の窓も、このコマから同じ絵にする(次のコマまで待つと、1コマずれる)
    this.zoom.sync(this.card, this.idle);
  }

  /** 残り5秒:端が赤く点滅し、オペレーターが急かす。少ししたら今の人の一言に戻す */
  private hurry(): void {
    this.hurried = true;
    this.lastTickSec = HURRY_AT_SEC + 1;
    this.alarm.start();
    const s = say('sortHurry');
    // 急かす一言の文字送りでは時計を止めない
    this.typeSeq++;
    this.holdClock = false;
    void this.remark.say(s.text, s.face, { who: s.who, alarm: true, speed: REMARK_CPS });
    const personAt = this.idx;
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(1100, () => {
      if (this.state !== 'play' || this.idx !== personAt) return;
      const p = this.people[this.idx];
      if (p) void this.remark.say(p.hint.text, p.hint.face, { instant: true });
    });
  }

  /** 時間切れ:残りの人はヒーローが気まぐれで決める */
  private async timeUp(): Promise<void> {
    if (this.state !== 'play') return;
    this.state = 'timeup';
    this.locked = true;
    this.hideGuide();
    this.swipe.reset();
    this.hintTimer?.remove();
    this.alarm.stop();
    audio.sfx('timeUp');
    flash(this, UI.bad, 2);
    this.tweens.killTweensOf(this.card);
    // くずれの途中で時間切れになったら、仕分けの動きに戻す
    if (this.glitching) { this.glitching = false; this.card.play(animKey(this.card.texture.key, 'sortIdle')); }
    this.card.setPosition(CX, FEET_Y).setAngle(0);
    this.shadow.setVisible(true).setX(CX);
    const filled = fillUnsorted(this.run);
    const s: Speech = say('timeUp');
    this.typeSeq++;
    this.profTyper.skip();
    void this.remark.say(s.text, s.face, { who: s.who, alarm: true, speed: REMARK_CPS });
    this.nameText.setText('時間切れ！');
    this.lineText.setText('残りはヒーローが\n気まぐれで決めます');
    void banner(this, '時間切れ！', { hold: 500, y: 128 });
    await waitMs(this, 750);
    // 残りの人に、ヒーローが決めたハンコを次々に押す
    for (let k = 0; k < filled.length; k++) {
      const p = filled[k];
      if (k > 0) {
        this.idx = this.people.indexOf(p);
        this.enter(this.people.indexOf(p), 0, true, this.run.sorts[filled[k - 1].id] === 'bad' ? 'right' : 'left');
        await waitMs(this, 110);
      }
      const c = this.run.sorts[p.id];
      audio.sfx(c === 'bad' ? 'swipeBad' : 'swipeCiv');
      audio.sfx('stamp', { volume: 0.7 });
      this.stampAndThrow(c, '?');
      this.nameText.setText('時間切れ！');
      this.profTyper.show('残りはヒーローが\n気まぐれで決めます');
      await waitMs(this, 200);
    }
    this.idx = this.people.length;
    await waitMs(this, 250);
    this.leave();
  }

  /** 全員仕分けた:すぐ結果発表へ */
  private finish(): void {
    if (this.state === 'done') return;
    this.state = 'done';
    this.alarm.stop();
    this.hintTimer?.remove();
    this.typeSeq++;
    this.holdClock = false;
    const s = say('sortDone');
    void this.remark.say(s.text, s.face, { who: s.who, speed: REMARK_CPS });
    this.nameText.setText('仕分け完了！');
    this.profTyper.show('');
    this.time.delayedCall(260, () => this.leave());
  }

  private leave(): void {
    this.state = 'done';
    gotoWhenFree(this, SCENES.street, undefined, { kind: 'wipe' });
  }

  // ─── 端の光 ─────────────────────────────────────

  private drawGlow(): void {
    const now = this.time.now;
    const pulse = Math.floor(now / 400) % 2 === 0 ? 0.12 : 0.28;
    let l = pulse, r = pulse;
    const pull = Math.min(1, Math.abs(this.dragDx) / 36);
    if (this.dragDx < 0) l = Math.max(l, pull);
    if (this.dragDx > 0) r = Math.max(r, pull);
    if (this.glowKick && now < this.glowKick.until) {
      if (this.glowKick.side === 'left') l = 1; else r = 1;
    }
    // 強いときは1コマおきに点滅させる
    const flick = Math.floor(this.game.loop.frame / 2) % 2 === 0;
    const lq = Math.round(l * 8) / 8, rq = Math.round(r * 8) / 8;
    const key = `${lq}|${rq}|${lq >= 0.9 || rq >= 0.9 ? flick : ''}`;
    if (key === this.glowKey) return;
    this.glowKey = key;
    const g = this.glow;
    g.clear();
    if (!(lq >= 0.9 && !flick)) edgeGlow(g, 'left', RED, lq);
    if (!(rq >= 0.9 && !flick)) edgeGlow(g, 'right', rq >= 0.5 ? BLUE_LIGHT : BLUE, rq);
    // 引っぱっている側の文字を白く光らせる
    const lc = lq >= 0.6 ? 0xffffff : 0xff8a80, rc = rq >= 0.6 ? 0xffffff : 0x9ac4ff;
    if (this.edgeLabels[0].style.color !== lc) this.edgeLabels[0].setColor(lc);
    if (this.edgeLabels[1].style.color !== rc) this.edgeLabels[1].setColor(rc);
  }
}
