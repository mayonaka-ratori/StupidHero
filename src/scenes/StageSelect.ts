// ステージを選ぶ画面。タイトルでタップしたあとに出る(docs/STAGE2.md「ステージを選ぶ画面」)。
// ステージ1「路地裏」とステージ2「地下駐車場」を、背景の絵を小さく見せたカードで縦に並べる。
// 開いていないステージは暗くして鍵のマークと def.lockedText。記録と称号の数は stageSelectInfo() から。
// カードをタップすると startRun(this, seed, false, stageId) をして掛け合い(Intro)へ。掛け合いを見たか遊んだことが
// あるステージは、すぐ仕分け(Sort)へ(entrySceneFor)。「◀タイトルへ」でタイトルへ。
// 結果画面でステージが開いたとき(stageselect/state.ts の印)は、鍵がこわれて開く演出をする。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey } from '../art/sheets';
import { purgeAccessorySheets } from '../art/recolor';
import { randomSeed, say, stageSelectInfo, type StageId } from '../logic';
import { startRun } from '../run';
import { px } from '../hires';
import { Button, CutIn, FS, PixelText, banner, flash, goto, shake } from '../ui';
import { addMute, devHook, unlockOnTap } from './sort/common';
import { drawHand } from './sort/introDemo';
import { entrySceneFor } from './Intro';
import { StageCard } from './stageselect/card';
import { takeJustUnlocked } from './stageselect/state';

const HEADER_H = 38;
const STRIPES = 'ss_stripes';

export class StageSelectScene extends Phaser.Scene {
  private cards: StageCard[] = [];
  private leaving = false;
  private busy = false;
  private bgTile!: Phaser.GameObjects.TileSprite;
  private bgT = 0;
  private hand?: Phaser.GameObjects.Graphics;

  constructor() { super(SCENES.stageSelect); }

