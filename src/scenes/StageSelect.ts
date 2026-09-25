// ステージを選ぶ画面。タイトルでタップしたあとに出る(docs/SPEC.md「ステージを選ぶ画面」)。
// STAGE_IDS のステージを、背景の絵を小さく見せたカードで縦に並べる(何枚でもよい)。
// 全部のカードが入る高い画面では、今までどおり高さを分けて並べる。入らないときは、カードの高さを絵が入る高さに決め、
// 指で上下にずらして見る(並べ方とずらす動きの計算は stageselect/scroll.ts)。次のカードの頭が少し見え、右の端に
// いまどのあたりを見ているかの細い印を出す。指が8ドットより動いたらずらす操作で、カードのタップにしない。
// ずらすときは、カードは指を離したときに選ぶ(ずらさないときは、今までどおり触れた瞬間に選ぶ)。
// 開いたときは、まだ遊んでいない開いたカード(NEW!)か、最後に遊んだステージのカードを見える所に出す(initialCard)。
// 見出し、「◀タイトルへ」「フリープレイ▶」、音のボタンはずれない。カードを並べる所の上と下は、背景と同じしま模様で
// ふたをして、ずれたカードをかくす。
// 開いていないステージは暗くして鍵のマークと def.lockedText。記録と称号の数は stageSelectInfo() から。
// カードをタップすると startRun(this, seed, false, stageId) をして掛け合い(Intro)へ。掛け合いを見たか遊んだことが
// あるステージは、すぐ仕分け(Sort)へ(entrySceneFor)。「◀タイトルへ」でタイトルへ。
// 結果画面でステージが開いたとき(stageselect/state.ts の印)は、そのカードまで自動でずらしてから、鍵がこわれて開く演出をする。
// 下の「◀タイトルへ」の右に「フリープレイ▶」のボタン(stageselect/freeButton.ts。docs/FREEPLAY.md「始め方」)。
// フリープレイはカードにしない。路地裏のボスを倒すと開き、押すと startFreeRun をして
// 初回だけ掛け合い(Intro)、2回目からはすぐ Street へ(freeEntryScene)。路地裏をクリアした直後は、
// カードの鍵のあとにボタンの鍵もこわれて開く。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { purgeAccessorySheets } from '../art/recolor';
import { freeSelectInfo, loadRecords, randomSeed, say, stageSelectInfo, type StageId, type StageSelectEntry } from '../logic';
import { startFreeRun, startRun } from '../run';
import { settings } from '../settings';
import { px } from '../hires';
import { Button, CutIn, CUT_H, FS, PixelText, banner, flash, shake, spawnFx, waitMs } from '../ui';
import { addMute, devHook, gotoSafe, unlockOnTap } from './sort/common';
import { drawHand } from './sort/introDemo';
import { entrySceneFor, freeEntryScene } from './Intro';
import { StageCard } from './stageselect/card';
import { FreeButton } from './stageselect/freeButton';
import { ListScroll, cardTop, initialCard, listLayout, showTarget, type ListLayout } from './stageselect/scroll';
import { markJustUnlocked, takeJustUnlocked } from './stageselect/state';

const HEADER_H = 38;
const STRIPES = 'ss_stripes';
/** 並べる所の上と下のふた(カードより前、ボタンより奥) */
const COVER_DEPTH = 200;

/**
 * 指の動きがあった時刻(ミリ秒)。ブラウザのイベントの時刻を使う(ゲームのコマが遅い端末でも、はじいた速さを正しく測れる)
 */
const eventTime = (p: Phaser.Input.Pointer): number => p.event?.timeStamp || performance.now();

/**
 * 開発用の URL(公開した版では効かない)。&cards=4 でカードを4枚に増やして並べ方を見る(足りない分は前のカードをくり返す)。
 * &justunlocked=mall で、そのステージが開いたばかりの演出をする(ページを開いて最初にこの画面に来たときだけ)
 */
