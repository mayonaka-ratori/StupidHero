// 仕分け。人が1人ずつスポットライトの下に出てくる。左にスワイプ(◀ワル)でワル、右(市民▶)で市民。
// 時間は波ごと(wave.seconds)。残り5秒で画面の端が赤く点滅し、オペレーターが急かす。
// 全員仕分けたらすぐ結果発表(Street)へ。時間切れなら残りをヒーローが気まぐれで決めて Street へ。
// 1人3秒くらいで決めるゲームなので、入れ替わりは0.2秒くらいにして待たせない。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey, originFor } from '../art/sheets';
import { HURRY_AT_SEC, WAVE_INTRO, say, type Person, type SortChoice, type Speech } from '../logic';
import { currentWave, fillUnsorted, getRun, setSort, type GameRun } from '../run';
import {
  Button, CutIn, EdgeAlarm, FS, IconButton, PauseControl, PixelText, SwipeInput, TimeBar, WindowFrame,
  addPanel, banner, flash, panelRect, shake
} from '../ui';
import {
  BLUE, BLUE_LIGHT, RED, Z, addMute, devHook, drawAlley, gotoSafe, drawLightPool, edgeGlow, spotlightDim, unlockOnTap
} from './sort/common';
import { makeStamp, popStamp } from './sort/stamp';
import { drawHand } from './sort/introDemo';

