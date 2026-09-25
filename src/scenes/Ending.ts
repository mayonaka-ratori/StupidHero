// 終わりの場面。高層ビルのボスを初めて倒したときだけ、最後の答え合わせ(WaveReview)と結果画面(Result)の間に出す
// (docs/STAGE4.md「終わりの場面」、文は docs/STAGE4_TEXT.md「終わりの場面」の TOWER_ENDING)。
// 行き先は run.ts の sceneAfterLastReview が決める。見せ始めたら markEndingSeen で記録に残し、2回目からは出さない
// (開発用に途中から始めたとき、run.debug は記録に残さない)。
//
// 上:朝日の差しこむパーティ会場(最上階の背景に Sunrise を重ねる)。ヒーローは大きく、シャンパンタワーのそばで親玉がのびている。
// 下:ステージ前の掛け合い(Intro)と同じ会話の窓。顔(48×48)を左上に、セリフを顔の下に出す。
// タップで次へ(文字送りの途中なら全部出す)。右上の「とばす▶」で結果画面へ。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey, frameIndex, originFor, sheetByKey } from '../art/sheets';
import { TOWER_ENDING, TOWER_ENDING_SKIP, bgForWave, markEndingSeen, type Speech } from '../logic';
import { getRun } from '../run';
import { Button, CutIn, CUT_H, CUT_TOP_H, FS, PixelText, addPanel, panelRect, spawnFx } from '../ui';
import { Z, devHook, drawLightPool, drawStageBg, gotoSafe, unlockOnTap } from './sort/common';
import { Sunrise } from './boss/sunrise';
import { CHANDELIER_HANG_Y, drawChain } from './boss/choice';

const HERO_X = 60;
const FEET_Y = 204;

export class EndingScene extends Phaser.Scene {
  private lines: readonly Speech[] = TOWER_ENDING;
  private index = -1;
  private cut!: CutIn;
  private hero!: Phaser.GameObjects.Sprite;
  private nextMark!: PixelText;
  private counter!: PixelText;
  private leaving = false;

  constructor() { super(SCENES.ending); }

  create(): void {
    const { W } = layout;
    const run = getRun(this);
    this.index = -1;
    this.leaving = false;
    this.lines = TOWER_ENDING;
    // 見せ始めたら「見た」にする(とばしても、閉じても、次からは出さない)
    if (!run.debug) markEndingSeen();
    unlockOnTap(this);
    audio.playBgm('title');

    // ─── 上:朝日の差しこむパーティ会場 ───
    const def = run.stage.def;
    const layers = drawStageBg(this, bgForWave(def, def.waves[def.waves.length - 1].no), Math.round(run.scrollX));
    new Sunrise(this, layers.wall.tilePositionX, Z.far + 0.5).showNow();
    // 天井のシャンデリア(会場の飾り。ボス戦のシャンデリアとは別の、奥のもの)
    drawChain(this.add.graphics().setDepth(Z.wall + 0.4), 172, CHANDELIER_HANG_Y);
    this.add.sprite(172, CHANDELIER_HANG_Y, 'prop_chandelier', 0).setOrigin(...originFor('prop_chandelier')).setDepth(Z.wall + 0.5);
    // 右:割れたシャンパンタワーと、のびている親玉
    this.add.sprite(188, 176, 'prop_champagne', 1).setOrigin(...originFor('prop_champagne')).setDepth(Z.actor - 1);
    const boss = def.bossSheet;
    const bdef = sheetByKey(boss);
    this.add.sprite(170, 196, boss, frameIndex(bdef, 'defeat', 3)).setOrigin(...originFor(boss)).setDepth(Z.actor - 0.5);
    const stars = this.add.sprite(154, 172, 'fx_stars', 0).setDepth(Z.actor);
    if (this.anims.exists(animKey('fx_stars', 'play'))) stars.play(animKey('fx_stars', 'play'));
    // 左:ヒーロー(大きく)
    const pool = this.add.graphics().setDepth(Z.ground + 1);
    drawLightPool(pool, HERO_X, FEET_Y + 1, 34, 5);
    this.hero = this.add.sprite(HERO_X, FEET_Y, 'hero').setOrigin(...originFor('hero')).setScale(2).setDepth(Z.actor);
    this.hero.play(animKey('hero', 'idle'));
    this.hero.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.hero.play(animKey('hero', 'idle')));

    // 右上:とばす(結果画面へ)
    const skip = new Button(this, W - 4 - 64, 6, 64, 22, TOWER_ENDING_SKIP, {
      color: 0x2a2540, size: FS.body, textColor: UI.textDim, onPress: () => this.leave()
    });

    // ─── 下:会話の窓(ステージ前の掛け合いと同じ) ───
    addPanel(this);
    const r = panelRect();
    const tall = r.h >= 150;
    const wide = panelRect(4);
    const ch = tall ? CUT_TOP_H : CUT_H;
    const cutY = r.y + Math.max(0, Math.floor((r.h - ch - 20) / 3));
    this.cut = new CutIn(this, wide.x, cutY, wide.w, ch, { speed: 32, size: tall ? FS.big : FS.body, faceTop: tall });
    // カットインをタップしたときも、シーンのタップとして扱う(二重に進まないように)
    for (const o of this.cut.list) if (o instanceof Phaser.GameObjects.Zone) o.disableInteractive();
    const markY = cutY + ch - 14;
    this.nextMark = new PixelText(this, wide.x + wide.w - 8, markY, '▼', { size: FS.small, color: UI.gold }).setOrigin(1, 0).setDepth(1200);
    this.time.addEvent({ delay: 300, loop: true, callback: () => { this.nextMark.y = markY + (this.nextMark.y === markY ? 1 : 0); } });
    this.counter = new PixelText(this, wide.x + 2, cutY + ch + 5, '', { size: FS.small, color: UI.textDim });
    new PixelText(this, wide.x + wide.w - 2, cutY + ch + 5, 'タップで次へ', { size: FS.small, color: UI.textDim }).setOrigin(1, 0);

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.some((o) => o.parentContainer === skip)) return;
      this.advance();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.leave());

    devHook(this, { advance: () => this.advance(), leave: () => this.leave(), state: () => ({ index: this.index, total: this.lines.length, typing: this.cut.isTyping }) });
    // 朝日のキラキラ
    for (let i = 0; i < 5; i++) this.time.delayedCall(200 + i * 260, () => spawnFx(this, 'fx_sparkle', Phaser.Math.Between(24, 200), Phaser.Math.Between(20, 80), { depth: Z.wall + 1 }));
    this.time.delayedCall(400, () => this.next());
  }

  override update(): void {
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
    // ヒーローのドヤ顔:決めポーズでキラーン
    if (line.who === 'hero') {
      this.hero.play(animKey('hero', 'win_fist'));
      spawnFx(this, 'fx_kiran', HERO_X + 14, FEET_Y - 94, { scale: 2, depth: Z.actorFront });
    }
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.sfx('button');
    gotoSafe(this, SCENES.result, undefined, undefined, (ok) => { if (!ok) this.leaving = false; });
  }
}