let devUnlockUsed = false;
function devEntries(scene: Phaser.Scene, entries: StageSelectEntry[]): StageSelectEntry[] {
  if (!import.meta.env.DEV) return entries;
  const q = new URLSearchParams(location.search);
  const ids = (q.get('justunlocked') ?? '').split(',').filter((id): id is StageId => entries.some((e) => e.id === id));
  if (ids.length && !devUnlockUsed) { devUnlockUsed = true; markJustUnlocked(scene, ids); }
  const n = Number(q.get('cards') ?? 0);
  if (!(n > entries.length) || !entries.length) return entries;
  return Array.from({ length: Math.min(9, n) }, (_, i) => entries[i % entries.length]);
}

export class StageSelectScene extends Phaser.Scene {
  private cards: StageCard[] = [];
  private leaving = false;
  private busy = false;
  private bgTile!: Phaser.GameObjects.TileSprite;
  private bgT = 0;
  private hand?: Phaser.GameObjects.Graphics;
  private handReady = false;
  private free!: FreeButton;
  private lay!: ListLayout;
  private scroll!: ListScroll;
  /** カードを並べる所の上の端と高さ(画面の座標) */
  private viewTop = 0;
  private viewH = 0;
  private bar?: Phaser.GameObjects.Graphics;
  private covers: Phaser.GameObjects.TileSprite[] = [];
  /** ずらすときに指が触れた所(離したときのタップに使う) */
  private downAt: { x: number; y: number } | null = null;

  constructor() { super(SCENES.stageSelect); }

