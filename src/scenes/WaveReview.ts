// 答え合わせ。波1と波2は Street のあと、波3は Boss のあとに出す。
// その波の人を1人1行で並べ、顔、名前、自分の仕分けと正体、見分ける決め手、○か×を出す。まちがえた行は赤黒くする。
// 時間切れでヒーローが決めた人は「あなた」の代わりに「ヒーローの勘」と出す。ボスは化けた姿と偽名で、正体はボス。
// 入口:Street(nextAfterStreet)と Boss から。出口:次へ → nextAfterReview(run)(次の波の Sort か Result)。
// 行はタップで一気に出せる。ステージ2の波3(6人と女ボスで7行)も、いちばん低い画面(高さ384)に入る高さにする。
// タイムセールラッシュのあるステージ(def.hasRush)の波2は、人の行のあとにラッシュのまとめを1行出す
// (「セール：撃破3/4・守った2/4」。ラッシュの数は仕分けの正解に入れない)。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { reasonFor, rushSummary, sortIsCorrect, stripReasonMarkup, tallySorts, type RushTally, type SortChoice } from '../logic';
import { Button, DEPTH, FS, MuteButton, PixelText, goto, preloadFont } from '../ui';
import { currentWave, getRun, nextAfterReview, recordWaveSorts, type GameRun } from '../run';
import { Timeline } from './result/timeline';
import { drawMark, personThumb } from './review/draw';

/** まちがえた行の色 */
const ROW_NG = UI.cutFill;
/** 行の箱のふち */
const ROW_EDGE = UI.panelLine;
/** 「ヒーローの勘」の字の色 */
const HERO_GUESS = 0xe0c080;
/** 顔の後ろ */
const THUMB_BG = 0x1a1d3a;

/** ラッシュのまとめの行の地 */
const RUSH_BG = 0x2a2150;
/** ラッシュのまとめの行の高さ */
const RUSH_ROW_H = 16;
/** タイムセールラッシュがある波(STAGE3「ゲームの流れ」。波2の結果発表のあと) */
const RUSH_WAVE = 2;

/** 仕分けの呼び方と色 */
const CHOICE_TEXT: Record<SortChoice | 'boss', string> = { bad: '{red}ワル{/}', civ: '{civ}市民{/}', boss: '{red}ボス{/}' };

/** 答え合わせの画面に出る字(先に読みこむ用) */
const REVIEW_TEXTS = ['の答え合わせ', '人中', '人正解', '正解:', 'あなた:', 'ヒーローの勘:', 'ワル', '市民', 'ボス', '次へ▶'];

/** 開発用:window.reviewDev から中身をさわれる(テスト用) */
interface ReviewDev {
  scene?: WaveReviewScene; next?: Button; rows?: { id: string; ok: boolean; hero: boolean; reason: string }[];
  /** ラッシュのまとめの行(出さないときは null) */
  rush?: string | null;
}
const dev: ReviewDev = {};

export class WaveReviewScene extends Phaser.Scene {
  private tl!: Timeline;
  private leaving = false;

  constructor() { super(SCENES.waveReview); }

