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
import { FREE_INTRO, introFor, markFreeIntroSeen, markIntroSeen, needsFreeIntro, needsIntro, type Speech, type StageId } from '../logic';
import { getRun } from '../run';
import { Button, CutIn, FS, PauseControl, PixelText, addPanel, panelRect, spawnFx } from '../ui';
import { Z, addMute, devHook, drawStageBg, gotoSafe, drawLightPool, flicker, unlockOnTap } from './sort/common';
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
  private lines: readonly Speech[] = [];
  private index = -1;
  private cut!: CutIn;
  private hero!: Phaser.GameObjects.Sprite;
  private demo!: IntroDemo;
  private nextMark!: PixelText;
  private counter!: PixelText;
  private leaving = false;
  /** 見たことがあって、すぐ仕分けへ行ったとき(何も作っていない) */
  private skipped = false;
  /** 掛け合いのあとのシーン(ステージは仕分け、フリープレイは Street) */
  private nextScene: string = SCENES.sort;

  constructor() { super(SCENES.intro); }

  create(): void {
    const { W } = layout;
    const run = getRun(this);
    this.index = -1;
    this.leaving = false;
    this.skipped = false;
    const free = run.mode === 'free';
    this.nextScene = free ? SCENES.street : SCENES.sort;
    // もう見たステージなら、何も出さずに仕分けへ(ワイプで隠れている間に切り替わる)
    if (!run.debug && !(free ? needsFreeIntro() : needsIntro(run.stage.id))) {
      this.leaving = true;
      this.skipped = true;
      this.scene.start(this.nextScene);
      return;
    }
    this.lines = free ? FREE_INTRO : introFor(run.stage.id);
    // 見せ始めたら「見た」にする(途中でとばしても、閉じても、次からは出さない)
    if (free) markFreeIntroSeen();
    else markIntroSeen(run.stage.id);
    unlockOnTap(this);
    // 「もう一回」から来たときに結果画面の曲が残らないように(タイトルから来たときは同じ曲なので何もしない)
    audio.playBgm('title');

    // 上:ステージの背景とヒーロー
    drawStageBg(this, run.stage.def.bg);
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
    const ch = tall ? 80 : 56;
    // 下に「次へ」の大きなボタンと、左に小さな「とばす」(どちらも親指が届くところ)。画面のどこをタップしても進む
    const btnH = Phaser.Math.Clamp(r.h - ch - 24, 30, 60);
    const btnY = r.bottom - btnH;
    const skipW = 60;
    // カットインはボタンとの間に少し寄せて、空きが上下に分かれるようにする
    const cutY = r.y + Math.max(0, Math.floor((btnY - 24 - ch - r.y) / 3));
    const cx = tall ? wide.x : r.x, cw = tall ? wide.w : r.w;
    this.cut = new CutIn(this, cx, cutY, cw, ch, { speed: 32, size: tall ? FS.big : FS.body, faceTop: tall });
    // カットインをタップしたときも、シーンのタップとして扱う(二重に進まないように)
    for (const o of this.cut.list) if (o instanceof Phaser.GameObjects.Zone) o.disableInteractive();
    const markY = cutY + ch - 14;
    this.nextMark = new PixelText(this, cx + cw - 8, markY, '▼', { size: FS.small, color: UI.gold }).setOrigin(1, 0).setDepth(1200);
    this.time.addEvent({ delay: 300, loop: true, callback: () => { this.nextMark.y = markY + (this.nextMark.y === markY ? 1 : 0); } });
    this.counter = new PixelText(this, cx + 2, cutY + ch + 5, '', { size: FS.small, color: UI.textDim });
    const skip = new Button(this, r.x, btnY, skipW, btnH, 'とばす▶▶', { color: 0x2a2540, size: FS.small, textColor: UI.textDim, onPress: () => this.leave() });
    const nextBtn = new Button(this, r.x + skipW + 6, btnY, r.w - skipW - 6, btnH, '次へ▶', { color: 0x3a3354, onPress: () => this.advance() });

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.some((o) => o.parentContainer === skip || o.parentContainer === mute || o.parentContainer === nextBtn)) return;
      this.advance();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.leave());

    devHook(this, { advance: () => this.advance(), leave: () => this.leave(), state: () => ({ index: this.index, total: this.lines.length, typing: this.cut.isTyping }) });
    this.time.delayedCall(260, () => this.next());
  }

  override update(_t: number, dt: number): void {
    if (this.skipped) return;
    this.demo.update(dt);
    this.nextMark.setVisible(!this.cut.isTyping && this.index >= 0);
  }

  /** タップ:文字送りの途中なら全部出す。出し終わっていれば次のセリフへ */
  private advance(): void {
    if (this.leaving || this.index < 0) return;
    if (this.cut.isTyping) { this.cut.skip(); return; }
    this.next();
  }

  private next(): void {
    this.index++;
    if (this.index >= this.lines.length) { this.leave(); return; }
    const line = this.lines[this.index];
    this.counter.setText(`${this.index + 1}/${this.lines.length}`);
    let n = 0;
    void this.cut.say(line.text, line.face, {
      who: line.who,
      onChar: () => { if (n++ % 2 === 0) audio.sfx('blip', { volume: 0.4, pitch: line.who === 'hero' ? 1.25 : 1 }); }
    });
    this.demo.show(demoKindFor(line.text));
    if (line.who === 'hero') this.heroReact(line.face);
  }

  /** ヒーローが話すときの動き */
  private heroReact(face: string): void {
    if (face === 'oops') { this.hero.play(animKey('hero', 'oops')); return; }
    if (face === 'smile') { this.hero.play(animKey('hero', 'okay')); return; }
    // ドヤ顔:キラーンと光る
    this.hero.play(animKey('hero', 'idle'));
    spawnFx(this, 'fx_kiran', HERO_X + 14, FEET_Y - 94, { scale: 2, depth: Z.actorFront });
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.sfx('button');
    // 切り替えの途中で受け付けられなかったら、また入力を受け付ける
    gotoSafe(this, this.nextScene, undefined, undefined, (ok) => { if (!ok) this.leaving = false; });
  }
}