const CX = 108;
const FEET_Y = 204;
const SCALE = 2;
/** 入れ替わりの時間(ミリ秒) */
const OUT_MS = 140;
const IN_MS = 130;
const IN_DELAY = 50;
/** 人の絵の上の、ハンコを押す高さ */
const STAMP_Y = FEET_Y - 74;

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

  private cards: Phaser.GameObjects.Sprite[] = [];
  private card!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Sprite;
  private cut!: CutIn;
  private countText!: PixelText;
  private secText!: PixelText;
  private timeBar!: TimeBar;
  private nameText!: PixelText;
  private lineText!: PixelText;
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
    this.totalMs = wave.seconds * 1000;
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
    // シーンは波ごとに作り直すので、前の波の絵を持ち越さない
    this.cards = [];
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
      buttons: () => [this.btnBad, this.btnCiv].map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })),
      setLeft: (ms: number) => { this.leftMs = ms; },
      state: () => ({ state: this.state, idx: this.idx, total: this.people.length, leftMs: Math.round(this.leftMs), locked: this.locked, sorts: { ...this.run.sorts }, random: [...this.run.randomSorted], wave: this.run.waveIndex + 1 })
    });

    void this.playIntro();
  }

  // ─── 画面を組む ─────────────────────────────────

  private buildAction(W: number): void {
    // 暗くした路地裏と、真ん中のスポットライト
    drawAlley(this);
    this.add.image(0, 0, spotlightDim(this, CX, FEET_Y)).setOrigin(0).setDepth(Z.dim);
    const pool = this.add.graphics().setDepth(Z.dim + 0.5);
    drawLightPool(pool, CX, FEET_Y + 1, 46, 7);
    // 左右の端の光(左が赤でワル、右が青で市民)
    this.glow = this.add.graphics().setDepth(Z.glow);
    const lbl = (x: number, text: string, color: number, ox: number): PixelText =>
      new PixelText(this, x, 140, text, { size: FS.body, color, outline: true, align: 'center', lineSpacing: 1 }).setOrigin(ox, 0.5).setDepth(Z.glow + 1);
    this.edgeLabels = [lbl(5, '◀\nワ\nル', 0xff8a80, 0), lbl(W - 5, '▶\n市\n民', 0x9ac4ff, 1)];

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

    // 左上:ステージ、何人目、時間
    new PixelText(this, 4, 3, 'STAGE1', { size: FS.body, color: UI.gold, outline: true });
    this.countText = new PixelText(this, 4, 18, '', { size: FS.body, outline: true });
    this.timeBar = new TimeBar(this, 4, 35, 40, 6);
    this.secText = new PixelText(this, 4, 44, '', { size: FS.big, outline: true });
    this.pause = new PauseControl(this, { onResume: () => audio.unlock() });
    new IconButton(this, 13, 76, 'pause', () => this.pause.pause());
    addMute(this, 35, 76);
    this.alarm = new EdgeAlarm(this);

    // 右上:オペレーターのカットイン
    this.cut = new CutIn(this, 48, 3, 165, 60, { speed: 60 });
    this.updateHud();
  }

  private buildPanel(): void {
    addPanel(this);
    const r = panelRect();
    const hintH = 16;
    const bh = Phaser.Math.Clamp(r.h - hintH - 8 - 76, 40, 80);
    const profH = Phaser.Math.Clamp(r.h - bh - 8 - hintH, 52, 76);
    // 縦に余裕があれば、プロフィールを大きな字(16)にする
    const big = profH >= 72;
    new WindowFrame(this, r.x, r.y, r.w, profH, 'win');
    this.nameText = new PixelText(this, r.x + 7, r.y + (big ? 7 : 5), '', { size: big ? FS.big : FS.body, color: UI.gold });
    this.lineText = new PixelText(this, r.x + 7, r.y + (big ? 29 : 20), '', { size: big ? FS.big : FS.body, wrap: r.w - 14, lineSpacing: big ? 3 : 2 });
    // ボタンは親指が届く下のほうに
    const by = r.bottom - hintH - bh;
    const bw = Math.floor((r.w - 8) / 2);
    this.btnBad = new Button(this, r.x, by, bw, bh, '◀ワル', { color: 'bad', onPress: () => this.press('bad') });
    this.btnCiv = new Button(this, r.x + bw + 8, by, bw, bh, '市民▶', { color: 'civ', onPress: () => this.press('civ') });
    new PixelText(this, Math.round(layout.W / 2), by + bh + 4, '左右にスワイプでもOK', { size: FS.body, color: UI.textDim }).setOrigin(0.5, 0);
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
    this.lineText.setText(`{gold}${this.people.length}人{/}を仕分けて！\n時間は{gold}${wave.seconds}秒{/}`);
    audio.sfx('reveal', { volume: 0.6 });
    void banner(this, `WAVE ${wave.no}`, { hold: 700, y: 128 });
    await this.sleep(200);
    for (const s of WAVE_INTRO[wave.no]) {
      if (this.introSkip) break;
      await this.cut.say(s.text, s.face, { who: s.who, speed: 45 });
      await this.sleep(450);
    }
    this.startPlay();
  }

  private skipIntro(): void {
    if (this.state !== 'intro') return;
    this.introSkip = true;
    this.cut.skip();
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
    this.tweens.killTweensOf(s);
    s.setTexture(p.sheetKey).setOrigin(...originFor(p.sheetKey)).setAngle(0).setDepth(Z.actor);
    const sx = from === 'right' ? CX + 64 : CX - 64;
    s.setPosition(sx, FEET_Y).setVisible(true).setFlipX(from === 'right');
    s.play(animKey(p.sheetKey, 'walk'));
    this.shadow.setVisible(true).setX(sx);
    if (this.state !== 'timeup') this.showProfile(p);
    this.updateHud();
    const ms = fast ? 80 : IN_MS;
    this.tweens.add({
      targets: [s, this.shadow], x: CX, delay, duration: ms, ease: 'Quad.easeOut',
      onUpdate: () => { s.x = Math.round(s.x); this.shadow.x = s.x; },
      onComplete: () => {
        s.setFlipX(false);
        s.play(animKey(p.sheetKey, 'sortIdle'));
        if (this.state === 'play') this.locked = false;
      }
    });
    if (this.state === 'play') {
      this.cut.say(p.hint.text, p.hint.face, { who: 'operator', speed: 60 });
      this.hintTimer?.remove();
    }
  }

  private showProfile(p: Person): void {
    this.nameText.setText(`${p.profile.name}{dim}(${p.profile.age})`);
    this.lineText.setText(p.profile.line);
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

  update(_t: number, dt: number): void {
    this.drawGlow();
    if (this.state !== 'play') return;
    this.leftMs -= dt;
    const sec = Math.ceil(this.leftMs / 1000);
    if (!this.hurried && this.leftMs <= HURRY_AT_SEC * 1000) this.hurry();
    if (this.hurried && sec < this.lastTickSec && sec > 0) {
      this.lastTickSec = sec;
      audio.sfx('tick');
    }
    this.updateHud();
    if (this.leftMs <= 0) { this.leftMs = 0; this.updateHud(); void this.timeUp(); }
  }

  /** 残り5秒:端が赤く点滅し、オペレーターが急かす。少ししたら今の人のヒントに戻す */
  private hurry(): void {
    this.hurried = true;
    this.lastTickSec = HURRY_AT_SEC + 1;
    this.alarm.start();
    const s = say('sortHurry');
    this.cut.say(s.text, s.face, { who: s.who, alarm: true, speed: 60 });
    const personAt = this.idx;
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(1100, () => {
      if (this.state !== 'play' || this.idx !== personAt) return;
      const p = this.people[this.idx];
      if (p) this.cut.say(p.hint.text, p.hint.face, { who: 'operator', speed: 90 });
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
    this.card.setPosition(CX, FEET_Y).setAngle(0);
    this.shadow.setVisible(true).setX(CX);
    const filled = fillUnsorted(this.run);
    const s: Speech = say('timeUp');
    this.cut.say(s.text, s.face, { who: s.who, alarm: true, speed: 60 });
    this.nameText.setText('時間切れ！');
    this.lineText.setText('残りはヒーローが\n気まぐれで決めます');
    void banner(this, '時間切れ！', { hold: 500, y: 128 });
    await this.wait(750);
    // 残りの人に、ヒーローが決めたハンコを次々に押す
    for (let k = 0; k < filled.length; k++) {
      const p = filled[k];
      if (k > 0) {
        this.idx = this.people.indexOf(p);
        this.enter(this.people.indexOf(p), 0, true, this.run.sorts[filled[k - 1].id] === 'bad' ? 'right' : 'left');
        await this.wait(110);
      }
      const c = this.run.sorts[p.id];
      audio.sfx(c === 'bad' ? 'swipeBad' : 'swipeCiv');
      audio.sfx('stamp', { volume: 0.7 });
      this.stampAndThrow(c, '?');
      this.nameText.setText('時間切れ！');
      this.lineText.setText('残りはヒーローが\n気まぐれで決めます');
      await this.wait(200);
    }
    this.idx = this.people.length;
    await this.wait(250);
    this.leave();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  /** 全員仕分けた:すぐ結果発表へ */
  private finish(): void {
    if (this.state === 'done') return;
    this.state = 'done';
    this.alarm.stop();
    this.hintTimer?.remove();
    const s = say('sortDone');
    this.cut.say(s.text, s.face, { who: s.who, speed: 60 });
    this.nameText.setText('仕分け完了！');
    this.lineText.setText('');
    this.time.delayedCall(260, () => this.leave());
  }

  private leave(): void {
    this.state = 'done';
    gotoSafe(this, SCENES.street);
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