  create(): void {
    const { W, H } = layout;
    const run = getRun(this);
    const wave = currentWave(run);
    this.leaving = false;
    this.tl = new Timeline();
    if (import.meta.env.DEV) (window as unknown as { reviewDev: ReviewDev }).reviewDev = dev;
    dev.scene = this;
    recordWaveSorts(run);

    audio.playBgm('sort');
    this.input.on('pointerdown', () => audio.unlock());

    // ─── 背景 ───
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(UI.panel, 1).fillRect(0, 0, W, H);
    bg.fillStyle(0x15122a, 1);
    for (let y = 2; y < H; y += 4) bg.fillRect(0, y, W, 1);

    // ─── 見出し ───
    const people = wave.people;
    const t = tallySorts(people, run.sorts, run.randomSorted);
    const correct = t.correct + t.byHeroCorrect;
    new PixelText(this, Math.floor(W / 2), 4, `WAVE${wave.no}の答え合わせ`, { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0);
    const count = new PixelText(this, Math.floor(W / 2), 22, `${people.length}人中{gold}${correct}人{/}正解`, { size: FS.big, color: UI.text, outline: true })
      .setOrigin(0.5, 0).setVisible(false);
    new MuteButton(this, W - 11, 12, { isMuted: () => audio.isMuted(), toggle: () => audio.toggleMuted() }).setDepth(DEPTH.ui + 1);

    // ─── 次へ ───
    const bottom = H - Math.max(6, layout.safeBottom + 4);
    const btnH = 28;
    const next = new Button(this, 6, bottom - btnH, W - 12, btnH, '次へ▶', { color: 'civ' });
    dev.next = next;
    next.on('press', () => {
      audio.unlock(); audio.sfx('button');
      this.finish();
    });

    // ─── 行 ───
    // 1人1つの箱。当たりは青、はずれは赤黒。箱の高さは人数で割って、広すぎないようにする
    // ラッシュのまとめを出すときは、その1行ぶんを下にとっておく
    const rush = wave.no === RUSH_WAVE && run.stage.def.hasRush ? rushTallyFor(run) : null;
    const rushText = rush ? rushSummary(rush) : null;
    dev.rush = rushText;
    const listTop = 42;
    const listBottom = bottom - btnH - 5 - (rushText ? RUSH_ROW_H + 3 : 0);
    const n = people.length;
    const gap = n >= 7 ? 2 : 3;
    // 1行は3行の字(名前、仕分け、決め手)が入る高さ(40)から56まで。上につめて並べる
    const rowH = Math.max(40, Math.min(56, Math.floor((listBottom - listTop + gap) / n) - gap));
    const y0 = listTop;
    const thumbW = 30;
    const thumbH = Math.min(rowH - 4, 46);
    const TX = 4 + 3 + thumbW + 4;   // 字の左
    const MX = W - 17;               // ○×の真ん中

    dev.rows = [];
    const rowParts: Phaser.GameObjects.GameObject[][] = [];
    const marks: { g: Phaser.GameObjects.Graphics; ok: boolean }[] = [];
    people.forEach((p, i) => {
      const y = y0 + i * (rowH + gap);
      const choice = run.sorts[p.id];
      const ok = sortIsCorrect(p.truth, choice);
      const byHero = run.randomSorted.includes(p.id);
      const reason = reasonFor(p, wave);
      dev.rows!.push({ id: p.id, ok, hero: byHero, reason: stripReasonMarkup(reason) });
      const parts: Phaser.GameObjects.GameObject[] = [];
      const g = this.add.graphics().setDepth(DEPTH.ui - 1);
      g.fillStyle(UI.black, 1).fillRect(3, y - 1, W - 6, rowH + 2);
      g.fillStyle(ROW_EDGE, 1).fillRect(4, y, W - 8, rowH);
      g.fillStyle(ok ? UI.winFill : ROW_NG, 1).fillRect(5, y + 1, W - 10, rowH - 2);
      // 顔
      const ty = y + Math.floor((rowH - thumbH) / 2);
      g.fillStyle(UI.black, 1).fillRect(6, ty - 1, thumbW + 2, thumbH + 2);
      g.fillStyle(THUMB_BG, 1).fillRect(7, ty, thumbW, thumbH);
      parts.push(g);
      const key = personThumb(this, p, thumbW, thumbH);
      if (key) parts.push(this.add.image(7, ty, key).setOrigin(0).setDepth(DEPTH.ui));
      // 名前と正体
      const ly = y + Math.max(1, Math.floor((rowH - 40) / 2));
      parts.push(new PixelText(this, TX, ly + 1, p.profile.name, { size: FS.body, color: UI.gold }));
      parts.push(new PixelText(this, MX - 13, ly + 1, `正解:${CHOICE_TEXT[p.truth]}`, { size: FS.body, color: UI.textDim }).setOrigin(1, 0));
      // 自分の仕分け(時間切れならヒーローの勘)
      const who = byHero ? 'ヒーローの勘' : 'あなた';
      const mine = choice ? CHOICE_TEXT[choice] : '?';
      parts.push(new PixelText(this, TX, ly + 14, `${who}:${mine}`, { size: FS.body, color: byHero ? HERO_GUESS : UI.textDim }));
      // 決め手
      parts.push(new PixelText(this, TX, ly + 27, reason, { size: FS.body, color: UI.textDim }));
      // ○か×
      const mg = this.add.graphics().setDepth(DEPTH.ui + 1).setVisible(false);
      drawMark(mg, MX, ly + 13, ok, 9);
      marks.push({ g: mg, ok });
      for (const o of parts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
      rowParts.push(parts);
    });

    // ラッシュのまとめ(人の行のすぐ下)。数字は金色
    let rushParts: Phaser.GameObjects.GameObject[] = [];
    if (rushText) {
      const y = y0 + n * (rowH + gap);
      const g = this.add.graphics().setDepth(DEPTH.ui - 1);
      g.fillStyle(UI.black, 1).fillRect(3, y - 1, W - 6, RUSH_ROW_H + 2);
      g.fillStyle(ROW_EDGE, 1).fillRect(4, y, W - 8, RUSH_ROW_H);
      g.fillStyle(RUSH_BG, 1).fillRect(5, y + 1, W - 10, RUSH_ROW_H - 2);
      const txt = new PixelText(this, Math.floor(W / 2), y + 2, rushText.replace(/(\d+\/\d+)/g, '{gold}$1{/}'), { size: FS.body, color: UI.text })
        .setOrigin(0.5, 0);
      rushParts = [g, txt];
      for (const o of rushParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
    }

    // ─── 流れ:1行ずつ出して、○×を押す ───
    const quiet = { v: false };
    this.tl.wait(250);
    rowParts.forEach((parts, i) => {
      this.tl.step(0, { end: () => { for (const o of parts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true); if (!quiet.v) audio.sfx('blip', { volume: 0.5 }); } })
        .wait(120)
        .step(0, {
          end: () => {
            marks[i].g.setVisible(true);
            if (!quiet.v) audio.sfx(marks[i].ok ? 'okay' : 'oops', { volume: 0.6 });
          }
        })
        .wait(160);
    });
    if (rushParts.length) {
      this.tl.step(0, { end: () => { for (const o of rushParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true); if (!quiet.v) audio.sfx('blip', { volume: 0.5 }); } })
        .wait(200);
    }
    this.tl.step(0, { end: () => { count.setVisible(true); if (!quiet.v) audio.sfx('stamp'); } });

    // タップで残りを一気に出す(ボタンの上は除く)
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length || this.tl.done) return;
      quiet.v = true;
      this.tl.finishAll();
      quiet.v = false;
      audio.sfx('blip');
    });
    const onUpdate = (_t: number, dt: number): void => this.tl.update(dt);
    this.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));

    // 字は先に読みこんでおく(決め手の文は日本語の字が多い)
    void preloadFont([...REVIEW_TEXTS, rushText ?? '', ...people.map((p) => p.profile.name + stripReasonMarkup(reasonFor(p, wave)))], [12, 16]);
  }

  /** 次へ:波1と波2は次の波の仕分け、波3は結果画面 */
  private finish(): void {
    if (this.leaving) return;
    const run = getRun(this);
    const to = nextAfterReview(run);
    if (goto(this, to, undefined, { kind: 'wipe' })) this.leaving = true;
    else if (to === SCENES.sort) run.waveIndex -= 1;   // 受け付けられなかったら、進めた波を戻す
  }
}

/**
 * ラッシュの数。まだ数えていないとき(開発用に途中から始めてラッシュを通らなかったとき)は、
 * 見本として宇宙人を1人だけ逃がし、市民を1人だけ殴ったことにする。ふつうに遊んでいれば数えてある
 */
function rushTallyFor(run: GameRun): RushTally | null {
  const t = run.stats.rushTally;
  if (t || !run.debug || !run.stage.rush) return t;
  run.stats.startRush(run.stage.rush);
  // 最初の宇宙人は待てで止め(逃がした)、最初の市民は殴った。ほかは正しく押した
  const firsts = new Set(['bad', 'civ'].map((t) => run.stage.rush!.runners.findIndex((r) => r.truth === t)));
  run.stage.rush.runners.forEach((r, i) => {
    const miss = firsts.has(i);
    if ((r.truth === 'bad') !== miss) run.stats.rushHit(r.truth); else run.stats.rushStopped(r.truth);
  });
  return run.stats.rushTally;
}