  create(): void {
    const { W, H } = layout;
    this.cards = [];
    this.leaving = false;
    this.busy = false;
    this.bgT = 0;
    this.hand = undefined;
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
        const k = this.add.sprite(Math.round(W / 2) + Phaser.Math.Between(-44, 44), 10, 'fx_kiran').setDepth(510);
        k.play(animKey('fx_kiran', 'play'));
        k.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => k.destroy());
      }
    });
    // 選べるカードの上に、ときどきキラキラ
    this.time.addEvent({
      delay: 420, loop: true, callback: () => {
        const open = this.cards.filter((c) => !c.locked);
        if (!open.length || this.leaving) return;
        const c = Phaser.Utils.Array.GetRandom(open);
        const sp = this.add.sprite(c.root.x + Phaser.Math.Between(10, c.box.w - 10), c.root.y + Phaser.Math.Between(8, c.box.thumbH), 'fx_sparkle').setDepth(300);
        sp.play(animKey('fx_sparkle', 'play'));
        sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sp.destroy());
      }
    });

    // ─── 下:タイトルへ ───
    const bottom = H - Math.max(6, layout.safeBottom + 4);
    const backH = 26;
    const backBtn = new Button(this, 6, bottom - backH, 96, backH, '◀タイトルへ', { color: 0x4a3f78, size: FS.body, onPress: () => this.back() });

    // ─── カード ───
    const entries = stageSelectInfo();
    const justUnlocked = takeJustUnlocked(this);
    const top = HEADER_H + 6;
    const room = bottom - backH - 8 - top;
    const gap = 8;
    const n = entries.length;
    const cardH = Math.min(186, Math.floor((room - gap * (n - 1)) / n));
    // 縦に余裕があれば、下に「タップで出発」の行をあける
    const thumbH = Phaser.Math.Clamp(cardH - (cardH >= 176 ? 80 : 64), 60, 118);
    const spare = room - cardH * n - gap * (n - 1);
    const y0 = top + Math.floor(spare / 2);
    entries.forEach((e, i) => {
      const card = new StageCard(this, e, { x: 6, y: y0 + i * (cardH + gap), w: W - 12, h: cardH, thumbH });
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
      this.time.delayedCall(700, () => g.setVisible(true));
    }

    // 開いたばかりのステージ:鍵がこわれて開く
    const opening = this.cards.filter((c) => c.entry.unlocked && justUnlocked.includes(c.entry.id));
    if (opening.length) void this.playUnlock(opening);

    // ─── タップ ───
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.some((o) => o.parentContainer === backBtn) || this.leaving || this.busy) return;
      const { x, y } = px(p);
      const card = this.cards.find((c) => c.contains(x, y));
      if (card) this.choose(card);
    });
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.input.keyboard?.on('keydown-ONE', () => this.cards[0] && this.choose(this.cards[0]));
    this.input.keyboard?.on('keydown-TWO', () => this.cards[1] && this.choose(this.cards[1]));
    this.input.keyboard?.on('keydown-ENTER', () => this.cards[0] && this.choose(this.cards[0]));

    devHook(this, {
      select: (id: StageId) => { const c = this.cards.find((k) => k.entry.id === id); if (c) this.choose(c); },
      back: () => this.back(),
      cards: () => this.cards.map((c) => ({ id: c.entry.id, locked: c.locked, x: c.root.x + c.box.w / 2, y: c.root.y + c.box.h / 2 }))
    });
  }

  update(_t: number, dt: number): void {
    this.bgT += dt;
    const step = Math.floor(this.bgT / 40);
    this.bgTile.tilePositionX = -step;
    this.bgTile.tilePositionY = -step;
    for (const c of this.cards) c.update(dt);
    if (this.hand && this.cards[0]) {
      const c = this.cards[0];
      const bob = Math.floor(this.bgT / 180) % 2;
      this.hand.setPosition(c.root.x + c.box.w - 30, c.root.y + c.box.h - 14 + bob * 3);
    }
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
      window.setTimeout(() => {
        const ok = goto(this, entrySceneFor(id), undefined, { kind: 'wipe', onCovered: () => startRun(this, randomSeed(), false, id) });
        if (!ok) this.leaving = false;
      }, 0);
    });
  }

  private back(): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.unlock();
    audio.sfx('button');
    window.setTimeout(() => { if (!goto(this, SCENES.title)) this.leaving = false; }, 0);
  }

  // ─── ステージが開く ─────────────────────────────

  private async playUnlock(cards: StageCard[]): Promise<void> {
    this.busy = true;
    await this.wait(750);
    for (const card of cards) {
      audio.sfx('tick');
      await card.unlock((x, y) => {
        audio.sfx('explosion');
        audio.sfx('fanfare', { volume: 0.6 });
        flash(this, 0xfff0c0, 2);
        shake(this, 6, 300);
        const e = this.add.sprite(x, y, 'fx_explosion', 0).setDepth(800);
        e.play(animKey('fx_explosion', 'play'));
        e.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => e.destroy());
        for (let i = 0; i < 6; i++) {
          const s = this.add.sprite(x + Phaser.Math.Between(-80, 80), y + Phaser.Math.Between(-30, 30), 'fx_sparkle').setDepth(801);
          s.play({ key: animKey('fx_sparkle', 'play'), delay: i * 60 });
          s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
        }
      });
      card.setBadge('NEW!');
      void banner(this, `${card.entry.def.name}が開いた!`, { y: card.root.y + card.box.h / 2, hold: 900 });
      // オペレーターのひとこと(下のボタンの上)
      const { W, H } = layout;
      const cut = new CutIn(this, 4, H - Math.max(6, layout.safeBottom + 4) - 26 - 8 - 50, W - 8, 46).setDepth(900);
      const s = say('unlocked', undefined, card.entry.id);
      void cut.say(s.text, s.face, { who: s.who });
      this.time.delayedCall(2600, () => cut.destroy());
    }
    this.busy = false;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
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
