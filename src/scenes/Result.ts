// 結果画面。称号、勝利ポーズ(背中で爆発)、数字の数え上げ、いちばんひどかった場面、共有。
// 入口:波3の答え合わせ(WaveReview)から。出口:もう一回 → 同じステージで startRun して Intro、タイトルへ → Title。
// 称号の一覧のボタンで TitleList を開く(この画面は眠らせておき、もどると発表をやり直さずに元のまま)。
// 背景と共有カードはそのステージの絵(run.stage.def)。このプレイで次のステージが開いたら、
// 称号のひとことを読んだあと、画面をタップしたときに知らせる(ひとことをすぐに上書きしない)。
// 共有カードは画面が出た時点で作っておく(result/card.ts)。共有の流れは result/share.ts。
//
// 下の数字の窓の並び:仕分け正解、悪党を倒した、市民のけが(その下に小さく内わけ)、逃がした、被害額(その下にたとえ)。
// ステージ2(def.mechanic が 'gang')は組ごと撃破と車で逃げた組を小さく1行足す。
// ステージ3(def.mechanic が 'ufo')はUFOを落とした数を、タイムセールラッシュのあるステージ(def.rush)はラッシュのまとめを、小さく1行ずつ足す。
// 低い画面では、ボタンを小さくし、UFOとラッシュの行を1行にまとめ、
// それでも足りなければ「悪党を倒した」と「逃がした」を1行にまとめる。いちばんひどい場面の写真が入らないときは出さない。
//
// フリープレイ(run.mode === 'free'。docs/FREEPLAY.md「結果画面」):
// - 称号は decideTitle(s)(s.free があればフリープレイの順)。記録は saveFreeResult。新記録の NEW はステージと同じ出し方
// - 数字の窓は result/freeStats.ts(クリアまでの時間を大きく、待てで守った、行けで決めた、市民のけが、逃がした、被害額、
//   いちばん下に小さく heroAccuracyText)
// - 背景、ひとこと、被害額のたとえは、波3の背景のステージ(遊び終わった場所)。共有カードのステージ名は「フリープレイ」
// - いちばんひどい場面は、ステージの場面がなければ s.free.worst(freeWorstCaption)。共有文の1行目は freeShareCaption
// - 路地裏しかクリアしていない人には、称号のひとことのあと、タップで一度だけ「ステージを進めると、出てくる人が増えるよ」
//   (次のステージが開いた知らせと同じ出し方)
// - もう一回はフリープレイをもう一度(startFreeRun して、掛け合いを出さずに Street へ)。タイトルへはタイトルへ

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey, originFor } from '../art/sheets';
import {
  FREE_NAME, bgForWave, buildShareText, damageAnalogy, decideTitle, formatYen, freeShareCaption, hurtBreakdown, randomSeed, rushSummary, saveFreeResult,
  saveResult, say, shareCaption, STAGES, titleCommentFor, type FreeSaveOutcome, type SaveOutcome, type StageId, type StageStats,
  type TitleDef
} from '../logic';
import {
  Button, CutIn, CUT_H, DEPTH, FS, PixelText, WindowFrame, addPanel, banner, flash, goto, preloadFont, shake, spawnFx
} from '../ui';
import { addMute, drawStageBg, unlockOnTap } from './sort/common';
import { currentWave, getRun, recordAllSorts, startFreeRun, startRun, type GameRun } from '../run';
import { settings } from '../settings';
import { buildCard, cardTexts, freeWorstCaption, makeFallbackShot, worstCaption, type Card, type CardStage } from './result/card';
import { makeCanvas } from './result/draw';
import { MORE_STAGES_HINT, freeWindow } from './result/freeStats';
import { fillSampleStats, makeSampleShot, memoryFreeStorage, memoryStorage, sampleName } from './result/sample';
import { ShareFlow } from './result/share';
import type { StatRow, StatsWindow, WindowEnv } from './result/stats';
import { Timeline } from './result/timeline';
import { markJustUnlocked } from './stageselect/state';
import { openTitleList } from './TitleList';

/** 保存した記録のうち、結果画面が使うもの(ステージとフリープレイで同じ形にしたもの) */
interface Saved {
  titleIsNew: boolean;
  titlesCollected: number;
  titlesTotal: number;
  /** 取った称号の全部(称号の一覧に渡す) */
  earned: SaveOutcome['records']['titles'];
  /** 新記録の項目 */
  newRecords: readonly string[];
  /** 今回のプレイで開いたステージ(フリープレイは空) */
  unlockedNow: StageId[];
  /** 「ステージを進めると、出てくる人が増えるよ」を出すか(フリープレイだけ) */
  moreHint: boolean;
}

