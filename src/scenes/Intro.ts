// ステージ前の掛け合い。ヒーローとオペレーターが下のカットインで順に話す。
// 初回は INTRO(遊び方の説明つき)、2回目からは INTRO_REPLAY。
// タップで次へ(文字送りの途中なら全部出す)。右上の「とばす」で仕分けへ。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey, originFor } from '../art/sheets';
import { INTRO, INTRO_REPLAY, type Speech } from '../logic';
import { getRun } from '../run';
import { Button, CutIn, FS, PauseControl, PixelText, addPanel, panelRect } from '../ui';
import { Z, addMute, devHook, drawAlley, gotoSafe, drawLightPool, flicker, unlockOnTap } from './sort/common';
import { IntroDemo, demoKindFor } from './sort/introDemo';

const HERO_X = 60;
const FEET_Y = 204;

export class IntroScene extends Phaser.Scene {
  private lines: readonly Speech[] = [];
  private index = -1;
  private cut!: CutIn;
  private hero!: Phaser.GameObjects.Sprite;
  private demo!: IntroDemo;
  private nextMark!: PixelText;
  private counter!: PixelText;
  private leaving = false;

  constructor() { super(SCENES.intro); }

  create(): void {
    const { W } = layout;
    const run = getRun(this);
    this.lines = run.playCount >= 2 ? INTRO_REPLAY : INTRO;
    this.index = -1;
    this.leaving = false;
    unlockOnTap(this);
    // 「もう一回」から来たときに結果画面の曲が残らないように(タイトルから来たときは同じ曲なので何もしない)
    audio.playBgm('title');

    // 上:路地裏とヒーロー
    drawAlley(this);
    const pool = this.add.graphics().setDepth(Z.ground + 1);
    drawLightPool(pool, HERO_X, FEET_Y + 1, 34, 5);
    const aura = this.add.sprite(HERO_X, FEET_Y - 44, 'fx_aura').setScale(2).setDepth(Z.aura);
    aura.play(animKey('fx_aura', 'play'));
    flicker(this, aura);
    this.hero = this.add.sprite(HERO_X, FEET_Y, 'hero').setOrigin(...originFor('hero')).setScale(2).setDepth(Z.actor);
    this.hero.play(animKey('hero', 'idle'));
    this.hero.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.hero.play(animKey('hero', 'idle')));
    this.demo = new IntroDemo(this, 116, 34, 96, 122);

    // 右上:とばす と 音
    const skip = new Button(this, W - 58, 5, 54, 22, 'とばす▶▶', { color: 0x3a3354, size: FS.small, onPress: () => this.leave() });
    const mute = addMute(this, W - 74, 16);
    const pause = new PauseControl(this);
    void pause;

    // 下:セリフ
    addPanel(this);
    const r = panelRect();
    // 縦に余裕があれば大きな字(16)で3行まで
    const tall = r.h >= 150;
    const ch = tall ? 78 : 56;
    this.cut = new CutIn(this, r.x, r.y, r.w, ch, { speed: 32, size: tall ? FS.big : FS.body });
    // カットインをタップしたときも、シーンのタップとして扱う(二重に進まないように)
    for (const o of this.cut.list) if (o instanceof Phaser.GameObjects.Zone) o.disableInteractive();
    const markY = r.y + ch - 14;
    this.nextMark = new PixelText(this, r.right - 8, markY, '▼', { size: FS.small, color: UI.gold }).setOrigin(1, 0).setDepth(1200);
    this.time.addEvent({ delay: 300, loop: true, callback: () => { this.nextMark.y = markY + (this.nextMark.y === markY ? 1 : 0); } });
    this.counter = new PixelText(this, r.x + 2, r.y + ch + 6, '', { size: FS.small, color: UI.textDim });
    const tapHint = new PixelText(this, Math.round(W / 2), Math.max(r.y + ch + 24, r.bottom - 14), 'タップで次へ', { size: FS.body, color: UI.textDim }).setOrigin(0.5, 0);
    this.time.addEvent({ delay: 600, loop: true, callback: () => tapHint.setVisible(!tapHint.visible) });

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.some((o) => o.parentContainer === skip || o.parentContainer === mute)) return;
      this.advance();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.leave());

    devHook(this, { advance: () => this.advance(), leave: () => this.leave(), state: () => ({ index: this.index, total: this.lines.length, typing: this.cut.isTyping }) });
    this.time.delayedCall(260, () => this.next());
  }

  update(_t: number, dt: number): void {
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
    const k = this.add.sprite(HERO_X + 14, FEET_Y - 94, 'fx_kiran').setScale(2).setDepth(Z.actorFront);
    k.play(animKey('fx_kiran', 'play'));
    k.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => k.destroy());
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.sfx('button');
    // 切り替えの途中で受け付けられなかったら、また入力を受け付ける
    gotoSafe(this, SCENES.sort, undefined, undefined, (ok) => { if (!ok) this.leaving = false; });
  }
}
