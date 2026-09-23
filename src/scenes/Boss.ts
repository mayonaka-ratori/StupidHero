// ボス戦。結果発表(Street)で波3のボスが正体を現したあとに来る。行け!ボタンの連打でボスを倒し、Result へ。
// 決まりは docs/SPEC.md の「ボス」「ボス戦」。連打の計算は logic の BossFight。
//
// 流れ:ボス出現!の帯 → 2人のセリフ → 「連打!」 → 連打(手が止まるとボスが暴れて被害額が増える)
//   → 撃破(いちばんひどい場面なら撮る)→ 爆発と勝利ポーズ → Result
// 一時停止中はシーンごと止まるので update が呼ばれず、BossFight の時計も止まる。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { animKey, originFor } from '../art/sheets';
import { audio } from '../audio';
import { BOSS, BossFight, findBoss, formatSeconds, formatYen, say, type Speech } from '../logic';
import { getRun, type GameRun } from '../run';
import {
  Button, CutIn, EdgeAlarm, FS, HpBar, IconButton, MuteButton, PauseControl, PixelText,
  addPanel, banner, blink, flash, gotoWhenFree, hitStop, impact, panelRect, popText, shake, tapSpark
} from '../ui';
import { DEPTH_OF } from './boss/depth';
import { flyPunch, spawnFx, SpeedLines, throwDebris } from './boss/effects';
import { BossHud, RushMeter } from './boss/hud';
import { BossProps } from './boss/props';
import { px, snapshotLogical } from '../hires';

/** 背景の奥の層が手前に対してどれだけ動くか(Street と合わせる) */
const FAR_PARALLAX = 0.25;
/** 足の裏の高さ */
const FEET_Y = 194;
const HERO_X = 82;
const BOSS_X = 152;
/** ボスの体の、ラッシュが当たるあたり(ボスは左向き) */
const HIT_X = BOSS_X - 12;
const HIT_Y = FEET_Y - 52;
/** 最後の連打からこの時間がたったら、ラッシュの動きをやめる(ms) */
const RUSH_HOLD_MS = 380;

type Phase = 'intro' | 'fight' | 'end';

export class BossScene extends Phaser.Scene {
  private run!: GameRun;
  private fight!: BossFight;
  private phase: Phase = 'intro';
  private hero!: Phaser.GameObjects.Sprite;
  private boss!: Phaser.GameObjects.Sprite;
  private aura!: Phaser.GameObjects.Sprite;
  private hp!: HpBar;
  private cut!: CutIn;
  private go!: Button;
  private hud!: BossHud;
  private meter!: RushMeter;
  private props!: BossProps;
  private lines!: SpeedLines;
  private alarm!: EdgeAlarm;
  private pause!: PauseControl;
  private icons: Phaser.GameObjects.GameObject[] = [];
  private comboText!: PixelText;
  private timeText!: PixelText;
  private mashText!: PixelText;
  private combo = 0;
  private lastTapAt = -1e9;
  private heroPush = 0;
  private bossPush = 0;
  private whiteFrames = 0;
  private frame = 0;
  private wasIdle = false;
  private lastIdleLineAt = -1e9;
  private lastRushLineAt = -1e9;
  private shownTime = '';
  private punchSide = 0;
  private fightStartAt = 0;

  constructor() { super(SCENES.boss); }