const fromStage = (o: SaveOutcome): Saved => ({
  titleIsNew: o.titleIsNew, titlesCollected: o.titlesCollected, titlesTotal: o.titlesTotal, earned: o.records.titles,
  newRecords: o.newRecords, unlockedNow: o.unlockedNow, moreHint: false
});
const fromFree = (o: FreeSaveOutcome): Saved => ({
  titleIsNew: o.titleIsNew, titlesCollected: o.titlesCollected, titlesTotal: o.titlesTotal, earned: o.records.titles,
  newRecords: o.newRecords, unlockedNow: [], moreHint: o.showMoreStagesHint
});

/** 同じプレイの記録を2回保存しないように */
const savedRuns = new WeakMap<GameRun, { stats: StageStats; title: TitleDef; saved: Saved }>();

const THUMB_KEY = 'result_thumb';

/** 称号の帯の上端 */
const BAND_Y = 12;
/** いちばんひどい場面の写真を出すのに要る高さ */
const THUMB_MIN = 58;

/** ステージの数字の窓とボタンの並べ方 */
interface Fit {
  smallH: number;
  shareH: number;
  gap: number;
  rowH: number;
  /** 「悪党を倒した」と「逃がした」を1行にまとめる */
  merge: boolean;
  /** 小さな字の行の高さ(内わけ、たとえ、組の行、UFOとラッシュの行) */
  subH: number;
  /** UFOを落とした数とラッシュのまとめを1行にまとめる(ステージ3) */
  pack: boolean;
}

/** 開発用:window.resultDev から中身をさわれる(テスト用) */
interface ResultDev { scene?: ResultScene; log: string[]; card?: Card; share?: ShareFlow; shareText?: string; [k: string]: unknown }
const dev: ResultDev = { log: [] };

export class ResultScene extends Phaser.Scene {
  private tl!: Timeline;
  private share?: ShareFlow;
  private card?: Card;
  private file: File | null = null;

  constructor() { super(SCENES.result); }

