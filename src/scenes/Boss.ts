// ボス戦。結果発表(Street)で波3のボスが正体を現したあとに来る。行け!ボタンの連打でボスを倒し、波3の答え合わせ(WaveReview)へ。
// 決まりは docs/SPEC.md の「ボス」「ボス戦」、docs/STAGE2.md と docs/STAGE3.md の「ボス戦」。連打の計算は logic の BossFight。
//
// 流れ:ボス出現!の帯 → 2人のセリフ → 「連打!」 → 連打(手が止まるとボスが暴れて被害額が増える)
//   → 撃破(いちばんひどい場面なら撮る)→ 爆発と勝利ポーズ → WaveReview
// ステージ2(地下駐車場)の女ボスは、体力が半分を切ると奥に止めてある高級車に飛び乗る(BossFight の boardedCar)。
//   そのあとは車ごと殴る。手が止まると車が暴れて柱や止めてある車にぶつかる。倒すと車がひっくり返って爆発する。
// ステージ3(ショッピングモール)の宇宙人の親玉は、体力が半分を切ると天井を破って母艦を呼び、乗りこむ(女ボスの車と同じ作り)。
//   そのあとは母艦ごと殴る。手が止まると母艦が光線で床を焼く(1秒ごとに shipBeam)。
//   倒すと母艦が噴水に落ちて爆発し(噴水は stats.breakProp(def.bossDefeatProp))、親玉が目を回して出てくる。
//   親玉を市民に仕分けていたときは、始まりに空から母艦の光線が落ちてモールを焼く(被害額は Street の bossRampage で数え済み)。
// 背景、曲、ボスの絵、置く物は stage.def から。
// 一時停止中はシーンごと止まるので update が呼ばれず、BossFight の時計も止まる。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { animKey, frameIndex, originFor, sheetByKey } from '../art/sheets';
import { audio } from '../audio';
import {
  BOSS, BossFight, findBoss, formatSeconds, formatYen, say,
  type AnyReactionKey, type Speech, type StageDef, type StageId
} from '../logic';
import { getRun, type GameRun } from '../run';
import {
  Button, CutIn, EdgeAlarm, FS, HpBar, IconButton, PauseControl, PixelText,
  addPanel, banner, blink, flash, gotoWhenFree, hitStop, jolt, panelRect, popText, shake, stopJolt, tapSpark, whenNoFlash, waitMs
} from '../ui';
import { addMute, drawStageBg } from './sort/common';
import { BossCar, MOTHERSHIP_LOOK } from './boss/car';
import { DEPTH_OF } from './boss/depth';
import { flyPunch, spawnFx, SpeedLines, throwDebris } from './boss/effects';
import { BossHud, RushMeter } from './boss/hud';
import { BossProps } from './boss/props';
import { breakCeiling, ScorchMarks, skyBeam, splash } from './boss/mothership';
import { px, snapshotLogical } from '../hires';

/** 足の裏の高さ */
const FEET_Y = 194;
const HERO_X = 82;
const BOSS_X = 152;
/** ボスの体の、ラッシュが当たるあたり(ボスは左向き) */
const HIT_X = BOSS_X - 12;
const HIT_Y = FEET_Y - 52;
/** 最後の連打からこの時間がたったら、ラッシュの動きをやめる(ms) */
const RUSH_HOLD_MS = 380;
/** 連打で出す技の順番(くり返す)。10連打ごとは飛び蹴りをはさむ */
const RUSH_MOVES = ['punch', 'punch', 'kick', 'punch', 'uppercut', 'punch', 'kick'] as const;
type RushMove = (typeof RUSH_MOVES)[number] | 'flykick';
const RUSH_MOVE_KEYS = new Set<string>([...RUSH_MOVES, 'flykick'].map((m) => animKey('hero', m)));
/** 技ごとの当たる高さのずれ(蹴りは低め、アッパーは高め) */
const MOVE_HIT_DY: Record<RushMove, number> = { punch: 0, kick: 14, uppercut: -10, flykick: 6 };

// ─── ステージ2:女ボスの高級車 ───
/** 奥の列に止めてある場所(下の真ん中) */
const CAR_PARK_X = 150;
const CAR_PARK_Y = 150;
/** 飛び乗ったあと、ヒーローの前まで出てくる場所 */
const CAR_X = 158;
const CAR_Y = FEET_Y + 2;
/** 車ごと殴るところの高さ */
const CAR_HIT_Y = FEET_Y - 24;
/** 連打で車が後ろへ押される量の上限 */
const CAR_BACK_MAX = 22;
/** 車の屋根から上だけ見せる(女ボスの絵の上から何ドットまで見せるか) */
const RIDER_CROP_H = 66;

// ─── ステージ3:親玉の母艦 ───
/** 母艦の真ん中の x(下の真ん中)。円盤の左のふちがヒーローの拳に届くところ */
const SHIP_X = 172;
/** 最初は天井の上(画面の外)で待つ */
const SHIP_WAIT_Y = -6;
/** 天井を破って下りてきて、浮き上がった親玉を乗せるところ */
const SHIP_HIGH_Y = 134;
/** 親玉を乗せて、ヒーローの前まで下りてくるところ(光線のコマの光線がちょうど床に届く) */
const SHIP_Y = FEET_Y;
/** 母艦の塔から上だけ見せる(親玉の絵の上から何ドットまで見せるか) */
const SHIP_RIDER_CROP_H = 56;

type Phase = 'intro' | 'fight' | 'end';
/** 女ボスが車に乗るまで(foot)、飛び乗って出てくるところ(boarding)、車の中(car)。親玉の母艦も同じ */
type CarMode = 'foot' | 'boarding' | 'car';

export class BossScene extends Phaser.Scene {
  private run!: GameRun;
  private def!: StageDef;
  private stageId: StageId = 'alley';
  /** ボスの絵のキー(路地裏は boss、地下駐車場は boss2、モールは boss3) */
  private bossKey = 'boss';
  private fight!: BossFight;
  private phase: Phase = 'intro';
  private hero!: Phaser.GameObjects.Sprite;
  private boss!: Phaser.GameObjects.Sprite;
  private bossShadow!: Phaser.GameObjects.Sprite;
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
  /** 次に出す技(RUSH_MOVES の何番目か) */
  private moveIdx = 0;
  private fightStartAt = 0;
  // ─── ステージ2の車(ステージ3は母艦) ───
  private car: BossCar | null = null;
  private carMode: CarMode = 'foot';
  /** 女ボスが車の屋根から顔を出していて、車について動くか */
  private riding = false;
  private carTaps = 0;
  private carRampages = 0;
  private boardAt = 0;
  private lastHoodSmokeAt = -1e9;
  private boardTweens: Phaser.Tweens.Tween[] = [];
  // ─── ステージ3の母艦 ───
  /** 光線で焼けた床のあと(母艦のステージだけ) */
  private scorch: ScorchMarks | null = null;
  /** 床に落ちる母艦の影 */
  private shipShadow: Phaser.GameObjects.Sprite | null = null;
  /** 暴れた1秒ごとの光線を、この時刻まで出す */
  private fireUntil = 0;
  private lastFloorSparkAt = -1e9;
  /** セリフを出した回数(あとから続きを言うとき、間にほかのセリフがあったかを見る) */
  private speakSeq = 0;
  /** 手が止まったのに「車が暴れてる!」をまだ言えていない(飛び乗っている間やほかのセリフの途中だった) */
  private idleLinePending = false;
  /** 「効いてない!」を最後に出した時刻 */
  private lastNoEffectAt = -1e9;

  constructor() { super(SCENES.boss); }

