// 結果画面。称号、勝利ポーズ(背中で爆発)、数字の数え上げ、いちばんひどかった場面、共有。
// 入口:Boss から。出口:もう一回 → startRun して Intro、タイトルへ → Title。
// 共有カードは画面が出た時点で作っておく(result/card.ts)。共有の流れは result/share.ts。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey, originFor } from '../art/sheets';
import {
  buildShareText, damageAnalogy, decideTitle, formatYen, saveResult,
  type RecordField, type SaveOutcome, type StageStats, type TitleDef
} from '../logic';
import {
  Button, CutIn, DEPTH, FS, MuteButton, PixelText, WindowFrame, addPanel, flash, goto, preloadFont, shake
} from '../ui';
import { getRun, startRun, type GameRun } from '../run';
import { WORST_CAPTION, buildCard, cardTexts, makeFallbackShot, type Card } from './result/card';
import { makeCanvas } from './result/draw';
import { fillSampleStats, makeSampleShot, memoryStorage, sampleName } from './result/sample';
import { ShareFlow } from './result/share';
import { Timeline } from './result/timeline';

/** 同じプレイの記録を2回保存しないように */
const savedRuns = new WeakMap<GameRun, { stats: StageStats; title: TitleDef; saved: SaveOutcome }>();

const THUMB_KEY = 'result_thumb';

interface StatRow {
  label: string;
  target: number;
  format: (n: number) => string;
  color: number;
  record?: RecordField;
  ms: number;
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
    (window as unknown as { resultDev: ResultDev }).resultDev = dev;
    dev.scene = this;
    dev.log.length = 0;

    // ─── 数字と称号と記録 ───
    let rec = savedRuns.get(run);
    let shot: CanvasImageSource | null = run.worstShot;
    if (!rec) {
      const sample = sampleName();
      if (run.debug && run.stats.defeated === 0 && run.stats.damage === 0 && run.stats.civHurt === 0) fillSampleStats(run.stats, sample);
      const stats = run.stats.snapshot();
      const title = decideTitle(stats);
      const saved = saveResult(run.stage.id, stats, title.id, run.debug ? memoryStorage() : undefined);
      rec = { stats, title, saved };
      savedRuns.set(run, rec);
    }
    if (!shot && run.debug) shot = makeSampleShot(this, sampleName());
    const { stats: s, title: t, saved } = rec;
    dev.log.push(`title:${t.id}`);

    // ─── 音 ───
    audio.sfx('fanfare');
    this.time.delayedCall(1500, () => audio.playBgm('result'));
    this.input.on('pointerdown', () => audio.unlock());

    // ─── 上:夜の路地裏と勝利ポーズ ───
    this.add.tileSprite(0, 0, W, actionH, 'bg_alley_far').setOrigin(0).setTilePosition(Math.floor(run.scrollX / 4), 0);
    this.add.tileSprite(0, 0, W, 130, 'bg_alley_wall').setOrigin(0).setTilePosition(run.scrollX, 0);
    this.add.tileSprite(0, 124, W, 90, 'bg_alley_ground').setOrigin(0).setTilePosition(run.scrollX, 0);

    const fist = t.pose === 'win_fist';
    const hx = 108;
    const feet = fist ? 198 : 206;
    if (fist) this.add.image(hx, 182, 'fx_rubble', 0).setOrigin(0.5, 0).setScale(2).setDepth(19);
    this.add.image(hx, feet - 2, 'fx_shadow', 0).setScale(2).setDepth(18).setVisible(!fist);
    const hero = this.add.sprite(hx, feet, 'hero', 0).setOrigin(...originFor('hero')).setScale(2).setDepth(20);
    hero.play(animKey('hero', t.pose));
    this.startExplosions(hx, fist ? 176 : 184);

    // 称号の帯
    const band = this.add.graphics().setDepth(DEPTH.ui - 1).setVisible(false);
    band.fillStyle(UI.black, 1).fillRect(0, 6, W, 26);
    band.fillStyle(UI.bad, 1).fillRect(0, 7, W, 2).fillRect(0, 29, W, 2);
    const titleText = new PixelText(this, Math.floor(W / 2), 19, t.name, { size: FS.big, color: UI.gold, outline: true })
      .setOrigin(0.5, 0.5).setVisible(false);
    const titleNew = this.newTag(Math.floor(W / 2) - Math.ceil(titleText.width / 2) - 2, 2).setVisible(false);
    new MuteButton(this, W - 11, 19, { isMuted: () => audio.isMuted(), toggle: () => audio.toggleMuted() }).setDepth(DEPTH.ui + 1);
    const cut = new CutIn(this, 4, 36, W - 8, 46).setVisible(false);