  create(): void {
    const { W, actionH } = layout;
    const run = getRun(this);
    this.tl = new Timeline();
    this.card = undefined;
    this.file = null;
    if (import.meta.env.DEV) (window as unknown as { resultDev: ResultDev }).resultDev = dev;
    dev.scene = this;
    dev.log.length = 0;

    // ─── 数字と称号と記録 ───
    let rec = savedRuns.get(run);
    let shot: CanvasImageSource | null = run.worstShot;
    const free = run.mode === 'free' && run.free !== null;
    if (!rec) {
      const sample = sampleName();
      if (run.debug && run.stats.defeated === 0 && run.stats.damage === 0 && run.stats.civHurt === 0) fillSampleStats(run.stats, sample);
      if (free) {
        const stats = run.stats.snapshot();
        const title = decideTitle(stats);
        rec = { stats, title, saved: fromFree(saveFreeResult(stats, title.id, run.debug ? memoryFreeStorage() : undefined)) };
      } else {
        // 答え合わせを通らずに来たとき(開発用に途中から始めたときなど)も、仕分けの済んだ波は数える
        recordAllSorts(run);
        const stats = run.stats.snapshot();
        const title = decideTitle(stats);
        const saved = saveResult(run.stage.id, stats, title.id, run.debug ? memoryStorage(run.stage.id) : undefined);
        rec = { stats, title, saved: fromStage(saved) };
        // 次のステージが開いた:ステージを選ぶ画面で鍵がこわれる演出をする
        markJustUnlocked(this, saved.unlockedNow);
      }
      savedRuns.set(run, rec);
    }
    // フリープレイの背景と言い方は、波3の背景のステージ(遊び終わった場所)
    const textStage: StageId = free ? run.free!.plan.waves[run.free!.plan.waves.length - 1].bgStage : run.stage.id;
    if (!shot && run.debug) shot = makeSampleShot(this, sampleName(), textStage, free);
    const { stats: s, title: t, saved } = rec;
    const def = free ? STAGES[textStage] : run.stage.def;
    const caption = free ? freeWorstCaption(s) : worstCaption(s);
    dev.log.push(`title:${t.id}`);
    if (saved.unlockedNow.length) dev.log.push(`unlocked:${saved.unlockedNow.join(',')}`);

    // ─── 音 ───
    audio.sfx('fanfare');
    this.time.delayedCall(1500, () => audio.playBgm('result'));
    unlockOnTap(this);

    // ─── 上:ステージの背景と勝利ポーズ ───
    drawStageBg(this, bgForWave(def, currentWave(run).no), run.scrollX, { depth: { far: 0, wall: 0, ground: 0 } });

    const fist = t.pose === 'win_fist';
    const hx = 108;
    const feet = fist ? 198 : 206;
    if (fist) this.add.image(hx, 182, 'fx_rubble', 0).setOrigin(0.5, 0).setScale(2).setDepth(19);
    this.add.image(hx, feet - 2, 'fx_shadow', 0).setScale(2).setDepth(18).setVisible(!fist);
    const hero = this.add.sprite(hx, feet, 'hero', 0).setOrigin(...originFor('hero')).setScale(2).setDepth(20);
    hero.play(animKey('hero', t.pose));
    this.startExplosions(hx, fist ? 176 : 184);

    // 称号の帯と、左上の「あなたの称号」の札
    const band = this.add.graphics().setDepth(DEPTH.ui - 1).setVisible(false);
    band.fillStyle(UI.black, 1).fillRect(0, BAND_Y, W, 26);
    band.fillStyle(UI.bad, 1).fillRect(0, BAND_Y + 1, W, 2).fillRect(0, BAND_Y + 23, W, 2);
    const yourTitle = this.labelTag(4, 0, 'あなたの称号').setVisible(false);
    const titleText = new PixelText(this, Math.floor(W / 2), BAND_Y + 13, t.name, { size: FS.big, color: UI.gold, outline: true })
      .setOrigin(0.5, 0.5).setVisible(false);
    // 初めて取った称号の NEW は、称号の右上に出す(左上は「あなたの称号」の札)
    const titleNew = this.newTag(Math.min(W - 44, Math.floor(W / 2) + Math.ceil(titleText.width / 2) - 8), 1).setVisible(false);
    addMute(this, W - 11, BAND_Y + 13).setDepth(DEPTH.ui + 1);
    const cut = new CutIn(this, 4, BAND_Y + 30, W - 8, CUT_H).setVisible(false);
    // タップで次の知らせがあることを示す印(次のステージが開いたとき)
    const more = new PixelText(this, W - 9, BAND_Y + 30 + CUT_H - 3, '▼タップ', { size: FS.small, color: UI.cutEdge })
      .setOrigin(1, 1).setDepth(DEPTH.cutin + 1).setVisible(false);

    // ─── 下:数字 ───
    addPanel(this);
    const boxY = actionH + 4;
    const bottom = layout.H - Math.max(6, layout.safeBottom + 4);
    const env: WindowEnv = { scene: this, boxY, bottom, newTag: (x, y) => this.newTag(x, y) };
    const sw = free ? freeWindow(env, s, { analogy: damageAnalogy(s.damage, textStage).text }) : stageWindow(env, s, run);
    const { fit, boxH, rows, values, newTags } = sw;

    // ─── ボタン ───
    const { smallH, shareH } = fit;
    const shareY = bottom - smallH - fit.gap - shareH;
    const rowBtnY = bottom - smallH;
    // 共有の画像(File)ができるまでは押せない
    const shareBtn = new Button(this, 6, shareY, W - 12, shareH, 'じゅんびちゅう', { color: 'stop' }).setEnabled(false);
    const againBtn = new Button(this, 6, rowBtnY, 99, smallH, 'もう一回', { color: 'civ' });
    const titleBtn = new Button(this, W - 105, rowBtnY, 99, smallH, 'タイトルへ', { color: 0x4a3f78 });
    // 次のステージが開いたら、タイトルへのボタンに「NEW」をつける(タイトルからステージを選ぶ画面へ行ける)
    const unlockNew = this.newTag(0, rowBtnY - 7).setVisible(false);
    unlockNew.x = W - 6 - (unlockNew.getData('w') as number) + 1;
    againBtn.on('press', () => {
      audio.unlock(); audio.sfx('button');
      // 新しいプレイは、切り替えを受け付けてから作る(連打や切り替えの途中で2回作らないように)
      // フリープレイは、掛け合いを出さずにすぐ Street へ(初回の掛け合いはもう見ている)
      if (free) goto(this, SCENES.street, undefined, { onCovered: () => startFreeRun(this, randomSeed(), { slow: settings.slowMode }) });
      else goto(this, SCENES.intro, undefined, { onCovered: () => startRun(this, randomSeed(), false, run.stage.id) });
    });
    titleBtn.on('press', () => {
      audio.unlock(); audio.sfx('button');
      goto(this, SCENES.title);
    });

    // ─── いちばんひどかった場面(小さく)と、称号の一覧のボタン ───
    const thumbTop = boxY + boxH + 5;
    const thumbRoom = shareY - 5 - thumbTop;
    const baseShot = shot ? normalizeShot(shot) : makeFallbackShot(this, s, run.scrollX, def);
    // Street が撮った画像がまだ読みこみ中なら、読めてから描き直す
    const pending = shot instanceof HTMLImageElement && !shot.complete ? shot : null;
    const shotReady = pending
      ? pending.decode().catch(() => undefined).then(() => { redrawShot(baseShot, pending); })
      : Promise.resolve();
    const thumbParts: Phaser.GameObjects.GameObject[] = [];
    const listText = `称号の一覧(${saved.titlesCollected}/${saved.titlesTotal})▶`;
    const listStyle = { color: UI.winFill, size: FS.body };
    let listBtn: Button;
    if (thumbRoom >= THUMB_MIN - 4) {
      // 左に写真、右に見出しと説明の文と称号の一覧のボタン
      const th = Math.min(64, thumbRoom);
      const tw = 86;
      const tc = makeCanvas(tw, th);
      // 半分の大きさ(1ドットおきに拾う)。人が立つあたりを、横は真ん中寄りで切り出す
      const sx = Math.round((216 - tw * 2) / 2);
      const drawThumb = (): void => tc.ctx.drawImage(baseShot, sx, 212 - th * 2, tw * 2, th * 2, 0, 0, tw, th);
      drawThumb();
      if (this.textures.exists(THUMB_KEY)) this.textures.remove(THUMB_KEY);
      this.textures.addCanvas(THUMB_KEY, tc.canvas);
      const ty = thumbTop + Math.floor((thumbRoom - th) / 2);
      const g = this.add.graphics().setDepth(DEPTH.ui);
      g.fillStyle(UI.black, 1).fillRect(4, ty - 2, tw + 4, th + 4);
      g.fillStyle(0xffffff, 1).fillRect(5, ty - 1, tw + 2, th + 2);
      const img = this.add.image(6, ty, THUMB_KEY).setOrigin(0).setDepth(DEPTH.ui);
      const rx = 6 + tw + 6;
      const rw = W - 5 - rx;
      // ボタンの字が1行に入らなければ2行にする
      const probe = new PixelText(this, 0, 0, listText, { size: FS.body });
      const bh = probe.width > rw - 4 ? 30 : 22;
      probe.destroy();
      listBtn = new Button(this, rx, ty + th - bh, rw, bh, bh > 22 ? listText.replace('(', '\n(') : listText, listStyle);
      const cap = new PixelText(this, rx, 0, caption, { size: FS.body, color: UI.text, wrap: rw, lineSpacing: 1 });
      // 見出し、説明の文、ボタンの順。高さが足りなければ見出しを省く
      const withLabel = 14 + Math.ceil(cap.height) + 3 + bh <= th;
      cap.setY(ty + (withLabel ? 14 : 0));
      thumbParts.push(g, img, cap, listBtn);
      if (withLabel) thumbParts.push(new PixelText(this, rx, ty, 'いちばんひどい場面', { size: FS.body, color: UI.danger, outline: true }));
      img.setInteractive().on('pointerdown', () => {
        if (!this.card) return;   // 画像がまだできていない
        audio.sfx('button'); this.share?.showOverlay();
      });
      void shotReady.then(() => {
        if (!this.textures.exists(THUMB_KEY)) return;
        drawThumb();
        (this.textures.get(THUMB_KEY) as Phaser.Textures.CanvasTexture).refresh();
      });
    } else if (thumbRoom >= 26) {
      // 写真の入る高さがないときは、ボタンだけを右に置く
      listBtn = new Button(this, W - 6 - 124, thumbTop + Math.floor((thumbRoom - 24) / 2), 124, 24, listText, listStyle);
      thumbParts.push(listBtn);
    } else {
      // それも入らない低い画面では、上の絵の右下(ヒーローの右)に置く
      listBtn = new Button(this, W - 4 - 70, actionH - 4 - 30, 70, 30, listText.replace('(', '\n('), listStyle);
      thumbParts.push(listBtn);
    }
    for (const o of thumbParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
    listBtn.on('press', () => {
      audio.unlock(); audio.sfx('button');
      this.skipAll(quiet, cut);
      openTitleList(this, { earned: saved.earned, current: t.id });
    });
    dev.buttons = { share: shareBtn, again: againBtn, title: titleBtn, list: listBtn };

    // ─── 流れ ───
    const quiet = { v: false };
    const sfx = (name: Parameters<typeof audio.sfx>[0], opt?: Parameters<typeof audio.sfx>[1]): void => { if (!quiet.v) audio.sfx(name, opt); };
    // 称号のひとことを出し終えた時刻(次のステージの知らせは、そのあとのタップで出す)
    let commentShownAt = 0;
    this.tl
      .wait(750)
      .step(150, {
        start: () => { titleText.setVisible(true).setScale(3); },
        update: (p) => titleText.setScale(p < 0.34 ? 3 : p < 0.67 ? 2 : 1),
        end: () => {
          titleText.setScale(1);
          band.setVisible(true);
          yourTitle.setVisible(true);
          sfx('stamp');
          if (!quiet.v) { shake(this, 5, 260); flash(this, 0xffffff, 1); }
          if (saved.titleIsNew) titleNew.setVisible(true);
        }
      })
      .wait(250)
      .step(0, {
        end: () => {
          const c = titleCommentFor(t.id, textStage);
          void cut.say(c.text, c.face, { who: c.who }).then(() => { commentShownAt = this.time.now; });
          if (quiet.v) cut.skip();
        }
      });
    rows.forEach((r, i) => {
      let last = -1;
      this.tl.wait(i === 0 ? 100 : 90).step(r.target === 0 ? 200 : r.ms, {
        start: () => values[i].setText(r.format(0)),
        update: (p) => {
          const v = Math.round(r.target * (1 - Math.pow(1 - p, 2)));
          if (v === last) return;
          last = v;
          values[i].setText(r.format(v));
          if (p < 1) sfx('tick', { volume: 0.5 });
        },
        end: () => {
          values[i].setText(r.format(r.target));
          sfx(i === rows.length - 1 ? 'stamp' : 'blip');
          if (i === rows.length - 1 && !quiet.v && r.target >= 10_000_000) shake(this, 3, 200);
          if (r.record && saved.newRecords.includes(r.record) && !newTags[i].getData('never')) { newTags[i].setVisible(true); sfx('sparkle'); }
          sw.onRowEnd(i);
        }
      });
    });
    this.tl
      .wait(200)
      .step(0, { end: () => { sw.reveal(); sfx('sparkle'); } })
      .wait(300)
      .step(0, {
        end: () => {
          for (const o of thumbParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
          if (thumbParts.length > 1) sfx('hit');
        }
      });

    // 次のステージが開いた知らせ(帯とオペレーターのひとこと)。称号のひとことのあと、タップで出す。
    // フリープレイの「ステージを進めると、出てくる人が増えるよ」も同じ出し方
    let unlockPending = saved.unlockedNow.length > 0 || saved.moreHint;
    const showUnlock = (): void => {
      if (!unlockPending) return;
      unlockPending = false;
      more.setVisible(false);
      if (saved.moreHint) {
        void cut.say(MORE_STAGES_HINT, 'normal', { who: 'operator' });
        audio.sfx('sparkle');
        dev.log.push('more-hint-shown');
        return;
      }
      const opened = saved.unlockedNow[0];
      // 名前が長くて帯の字が画面の端につくとき(「ショッピングモール」)は、短い名前(「モール」)にする
      const full = `${STAGES[opened].name}が遊べる!`;
      const probe = new PixelText(this, 0, 0, full, { size: FS.big, outline: true });
      const text = probe.width > W - 16 ? `${STAGES[opened].shortName}が遊べる!` : full;
      probe.destroy();
      void banner(this, text, { y: 128, hold: 1500, band: UI.gold });
      audio.sfx('fanfare');
      flash(this, 0xfff0c0, 2);
      const u = say('unlocked', undefined, opened);
      void cut.say(u.text, u.face, { who: u.who });
      unlockNew.setVisible(true);
      dev.log.push('unlock-shown');
    };
    const unlockReady = (): boolean => unlockPending && this.tl.done && commentShownAt > 0 && this.time.now - commentShownAt > 150;

    // タップ:数え上げの途中なら最後まで飛ばす。終わっていれば、文字送りを飛ばすか、次のステージの知らせを出す
    // (ボタンの上は除く。カットインの上のタップは、カットインが文字送りを飛ばす)
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const onCut = over.length > 0 && over.every((o) => o.parentContainer === cut);
      if (over.length && !onCut) return;
      if (!this.tl.done) { this.skipAll(quiet, cut); return; }
      if (unlockReady()) { showUnlock(); return; }
      if (!onCut) cut.skip();
    });
    const onUpdate = (_t: number, dt: number): void => {
      this.tl.update(dt);
      const on = this.blinkTags([titleNew, unlockNew, ...newTags]);
      more.setVisible(unlockReady() && on);
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);

    // ─── 共有 ───
    // 文は短く:いちばんひどい場面の見出し(弱ければ称号)、ハッシュタグ、URL。数字は画像に入っている
    const url = location.origin + location.pathname;
    // フリープレイは、ルールと場面をつなげた文(「『風船の人はワル!』でおばあちゃんに全力パンチ!」)
    const text = buildShareText({
      caption: free && s.free
        ? freeShareCaption({ worstScene: s.worstScene, caption: freeWorstCaption(s), free: s.free, titleName: t.name })
        : shareCaption({ worstScene: s.worstScene, caption: worstCaption(s), titleName: t.name }),
      url
    });
    dev.shareText = text;
    this.share = new ShareFlow({
      text,
      getFile: () => this.file,
      getDataUrl: () => this.card?.dataUrl ?? '',
      onOpen: () => { this.input.enabled = false; },
      onClose: () => { this.input.enabled = true; },
      log: (m) => dev.log.push(m)
    });
    dev.share = this.share;
    shareBtn.on('press', () => {
      if (!shareBtn.isEnabled) return;
      audio.unlock();
      audio.sfx('button');
      this.skipAll(quiet, cut);
      this.share?.arm();
    });

    // フリープレイのカードは、右上のステージ名を「フリープレイ」にする(背景は波3のステージ)
    const cardStage: CardStage = free ? { bg: def.bg, bossSheet: def.bossSheet, name: FREE_NAME, shortName: FREE_NAME } : def;
    const cardIn = { title: t, stats: s, saved, shot: baseShot, scrollX: run.scrollX, stage: cardStage, textStage };
    const texts = [
      ...cardTexts(cardIn), ...sw.texts, 'いちばんひどい場面', 'あなたの称号', 'NEW', '▼タップ', listText, caption,
      free ? MORE_STAGES_HINT : ''
    ];
    const alive = (): boolean => this.sys.isActive() || this.sys.isPaused() || this.sys.isSleeping();
    // 共有ボタンを使えるようにする(File が作れなかったときも、画像を大きく出す方で共有できる)
    const shareReady = (): void => {
      if (!alive() || shareBtn.isEnabled) return;
      shareBtn.setLabel('共有する').setEnabled(true);
    };
    Promise.all([preloadFont(texts, [10, 12, 16]), shotReady]).then(() => {
      if (!alive()) return;
      this.card = buildCard(this, cardIn);
      dev.card = this.card;
      dev.log.push('card');
      const card = this.card;
      void card.file.then((f) => {
        if (this.card !== card) return;
        this.file = f;
        dev.log.push(f ? 'file' : 'nofile');
        shareReady();
      }, () => { if (this.card === card) { dev.log.push('nofile'); shareReady(); } });
    }).catch((e: unknown) => { console.error(e); });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
      this.share?.destroy();
      this.share = undefined;
      if (this.textures.exists(THUMB_KEY)) this.textures.remove(THUMB_KEY);
    });
  }

  private skipAll(quiet: { v: boolean }, cut: CutIn): void {
    if (this.tl.done) { cut.skip(); return; }
    quiet.v = true;
    this.tl.finishAll();
    quiet.v = false;
    audio.sfx('blip');
  }

  /** 小さな札(暗い地に金色のふちと金色の字)。「あなたの称号」 */
  private labelTag(x: number, y: number, text: string): Phaser.GameObjects.Container {
    const c = this.add.container(Math.round(x), Math.round(y)).setDepth(DEPTH.ui + 1);
    const txt = new PixelText(this, 4, 2, text, { size: FS.body, color: UI.gold });
    const g = this.add.graphics();
    const w = Math.ceil(txt.width) + 8;
    g.fillStyle(UI.black, 1).fillRect(-1, 0, w + 2, 17);
    g.fillStyle(UI.gold, 1).fillRect(0, 0, w, 16);
    g.fillStyle(UI.panel, 1).fillRect(1, 1, w - 2, 14);
    c.add([g, txt]);
    return c;
  }

  /** 「NEW」の札(赤い四角に白い字) */
  private newTag(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(Math.round(x), Math.round(y)).setDepth(DEPTH.ui + 1);
    const txt = new PixelText(this, 3, 1, 'NEW', { size: FS.small, color: 0xffffff });
    const g = this.add.graphics();
    g.fillStyle(UI.black, 1).fillRect(-1, -1, txt.width + 8, 13);
    g.fillStyle(UI.bad, 1).fillRect(0, 0, txt.width + 6, 11);
    c.add([g, txt]);
    c.setData('w', Math.ceil(txt.width) + 7);
    return c;
  }

  private blinkN = 0;
  /** NEW の札を点滅させる(半透明を使わず、見える/見えないを切り替える)。いま見せる番かを返す */
  private blinkTags(tags: Phaser.GameObjects.Container[]): boolean {
    this.blinkN++;
    const on = Math.floor(this.blinkN / 18) % 3 !== 2;
    for (const t of tags) if (t.getData('shown') || t.visible) { t.setData('shown', true); t.setVisible(on); }
    return on;
  }

  /** 背中の爆発。はじめに何発か続けて、あとはときどき */
  private startExplosions(x: number, groundY: number): void {
    const boom = (dx: number, dy: number, scale: number, loud: boolean): void => {
      spawnFx(this, 'fx_explosion', x + dx, groundY + dy, { origin: [0.5, 0.78], scale, depth: 10 });
      if (loud) {
        audio.sfx('explosion', { pitch: scale > 1 ? 0.8 : 1 + (Math.random() - 0.5) * 0.2 });
        shake(this, scale > 1 ? 6 : 3, 220);
        spawnFx(this, 'fx_dust', x + dx, groundY + 2, { origin: [0.5, 1], depth: 11 });
      }
    };
    const first: [number, number, number, number][] = [
      [60, 0, 0, 2], [300, -40, -20, 1], [480, 42, -26, 1], [700, -8, -52, 1], [900, 30, 0, 2]
    ];
    first.forEach(([ms, dx, dy, sc]) => this.time.delayedCall(ms, () => {
      boom(dx, dy, sc, true);
      if (ms === 60) flash(this, 0xfff0c0, 2);
    }));
    const kiran = (): void => {
      spawnFx(this, 'fx_kiran', x + 14, groundY - 104, { depth: 21 });
    };
    this.time.delayedCall(1100, kiran);
    this.time.addEvent({
      delay: 2600, startAt: 0, loop: true, callback: () => {
        const dx = Phaser.Math.Between(-50, 50);
        boom(dx, Phaser.Math.Between(-50, -10), 1, false);
        if (Math.random() < 0.5) this.time.delayedCall(300, kiran);
      }
    });
  }
}

