// ステージ前の掛け合い。ヒーローとオペレーターが下のカットインで順に話す。
// そのステージを初めて遊ぶときだけ introFor(stage.id)(仕分けのやり方を3〜5枚で)を見せる。
// 見たこと(records の introSeen)か、そのステージを遊んだことがあれば、このシーンはとばしてすぐ仕分けへ。
// ステージを選ぶ画面とタイトルは entrySceneFor(stage.id) で行き先を決める。結果画面の「もう一回」でここへ来たときも、
// 見たことがあれば create ですぐ仕分けへ行く。開発用に途中から始めたとき(run.debug)は毎回見せる。
// タップで次へ(文字送りの途中なら全部出す)。下の「とばす」で仕分けへ(片手で届くように「次へ」の横)。
// フリープレイ(run.mode === 'free')は、初めて遊ぶときだけ FREE_INTRO の3枚を出して markFreeIntroSeen。
// 行き先は仕分けではなく Street(波1)。2回目からは何も出さずに Street へ(freeEntryScene)。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey, originFor } from '../art/sheets';
import { FREE_INTRO, bgForWave, introFor, markFreeIntroSeen, markIntroSeen, needsFreeIntro, needsIntro, type StageId } from '../logic';
import { currentWave, getRun } from '../run';
import { Button, CUT_H, CUT_TOP_H, FS, PauseControl, addPanel, panelRect, spawnFx } from '../ui';
import { Z, addMute, devHook, drawStageBg, drawLightPool, flicker, unlockOnTap } from './sort/common';
import { Dialogue } from './dialogue';
import { IntroDemo, demoKindFor } from './sort/introDemo';

const HERO_X = 60;
const FEET_Y = 204;

/** そのステージを始めるときの最初のシーン。掛け合いを見たか遊んだことがあれば、すぐ仕分け */
export function entrySceneFor(stageId: StageId): string {
  return needsIntro(stageId) ? SCENES.intro : SCENES.sort;
}

/** フリープレイを始めるときの最初のシーン。初回だけ掛け合い、2回目からはすぐ Street */
export function freeEntryScene(): string {
  return needsFreeIntro() ? SCENES.intro : SCENES.street;
}

export class IntroScene extends Phaser.Scene {
  private talk!: Dialogue;
  private hero!: Phaser.GameObjects.Sprite;
  private demo!: IntroDemo;
  /** 見たことがあって、すぐ仕分けへ行ったとき(何も作っていない) */
  private skipped = false;
  /** 掛け合いのあとのシーン(ステージは仕分け、フリープレイは Street) */
  private nextScene: string = SCENES.sort;

  constructor() { super(SCENES.intro); }

  create(): void {
    const { W } = layout;
    const run = getRun(this);
    this.skipped = false;
    const free = run.mode === 'free';
    this.nextScene = free ? SCENES.street : SCENES.sort;
    // もう見たステージなら、何も出さずに仕分けへ(ワイプで隠れている間に切り替わる)
    if (!run.debug && !(free ? needsFreeIntro() : needsIntro(run.stage.id))) {
      this.skipped = true;
      this.scene.start(this.nextScene);
      return;
    }
    const lines = free ? FREE_INTRO : introFor(run.stage.id);
    // 見せ始めたら「見た」にする(途中でとばしても、閉じても、次からは出さない)
    if (free) markFreeIntroSeen();
    else markIntroSeen(run.stage.id);
    unlockOnTap(this);
    // 「もう一回」から来たときに結果画面の曲が残らないように(タイトルから来たときは同じ曲なので何もしない)
    audio.playBgm('title');

    // 上:ステージの背景とヒーロー
    drawStageBg(this, bgForWave(run.stage.def, currentWave(run).no));
    const pool = this.add.graphics().setDepth(Z.ground + 1);
    drawLightPool(pool, HERO_X, FEET_Y + 1, 34, 5);
    const aura = this.add.sprite(HERO_X, FEET_Y - 44, 'fx_aura').setScale(2).setDepth(Z.aura);
    aura.play(animKey('fx_aura', 'play'));
    flicker(this, aura);
    this.hero = this.add.sprite(HERO_X, FEET_Y, 'hero').setOrigin(...originFor('hero')).setScale(2).setDepth(Z.actor);
    this.hero.play(animKey('hero', 'idle'));
    this.hero.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.hero.play(animKey('hero', 'idle')));
    // お手本の人は、そのステージの人にする(路地裏と地下駐車場はパーカーの男のまま)
    this.demo = new IntroDemo(this, 116, 34, 96, 122, run.stage.def.mechanic === 'ufo' ? 'uncle_bad' : undefined);

    // 右上:音
    const mute = addMute(this, W - 13, 13);
    new PauseControl(this);

    // 下:セリフ
    addPanel(this);
    const r = panelRect();
    // 縦に余裕があれば大きな字(16)。顔を上に置いて、セリフは箱の幅いっぱい(1行12文字が入る)
    const tall = r.h >= 150;
    const wide = panelRect(4);
    const ch = tall ? CUT_TOP_H : CUT_H;
    // 下に「次へ」の大きなボタンと、左に小さな「とばす」(どちらも親指が届くところ)。画面のどこをタップしても進む
    const btnH = Phaser.Math.Clamp(r.h - ch - 24, 30, 60);
    const btnY = r.bottom - btnH;
    const skipW = 60;
    // カットインはボタンとの間に少し寄せて、空きが上下に分かれるようにする
    const cutY = r.y + Math.max(0, Math.floor((btnY - 24 - ch - r.y) / 3));
    // 会話の窓は横いっぱい(顔の右にセリフを出すときも、1行12字が入る)
    const cx = wide.x, cw = wide.w;
    const talk = new Dialogue(this, {
      x: cx, y: cutY, w: cw, h: ch, tall, lines, to: this.nextScene,
      onLine: (line) => {
        this.demo.show(demoKindFor(line.text));
        if (line.who === 'hero') this.heroReact(line.face);
      }
    });
    this.talk = talk;
    const skip = new Button(this, r.x, btnY, skipW, btnH, 'とばす▶▶', { color: 0x2a2540, size: FS.small, textColor: UI.textDim, onPress: () => talk.leave() });
    const nextBtn = new Button(this, r.x + skipW + 6, btnY, r.w - skipW - 6, btnH, '次へ▶', { color: 0x3a3354, onPress: () => talk.advance() });

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.some((o) => o.parentContainer === skip || o.parentContainer === mute || o.parentContainer === nextBtn)) return;
      talk.advance();
    });
    this.input.keyboard?.on('keydown-SPACE', () => talk.advance());
    this.input.keyboard?.on('keydown-ENTER', () => talk.advance());
    this.input.keyboard?.on('keydown-ESC', () => talk.leave());

    devHook(this, { advance: () => talk.advance(), leave: () => talk.leave(), state: () => ({ index: talk.index, total: talk.total, typing: talk.cut.isTyping }) });
    this.time.delayedCall(260, () => talk.next());
  }

  override update(_t: number, dt: number): void {
    if (this.skipped) return;
    this.demo.update(dt);
    this.talk.update();
  }

  /** ヒーローが話すときの動き */
  private heroReact(face: string): void {
    if (face === 'oops') { this.hero.play(animKey('hero', 'oops')); return; }
    if (face === 'smile') { this.hero.play(animKey('hero', 'okay')); return; }
    // ドヤ顔:キラーンと光る
    this.hero.play(animKey('hero', 'idle'));
    spawnFx(this, 'fx_kiran', HERO_X + 14, FEET_Y - 94, { scale: 2, depth: Z.actorFront });
  }
}