    // ─── 下:数字 ───
    addPanel(this);
    const top = actionH;
    const rows: StatRow[] = [
      { label: '悪党撃破', target: s.defeated, format: (n) => `${n}人`, color: UI.gold, record: 'mostDefeated', ms: 350 },
      { label: '市民負傷', target: s.civHurt, format: (n) => `${n}人`, color: s.civHurt > 0 ? UI.danger : UI.gold, record: 'fewestHurt', ms: 350 },
      { label: '逃がした', target: s.escaped, format: (n) => `${n}人`, color: s.escaped > 0 ? UI.danger : UI.gold, ms: 300 },
      { label: '被害額', target: s.damage, format: (n) => formatYen(n), color: UI.gold, record: 'highestDamage', ms: 800 }
    ];
    const rowH = 17;
    const boxY = top + 4;
    const boxH = 8 + rowH * (rows.length + 1);
    new WindowFrame(this, 4, boxY, W - 8, boxH, 'win');
    const rowY = (i: number): number => boxY + 5 + i * rowH;
    const values = rows.map((r, i) => {
      new PixelText(this, 11, rowY(i), r.label, { size: FS.big, color: UI.textDim });
      return new PixelText(this, W - 11, rowY(i), '', { size: FS.big, color: r.color, outline: true }).setOrigin(1, 0);
    });
    const newTags = rows.map((r, i) => this.newTag(11 + 16 * r.label.length + 4, rowY(i) + 3).setVisible(false));
    const analogy = new PixelText(this, 11, rowY(rows.length), damageAnalogy(s.damage).text, { size: FS.big, color: UI.gold, outline: true })
      .setVisible(false);
    const collected = new PixelText(this, W - 11, rowY(rows.length),
      `称号{gold}${saved.titlesCollected}{/}/${saved.titlesTotal}`, { size: FS.big, color: UI.textDim, outline: true })
      .setOrigin(1, 0).setVisible(false);
    const collectedNew = this.newTag(W - 11 - collected.width - 30, rowY(rows.length) + 3).setVisible(false);

    // ─── ボタン ───
    const bottom = layout.H - Math.max(6, layout.safeBottom + 4);
    const smallH = 26, shareH = 30, gap = 5;
    const rowBtnY = bottom - smallH;
    const shareY = rowBtnY - gap - shareH;
    const shareBtn = new Button(this, 6, shareY, W - 12, shareH, '共有する', { color: 'stop' });
    const againBtn = new Button(this, 6, rowBtnY, 99, smallH, 'もう一回', { color: 'civ' });
    const titleBtn = new Button(this, W - 105, rowBtnY, 99, smallH, 'タイトルへ', { color: 0x4a3f78 });
    dev.buttons = { share: shareBtn, again: againBtn, title: titleBtn };
    againBtn.on('press', () => {
      audio.unlock(); audio.sfx('button');
      startRun(this);
      goto(this, SCENES.intro);
    });
    titleBtn.on('press', () => {
      audio.unlock(); audio.sfx('button');
      goto(this, SCENES.title);
    });