  create(): void {
    this.run = getRun(this);
    this.fight = new BossFight();
    this.phase = 'intro';
    this.combo = 0;
    this.lastTapAt = -1e9;
    this.heroPush = this.bossPush = this.whiteFrames = this.frame = 0;
    this.wasIdle = false;
    this.lastIdleLineAt = this.lastRushLineAt = -1e9;
    this.shownTime = '';
    this.icons = [];
    if (import.meta.env.DEV && this.run.debug) (window as unknown as { bossScene?: BossScene }).bossScene = this;

    const { W, actionH } = layout;
    this.drawBackground();
    this.props = new BossProps(this);
    this.lines = new SpeedLines(this, 40, actionH - 12, W);

    // ヒーローとボスが向かい合う
    this.add.sprite(HERO_X, FEET_Y + 1, 'fx_shadow').setDepth(DEPTH_OF.shadow);
    this.add.sprite(BOSS_X, FEET_Y + 1, 'fx_shadow').setDepth(DEPTH_OF.shadow).setScale(2, 1);
    this.aura = this.add.sprite(HERO_X, FEET_Y, 'fx_aura', 0).setOrigin(...originFor('hero')).setDepth(DEPTH_OF.aura).setVisible(false);
    this.playAnim(this.aura, 'fx_aura', 'play');
    this.hero = this.add.sprite(HERO_X, FEET_Y, 'hero', 0).setOrigin(...originFor('hero')).setDepth(DEPTH_OF.hero);
    this.playAnim(this.hero, 'hero', 'idle');
    this.boss = this.add.sprite(BOSS_X, FEET_Y, 'boss', 0).setOrigin(...originFor('boss')).setDepth(DEPTH_OF.boss).setFlipX(true);
    this.playAnim(this.boss, 'boss', 'idle');

    // 上:体力のバー、連打の数、時計、中断と音
    this.hp = new HpBar(this, 8, 26, W - 16, 8, 'ボス', { ticks: 4 });
    this.hp.setValue(1);
    this.comboText = new PixelText(this, 8, 40, '', { size: FS.big, outline: true }).setVisible(false);
    this.timeText = new PixelText(this, W - 8, 40, '', { size: FS.body, color: UI.textDim, outline: true }).setOrigin(1, 0);
    this.mashText = new PixelText(this, Math.floor(W / 2), 78, '連打!', { size: 32, color: UI.gold, outline: true })
      .setOrigin(0.5, 0.5).setVisible(false);
    this.alarm = new EdgeAlarm(this);

    this.pause = new PauseControl(this);
    this.icons.push(new IconButton(this, W - 12, 12, 'pause', () => this.pause.pause()));
    this.icons.push(new MuteButton(this, W - 34, 12, { isMuted: () => audio.isMuted(), toggle: () => audio.toggleMuted() }));

    // 下:撃破、負傷、被害額、カットイン、大きな行け!ボタン
    addPanel(this);
    const r = panelRect();
    this.hud = new BossHud(this, r.x, r.y, r.w);
    this.hud.refresh(this.run.stats);
    const cutY = r.y + BossHud.H + 4;
    this.cut = new CutIn(this, r.x, cutY, r.w, 46);
    this.cut.hide();
    const by = cutY + 46 + 5;
    const bh = r.bottom - by;
    this.go = new Button(this, r.x, by, r.w, bh, '行け!', { color: 'go', size: 32, onPress: (p) => this.onPress(p) });
    this.go.setEnabled(false);
    this.meter = new RushMeter(this, r.x + 8, by + 6, r.w - 16);
    this.meter.setVisible(false);

    // どこを触っても音を出せるようにし、始まりのセリフは触ると早送りする
    this.input.on('pointerdown', () => {
      audio.unlock();
      if (this.phase !== 'fight') this.cut.skip();
    });

    audio.playBgm('boss');
    void this.intro();
  }

  // ─── 背景 ───

  private drawBackground(): void {
    const { W, actionH } = layout;
    const sx = Math.round(this.run.scrollX);
    this.add.tileSprite(0, 0, W, actionH, 'bg_alley_far').setOrigin(0).setDepth(DEPTH_OF.far)
      .setTilePosition(Math.round(sx * FAR_PARALLAX), 0);
    this.add.tileSprite(0, 0, W, 130, 'bg_alley_wall').setOrigin(0).setDepth(DEPTH_OF.wall).setTilePosition(sx, 0);
    this.add.tileSprite(0, 124, W, 90, 'bg_alley_ground').setOrigin(0).setDepth(DEPTH_OF.ground).setTilePosition(sx, 0);
  }

  private playAnim(s: Phaser.GameObjects.Sprite, sheet: string, anim: string, ignoreIfPlaying = true): void {
    const key = animKey(sheet, anim);
    if (this.anims.exists(key)) s.play(key, ignoreIfPlaying);
  }

  // ─── 始まり ───

  private async intro(): Promise<void> {
    await this.wait(250);
    audio.sfx('reveal');
    shake(this, 3, 300);
    spawnFx(this, 'fx_dust', BOSS_X - 20, FEET_Y - 8);
    spawnFx(this, 'fx_dust', BOSS_X + 22, FEET_Y - 6);
    await banner(this, 'ボス出現!');
    const boss = findBoss(this.run.stage);
    const sortedCiv = boss ? this.run.sorts[boss.id] === 'civ' : false;
    const rng = this.run.rng;
    await this.speak(say(sortedCiv ? 'bossRampageHero' : 'bossStartHero', rng));
    await this.wait(250);
    await this.speak(say('bossStart', rng));
    await this.wait(200);
    this.startFight();
  }

  private speak(s: Speech, alarm = false): Promise<void> {
    if (!this.sys.isActive() && !this.sys.isPaused()) return Promise.resolve();
    return this.cut.say(s.text, s.face, { who: s.who, alarm });
  }