  create(): void {
    const { W, H } = layout;
    this.cards = [];
    this.leaving = false;
    this.busy = false;
    this.bgT = 0;
    this.hand = undefined;
    this.handReady = false;
    this.bar = undefined;
    this.covers = [];
    this.downAt = null;
    // ステージ2で人ごとに塗り替えた絵を捨てる(このあとカードの絵の分だけ作り直す)
    purgeAccessorySheets(this);
    unlockOnTap(this);
    audio.playBgm('title');

    // ─── 背景:ななめのしま模様が流れる ───
    this.makeStripes();
    this.bgTile = this.add.tileSprite(0, 0, W, H, STRIPES).setOrigin(0).setDepth(0);
    this.speedLines();

    // ─── 上:見出し ───
    const hd = this.add.container(0, -HEADER_H).setDepth(500);
    const hg = this.add.graphics();
    hg.fillStyle(0x000000, 1).fillRect(0, 0, W, HEADER_H);
    hg.fillStyle(UI.bad, 1).fillRect(0, HEADER_H - 4, W, 2);
    hg.fillStyle(UI.gold, 1).fillRect(0, HEADER_H - 2, W, 1);
    hg.fillStyle(0x000000, 1).fillRect(0, HEADER_H - 1, W, 1);
    const ttl = new PixelText(this, Math.round(W / 2), 4, 'STAGE SELECT', { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0);
    const sub = new PixelText(this, Math.round(W / 2), 21, '遊ぶステージを選んでね', { size: FS.small, color: UI.textDim }).setOrigin(0.5, 0);
    hd.add([hg, ttl, sub]);
    this.tweens.add({ targets: hd, y: 0, duration: 220, ease: 'Back.easeOut', onUpdate: () => { hd.y = Math.round(hd.y); } });
    addMute(this, W - 13, 13).setDepth(600);
    // 見出しの字がときどきキラーンと光る
    this.time.addEvent({
      delay: 1900, loop: true, startAt: 1200, callback: () => {
        spawnFx(this, 'fx_kiran', Math.round(W / 2) + Phaser.Math.Between(-44, 44), 10, { depth: 510 });
      }
    });
    // 選べるカードの上に、ときどきキラキラ
    this.time.addEvent({
      delay: 420, loop: true, callback: () => {
        // 見えているカードの、見えている所だけ
        const vTop = this.viewTop + 8, vBottom = this.viewTop + this.viewH - 8;
        const span = (c: StageCard): [number, number] => [Math.max(c.root.y + 8, vTop), Math.min(c.root.y + (c.box.thumbH || c.box.h - 8), vBottom)];
        const open = this.cards.filter((c) => { const [a, b] = span(c); return !c.locked && a < b; });
        if (!open.length || this.leaving) return;
        const c = Phaser.Utils.Array.GetRandom(open);
        const [y0, y1] = span(c);
        spawnFx(this, 'fx_sparkle', c.root.x + Phaser.Math.Between(10, c.box.w - 10), Phaser.Math.Between(y0, y1), { depth: 300 });
      }
    });

    // ─── 下:タイトルへ ───
    const bottom = H - Math.max(6, layout.safeBottom + 4);
    const backH = 26;
    const backBtn = new Button(this, 6, bottom - backH, 96, backH, '◀タイトルへ', { color: 0x4a3f78, size: FS.body, onPress: () => this.back() });
    // その右に「フリープレイ▶」
    const freeInfo = freeSelectInfo();
    this.free = new FreeButton(this, 108, bottom - backH, W - 114, backH, freeInfo, () => this.chooseFree());

    // ─── カード ───
    const entries = devEntries(this, stageSelectInfo());
    const justUnlocked = takeJustUnlocked(this);
    const top = HEADER_H + 6;
    this.viewTop = top;
    this.viewH = bottom - backH - 8 - top;
    // 全部入るなら高さを分けて並べる(縦に余裕があれば、下に「タップで出発」の行をあける)。入らなければずらす
    const lay = listLayout(this.viewH, entries.length);
    this.lay = lay;
    this.scroll = new ListScroll(lay.scrollMax);
    const { cardH, thumbH } = lay;
    entries.forEach((e, i) => {
      const card = new StageCard(this, e, { x: 6, y: top + cardTop(lay, i), w: W - 12, h: cardH, thumbH });
      this.cards.push(card);
      // 左右から順に飛びこんでくる
      const tx = card.root.x;
      card.root.x = i % 2 === 0 ? -W : W;
      this.tweens.add({
        targets: card.root, x: tx, duration: 260, delay: 120 + i * 110, ease: 'Back.easeOut',
        onUpdate: () => { card.root.x = Math.round(card.root.x); },
        onComplete: () => { audio.sfx('stamp', { volume: 0.5 }); shake(this, 2, 80); }
      });
      if (!e.unlocked) return;
      if (justUnlocked.includes(e.id)) card.setLockedLook(true);
      else if (!e.record) card.setBadge(i === 0 ? 'ここから!' : 'NEW!', i === 0 ? UI.civ : UI.bad);
    });

    // 初めての人には、ステージ1のカードを指さす手
    const first = this.cards[0];
    if (first && !first.entry.record && !justUnlocked.length) {
      const g = this.add.graphics().setDepth(700);
      drawHand(g);
      g.setScale(2).setVisible(false);
      this.hand = g;
      this.time.delayedCall(700, () => { this.handReady = true; });
    }

    // ─── ずらす ───
    if (lay.scrollMax > 0) this.buildScroller();
    // 開いたときに見せるカード:まだ遊んでいない開いたカードか、最後に遊んだステージ
    const last = loadRecords().lastStage;
    const shown = initialCard(
      entries.map((e) => ({ unlocked: e.unlocked, played: !!e.record, justUnlocked: justUnlocked.includes(e.id) })),
      last ? entries.findIndex((e) => e.id === last) : -1
    );
    this.scroll.set(showTarget(shown, lay, 0));
    this.applyScroll();

    // 開いたばかりのステージ:鍵がこわれて開く
    const opening = this.cards.filter((c) => c.entry.unlocked && justUnlocked.includes(c.entry.id));
    // 路地裏をクリアした直後(地下駐車場が開いた)は、フリープレイのボタンも鍵の見た目から開く
    const freeOpening = freeInfo.unlocked && !freeInfo.record && justUnlocked.includes('garage');
    if (freeOpening) this.free.setLockedLook(true);
    if (opening.length) void this.playUnlock(opening, freeOpening);

    // ─── タップ ───
    // ずらさないときは、今までどおり触れた瞬間に選ぶ。ずらすときは、指を離したときに、8ドットより動いていなければ選ぶ
    const scrolls = lay.scrollMax > 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.some((o) => o.parentContainer === backBtn || o.parentContainer === this.free.btn) || this.leaving || this.busy) return;
      const { x, y } = px(p);
      if (scrolls) {
        // カードを並べる所の中で触れたときだけ(ふたの上やボタンのまわりは見ない)
        if (y < this.viewTop || y >= this.viewTop + this.viewH || this.scroll.touching) return;
        this.scroll.down(p.id, y, eventTime(p));
        this.downAt = { x, y };
        return;
      }
      const card = this.cards.find((c) => c.contains(x, y));
      if (card) this.choose(card);
    });
    if (scrolls) {
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (this.scroll.move(p.id, px(p).y, eventTime(p))) this.applyScroll();
      });
      const up = (p: Phaser.Input.Pointer): void => {
        const at = this.downAt;
        const r = this.scroll.up(p.id, eventTime(p));
        // ほかの指を離しただけなら、触れている指はそのまま
        if (this.scroll.touching) return;
        this.downAt = null;
        if (r !== 'tap' || !at || this.leaving || this.busy) return;
        const card = this.cards.find((c) => c.contains(at.x, at.y));
        if (card) this.choose(card);
      };
      this.input.on('pointerup', up);
      this.input.on('pointerupoutside', up);
      this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        if (this.busy || this.leaving) return;
        this.scroll.set(this.scroll.pos + dy / 4);
        this.applyScroll();
      });
      // シーンが止まったら、触れている指を放す(再開したときに勝手にずれたり選んだりしないように)
      this.events.on(Phaser.Scenes.Events.PAUSE, () => { this.scroll.cancel(); this.downAt = null; });
    }
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    // 数字のキーで、その番号のカードを選ぶ
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'].forEach((k, i) => {
      this.input.keyboard?.on(`keydown-${k}`, () => this.cards[i] && this.choose(this.cards[i]));
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.cards[0] && this.choose(this.cards[0]));
    this.input.keyboard?.on('keydown-F', () => this.chooseFree());

    devHook(this, {
      select: (id: StageId) => { const c = this.cards.find((k) => k.entry.id === id); if (c) this.choose(c); },
      back: () => this.back(),
      free: () => this.chooseFree(),
      freeButton: () => ({ x: this.free.x, y: this.free.y, w: this.free.w, h: this.free.h, locked: this.free.locked }),
      // top は、ずらしていないときの上の端。y はいまの真ん中(ずらした分を引いた画面の座標)
      cards: () => this.cards.map((c) => ({
        id: c.entry.id, locked: c.locked, x: c.root.x + c.box.w / 2, y: c.root.y + c.box.h / 2, top: c.box.y, h: c.box.h, thumbH: c.box.thumbH
      })),
      scroll: () => ({ pos: this.scroll.pos, max: this.lay.scrollMax, moving: this.scroll.moving, viewTop: this.viewTop, viewH: this.viewH }),
      scrollTo: (v: number) => { this.scroll.set(v); this.applyScroll(); }
    });
  }

  override update(_t: number, dt: number): void {
    this.bgT += dt;
    const step = Math.floor(this.bgT / 40);
    this.bgTile.tilePositionX = -step;
    this.bgTile.tilePositionY = -step;
    // ふたのしま模様を、うしろの背景とつなげる
    for (const c of this.covers) {
      c.tilePositionX = -step;
      c.tilePositionY = -step + c.y;
    }
    if (this.scroll.step(dt)) this.applyScroll();
    for (const c of this.cards) c.update(dt);
    this.free.update(dt);
    if (this.hand && this.cards[0]) {
      const c = this.cards[0];
      const bob = Math.floor(this.bgT / 180) % 2;
      const hy = c.root.y + c.box.h - 14;
      this.hand.setPosition(c.root.x + c.box.w - 30, hy + bob * 3);
      // カードがずれて見えなくなったら、手もかくす
      this.hand.setVisible(this.handReady && !this.leaving && hy > this.viewTop && hy < this.viewTop + this.viewH);
    }
  }

  // ─── ずらす ─────────────────────────────────────

  /** 並べる所の上と下のふたと、右の端の印を作る(ずらすときだけ) */
  private buildScroller(): void {
    const { W, H } = layout;
    const vBottom = this.viewTop + this.viewH;
    this.covers = [
      this.add.tileSprite(0, HEADER_H, W, this.viewTop - HEADER_H, STRIPES),
      this.add.tileSprite(0, vBottom, W, H - vBottom, STRIPES)
    ].map((t) => t.setOrigin(0).setDepth(COVER_DEPTH));
    this.bar = this.add.graphics().setDepth(COVER_DEPTH + 1);
  }

  /** いまのずれに合わせて、カードと右の端の印を動かす */
  private applyScroll(): void {
    const pos = Math.round(this.scroll.pos);
    for (const c of this.cards) c.root.y = c.box.y - pos;
    const bar = this.bar;
    const lay = this.lay;
    if (!bar || lay.scrollMax <= 0) return;
    // 右の端の細い印(称号の一覧と同じ形)。黒いみぞの中を、見ている所の長さの線が動く
    const W = layout.W;
    const top = this.viewTop, viewH = this.viewH;
    const th = Math.max(16, Math.round((viewH * viewH) / lay.contentH));
    const ty = top + Math.round(((viewH - th) * pos) / lay.scrollMax);
    bar.clear();
    bar.fillStyle(UI.black, 1).fillRect(W - 4, top, 3, viewH);
    bar.fillStyle(UI.textDim, 1).fillRect(W - 3, ty, 1, th);
  }

  /** i 番目のカードが見えるまで自動でずらし、止まるまで待つ */
  private async slideToCard(i: number): Promise<void> {
    if (this.lay.scrollMax <= 0) return;
    this.scroll.cancel();
    this.scroll.slideTo(showTarget(i, this.lay, this.scroll.pos));
    while (this.scroll.moving && this.scene.isActive()) await waitMs(this, 30);
  }

  // ─── 選ぶ ───────────────────────────────────────

  private choose(card: StageCard): void {
    if (this.leaving || this.busy) return;
    audio.unlock();
    if (card.locked) {
      audio.sfx('oops', { volume: 0.7 });
      card.shakeLock();
      shake(this, 2, 120);
      return;
    }
    const id = card.entry.id;
    this.leaving = true;
    audio.sfx('button');
    audio.sfx('go', { volume: 0.8 });
    flash(this, 0xffffff, 2);
    card.pressed();
    this.hand?.setVisible(false);
    // 新しいプレイは、切り替えを受け付けてから作る(連打や切り替えの途中で2回作らないように)
    this.time.delayedCall(360, () => {
      gotoSafe(this, entrySceneFor(id), undefined, { kind: 'wipe', onCovered: () => startRun(this, randomSeed(), false, id) }, (ok) => {
        if (!ok) this.leaving = false;
      });
    });
  }

  /** 「フリープレイ▶」:開いていなければ鍵が揺れて開き方を出す。開いていれば startFreeRun をして掛け合いか Street へ */
  private chooseFree(): void {
    if (this.leaving || this.busy) return;
    audio.unlock();
    if (this.free.locked) {
      audio.sfx('oops', { volume: 0.7 });
      this.free.shakeLock();
      shake(this, 2, 120);
      return;
    }
    this.leaving = true;
    audio.sfx('button');
    audio.sfx('go', { volume: 0.8 });
    flash(this, 0xffffff, 2);
    this.hand?.setVisible(false);
    // 新しいプレイは、切り替えを受け付けてから作る(ステージのカードと同じ)
    this.time.delayedCall(200, () => {
      gotoSafe(this, freeEntryScene(), undefined, {
        kind: 'wipe', onCovered: () => startFreeRun(this, randomSeed(), { slow: settings.slowMode })
      }, (ok) => {
        if (!ok) this.leaving = false;
      });
    });
  }

  private back(): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.unlock();
    audio.sfx('button');
    gotoSafe(this, SCENES.title, undefined, undefined, (ok) => { if (!ok) this.leaving = false; });
  }

  // ─── ステージが開く ─────────────────────────────

  private async playUnlock(cards: StageCard[], freeToo = false): Promise<void> {
    this.busy = true;
    await waitMs(this, 750);
    for (const card of cards) {
      // 下の方のカードなら、見える所までずらしてから
      const i = this.cards.indexOf(card);
      if (i >= 0 && this.lay.scrollMax > 0) {
        await this.slideToCard(i);
        await waitMs(this, 200);
      }
      audio.sfx('tick');
      await card.unlock((x, y) => {
        audio.sfx('explosion');
        audio.sfx('fanfare', { volume: 0.6 });
        flash(this, 0xfff0c0, 2);
        shake(this, 6, 300);
        spawnFx(this, 'fx_explosion', x, y, { depth: 800 });
        for (let i = 0; i < 6; i++) {
          spawnFx(this, 'fx_sparkle', x + Phaser.Math.Between(-80, 80), y + Phaser.Math.Between(-30, 30), { depth: 801, delay: i * 60 });
        }
      });
      card.setBadge('NEW!');
      void banner(this, `${card.entry.def.name}が開いた!`, { y: card.root.y + card.box.h / 2, hold: 900 });
      // オペレーターのひとこと。開いたカードを隠さないように、カードが下の方なら見出しの下、上の方なら下のボタンの上
      const { W, H } = layout;
      const low = card.root.y + card.box.h / 2 > H / 2;
      const cut = new CutIn(this, 4, low ? HEADER_H + 4 : H - Math.max(6, layout.safeBottom + 4) - 26 - 8 - CUT_H - 4, W - 8, CUT_H).setDepth(900);
      const s = say('unlocked', undefined, card.entry.id);
      void cut.say(s.text, s.face, { who: s.who });
      this.time.delayedCall(2600, () => cut.destroy());
    }
    if (freeToo) {
      await waitMs(this, 1400);
      audio.sfx('tick');
      await this.free.unlock((x, y) => {
        audio.sfx('explosion', { volume: 0.6 });
        audio.sfx('fanfare', { volume: 0.5 });
        flash(this, 0xfff0c0, 2);
        shake(this, 4, 200);
        for (let i = 0; i < 5; i++) {
          spawnFx(this, 'fx_sparkle', x + Phaser.Math.Between(0, this.free.w - 10), y + Phaser.Math.Between(-10, 8), { depth: 1200, delay: i * 60 });
        }
      });
      void banner(this, 'フリープレイが開いた!', { y: this.free.y - 20, hold: 900 });
    }
    this.busy = false;
  }

  // ─── 背景 ───────────────────────────────────────

  /** ななめのしま模様(2色)のテクスチャ */
  private makeStripes(): void {
    if (this.textures.exists(STRIPES)) return;
    const size = 24;
    const tex = this.textures.createCanvas(STRIPES, size, size)!;
    const ctx = tex.context;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const band = Math.floor(((x + y) % size) / 6);
        ctx.fillStyle = band % 2 === 0 ? '#0c0a26' : '#141038';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // 小さな星をちらす
    ctx.fillStyle = '#3a3470';
    ctx.fillRect(3, 17, 1, 1);
    ctx.fillRect(15, 5, 1, 1);
    tex.refresh();
  }

  /** 画面の左右を、ときどき光の線が走る */
  private speedLines(): void {
    const { W, H } = layout;
    const g = this.add.graphics().setDepth(1);
    const lines = Array.from({ length: 7 }, () => ({ y: Phaser.Math.Between(HEADER_H, H), x: Phaser.Math.Between(-W, W), v: Phaser.Math.Between(3, 7), len: Phaser.Math.Between(12, 40) }));
    const draw = (): void => {
      g.clear();
      for (const l of lines) {
        l.x += l.v;
        if (l.x > W + 40) { l.x = -Phaser.Math.Between(40, 200); l.y = Phaser.Math.Between(HEADER_H, H); }
        g.fillStyle(0x2a2464, 1).fillRect(Math.round(l.x), l.y, l.len, 1);
        g.fillStyle(0x6a60c0, 1).fillRect(Math.round(l.x) + l.len - 4, l.y, 4, 1);
      }
    };
    // シーンを出るときに外す(行き来するたびに毎フレームの処理が増えないように)
    this.events.on(Phaser.Scenes.Events.UPDATE, draw);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, draw));
  }
}
