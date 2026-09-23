// 結果画面。称号、勝利ポーズ(背中で爆発)、数字の数え上げ、いちばんひどかった場面、共有。
// 入口:Boss から。出口:もう一回 → 同じステージで startRun して Intro、タイトルへ → Title。
// 背景と共有カードはそのステージの絵(run.stage.def)。このプレイで次のステージが開いたら、最後に知らせる。
// 共有カードは画面が出た時点で作っておく(result/card.ts)。共有の流れは result/share.ts。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey, originFor } from '../art/sheets';
import {
  buildShareText, damageAnalogy, decideTitle, formatYen, randomSeed, saveResult, say, STAGES, titleCommentFor,
  type RecordField, type SaveOutcome, type StageStats, type TitleDef
} from '../logic';
import {
  Button, CutIn, DEPTH, FS, MuteButton, PixelText, WindowFrame, addPanel, banner, flash, goto, preloadFont, shake
} from '../ui';
import { getRun, startRun, type GameRun } from '../run';
import { buildCard, cardTexts, makeFallbackShot, worstCaption, type Card } from './result/card';
import { makeCanvas } from './result/draw';
import { fillSampleStats, makeSampleShot, memoryStorage, sampleName } from './result/sample';
import { ShareFlow } from './result/share';
import { Timeline } from './result/timeline';
import { markJustUnlocked } from './stageselect/state';

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
    if (import.meta.env.DEV) (window as unknown as { resultDev: ResultDev }).resultDev = dev;
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
      const saved = saveResult(run.stage.id, stats, title.id, run.debug ? memoryStorage(run.stage.id) : undefined);
      rec = { stats, title, saved };
      savedRuns.set(run, rec);
      // 次のステージが開いた:ステージを選ぶ画面で鍵がこわれる演出をする
      markJustUnlocked(this, saved.unlockedNow);
    }
    if (!shot && run.debug) shot = makeSampleShot(this, sampleName(), run.stage.id);
    const { stats: s, title: t, saved } = rec;
    const def = run.stage.def;
    dev.log.push(`title:${t.id}`);
    if (saved.unlockedNow.length) dev.log.push(`unlocked:${saved.unlockedNow.join(',')}`);

    // ─── 音 ───
    audio.sfx('fanfare');
    this.time.delayedCall(1500, () => audio.playBgm('result'));
    this.input.on('pointerdown', () => audio.unlock());

    // ─── 上:ステージの背景と勝利ポーズ ───
    this.add.tileSprite(0, 0, W, actionH, def.bg.far).setOrigin(0).setTilePosition(Math.floor(run.scrollX / 4), 0);
    this.add.tileSprite(0, 0, W, 130, def.bg.wall).setOrigin(0).setTilePosition(run.scrollX, 0);
    this.add.tileSprite(0, 124, W, 90, def.bg.ground).setOrigin(0).setTilePosition(run.scrollX, 0);

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
    const boxY = top + 4;
    // ボタンの位置(下から)。低い画面(iPhone SE など)でステージ2の1行が足りないときは、ボタンと行を少し詰める
    const bottom = layout.H - Math.max(6, layout.safeBottom + 4);
    const btn = (smallH: number, shareH: number, gap: number) => ({ smallH, shareH, gap, shareY: bottom - smallH - gap - shareH });
    let bl = btn(26, 30, 5);
    let rowH = 17;
    // ステージ2は、組ごと撃破した人数と車で逃げられた組の数を小さな字で1行足す
    let gangRowH = def.hasGangs ? 14 : 0;
    const boxHFor = (): number => 8 + rowH * (rows.length + 1) + gangRowH;
    if (boxY + boxHFor() > bl.shareY - 3) {
      bl = btn(24, 26, 4);
      rowH = 16;
      if (gangRowH) gangRowH = 13;
    }
    const boxH = boxHFor();
    new WindowFrame(this, 4, boxY, W - 8, boxH, 'win');
    const rowY = (i: number): number => boxY + 5 + i * rowH;
    const values = rows.map((r, i) => {
      new PixelText(this, 11, rowY(i), r.label, { size: FS.big, color: UI.textDim });
      return new PixelText(this, W - 11, rowY(i), '', { size: FS.big, color: r.color, outline: true }).setOrigin(1, 0);
    });
    const newTags = rows.map((r, i) => this.newTag(11 + 16 * r.label.length + 4, rowY(i) + 3).setVisible(false));
    const analogy = new PixelText(this, 11, rowY(rows.length), damageAnalogy(s.damage, run.stage.id).text, { size: FS.big, color: UI.gold, outline: true })
      .setVisible(false);
    const collected = new PixelText(this, W - 11, rowY(rows.length),
      `称号{gold}${saved.titlesCollected}{/}/${saved.titlesTotal}`, { size: FS.big, color: UI.textDim, outline: true })
      .setOrigin(1, 0).setVisible(false);
    // 称号の数の NEW は、たとえの字と称号の数の間に置く。すきまが足りなければ出さない(称号の帯にも NEW が出る)
    const collectedNew = this.newTag(0, rowY(rows.length) + 3).setVisible(false);
    const tagW = collectedNew.getData('w') as number;
    const gapL = 11 + Math.ceil(analogy.width) + 3;
    const gapR = W - 11 - Math.ceil(collected.width) - 3;
    const newFits = gapR - gapL >= tagW;
    collectedNew.x = Math.round(gapL + (gapR - gapL - tagW) / 2);
    const gangTexts: PixelText[] = [];
    if (gangRowH) {
      const gy = rowY(rows.length) + rowH;
      const byGroup = s.defeatedByWipe + s.defeatedByVan;
      gangTexts.push(
        new PixelText(this, 11, gy, `組ごと撃破{gold}${byGroup}{/}人`, { size: FS.body, color: UI.textDim }).setVisible(false),
        new PixelText(this, W - 11, gy, `車で逃げた{${s.groupsEscaped > 0 ? 'red' : 'gold'}}${s.groupsEscaped}{/}組`, { size: FS.body, color: UI.textDim })
          .setOrigin(1, 0).setVisible(false)
      );
    }

    // ─── ボタン ───
    const { smallH, shareH, shareY } = bl;
    const rowBtnY = bottom - smallH;
    // 共有の画像(File)ができるまでは押せない
    const shareBtn = new Button(this, 6, shareY, W - 12, shareH, 'じゅんびちゅう', { color: 'stop' }).setEnabled(false);
    const againBtn = new Button(this, 6, rowBtnY, 99, smallH, 'もう一回', { color: 'civ' });
    const titleBtn = new Button(this, W - 105, rowBtnY, 99, smallH, 'タイトルへ', { color: 0x4a3f78 });
    // 次のステージが開いたら、タイトルへのボタンに「NEW」をつける(タイトルからステージを選ぶ画面へ行ける)
    const unlockNew = this.newTag(0, rowBtnY - 7).setVisible(false);
    unlockNew.x = W - 6 - (unlockNew.getData('w') as number) + 1;
    dev.buttons = { share: shareBtn, again: againBtn, title: titleBtn };
    againBtn.on('press', () => {
      audio.unlock(); audio.sfx('button');
      // 新しいプレイは、切り替えを受け付けてから作る(連打や切り替えの途中で2回作らないように)
      goto(this, SCENES.intro, undefined, { onCovered: () => startRun(this, randomSeed(), false, run.stage.id) });
    });
    titleBtn.on('press', () => {
      audio.unlock(); audio.sfx('button');
      goto(this, SCENES.title);
    });

    // ─── いちばんひどかった場面(小さく)───
    const thumbTop = boxY + boxH + 5;
    const thumbRoom = shareY - 5 - thumbTop;
    const baseShot = shot ? normalizeShot(shot) : makeFallbackShot(this, s, run.scrollX, def);
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
      const lab = new PixelText(this, 121, ty, 'ワーストシーン', { size: FS.body, color: UI.danger, outline: true });
      const capText = worstCaption(s);
      const cap = new PixelText(this, 121, ty + 16, capText, { size: FS.body, color: UI.text, wrap: W - 121 - 3 });
      thumbParts.push(g, img, lab, cap);
      for (const o of thumbParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
      img.setInteractive().on('pointerdown', () => {
        if (!this.card) return;   // 画像がまだできていない
        audio.sfx('button'); this.share?.showOverlay();
      });
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
      .step(0, { end: () => { const c = titleCommentFor(t.id, run.stage.id); void cut.say(c.text, c.face, { who: c.who }); if (quiet.v) cut.skip(); } });
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
      .step(0, { end: () => { analogy.setVisible(true); for (const g of gangTexts) g.setVisible(true); sfx('sparkle'); } })
      .wait(250)
      .step(0, {
        end: () => {
          collected.setVisible(true);
          sfx('blip');
          if (saved.titleIsNew && newFits) collectedNew.setVisible(true);
        }
      })
      .wait(300)
      .step(0, {
        end: () => {
          for (const o of thumbParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
          if (thumbParts.length) sfx('hit');
        }
      });
    // 次のステージが開いた知らせ(帯とオペレーターのひとこと)
    if (saved.unlockedNow.length) {
      const opened = saved.unlockedNow[0];
      this.tl.wait(700).step(0, {
        end: () => {
          void banner(this, `${STAGES[opened].name}が遊べる!`, { y: 128, hold: 1500, band: UI.gold });
          sfx('fanfare');
          if (!quiet.v) flash(this, 0xfff0c0, 2);
          const u = say('unlocked', undefined, opened);
          void cut.say(u.text, u.face, { who: u.who });
          if (quiet.v) cut.skip();
          unlockNew.setVisible(true);
        }
      });
    }

    // タップで数え上げを飛ばす(ボタンの上は除く)
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length) return;
      this.skipAll(quiet, cut);
    });
    const onUpdate = (_t: number, dt: number): void => {
      this.tl.update(dt);
      this.blinkTags([titleNew, collectedNew, unlockNew, ...newTags]);
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);

    // ─── 共有 ───
    const url = location.origin + location.pathname;
    const text = buildShareText({
      stageId: run.stage.id, defeated: s.defeated, civHurt: s.civHurt, damage: s.damage, titleName: t.name,
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
      if (!shareBtn.isEnabled) return;
      audio.unlock();
      audio.sfx('button');
      this.skipAll(quiet, cut);
      this.share?.arm();
    });

    const cardIn = { title: t, stats: s, saved, shot: baseShot, scrollX: run.scrollX, stage: def };
    const texts = [...cardTexts(cardIn), ...rows.map((r) => r.label), 'ワーストシーン', 'NEW'];
    const alive = (): boolean => this.sys.isActive() || this.sys.isPaused();
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