    // ─── いちばんひどかった場面(小さく)───
    const thumbTop = boxY + boxH + 5;
    const thumbRoom = shareY - 5 - thumbTop;
    const baseShot = shot ? normalizeShot(shot) : makeFallbackShot(this, s, run.scrollX);
    // Street が撮った画像がまだ読みこみ中なら、読めてから描き直す
    const pending = shot instanceof HTMLImageElement && !shot.complete ? shot : null;
    const shotReady = pending
      ? pending.decode().catch(() => undefined).then(() => { redrawShot(baseShot, pending); })
      : Promise.resolve();
    const thumbParts: Phaser.GameObjects.GameObject[] = [];
    if (thumbRoom >= 50) {
      const th = Math.min(56, thumbRoom - 4);
      const tc = makeCanvas(108, th);
      // 半分の大きさ(1ドットおきに拾う)。人が立つあたりを切り出す
      tc.ctx.drawImage(baseShot, 0, 212 - th * 2, 216, th * 2, 0, 0, 108, th);
      if (this.textures.exists(THUMB_KEY)) this.textures.remove(THUMB_KEY);
      this.textures.addCanvas(THUMB_KEY, tc.canvas);
      const ty = thumbTop + Math.floor((thumbRoom - th - 4) / 2) + 2;
      const g = this.add.graphics().setDepth(DEPTH.ui);
      g.fillStyle(UI.black, 1).fillRect(5, ty - 2, 112, th + 4);
      g.fillStyle(0xffffff, 1).fillRect(6, ty - 1, 110, th + 2);
      const img = this.add.image(7, ty, THUMB_KEY).setOrigin(0).setDepth(DEPTH.ui);
      const lab = new PixelText(this, 124, ty, 'ワーストシーン', { size: FS.body, color: UI.danger, outline: true });
      const capText = s.worstScene ? WORST_CAPTION[s.worstScene] : 'ひどいことはなかった!';
      const cap = new PixelText(this, 124, ty + 16, capText, { size: FS.body, color: UI.text, wrap: W - 124 - 4 });
      thumbParts.push(g, img, lab, cap);
      for (const o of thumbParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
      img.setInteractive().on('pointerdown', () => { audio.sfx('button'); this.share?.showOverlay(); });
      void shotReady.then(() => {
        if (!this.textures.exists(THUMB_KEY)) return;
        tc.ctx.drawImage(baseShot, 0, 212 - th * 2, 216, th * 2, 0, 0, 108, th);
        (this.textures.get(THUMB_KEY) as Phaser.Textures.CanvasTexture).refresh();
      });
    }

    // ─── 流れ ───
    const quiet = { v: false };
    const sfx = (name: Parameters<typeof audio.sfx>[0], opt?: Parameters<typeof audio.sfx>[1]): void => { if (!quiet.v) audio.sfx(name, opt); };
    this.tl
      .wait(750)
      .step(150, {
        start: () => { titleText.setVisible(true).setScale(3); },
        update: (p) => titleText.setScale(p < 0.34 ? 3 : p < 0.67 ? 2 : 1),
        end: () => {
          titleText.setScale(1);
          band.setVisible(true);
          sfx('stamp');
          if (!quiet.v) { shake(this, 5, 260); flash(this, 0xffffff, 1); }
          if (saved.titleIsNew) titleNew.setVisible(true);
        }
      })
      .wait(250)
      .step(0, { end: () => { void cut.say(t.comment.text, t.comment.face, { who: t.comment.who }); if (quiet.v) cut.skip(); } });
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
          if (r.record && saved.newRecords.includes(r.record)) { newTags[i].setVisible(true); sfx('sparkle'); }
        }
      });
    });
    this.tl
      .wait(200)
      .step(0, { end: () => { analogy.setVisible(true); sfx('sparkle'); } })
      .wait(250)
      .step(0, {
        end: () => {
          collected.setVisible(true);
          sfx('blip');
          if (saved.titleIsNew) collectedNew.setVisible(true);
        }
      })
      .wait(300)
      .step(0, {
        end: () => {
          for (const o of thumbParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
          if (thumbParts.length) sfx('hit');
        }
      });

    // タップで数え上げを飛ばす(ボタンの上は除く)
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length) return;
      this.skipAll(quiet, cut);
    });
    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
      this.tl.update(dt);
      this.blinkTags([titleNew, collectedNew, ...newTags]);
    });

    // ─── 共有 ───
    const url = location.origin + location.pathname;
    const text = buildShareText({
      stageName: run.stage.name, defeated: s.defeated, civHurt: s.civHurt, damage: s.damage, titleName: t.name,
      titlesCollected: saved.titlesCollected, titlesTotal: saved.titlesTotal, url
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
      audio.unlock();
      audio.sfx('button');
      this.skipAll(quiet, cut);
      this.share?.arm();
    });

    const cardIn = { title: t, stats: s, saved, shot: baseShot, scrollX: run.scrollX };
    const texts = [...cardTexts(cardIn), ...rows.map((r) => r.label), 'ワーストシーン', 'NEW'];
    Promise.all([preloadFont(texts, [10, 12, 16]), shotReady]).then(() => {
      if (!this.sys.isActive() && !this.sys.isPaused()) return;
      this.card = buildCard(this, cardIn);
      dev.card = this.card;
      dev.log.push('card');
      void this.card.file.then((f) => { this.file = f; dev.log.push(f ? 'file' : 'nofile'); });
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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

  /** 「NEW」の札(赤い四角に白い字) */
  private newTag(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(Math.round(x), Math.round(y)).setDepth(DEPTH.ui + 1);
    const txt = new PixelText(this, 3, 1, 'NEW', { size: FS.small, color: 0xffffff });
    const g = this.add.graphics();
    g.fillStyle(UI.black, 1).fillRect(-1, -1, txt.width + 8, 13);
    g.fillStyle(UI.bad, 1).fillRect(0, 0, txt.width + 6, 11);
    c.add([g, txt]);
    return c;
  }

  private blinkN = 0;
  /** NEW の札を点滅させる(半透明を使わず、見える/見えないを切り替える) */
  private blinkTags(tags: Phaser.GameObjects.Container[]): void {
    this.blinkN++;
    const on = Math.floor(this.blinkN / 18) % 3 !== 2;
    for (const t of tags) if (t.getData('shown') || t.visible) { t.setData('shown', true); t.setVisible(on); }
  }

  /** 背中の爆発。はじめに何発か続けて、あとはときどき */
  private startExplosions(x: number, groundY: number): void {
    const boom = (dx: number, dy: number, scale: number, loud: boolean): void => {
      const e = this.add.sprite(x + dx, groundY + dy, 'fx_explosion', 0).setOrigin(0.5, 0.78).setScale(scale).setDepth(10);
      e.play(animKey('fx_explosion', 'play'));
      e.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => e.destroy());
      if (loud) {
        audio.sfx('explosion', { pitch: scale > 1 ? 0.8 : 1 + (Math.random() - 0.5) * 0.2 });
        shake(this, scale > 1 ? 6 : 3, 220);
        const d = this.add.sprite(x + dx, groundY + 2, 'fx_dust', 0).setOrigin(0.5, 1).setDepth(11);
        d.play(animKey('fx_dust', 'play'));
        d.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => d.destroy());
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
      const k = this.add.sprite(x + 14, groundY - 104, 'fx_kiran', 0).setDepth(21);
      k.play(animKey('fx_kiran', 'play'));
      k.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => k.destroy());
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