  /** シーンの時計で待つ(一時停止中は止まる) */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private startFight(): void {
    if (this.phase !== 'intro') return;
    this.phase = 'fight';
    this.go.setEnabled(true);
    this.meter.setVisible(true);
    this.meter.update(0);
    this.fightStartAt = this.time.now;
    flash(this, 0xffffff, 1);
    shake(this, 3, 200);
    audio.sfx('go');
  }

  // ─── 連打 ───

  private onPress(p: Phaser.Input.Pointer): void {
    audio.unlock();
    if (this.phase !== 'fight') return;
    const q = px(p);
    tapSpark(this, q.x, q.y, UI.gold);
    const res = this.fight.tap();
    const tps = this.fight.tapsPerSec;
    const power = tps / BOSS.maxTapsPerSec; // 0〜1
    this.combo++;
    this.lastTapAt = this.time.now;

    // ヒーローのラッシュ:押すほど速く、前へ出る
    if (this.hero.anims.currentAnim?.key !== animKey('hero', 'punch')) {
      const key = animKey('hero', 'punch');
      if (this.anims.exists(key)) this.hero.play({ key, repeat: -1 });
    }
    this.hero.anims.timeScale = 1.2 + power * 3.3;
    this.heroPush = Math.min(12, this.heroPush + 3);
    this.bossPush = Math.min(8, this.bossPush + 2);
    this.playAnim(this.boss, 'boss', 'hit');
    this.whiteFrames = 2;

    // 光の拳と火花
    this.punchSide ^= 1;
    const fy = HIT_Y + (this.punchSide ? -8 : 6) + Phaser.Math.Between(-3, 3);
    const hx = HIT_X + this.bossPush;
    flyPunch(this, this.hero.x + 24, hx - 6, fy, 50);
    spawnFx(this, 'fx_hit_big', hx + Phaser.Math.Between(-6, 6), fy + Phaser.Math.Between(-4, 4), { depth: DEPTH_OF.fxTop, speed: 1 + power });
    if (tps >= 6) spawnFx(this, 'fx_hit', hx + Phaser.Math.Between(-18, 14), HIT_Y + Phaser.Math.Between(-24, 22), { depth: DEPTH_OF.fxTop });
    if (tps >= 9 && this.combo % 2 === 0) throwDebris(this, hx, fy, Phaser.Math.Between(20, 50), Phaser.Math.Between(10, 40), 360);

    // 音と揺れ
    audio.sfx('rush', { pitch: 1 + power * 0.25 });
    if (this.combo % 3 === 0) audio.sfx('hit', { volume: 0.5 + power * 0.4, pitch: 0.9 + Math.random() * 0.2 });
    shake(this, 1 + Math.round(power * 3), 90);

    // 体力のバー
    this.hp.setValue(this.fight.hpRatio);
    this.hp.hit();

    // 連打の数
    this.comboText.setText(`{gold}${this.combo}{/}連打!`).setVisible(true);
    this.comboText.y = 38;
    if (this.combo % 10 === 0) {
      audio.sfx('bigHit');
      flash(this, 0xffffff, 1);
      hitStop(this, 40);
      popText(this, hx, HIT_Y - 30, `${this.combo}連打!`, { color: UI.gold, size: FS.big });
    }

    // 暴れていたのを止めた
    if (this.wasIdle) this.endIdle();

    if (tps >= 8 && this.time.now - this.lastRushLineAt > 4000 && !this.cut.isTyping) {
      this.lastRushLineAt = this.time.now;
      void this.speak(say('bossRush'));
    }

    if (res.defeated) this.onDefeated();
  }