/**
 * ステージの数字の窓。並び:仕分け正解、悪党を倒した、市民のけが(その下に小さく内わけ)、逃がした、被害額(その下にたとえ)。
 * ステージ2は組の行、ステージ3はUFOとラッシュの行を足す。低い画面では詰める(先頭の説明)
 */
function stageWindow(env: WindowEnv, s: StageStats, run: GameRun): StatsWindow {
  const { scene, boxY, bottom } = env;
  const { W } = layout;
  const def = run.stage.def;
  const hurtParts = hurtBreakdown(s);
  // 窓のいちばん下に足す小さな行:ステージ2は組の行、ステージ3はUFOを落とした数とラッシュのまとめ
  const ufoText = def.mechanic === 'ufo' ? `UFOを落とした{gold}${s.ufosDowned}{/}機` : null;
  const rushText = def.rush?.kind === 'sale' && s.rush ? rushSummary(s.rush).replace(/(\d+\/\d+)/g, '{gold}$1{/}') : null;
  const extraRows = (f: Fit): number =>
    (def.mechanic === 'gang' ? 1 : 0) + (f.pack && ufoText && rushText ? 1 : (ufoText ? 1 : 0) + (rushText ? 1 : 0));
  const subRowsOf = (f: Fit): number => (hurtParts.length ? 1 : 0) + 1 + extraRows(f);
  const shareYOf = (f: Fit): number => bottom - f.smallH - f.gap - f.shareH;
  const boxHOf = (f: Fit): number => 8 + f.rowH * (f.merge ? 4 : 5) + f.subH * subRowsOf(f);
  const roomOf = (f: Fit): number => shareYOf(f) - 5 - (boxY + boxHOf(f) + 5);
  // 写真が入る並べ方を、ゆったりした順に探す。どれでも入らなければ、いちばん詰めたもの(写真なし)
  // (UFOとラッシュの行をまとめる pack は、ステージ3のほかでは何も変えない)
  const fits: Fit[] = [
    { smallH: 26, shareH: 30, gap: 5, rowH: 17, merge: false, subH: 13, pack: false },
    { smallH: 24, shareH: 26, gap: 4, rowH: 16, merge: false, subH: 13, pack: false },
    { smallH: 24, shareH: 26, gap: 4, rowH: 16, merge: false, subH: 13, pack: true },
    { smallH: 24, shareH: 26, gap: 4, rowH: 16, merge: true, subH: 13, pack: true },
    // いちばん低い画面(高さ384)のステージ2と3:写真なしで、窓がボタンにかぶらないところまで詰める
    { smallH: 22, shareH: 24, gap: 3, rowH: 15, merge: true, subH: 12, pack: true }
  ];
  const fit = fits.find((f) => roomOf(f) >= THUMB_MIN) ?? fits.find((f) => roomOf(f) >= -6) ?? fits[fits.length - 1];
  const { rowH, merge, subH, pack } = fit;
  const boxH = boxHOf(fit);
  new WindowFrame(scene, 4, boxY, W - 8, boxH, 'win');

  const rows: StatRow[] = [
    { label: '仕分け正解', target: s.sortCorrect, format: (n) => `${n}/${s.sortTotal}人`, color: UI.gold, ms: 350 },
    { label: '悪党を倒した', target: s.defeated, format: (n) => `${n}人`, color: UI.gold, record: 'mostDefeated', ms: 350 },
    { label: '市民のけが', target: s.civHurt, format: (n) => `${n}人`, color: s.civHurt > 0 ? UI.danger : UI.gold, record: 'fewestHurt', ms: 350 },
    { label: '逃がした', target: s.escaped, format: (n) => `${n}人`, color: s.escaped > 0 ? UI.danger : UI.gold, ms: 300 },
    { label: '被害額', target: s.damage, format: (n) => formatYen(n), color: UI.gold, record: 'highestDamage', ms: 800 }
  ];
  const DAMAGE = 4;
  // 行ごとの位置(左、右、上)。まとめるときは「逃がした」を「悪党を倒した」の行の右半分に置く(字は小さめ)
  const place: { x: number; right: number; y: number; small: boolean }[] = [];
  let cy = boxY + 5;
  const hurtSub = { y: 0 };
  const analogyY = { y: 0 };
  rows.forEach((_r, i) => {
    if (merge && i === 1) { place.push({ x: 11, right: 118, y: cy, small: true }); cy += rowH; return; }
    if (merge && i === 3) { place.push({ x: 124, right: W - 11, y: place[1].y, small: true }); return; }
    place.push({ x: 11, right: W - 11, y: cy, small: false });
    cy += rowH;
    if (i === 2 && hurtParts.length) { hurtSub.y = cy - 1; cy += subH; }
    if (i === DAMAGE) { analogyY.y = cy; cy += subH; }
  });
  const extraY = cy - 2;
  const values = rows.map((r, i) => {
    const p = place[i];
    // まとめた行は、見出しを小さい字にして数字は大きいまま
    // 仕分け正解はいちばん大事なので、見出しも金色
    new PixelText(scene, p.x, p.small ? p.y + 3 : p.y, r.label, { size: p.small ? FS.body : FS.big, color: i === 0 ? UI.gold : UI.textDim });
    return new PixelText(scene, p.right, p.y, '', { size: FS.big, color: r.color, outline: true }).setOrigin(1, 0);
  });
  // 新記録の NEW は見出しのすぐ右
  const newTags = rows.map((r, i) => {
    const p = place[i];
    const tag = env.newTag(p.x + 16 * r.label.length + 4, p.y + 3).setVisible(false);
    // まとめた行は数字とぶつかるので出さない
    if (p.small) tag.setData('never', true);
    return tag;
  });
  // 市民のけがの内わけ(0の理由は書かない)
  const hurtLine = hurtParts.length
    ? new PixelText(scene, W - 11, hurtSub.y, hurtParts.join('・'), { size: FS.small, color: UI.textDim }).setOrigin(1, 0).setVisible(false)
    : null;
  const analogy = new PixelText(scene, W - 11, analogyY.y, `(${damageAnalogy(s.damage, run.stage.id).text})`, { size: FS.small, color: UI.gold, outline: true })
    .setOrigin(1, 0).setVisible(false);
  const extraTexts: PixelText[] = [];
  if (def.mechanic === 'gang') {
    const byGroup = s.defeatedByWipe + s.defeatedByVan;
    extraTexts.push(
      new PixelText(scene, 11, extraY, `組ごと撃破{gold}${byGroup}{/}人`, { size: FS.body, color: UI.textDim }).setVisible(false),
      new PixelText(scene, W - 11, extraY, `車で逃げた{${s.groupsEscaped > 0 ? 'red' : 'gold'}}${s.groupsEscaped}{/}組`, { size: FS.body, color: UI.textDim })
        .setOrigin(1, 0).setVisible(false)
    );
  }
  // UFOとラッシュ:ふだんは1行ずつ。まとめるときは小さい字で「UFO：2機・セール：…」の1行にする
  // (「UFO2機」だと「UFO」と数字がつながって読みにくいので、ラッシュのまとめと同じく「：」で区切る)
  if (pack && ufoText && rushText) {
    const short = `UFO：{gold}${s.ufosDowned}{/}機・${rushText}`;
    extraTexts.push(new PixelText(scene, 11, extraY + 1, short, { size: FS.small, color: UI.textDim }).setVisible(false));
  } else {
    [ufoText, rushText].filter((x): x is string => !!x).forEach((x, k) => {
      extraTexts.push(new PixelText(scene, 11, extraY + subH * k, x, { size: FS.body, color: UI.textDim }).setVisible(false));
    });
  }

  return {
    fit, boxH, rows, values, newTags,
    onRowEnd: (i) => { if (i === 2) hurtLine?.setVisible(true); },
    reveal: () => { analogy.setVisible(true); for (const g of extraTexts) g.setVisible(true); },
    texts: [...rows.map((r) => r.label), hurtParts.join('・'), ufoText ?? '', rushText ?? '', 'UFO：機・']
  };
}

/** 場面の写真を 216×214 のキャンバスにそろえる */
function normalizeShot(src: CanvasImageSource): HTMLCanvasElement {
  const { canvas } = makeCanvas(216, 214);
  redrawShot(canvas, src);
  return canvas;
}

function redrawShot(canvas: HTMLCanvasElement, src: CanvasImageSource): void {
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const w = (src as HTMLImageElement).naturalWidth || (src as HTMLCanvasElement).width || 216;
  const h = (src as HTMLImageElement).naturalHeight || (src as HTMLCanvasElement).height || 214;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 216, 214);
  try { ctx.drawImage(src, 0, 0, w, h, 0, 0, 216, 214); } catch { /* 読めなければ黒のまま */ }
}