  create(): void {
    this.run = getRun(this);
    this.def = this.run.stage.def;
    this.stageId = this.run.stage.id;
    this.bossKey = this.def.bossSheet;
    this.fight = new BossFight(this.def.bossFight);
    this.phase = 'intro';
    this.combo = 0;
    this.lastTapAt = -1e9;
    this.heroPush = this.bossPush = this.whiteFrames = this.frame = 0;
    this.wasIdle = false;
    this.lastIdleLineAt = this.lastRushLineAt = -1e9;
    this.shownTime = '';
    this.icons = [];
    this.car = null;
    this.carMode = 'foot';
    this.riding = false;
    this.carTaps = this.carRampages = this.boardAt = 0;
    this.lastHoodSmokeAt = -1e9;
    this.boardTweens = [];
    this.scorch = null;
    this.shipShadow = null;
    this.fireUntil = 0;
    this.lastFloorSparkAt = -1e9;
    this.speakSeq = 0;
    this.idleLinePending = false;
    this.lastNoEffectAt = -1e9;
    if (import.meta.env.DEV && this.run.debug) (window as unknown as { bossScene?: BossScene }).bossScene = this;

    const { W, actionH } = layout;
    this.drawBackground();
    this.props = new BossProps(this, this.stageId, this.def.props);
    // 女ボスの高級車は、最初は奥に止めてある
    if (this.def.bossProp === 'bosscar') this.car = new BossCar(this, CAR_PARK_X, CAR_PARK_Y);
    // 親玉の母艦は、最初は天井の上(画面の外)で待っている
    if (this.def.bossProp === 'mothership') {
      this.car = new BossCar(this, SHIP_X, SHIP_WAIT_Y, MOTHERSHIP_LOOK).setDepth(DEPTH_OF.car).setVisible(false);
      this.scorch = new ScorchMarks(this);
    }
    this.lines = new SpeedLines(this, 40, actionH - 12, W);

    // ヒーローとボスが向かい合う
    this.add.sprite(HERO_X, FEET_Y + 1, 'fx_shadow').setDepth(DEPTH_OF.shadow);
    this.bossShadow = this.add.sprite(BOSS_X, FEET_Y + 1, 'fx_shadow').setDepth(DEPTH_OF.shadow).setScale(2, 1);
    if (this.car?.flies) this.shipShadow = this.add.sprite(SHIP_X, FEET_Y + 1, 'fx_shadow').setDepth(DEPTH_OF.shadow).setScale(4, 1).setVisible(false);
    this.aura = this.add.sprite(HERO_X, FEET_Y, 'fx_aura', 0).setOrigin(...originFor('hero')).setDepth(DEPTH_OF.aura).setVisible(false);
    this.playAnim(this.aura, 'fx_aura', 'play');
    this.hero = this.add.sprite(HERO_X, FEET_Y, 'hero', 0).setOrigin(...originFor('hero')).setDepth(DEPTH_OF.hero);
    this.playAnim(this.hero, 'hero', 'idle');
    // 連打の技が1つ終わったとき、まだ連打していれば次の技へつなぐ。止まっていれば待機にもどる
    this.hero.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      if (this.phase !== 'fight' || !RUSH_MOVE_KEYS.has(anim.key)) return;
      if (this.time.now - this.lastTapAt < RUSH_HOLD_MS) this.startMove();
      else { this.hero.anims.timeScale = 1; this.playAnim(this.hero, 'hero', 'idle'); }
    });
    this.boss = this.add.sprite(BOSS_X, FEET_Y, this.bossKey, 0).setOrigin(...originFor(this.bossKey)).setDepth(DEPTH_OF.boss).setFlipX(true);
    this.playAnim(this.boss, this.bossKey, 'idle');

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
    this.icons.push(addMute(this, W - 34, 12));

    // 下:撃破、負傷、被害額、カットイン、大きな行け!ボタン
    addPanel(this);
    const r = panelRect();
    // 地下駐車場は被害額の点滅を短く(手を止めると1秒ごとに増え、長いと数字が半分の時間消えて読めない)
    this.hud = new BossHud(this, r.x, r.y, r.w, this.car ? 160 : 500);
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

    audio.playBgm(this.def.bgm.boss);
    void this.intro();
  }

  // ─── 背景 ───

  private drawBackground(): void {
    drawStageBg(this, this.def.bg, Math.round(this.run.scrollX), { depth: DEPTH_OF });
  }

  private playAnim(s: Phaser.GameObjects.Sprite, sheet: string, anim: string, ignoreIfPlaying = true): void {
    const key = animKey(sheet, anim);
    if (this.anims.exists(key)) s.play(key, ignoreIfPlaying);
  }

  /** このステージのセリフ。rng を省くと Math.random で選ぶ(路地裏のこれまでと同じ) */
  private line(key: AnyReactionKey, rng?: GameRun['rng']): Speech {
    return say(key, rng, this.stageId);
  }

  /**
   * 画面全体の揺れ。ボス戦は揺れる場面が多いので、ほかのシーンの半分の強さにする。
   * 撃破したあと(爆発、車や母艦が壊れる、ボスが出てくる)は揺れが続くので、さらに半分にする
   */
  private quake(px: number, ms: number): void {
    const div = this.phase === 'end' ? 4 : 2;
    shake(this, Math.max(1, Math.round(px / div)), ms);
  }

  // ─── 始まり ───

  private async intro(): Promise<void> {
    await waitMs(this, 250);
    audio.sfx('reveal');
    this.quake(3, 300);
    spawnFx(this, 'fx_dust', BOSS_X - 20, FEET_Y - 8);
    spawnFx(this, 'fx_dust', BOSS_X + 22, FEET_Y - 6);
    await banner(this, 'ボス出現!');
    const boss = findBoss(this.run.stage);
    const sortedCiv = boss ? this.run.sorts[boss.id] === 'civ' : false;
    const rng = this.run.rng;
    // 母艦のあるステージで親玉を見逃していたら、空から母艦の光線が落ちてモールを焼く
    if (sortedCiv && this.car?.flies) await this.beamFromSky();
    await this.speak(this.line(sortedCiv ? 'bossRampageHero' : 'bossStartHero', rng));
    await waitMs(this, 250);
    await this.speak(this.line('bossStart', rng));
    await waitMs(this, 200);
    this.startFight();
  }

  private speak(s: Speech, alarm = false): Promise<void> {
    if (!this.sys.isActive() && !this.sys.isPaused()) return Promise.resolve();
    this.speakSeq++;
    return this.cut.say(s.text, s.face, { who: s.who, alarm });
  }

  /** シーンの時計で待つ(一時停止中は止まる) */
  private startFight(): void {
    if (this.phase !== 'intro') return;
    this.phase = 'fight';
    this.go.setEnabled(true);
    this.meter.setVisible(true);
    this.meter.update(0);
    this.fightStartAt = this.time.now;
    flash(this, 0xffffff, 1);
    this.quake(3, 200);
    audio.sfx('go');
  }

  // ─── 連打 ───

  private onPress(p: Phaser.Input.Pointer): void {
    audio.unlock();
    if (this.phase !== 'fight') return;
    const q = px(p);
    tapSpark(this, q.x, q.y, UI.gold);
    const hpBefore = this.fight.hp;
    const res = this.fight.tap();
    // 車に飛び乗って手前に出てくる間は体力が減らない(logic の carHoldSec)。「効いてない!」を見せる
    const noEffect = res.counted && !res.defeated && this.carMode === 'boarding' && this.fight.hp >= hpBefore - 1e-6;
    const tps = this.fight.tapsPerSec;
    const power = tps / BOSS.maxTapsPerSec; // 0〜1
    this.combo++;
    this.lastTapAt = this.time.now;

    // ヒーローのラッシュ:パンチ、蹴り、アッパーを順に出す。押すほど速く、前へ出る。10連打ごとに飛び蹴り
    if (this.combo % 10 === 0) this.startMove('flykick');
    else if (!this.currentMove()) this.startMove();
    this.hero.anims.timeScale = 1.2 + power * 3.3;
    const move = this.currentMove() ?? 'punch';
    this.heroPush = Math.min(move === 'flykick' ? 20 : 12, this.heroPush + (move === 'flykick' ? 8 : 3));
    // 車に飛び乗っている途中は、跳ぶ動きを続ける
    if (this.carMode !== 'boarding' || this.riding) this.playAnim(this.boss, this.bossKey, 'hit');
    this.whiteFrames = 2;

    let hx: number, fy: number;
    const car = this.car;
    if (car && this.carMode === 'car') {
      // 車ごと殴る:車が押し下げられ、少しずつへこむ
      car.push = Math.min(10, car.push + 3);
      if (res.counted) {
        this.carTaps++;
        car.back = Math.min(CAR_BACK_MAX, car.back + 0.8);
        if (this.carTaps % 2 === 0) car.addDent();
      }
      this.punchSide ^= 1;
      fy = this.vehicleHitY() + (this.punchSide ? -8 : 5) + Math.round(MOVE_HIT_DY[move] / 2) + Phaser.Math.Between(-3, 3);
      hx = car.frontX;
      flyPunch(this, this.hero.x + 24, hx - 6, fy, 50);
      spawnFx(this, 'fx_hit_big', hx + Phaser.Math.Between(-4, 8), fy + Phaser.Math.Between(-4, 4), { depth: DEPTH_OF.fxTop, speed: 1 + power });
      if (tps >= 5) spawnFx(this, 'fx_hit', hx + Phaser.Math.Between(0, 40), this.vehicleHitY() + Phaser.Math.Between(-14, 10), { depth: DEPTH_OF.fxTop });
      if (tps >= 8 && this.combo % 2 === 0) throwDebris(this, hx, fy, Phaser.Math.Between(-30, 30), Phaser.Math.Between(0, 30), 360);
      if (this.combo % 4 === 0) audio.sfx('crash', { volume: 0.35 + power * 0.3, pitch: 1.1 + Math.random() * 0.3 });
    } else {
      this.bossPush = Math.min(move === 'punch' ? 8 : 12, this.bossPush + (move === 'punch' ? 2 : 4));
      // 光の拳と火花
      this.punchSide ^= 1;
      fy = HIT_Y + (this.punchSide ? -8 : 6) + MOVE_HIT_DY[move] + Phaser.Math.Between(-3, 3);
      hx = HIT_X + this.bossPush;
      if (this.carMode === 'boarding') hx = this.boss.x - 12;
      // 母艦へ浮き上がっている親玉は、体の高さに当てる
      if (this.carMode === 'boarding' && this.car?.flies) fy = this.boss.y - 52 + (this.punchSide ? -8 : 6);
      flyPunch(this, this.hero.x + 24, hx - 6, fy, 50);
      spawnFx(this, 'fx_hit_big', hx + Phaser.Math.Between(-6, 6), fy + Phaser.Math.Between(-4, 4), { depth: DEPTH_OF.fxTop, speed: 1 + power });
      if (tps >= 6) spawnFx(this, 'fx_hit', hx + Phaser.Math.Between(-18, 14), HIT_Y + Phaser.Math.Between(-24, 22), { depth: DEPTH_OF.fxTop });
      if (tps >= 9 && this.combo % 2 === 0) throwDebris(this, hx, fy, Phaser.Math.Between(20, 50), Phaser.Math.Between(10, 40), 360);
    }
    // 蹴りとアッパーは、火花を1つ多く出す。アッパーは破片を上へ、飛び蹴りは砂ぼこりも
    if (move !== 'punch') {
      spawnFx(this, 'fx_hit', hx + Phaser.Math.Between(-4, 10), fy + (move === 'uppercut' ? -10 : 4), { depth: DEPTH_OF.fxTop });
      if (move === 'uppercut') throwDebris(this, hx, fy, Phaser.Math.Between(0, 30), Phaser.Math.Between(-10, 10), 420);
      if (move === 'flykick') spawnFx(this, 'fx_dust', this.hero.x, FEET_Y - 8, { depth: DEPTH_OF.fx });
    }

    // 音と揺れ
    audio.sfx('rush', { pitch: 1 + power * 0.25 });
    if (this.combo % 3 === 0) audio.sfx('hit', { volume: 0.5 + power * 0.4, pitch: 0.9 + Math.random() * 0.2 });
    // 画面は揺らさず、殴られた相手だけを揺らす(連打のたびに画面が揺れると激しすぎるため)
    jolt(this.car && this.carMode === 'car' ? this.car.sprite : this.boss, 1 + Math.round(power * 2), 90);

    // 体力のバー
    this.hp.setValue(this.fight.hpRatio);
    if (noEffect) this.showNoEffect(hx, fy);
    else this.hp.hit();

    // 連打の数
    this.comboText.setText(`{gold}${this.combo}{/}連打!`).setVisible(true);
    this.comboText.y = 38;
    if (this.combo % 10 === 0) {
      audio.sfx('bigHit');
      flash(this, 0xffffff, 1);
      hitStop(this, 40);
      popText(this, hx, (this.carMode === 'car' ? this.vehicleHitY() : HIT_Y) - 30, `${this.combo}連打!`, { color: UI.gold, size: FS.big });
    }

    // 暴れていたのを止めた
    if (this.wasIdle) this.endIdle();

    if (tps >= 8 && this.time.now - this.lastRushLineAt > 4000 && !this.cut.isTyping && this.carMode !== 'boarding') {
      this.lastRushLineAt = this.time.now;
      void this.speak(this.line('bossRush'));
    }

    if (res.boardedCar) this.boardCar();
    if (res.defeated) this.onDefeated();
  }

  override update(_time: number, delta: number): void {
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
    if (r.boardedCar) this.boardCar();
    this.hp.setValue(this.fight.hpRatio);
    this.hud.refresh(this.run.stats);
    if (r.defeated) { this.onDefeated(); return; }

    const tps = this.fight.tapsPerSec;
    const power = tps / BOSS.maxTapsPerSec;
    const rushing = this.time.now - this.lastTapAt < RUSH_HOLD_MS;

    // 手が止まった:ボスが暴れる
    const idle = this.fight.isIdle;
    if (idle && !this.wasIdle) this.startIdle();
    this.flushIdleLine();

    // ヒーロー
    if (!rushing) this.heroPush = Math.max(0, this.heroPush - 0.6);
    else this.heroPush = Math.max(0, this.heroPush - 0.35);
    // 連打中は前後に細かく揺れて、止まって見えないようにする
    const jitter = rushing ? (this.frame % 2 === 0 ? 1 : -1) * Math.min(2, 1 + Math.floor(power * 2)) : 0;
    this.hero.x = Math.round(HERO_X + this.heroPush + jitter);
    this.aura.x = this.hero.x;
    this.aura.setVisible(rushing && tps >= 4 && this.frame % 2 === 0);

    // ボス
    const bossJit = rushing ? (this.frame % 2 === 0 ? 1 : 0) : 0;
    if (this.car) this.updateCar(rushing, idle, bossJit);
    if (this.carMode === 'foot') {
      this.bossPush = Math.max(0, this.bossPush - 0.4);
      this.boss.x = Math.round(BOSS_X + this.bossPush + bossJit);
    }
    if (this.whiteFrames > 0) { this.boss.setTintFill(0xffffff); this.whiteFrames--; } else this.boss.clearTint();
    if (!rushing && !idle && this.carMode !== 'boarding' && this.boss.anims.currentAnim?.key === animKey(this.bossKey, 'hit')) {
      this.playAnim(this.boss, this.bossKey, 'idle');
    }

    // 連打の数は止まると消える
    if (!rushing && this.time.now - this.lastTapAt > 900 && this.comboText.visible) { this.comboText.setVisible(false); this.combo = 0; }
    if (this.comboText.visible && this.comboText.y < 40) this.comboText.y++;

    this.lines.update(rushing && tps >= 6 ? power : 0);
    this.meter.update(tps);
    // 「連打!」:始まりの0.9秒と、車に飛び乗った直後と、手が止まっている間だけ点滅
    const intro = this.time.now - this.fightStartAt < 900;
    const boarded = this.carMode === 'car' && this.time.now - this.boardAt < 1600;
    this.mashText.setVisible(((intro || boarded) && this.frame % 4 < 2) || (idle && Math.floor(this.frame / 8) % 2 === 0));

    const t = formatSeconds(this.fight.elapsedSec);
    if (t !== this.shownTime) { this.shownTime = t; this.timeText.setText(t); }
  }

  // ─── ステージ2:車(ステージ3の母艦も同じ作り) ───

  /** 車(母艦)ごと殴るところの高さ */
  private vehicleHitY(): number {
    return this.car?.flies ? this.car.hitY : CAR_HIT_Y;
  }

  /** 毎フレーム:車を動かし、屋根から顔を出す女ボスを車に合わせる */
  private updateCar(rushing: boolean, idle: boolean, jit: number): void {
    const car = this.car!;
    car.push = Math.max(0, car.push - 0.5);
    // 手が止まると、車はじりじりと前へ出てくる(逃げようとする)
    if (idle && this.carMode === 'car') car.back = Math.max(0, car.back - 0.12);
    // 母艦:手が止まっている間と、暴れた1秒ごとの少しの間は光線を出す
    if (car.flies) car.firing = (idle && this.carMode === 'car') || this.time.now < this.fireUntil;
    car.update(this.time.now, this.carMode === 'car' ? jit : 0,
      car.flies ? undefined : (hard) => audio.sfx('engine', { pitch: hard ? 1.15 : 1, volume: hard ? 0.8 : 0.55 }), idle || rushing);
    if (this.riding) {
      this.boss.x = car.riderX;
      this.boss.y = car.riderY;
    }
    if (car.flies) this.updateShip();
    // 体力が少ないと、ボンネットから煙が出る(母艦は円盤から)
    if (this.carMode === 'car' && this.fight.hpRatio < 0.3 && this.time.now - this.lastHoodSmokeAt > 220) {
      this.lastHoodSmokeAt = this.time.now;
      spawnFx(this, 'fx_dust', car.frontX + Phaser.Math.Between(4, 24), car.smokeY, { depth: DEPTH_OF.car + 0.5 });
    }
  }

  /** 毎フレーム(母艦):床の影を合わせ、光線が床に当たっている所から火花を出す */
  private updateShip(): void {
    const ship = this.car!;
    const low = ship.sprite.visible && ship.y > FEET_Y - 60;
    this.shipShadow?.setVisible(low).setX(ship.x);
    if (!ship.firing || ship.y < FEET_Y - 4 || this.time.now - this.lastFloorSparkAt < 150) return;
    this.lastFloorSparkAt = this.time.now;
    spawnFx(this, 'fx_hit', ship.x + Phaser.Math.Between(-5, 5), FEET_Y - 4, { depth: DEPTH_OF.car + 0.5 });
  }

  /** 体力が半分を切った:女ボスが奥の高級車に飛び乗り、エンジンをふかして手前へ出てくる(親玉は母艦を呼ぶ) */
  private boardCar(): void {
    if (!this.car || this.carMode !== 'foot' || this.phase !== 'fight') return;
    this.carMode = 'boarding';
    this.boardAt = this.time.now;
    void (this.car.flies ? this.boardShipSequence() : this.boardSequence());
  }

  /** 車に乗ったあとのセリフ:オペレーター → ヒーロー */
  private boardLines(): void {
    const rng = this.run.rng;
    void (async () => {
      await this.speak(this.line('bossCar', rng), true);
      // 間にほかのセリフ(「車が暴れてる!」など)が出ていたら、ヒーローのセリフで上書きしない
      const seq = this.speakSeq;
      await waitMs(this, 350);
      if (this.phase === 'fight' && this.speakSeq === seq && !this.wasIdle) await this.speak(this.line('bossCarHero', rng));
    })();
  }

  private async boardSequence(): Promise<void> {
    const car = this.car!;
    const boss = this.boss;
    // セリフ:オペレーター → ヒーロー
    this.boardLines();

    // 飛び乗る:高く跳んで、奥の車の屋根へ
    this.bossShadow.setVisible(false);
    this.bossPush = 0;
    this.playAnim(boss, this.bossKey, 'jump', false);
    audio.sfx('reveal', { pitch: 1.2 });
    spawnFx(this, 'fx_dust', boss.x - 14, FEET_Y - 6);
    spawnFx(this, 'fx_dust', boss.x + 14, FEET_Y - 6);
    this.quake(2, 120);
    const x0 = boss.x, y0 = boss.y;
    const x1 = car.riderX, y1 = car.riderY;
    let under = false;
    this.boardTweens.push(this.tweens.addCounter({
      from: 0, to: 1, duration: 520, ease: 'Linear',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        boss.x = Math.round(x0 + (x1 - x0) * t);
        boss.y = Math.round(y0 + (y1 - y0) * t - 84 * 4 * t * (1 - t));
        // 落ちてくるところで車の中へ(屋根から上だけ見える)
        if (!under && t > 0.6) {
          under = true;
          boss.setDepth(DEPTH_OF.bossInParkedCar).setCrop(0, 0, boss.width, RIDER_CROP_H);
        }
      }
    }));
    await waitMs(this, 520);
    if (this.phase !== 'fight') return;
    this.riding = true;
    this.playAnim(boss, this.bossKey, 'idle');
    // 着地で車が沈む
    audio.sfx('hit', { pitch: 0.7 });
    this.quake(3, 150);
    this.boardTweens.push(this.tweens.add({ targets: car.lunge, y: 3, duration: 60, yoyo: true, ease: 'Quad.easeOut' }));

    // エンジンをふかす
    car.revving = true;
    audio.sfx('engine', { pitch: 1.2 });
    await waitMs(this, 420);
    if (this.phase !== 'fight') return;

    // タイヤをきしませて手前へ出てくる
    audio.sfx('skid');
    audio.sfx('engine', { pitch: 1.3 });
    let front = false;
    const bx = car.baseX, byy = car.baseY;
    this.boardTweens.push(this.tweens.addCounter({
      from: 0, to: 1, duration: 360, ease: 'Quad.easeIn',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        car.baseX = bx + (CAR_X - bx) * t;
        car.baseY = byy + (CAR_Y - byy) * t;
        if (!front && t > 0.35) {
          front = true;
          car.setDepth(DEPTH_OF.car);
          boss.setDepth(DEPTH_OF.bossInCar);
        }
        if (this.frame % 3 === 0) spawnFx(this, 'fx_dust', car.exhaustX, car.y - 6, { depth: DEPTH_OF.car + 0.5 });
      }
    }));
    await waitMs(this, 360);
    if (this.phase !== 'fight') return;
    // 急ブレーキ:火花、砂ぼこり、クラクション
    car.baseX = CAR_X; car.baseY = CAR_Y;
    audio.sfx('horn');
    audio.sfx('crash', { volume: 0.5, pitch: 0.8 });
    hitStop(this, 40);
    this.quake(4, 220);
    for (const wx of [CAR_X - 40, CAR_X + 40]) {
      spawnFx(this, 'fx_brake', wx, FEET_Y - 2, { depth: DEPTH_OF.car + 0.5 });
      spawnFx(this, 'fx_dust', wx + 8, FEET_Y - 8, { depth: DEPTH_OF.car + 0.5 });
    }
    this.boardTweens.push(this.tweens.add({ targets: car.lunge, x: -6, duration: 70, yoyo: true, ease: 'Quad.easeOut' }));
    this.finishBoarding();
  }

  /** 乗り物がヒーローの前に着いた:ここから車ごと殴れる */
  private finishBoarding(): void {
    this.carMode = 'car';
    this.boardAt = this.time.now;
    if (this.fight.isIdle) this.playAnim(this.boss, this.bossKey, 'rampage');
  }

  /** 親玉の「母艦に乗りこむ」動きの i コマ目(0〜3)を出す */
  private boardFrame(i: number): void {
    const def = sheetByKey(this.bossKey);
    if (!def.rows.some((r) => r.name === 'board')) return;
    this.boss.anims.stop();
    this.boss.setFrame(frameIndex(def, 'board', i));
  }

  /**
   * ステージ3:親玉が天をさして母艦を呼ぶ。母艦が天井を破って下りてきて、親玉は浮き上がって塔に乗りこむ。
   * そのまま母艦がヒーローの前まで下りてくる。全部で1.25秒(logic の carHoldSec 1.3秒の間に収める)
   */
  private async boardShipSequence(): Promise<void> {
    const ship = this.car!;
    const boss = this.boss;
    this.boardLines();

    // 天をさす
    this.bossPush = 0;
    this.boardFrame(0);
    audio.sfx('reveal', { pitch: 1.2 });
    await waitMs(this, 150);
    if (this.phase !== 'fight') return;

    // 天井を破って、母艦が下りてくる
    breakCeiling(this, SHIP_X);
    audio.sfx('crash', { pitch: 0.8 });
    audio.sfx('break');
    audio.sfx('ufoDown');
    this.quake(4, 220);
    ship.setVisible(true);
    this.boardTweens.push(this.tweens.add({ targets: ship, baseY: SHIP_HIGH_Y, duration: 450, ease: 'Quad.easeOut' }));
    await waitMs(this, 150);
    if (this.phase !== 'fight') return;
    // しゃがむ
    this.boardFrame(1);
    await waitMs(this, 300);
    if (this.phase !== 'fight') return;

    // 浮き上がって、母艦の塔へ(3〜4コマを交互に。どちらも体の真ん中がそろえてある)
    this.bossShadow.setVisible(false);
    spawnFx(this, 'fx_dust', boss.x - 14, FEET_Y - 6);
    spawnFx(this, 'fx_dust', boss.x + 14, FEET_Y - 6);
    const x0 = boss.x, y0 = boss.y;
    let under = false;
    this.boardTweens.push(this.tweens.addCounter({
      from: 0, to: 1, duration: 350, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        boss.x = Math.round(x0 + (ship.riderX - x0) * t);
        boss.y = Math.round(y0 + (ship.riderY - y0) * t);
        this.boardFrame(2 + (Math.floor(t * 4) % 2));
        // 塔の高さまで来たら母艦の中へ(塔から上だけ見える)
        if (!under && t > 0.7) {
          under = true;
          boss.setDepth(DEPTH_OF.bossInCar).setCrop(0, 0, boss.width, SHIP_RIDER_CROP_H);
        }
      }
    }));
    await waitMs(this, 350);
    if (this.phase !== 'fight') return;
    this.riding = true;
    this.playAnim(boss, this.bossKey, 'idle');
    audio.sfx('hit', { pitch: 0.7 });
    this.boardTweens.push(this.tweens.add({ targets: ship.lunge, y: 3, duration: 60, yoyo: true, ease: 'Quad.easeOut' }));

    // 親玉を乗せて、ヒーローの前まで下りてくる
    audio.sfx('ufoDown', { pitch: 1.2 });
    this.boardTweens.push(this.tweens.add({ targets: ship, baseY: SHIP_Y, duration: 300, ease: 'Quad.easeIn' }));
    await waitMs(this, 300);
    if (this.phase !== 'fight') return;
    ship.baseY = SHIP_Y;
    audio.sfx('hit', { pitch: 0.6 });
    this.quake(3, 150);
    for (const dx of [-56, 56]) spawnFx(this, 'fx_dust', ship.x + dx, FEET_Y - 6, { depth: DEPTH_OF.car + 0.5 });
    this.finishBoarding();
  }

  // ─── 連打の技 ───

  /** いま出している連打の技(待機などのときは null) */
  private currentMove(): RushMove | null {
    const key = this.hero.anims.currentAnim?.key;
    if (!key || !RUSH_MOVE_KEYS.has(key) || !this.hero.anims.isPlaying) return null;
    return key.slice(key.indexOf('.') + 1) as RushMove;
  }

  /** 連打の技を1つ流す。move を省くと RUSH_MOVES の次の技 */
  private startMove(move?: RushMove): void {
    const m = move ?? RUSH_MOVES[this.moveIdx++ % RUSH_MOVES.length];
    const key = animKey('hero', m);
    if (!this.anims.exists(key)) return;
    const ts = this.hero.anims.timeScale;
    this.hero.play(key);
    this.hero.anims.timeScale = ts;
    if (m === 'flykick') audio.sfx('charge', { volume: 0.6, pitch: 1.2 });
  }

  // ─── 手が止まっているとき ───

  private startIdle(): void {
    this.wasIdle = true;
    const inCar = this.carMode !== 'foot';
    if (this.carMode !== 'boarding') this.playAnim(this.boss, this.bossKey, 'rampage');
    this.playAnim(this.hero, 'hero', 'idle');
    this.alarm.start();
    audio.sfx(inCar ? (this.car?.flies ? 'shipBeam' : 'horn') : 'rampage');
    if (this.time.now - this.lastIdleLineAt > 2500 && this.carMode !== 'boarding') {
      this.lastIdleLineAt = this.time.now;
      void this.speak(inCar ? this.line('bossCarIdle', this.run.rng) : this.line('bossIdle'), true);
    } else if (inCar) {
      // 飛び乗っている途中や、ほかのセリフのすぐあと:車が手前に来て、セリフが終わってから言う
      this.idleLinePending = true;
    }
  }

  /** 手が止まったままなら、言えていなかった「車が暴れてる!」を言う(毎フレーム) */
  private flushIdleLine(): void {
    if (!this.idleLinePending) return;
    if (!this.wasIdle) { this.idleLinePending = false; return; }
    if (this.carMode !== 'car' || this.cut.isTyping || this.time.now - this.lastIdleLineAt < 1200) return;
    this.idleLinePending = false;
    this.lastIdleLineAt = this.time.now;
    void this.speak(this.line('bossCarIdle', this.run.rng), true);
  }

  /** 飛び乗っている間の連打:光の拳がはじかれて、「効いてない!」 */
  private showNoEffect(x: number, y: number): void {
    spawnFx(this, 'fx_kiran', x + Phaser.Math.Between(-6, 6), y + Phaser.Math.Between(-6, 6), { depth: DEPTH_OF.fxTop });
    if (this.time.now - this.lastNoEffectAt < 450) return;
    this.lastNoEffectAt = this.time.now;
    audio.sfx('stop', { volume: 0.5, pitch: 1.3 });
    popText(this, Phaser.Math.Clamp(x, 44, 172), y + 20, '効いてない!', { color: 0xffffff, size: FS.big, ms: 700 });
  }

  private endIdle(): void {
    this.wasIdle = false;
    this.alarm.stop();
  }

  /** 1秒ぶん暴れた:まわりの物を1つ壊し、被害額を飛ばす */
  private rampageTick(yen: number): void {
    if (this.car && this.carMode !== 'foot') {
      if (this.car.flies) this.shipRampageTick(yen);
      else this.carRampageTick(yen);
      return;
    }
    audio.sfx('rampage', { pitch: 0.9 + Math.random() * 0.2 });
    spawnFx(this, 'fx_dust', BOSS_X + Phaser.Math.Between(-24, 24), FEET_Y - 8);
    const prop = this.props.takeNext();
    const label = formatYen(yen);
    if (prop) {
      const c = BossProps.centerOf(prop);
      // ボスが投げたがれきが飛んでいって当たる
      throwDebris(this, BOSS_X, FEET_Y - 60, c.x - BOSS_X, c.y - (FEET_Y - 60), 180);
      this.time.delayedCall(180, () => {
        if (this.phase !== 'fight') return;
        // 画面は揺らさず、壊れた物だけを揺らす
        hitStop(this, 40);
        jolt(prop, 2, 160);
        this.breakPropFx(prop, c, label, 'fx_hit', 4);
      });
    } else {
      // もう壊す物がないときは地面をたたき割る
      const x = Phaser.Math.Between(24, 192);
      spawnFx(this, 'fx_dust', x, FEET_Y - 4);
      for (let i = 0; i < 4; i++) throwDebris(this, x, FEET_Y - 6, Phaser.Math.Between(-40, 40), Phaser.Math.Between(-10, 10));
      jolt(this.boss, 2, 160);
      audio.sfx('break', { pitch: 0.8 });
      popText(this, x, FEET_Y - 30, label, { color: UI.danger, size: FS.big });
    }
  }

  /** 暴れて物が1つ壊れた:壊れたコマにして、破片と被害額を飛ばす */
  private breakPropFx(prop: Phaser.GameObjects.Sprite, at: { x: number; y: number }, label: string, fx: string, debris: number): void {
    prop.setFrame(1);
    audio.sfx('break');
    spawnFx(this, fx, at.x, at.y, { depth: DEPTH_OF.fxTop });
    for (let i = 0; i < debris; i++) throwDebris(this, at.x, at.y, Phaser.Math.Between(-40, 40), Phaser.Math.Between(10, 50));
    popText(this, Phaser.Math.Clamp(at.x, 30, 186), at.y - 10, label, { color: UI.danger, size: FS.big });
  }

  /**
   * 車に乗ったあと、1秒ぶん暴れた:車がタイヤをきしませて、柱や止めてある車にぶつかる。
   * 右の物には後ろから、左の物には前から突っこむ。物は見た目だけ壊す(被害額は BossFight の決まりで数える)
   */
  private carRampageTick(yen: number): void {
    const car = this.car!;
    const prop = this.props.takeNext();
    const label = formatYen(yen);
    const target = prop ? BossProps.centerOf(prop) : { x: Phaser.Math.Between(20, 196), y: FEET_Y - 30 };
    const dir = target.x >= car.x ? 1 : -1;
    const n = this.carRampages++;
    audio.sfx('skid', { pitch: 0.9 + Math.random() * 0.2 });
    for (const wx of [car.x - 40, car.x + 40]) {
      spawnFx(this, 'fx_brake', wx, FEET_Y - 2, { flipX: dir < 0, depth: DEPTH_OF.car + 0.5 });
      spawnFx(this, 'fx_dust', wx - dir * 10, FEET_Y - 8, { depth: DEPTH_OF.car + 0.5 });
    }
    if (this.carMode === 'car') {
      this.tweens.add({ targets: car.lunge, x: dir > 0 ? 22 : -14, y: -5, duration: 120, ease: 'Quad.easeIn', yoyo: true, hold: 70 });
    }
    this.time.delayedCall(120, () => {
      if (this.phase !== 'fight') return;
      const hitX = dir > 0 ? Math.min(208, car.x + 58) : car.frontX - 8;
      const hitY = FEET_Y - 26;
      audio.sfx('crash');
      if (n % 2 === 0) audio.sfx('horn', { pitch: 0.9 + Math.random() * 0.2 });
      // 画面は揺らさず、ぶつかった車だけを揺らす
      hitStop(this, 40);
      jolt(car.sprite, 2, 200);
      spawnFx(this, 'fx_hit_big', hitX, hitY, { depth: DEPTH_OF.fxTop });
      for (let i = 0; i < 3; i++) throwDebris(this, hitX, hitY, Phaser.Math.Between(-30, 30), Phaser.Math.Between(-10, 30), 360);
      if (prop) {
        // 車がぶつかった勢いで、物に破片が飛んでいって壊れる
        throwDebris(this, hitX, hitY, target.x - hitX, target.y - hitY, 160);
        this.time.delayedCall(160, () => {
          spawnFx(this, 'fx_dust', target.x, target.y + 6);
          this.breakPropFx(prop, target, label, 'fx_hit_big', 5);
        });
      } else {
        popText(this, Phaser.Math.Clamp(hitX, 30, 186), hitY - 20, label, { color: UI.danger, size: FS.big });
      }
    });
  }

  /**
   * 母艦に乗ったあと、1秒ぶん暴れた:母艦が少し横へ動いて光線で床を焼き、焼けた所から飛んだ破片で物が壊れる。
   * 物は見た目だけ壊す(被害額は BossFight の決まりで数える)
   */
  private shipRampageTick(yen: number): void {
    const ship = this.car!;
    const prop = this.props.takeNext();
    const label = formatYen(yen);
    const target = prop ? BossProps.centerOf(prop) : null;
    const dir = target ? (target.x >= ship.x ? 1 : -1) : (this.carRampages % 2 === 0 ? -1 : 1);
    this.carRampages++;
    audio.sfx('shipBeam');
    this.fireUntil = this.time.now + 420;
    // 乗りこむ途中で母艦が高い所にいるときは、砲口から床まで光線をのばす
    if (ship.y < FEET_Y - 8) skyBeam(this, ship.x, ship.y - 29, FEET_Y, 420);
    if (this.carMode === 'car') {
      this.tweens.add({ targets: ship.lunge, x: dir > 0 ? 10 : -12, duration: 140, ease: 'Quad.easeOut', yoyo: true, hold: 160 });
    }
    this.time.delayedCall(140, () => {
      if (this.phase !== 'fight') return;
      // 光線が当たった床が焼けて、火花と煙
      const bx = ship.x;
      const by = FEET_Y - 6;
      this.scorch?.add(bx, FEET_Y - 1);
      hitStop(this, 40);
      spawnFx(this, 'fx_hit_big', bx, by, { depth: DEPTH_OF.car + 0.5 });
      spawnFx(this, 'fx_dust', bx - dir * 14, by - 2, { depth: DEPTH_OF.car + 0.5 });
      for (let i = 0; i < 3; i++) throwDebris(this, bx, by, Phaser.Math.Between(-40, 40), Phaser.Math.Between(-10, 10), 360);
      if (prop && target) {
        // 焼けた床の破片が飛んでいって、物が壊れる
        throwDebris(this, bx, by, target.x - bx, target.y - by, 180);
        this.time.delayedCall(180, () => {
          jolt(prop, 2, 160);
          this.breakPropFx(prop, target, label, 'fx_hit_big', 4);
        });
      } else {
        popText(this, Phaser.Math.Clamp(bx, 30, 186), by - 30, label, { color: UI.danger, size: FS.big });
      }
    });
  }

  /**
   * 親玉を市民に仕分けていたとき(母艦のステージ):正体を現した親玉が空をさし、天窓の上の母艦から光線が落ちて、
   * モールの物を焼く。被害額(bossRampage)は結果発表(Street)で数え済みなので、ここは見た目だけ
   */
  private async beamFromSky(): Promise<void> {
    this.playAnim(this.boss, this.bossKey, 'rampage');
    const spots: { x: number; y: number; prop: Phaser.GameObjects.Sprite | null }[] = [];
    for (let i = 0; i < 2; i++) {
      const prop = this.props.takeNext();
      if (prop) spots.push({ x: BossProps.centerOf(prop).x, y: prop.y, prop });
    }
    // 物が足りなければ床を焼く
    while (spots.length < 3) spots.push({ x: Phaser.Math.Between(24, 72), y: FEET_Y - 10, prop: null });
    spots.forEach((sp, i) => this.time.delayedCall(i * 280, () => {
      if (!this.sys.isActive()) return;
      skyBeam(this, sp.x, 2, sp.y, 480);
      audio.sfx('shipBeam');
      this.time.delayedCall(120, () => {
        this.scorch?.add(sp.x, sp.y - 1);
        spawnFx(this, 'fx_hit_big', sp.x, sp.y - 8, { depth: DEPTH_OF.fxTop });
        spawnFx(this, 'fx_dust', sp.x + 8, sp.y - 6);
        for (let k = 0; k < 3; k++) throwDebris(this, sp.x, sp.y - 8, Phaser.Math.Between(-40, 40), Phaser.Math.Between(0, 30));
        if (sp.prop) {
          sp.prop.setFrame(1);
          audio.sfx('break');
          jolt(sp.prop, 2, 160);
        }
      });
    }));
    await waitMs(this, spots.length * 280 + 520);
    this.playAnim(this.boss, this.bossKey, 'idle');
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

    void this.finale();
    if (run.stats.reportScene('bossDefeated')) {
      // ボスが倒れる動きが始まってから撮る(写真と「ボスを倒した!」を合わせる)。
      // 「ボス撃破!」の字が出る前で、画面全体の光(flash)が出ていないコマにする。
      // 車が爆発するステージは、車がひっくり返って宙に浮いたところを撮る
      const { W, actionH } = layout;
      this.time.delayedCall(this.car ? 300 : 170, () => whenNoFlash(this, () => {
        if (!this.sys.isActive()) return;
        snapshotLogical(this.game, 0, 0, W, actionH, (img) => { run.worstShot = img; });
      }));
    }
  }

  private async finale(): Promise<void> {
    const sec = this.fight.seconds ?? this.fight.elapsedSec;
    audio.stopBgm(300);
    // 母艦は、まず噴水へ落ちていく音(bossDown は母艦が噴水に落ちたとき)
    audio.sfx(this.car?.flies ? 'ufoFall' : 'bossDown');
    // impact('huge') と同じ光と止まり方で、揺れだけ小さくする
    flash(this, 0xffffff, 3);
    hitStop(this, 160);
    this.quake(7, 500);
    // とどめはアッパー
    this.hero.anims.timeScale = 1;
    this.playAnim(this.hero, 'hero', 'uppercut', false);
    if (this.car) {
      if (this.car.flies) this.wreckShip();
      else this.wreckCar();
    } else {
      this.playAnim(this.boss, this.bossKey, 'defeat', false);
      this.tweens.add({ targets: this.boss, x: BOSS_X + 22, duration: 500, ease: 'Cubic.easeOut', onUpdate: () => { this.boss.x = Math.round(this.boss.x); } });

      // 爆発と火花を何発も
      for (let i = 0; i < 7; i++) {
        this.time.delayedCall(i * 150, () => {
          const x = BOSS_X + 10 + Phaser.Math.Between(-30, 30);
          const y = FEET_Y - 40 + Phaser.Math.Between(-30, 20);
          spawnFx(this, i % 2 === 0 ? 'fx_explosion' : 'fx_hit_big', x, y, { depth: DEPTH_OF.fxTop });
          spawnFx(this, 'fx_hit_big', x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-20, 20), { depth: DEPTH_OF.fxTop });
          for (let k = 0; k < 2; k++) throwDebris(this, x, y, Phaser.Math.Between(-60, 60), Phaser.Math.Between(0, 50));
          // 画面全体の光は最初の impact だけにする(光に弱い人のため、続けて光らせない)
          if (i % 2 === 0) audio.sfx('explosion', { pitch: 0.9 + Math.random() * 0.2 });
          this.quake(5, 180);
        });
      }
    }

    const { W } = layout;
    const title = new PixelText(this, Math.floor(W / 2), 70, 'ボス撃破!', { size: 32, color: UI.gold, outline: true }).setOrigin(0.5, 0.5).setDepth(1500);
    const time = new PixelText(this, Math.floor(W / 2), 94, `タイム{white}${formatSeconds(sec)}{/}`, { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0).setDepth(1500);
    title.setVisible(false); time.setVisible(false);
    this.comboText.setVisible(false);
    await waitMs(this, 350);
    title.setVisible(true);
    blink(title, 500);
    await waitMs(this, 300);
    time.setVisible(true);

    if (this.car) {
      // 最後の大きな爆発のあと、車が燃えている間に、目を回した女ボスへのひとこと
      await waitMs(this, 1100);
      await this.speak(this.line('bossWreck', this.run.rng));
      await waitMs(this, 150);
    } else {
      await waitMs(this, 700);
    }

    // ヒーローの勝利のポーズ。背中で爆発
    this.tweens.add({ targets: this.hero, x: HERO_X + 8, duration: 200, onUpdate: () => { this.hero.x = Math.round(this.hero.x); } });
    this.playAnim(this.hero, 'hero', 'win_fist', false);
    spawnFx(this, 'fx_explosion', this.hero.x - 16, FEET_Y - 36, { depth: DEPTH_OF.aura });
    this.time.delayedCall(180, () => spawnFx(this, 'fx_explosion', this.hero.x - 4, FEET_Y - 50, { depth: DEPTH_OF.aura }));
    audio.sfx('explosion');
    flash(this, 0xffffff, 2);
    this.quake(4, 300);
    for (let i = 0; i < 6; i++) this.time.delayedCall(i * 120, () => spawnFx(this, 'fx_sparkle', this.hero.x + Phaser.Math.Between(-24, 24), FEET_Y - Phaser.Math.Between(20, 70), { depth: DEPTH_OF.fxTop }));

    await this.speak(this.line('bossDefeated', this.run.rng));
    await waitMs(this, 400);
    await this.speak(this.line('bossDefeatedOp', this.run.rng));
    await waitMs(this, 900);
    gotoWhenFree(this, SCENES.waveReview, undefined, { kind: 'wipe' });
  }

  /** 倒したとき:乗り物の動きを止め、乗っていたボスを隠す(このあと壊れた乗り物から出てくる) */
  private stopVehicle(): void {
    const v = this.car!;
    for (const tw of this.boardTweens) tw.stop();
    this.tweens.killTweensOf(v.lunge);
    v.frozen = true;
    v.clearDents();
    this.riding = false;
    this.boss.setVisible(false).setCrop();
  }

  /**
   * ステージ2:車がひっくり返って爆発し、女ボスが目を回して飛び出してくる。
   * 高級車の爆発は被害額に数えない(logic の決まり)
   */
  private wreckCar(): void {
    const car = this.car!;
    this.stopVehicle();
    car.revving = false;

    // 殴られた勢いで、壊れた車が宙に浮いてひっくり返る(回転は45度ずつ、ドット絵らしく)
    const s = car.sprite;
    stopJolt(s);
    s.setFrame(3).setDepth(DEPTH_OF.car);
    const cx = s.x, cy = s.y - 28;
    // 押されて右へ寄っているので、画面の真ん中寄りに落ちるようにする
    const tx = Math.min(cx, 150);
    s.setOrigin(0.5, 0.5).setPosition(cx, cy);
    audio.sfx('crash');
    spawnFx(this, 'fx_explosion', car.frontX + 10, cy - 4, { depth: DEPTH_OF.fxTop });
    for (let i = 0; i < 6; i++) throwDebris(this, cx, cy, Phaser.Math.Between(-70, 70), Phaser.Math.Between(-10, 40), 500);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 560, ease: 'Linear',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        s.x = Math.round(cx + (tx - cx) * t);
        s.y = Math.round(cy - 58 * 4 * t * (1 - t));
        s.angle = Math.min(180, Math.floor((t * 180) / 45 + 0.5) * 45);
      },
      onComplete: () => {
        // 屋根から落ちる
        s.angle = 180;
        audio.sfx('crash', { pitch: 0.7 });
        this.quake(6, 260);
        for (const dx of [-50, 0, 50]) spawnFx(this, 'fx_dust', s.x + dx, FEET_Y - 6, { depth: DEPTH_OF.car + 0.5 });
      }
    });

    this.burnWreck(s, 420);

    // 女ボスが目を回して飛び出してくる
    this.bossOutOfWreck(s, 640);
  }

  /** 壊れた車(母艦)で爆発を何発も。最後は大きな爆発が3つ重なる。startMs は1発目までの時間 */
  private burnWreck(s: Phaser.GameObjects.Sprite, startMs: number): void {
    for (let i = 0; i < 9; i++) {
      this.time.delayedCall(startMs + i * 110, () => {
        const x = s.x + Phaser.Math.Between(-52, 52);
        const y = s.y + Phaser.Math.Between(-22, 12);
        spawnFx(this, i % 3 === 2 ? 'fx_hit_big' : 'fx_explosion', x, y, { depth: DEPTH_OF.fxTop });
        for (let k = 0; k < 3; k++) throwDebris(this, x, y, Phaser.Math.Between(-70, 70), Phaser.Math.Between(-10, 50), 480);
        if (i % 2 === 0) audio.sfx('explosion', { pitch: 0.8 + Math.random() * 0.3 });
        audio.sfx('crash', { volume: 0.3, pitch: 1.2 + Math.random() * 0.4 });
        this.quake(5, 160);
      });
    }
    this.time.delayedCall(startMs + 9 * 110 + 60, () => {
      for (const [dx, dy, d, big] of [[-40, -6, 0, 1], [36, -2, 90, 1], [0, -16, 170, 2]] as const) {
        this.time.delayedCall(d, () => {
          spawnFx(this, 'fx_explosion', s.x + dx, s.y + dy, { depth: DEPTH_OF.fxTop }).setScale(big);
          for (let k = 0; k < 4; k++) throwDebris(this, s.x + dx, s.y + dy, Phaser.Math.Between(-90, 90), Phaser.Math.Between(-20, 50), 560);
        });
      }
      audio.sfx('explosion', { pitch: 0.7 });
      audio.sfx('bigHit', { pitch: 0.8 });
      this.quake(9, 500);
      hitStop(this, 80);
      // そのあとも車は燃えている
      for (let i = 0; i < 8; i++) {
        this.time.delayedCall(200 + i * 260, () => spawnFx(this, i % 2 ? 'fx_dust' : 'fx_hit', s.x + Phaser.Math.Between(-40, 40), s.y - 22 + Phaser.Math.Between(-4, 6), { depth: DEPTH_OF.car + 0.5 }));
      }
    });
  }

  /**
   * ステージ3:殴られた母艦が宙に浮き、噴水(def.bossDefeatProp)に落ちて爆発する。親玉は目を回して出てくる。
   * 噴水が壊れた分は被害額に足す(stats.breakProp)。母艦そのものは数えない
   */
  private wreckShip(): void {
    const ship = this.car!;
    this.stopVehicle();
    this.tweens.killTweensOf(ship);
    ship.firing = false;
    this.shipShadow?.setVisible(false);

    // 落ちた母艦のコマにして、真ん中を基準に動かす
    const s = ship.sprite;
    stopJolt(s);
    s.setVisible(true).setFrame(3).setDepth(DEPTH_OF.car);
    const cx = s.x, cy = s.y - ship.look.h / 2;
    s.setOrigin(0.5, 0.5).setPosition(cx, cy);
    const kind = this.def.bossDefeatProp;
    const fountain = kind ? this.props.spare(kind) : null;
    // 噴水の水の中に沈んだように、母艦の下の端を噴水の下の端より少し上にする
    const tx = fountain?.x ?? 150;
    const ty = (fountain?.y ?? FEET_Y - 40) - 6 - ship.look.h / 2;
    audio.sfx('crash');
    spawnFx(this, 'fx_explosion', ship.frontX + 10, s.y - 8, { depth: DEPTH_OF.fxTop });
    for (let i = 0; i < 6; i++) throwDebris(this, cx, cy, Phaser.Math.Between(-70, 70), Phaser.Math.Between(-10, 40), 500);
    // ufoFall は鳴らしてから0.5秒で地面に当たる音が入るので、落ちるのも0.5秒
    this.tweens.addCounter({
      from: 0, to: 1, duration: 500, ease: 'Linear',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        s.x = Math.round(cx + (tx - cx) * t);
        s.y = Math.round(cy + (ty - cy) * t - 44 * 4 * t * (1 - t));
      },
      onComplete: () => {
        // 噴水に落ちた:噴水のふちを母艦より手前に描いて、水の中に沈んで見せる
        s.setPosition(tx, ty);
        audio.sfx('bossDown');
        audio.sfx('break');
        this.quake(6, 260);
        for (const dx of [-50, 0, 50]) spawnFx(this, 'fx_dust', s.x + dx, s.y + 20, { depth: DEPTH_OF.car + 0.5 });
        if (fountain && kind) {
          fountain.setFrame(1).setDepth(DEPTH_OF.car + 0.2);
          splash(this, fountain.x, fountain.y - 24, 16);
          const cost = this.run.stats.breakProp(kind);
          this.hud.refresh(this.run.stats);
          popText(this, Phaser.Math.Clamp(fountain.x, 30, 186), fountain.y - 50, formatYen(cost), { color: UI.danger, size: FS.big });
        }
      }
    });

    this.burnWreck(s, 540);

    // 親玉が目を回して出てくる
    this.bossOutOfWreck(s, 900);
  }

  /** ボスが目を回して、壊れた車(母艦)から飛び出してきて、手前でのびる */
  private bossOutOfWreck(s: Phaser.GameObjects.Sprite, delayMs: number): void {
    const boss = this.boss;
    this.time.delayedCall(delayMs, () => {
      // 車の手前に落ちて、のびる
      const x0 = s.x, y0 = s.y - 6;
      const x1 = 142, y1 = FEET_Y + 14;
      boss.setVisible(true).setDepth(DEPTH_OF.car + 1).setPosition(x0, y0);
      this.playAnim(boss, this.bossKey, 'defeat', false);
      audio.sfx('bossDown', { pitch: 1.3 });
      this.tweens.addCounter({
        from: 0, to: 1, duration: 520, ease: 'Linear',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          boss.x = Math.round(x0 + (x1 - x0) * t);
          boss.y = Math.round(y0 + (y1 - y0) * t - 60 * 4 * t * (1 - t));
        },
        onComplete: () => {
          spawnFx(this, 'fx_dust', x1 - 10, FEET_Y - 4, { depth: DEPTH_OF.car + 2 });
          this.quake(3, 150);
          this.bossShadow.setPosition(x1, y1 + 1).setVisible(true).setDepth(DEPTH_OF.car + 0.9);
          // 目を回した星
          const stars = this.add.sprite(x1 + 18, y1 - 22, 'fx_stars', 0).setDepth(DEPTH_OF.car + 2);
          this.playAnim(stars, 'fx_stars', 'play');
        }
      });
    });
  }
}