  update(_time: number, delta: number): void {
    this.frame++;
    if (this.phase !== 'fight') {
      if (this.phase === 'end') this.lines.update(0);
      return;
    }
    const r = this.fight.update(Math.min(delta, 100));
    if (r.damageYen > 0) {
      this.run.stats.addBossDamage(r.damageYen);
      const each = r.damageYen / Math.max(1, r.idleTicks);
      for (let i = 0; i < r.idleTicks; i++) this.rampageTick(each);
    }
    this.hp.setValue(this.fight.hpRatio);
    this.hud.refresh(this.run.stats);
    if (r.defeated) { this.onDefeated(); return; }

    const tps = this.fight.tapsPerSec;
    const power = tps / BOSS.maxTapsPerSec;
    const rushing = this.time.now - this.lastTapAt < RUSH_HOLD_MS;

    // 手が止まった:ボスが暴れる
    const idle = this.fight.isIdle;
    if (idle && !this.wasIdle) this.startIdle();

    // ヒーロー
    if (!rushing && !idle && this.hero.anims.currentAnim?.key === animKey('hero', 'punch')) this.playAnim(this.hero, 'hero', 'idle');
    if (!rushing) this.heroPush = Math.max(0, this.heroPush - 0.6);
    else this.heroPush = Math.max(0, this.heroPush - 0.35);
    // 連打中は前後に細かく揺れて、止まって見えないようにする
    const jitter = rushing ? (this.frame % 2 === 0 ? 1 : -1) * Math.min(2, 1 + Math.floor(power * 2)) : 0;
    this.hero.x = Math.round(HERO_X + this.heroPush + jitter);
    this.aura.x = this.hero.x;
    this.aura.setVisible(rushing && tps >= 4 && this.frame % 2 === 0);

    // ボス
    this.bossPush = Math.max(0, this.bossPush - 0.4);
    const bossJit = rushing ? (this.frame % 2 === 0 ? 1 : 0) : 0;
    this.boss.x = Math.round(BOSS_X + this.bossPush + bossJit);
    if (this.whiteFrames > 0) { this.boss.setTintFill(0xffffff); this.whiteFrames--; } else this.boss.clearTint();
    if (!rushing && !idle && this.boss.anims.currentAnim?.key === animKey('boss', 'hit')) this.playAnim(this.boss, 'boss', 'idle');

    // 連打の数は止まると消える
    if (!rushing && this.time.now - this.lastTapAt > 900 && this.comboText.visible) { this.comboText.setVisible(false); this.combo = 0; }
    if (this.comboText.visible && this.comboText.y < 40) this.comboText.y++;

    this.lines.update(rushing && tps >= 6 ? power : 0);
    this.meter.update(tps);
    // 「連打!」:始まりの0.9秒と、手が止まっている間だけ点滅
    const intro = this.time.now - this.fightStartAt < 900;
    this.mashText.setVisible((intro && this.frame % 4 < 2) || (idle && Math.floor(this.frame / 8) % 2 === 0));

    const t = formatSeconds(this.fight.elapsedSec);
    if (t !== this.shownTime) { this.shownTime = t; this.timeText.setText(t); }
  }

  // ─── 手が止まっているとき ───

  private startIdle(): void {
    this.wasIdle = true;
    this.playAnim(this.boss, 'boss', 'rampage');
    this.playAnim(this.hero, 'hero', 'idle');
    this.alarm.start();
    audio.sfx('rampage');
    if (this.time.now - this.lastIdleLineAt > 2500) {
      this.lastIdleLineAt = this.time.now;
      void this.speak(say('bossIdle'), true);
    }
  }

  private endIdle(): void {
    this.wasIdle = false;
    this.alarm.stop();
  }

  /** 1秒ぶん暴れた:まわりの物を1つ壊し、被害額を飛ばす */
  private rampageTick(yen: number): void {
    audio.sfx('rampage', { pitch: 0.9 + Math.random() * 0.2 });
    spawnFx(this, 'fx_dust', BOSS_X + Phaser.Math.Between(-24, 24), FEET_Y - 8);
    const prop = this.props.takeNext();
    const label = formatYen(yen);
    if (prop) {
      const c = BossProps.centerOf(prop);
      // ボスが投げたがれきが飛んでいって当たる
      throwDebris(this, BOSS_X, FEET_Y - 60, c.x - BOSS_X, c.y - (FEET_Y - 60), 180);
      this.time.delayedCall(180, () => {
        prop.setFrame(1);
        audio.sfx('break');
        impact(this, 'small');
        spawnFx(this, 'fx_hit', c.x, c.y, { depth: DEPTH_OF.fxTop });
        for (let i = 0; i < 4; i++) throwDebris(this, c.x, c.y, Phaser.Math.Between(-40, 40), Phaser.Math.Between(10, 50));
        popText(this, c.x, c.y - 10, label, { color: UI.danger, size: FS.big });
      });
    } else {
      // もう壊す物がないときは地面をたたき割る
      const x = Phaser.Math.Between(24, 192);
      spawnFx(this, 'fx_dust', x, FEET_Y - 4);
      for (let i = 0; i < 4; i++) throwDebris(this, x, FEET_Y - 6, Phaser.Math.Between(-40, 40), Phaser.Math.Between(-10, 10));
      shake(this, 3, 200);
      audio.sfx('break', { pitch: 0.8 });
      popText(this, x, FEET_Y - 30, label, { color: UI.danger, size: FS.big });
    }
  }

  // ─── 倒したとき ───

  private onDefeated(): void {
    if (this.phase !== 'fight') return;
    this.phase = 'end';
    const run = this.run;
    run.stats.defeatBoss(this.fight.seconds ?? this.fight.elapsedSec);
    // 押しても何も起きない(phase が end)。灰色にせず、金色で撃破を見せる
    this.go.setColor('stop');
    this.go.setLabel('撃破!');
    this.timeText.setVisible(false);
    this.meter.setVisible(false);
    this.alarm.stop();
    this.mashText.setVisible(false);
    this.aura.setVisible(false);
    this.hp.setValue(0);
    this.hp.hit();
    this.hud.refresh(run.stats);
    this.boss.clearTint();
    for (const o of this.icons) (o as unknown as Phaser.GameObjects.Container).setVisible(false);

    let started = false;
    const finale = (): void => { if (!started) { started = true; void this.finale(); } };
    if (run.stats.reportScene('bossDefeated')) {
      // 最後の一撃の瞬間を撮ってから、爆発を始める(白い光が写らないように)
      const { W, actionH } = layout;
      snapshotLogical(this.game, 0, 0, W, actionH, (img) => {
        run.worstShot = img;
        finale();
      });
      this.time.delayedCall(250, finale);
    } else finale();
  }

  private async finale(): Promise<void> {
    const sec = this.fight.seconds ?? this.fight.elapsedSec;
    audio.stopBgm(300);
    audio.sfx('bossDown');
    impact(this, 'huge');
    this.playAnim(this.boss, 'boss', 'defeat', false);
    this.tweens.add({ targets: this.boss, x: BOSS_X + 22, duration: 500, ease: 'Cubic.easeOut', onUpdate: () => { this.boss.x = Math.round(this.boss.x); } });
    this.playAnim(this.hero, 'hero', 'punch', false);

    // 爆発と火花を何発も
    for (let i = 0; i < 7; i++) {
      this.time.delayedCall(i * 150, () => {
        const x = BOSS_X + 10 + Phaser.Math.Between(-30, 30);
        const y = FEET_Y - 40 + Phaser.Math.Between(-30, 20);
        spawnFx(this, i % 2 === 0 ? 'fx_explosion' : 'fx_hit_big', x, y, { depth: DEPTH_OF.fxTop });
        spawnFx(this, 'fx_hit_big', x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-20, 20), { depth: DEPTH_OF.fxTop });
        for (let k = 0; k < 2; k++) throwDebris(this, x, y, Phaser.Math.Between(-60, 60), Phaser.Math.Between(0, 50));
        if (i % 2 === 0) { audio.sfx('explosion', { pitch: 0.9 + Math.random() * 0.2 }); flash(this, i % 4 === 0 ? 0xffffff : 0xffe08a, 1); }
        shake(this, 5, 180);
      });
    }

    const { W } = layout;
    const title = new PixelText(this, Math.floor(W / 2), 70, 'ボス撃破!', { size: 32, color: UI.gold, outline: true }).setOrigin(0.5, 0.5).setDepth(1500);
    const time = new PixelText(this, Math.floor(W / 2), 94, `タイム{white}${formatSeconds(sec)}{/}`, { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0).setDepth(1500);
    title.setVisible(false); time.setVisible(false);
    this.comboText.setVisible(false);
    await this.wait(350);
    title.setVisible(true);
    blink(title, 500);
    await this.wait(300);
    time.setVisible(true);

    // ヒーローの勝利のポーズ。背中で爆発
    await this.wait(700);
    this.tweens.add({ targets: this.hero, x: HERO_X + 8, duration: 200, onUpdate: () => { this.hero.x = Math.round(this.hero.x); } });
    this.playAnim(this.hero, 'hero', 'win_fist', false);
    spawnFx(this, 'fx_explosion', this.hero.x - 16, FEET_Y - 36, { depth: DEPTH_OF.aura });
    this.time.delayedCall(180, () => spawnFx(this, 'fx_explosion', this.hero.x - 4, FEET_Y - 50, { depth: DEPTH_OF.aura }));
    audio.sfx('explosion');
    flash(this, 0xffffff, 2);
    shake(this, 4, 300);
    for (let i = 0; i < 6; i++) this.time.delayedCall(i * 120, () => spawnFx(this, 'fx_sparkle', this.hero.x + Phaser.Math.Between(-24, 24), FEET_Y - Phaser.Math.Between(20, 70), { depth: DEPTH_OF.fxTop }));

    await this.speak(say('bossDefeated', this.run.rng));
    await this.wait(400);
    await this.speak(say('bossDefeatedOp', this.run.rng));
    await this.wait(900);
    gotoWhenFree(this, SCENES.result, undefined, { kind: 'wipe' });
  }
}
