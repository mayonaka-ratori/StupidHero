// タイトル画面。夜の路地裏で、サーチライトの光の中にヒーローが立つ。
// 「タップしてスタート」のタップで音を鳴らし始め、ステージを選ぶ画面(StageSelect)へ。
// まだどのステージも遊んだことがない人は、ステージを選ぶ画面をとばして、すぐ路地裏の掛け合い(Intro)へ。
// ロゴの下に、遊び方をひとことで言う帯(タグライン)を出す。
// 称号の数は全部のステージを合わせた数(称号5/14)。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { animKey, originFor } from '../art/sheets';
import { purgeAccessorySheets } from '../art/recolor';
import { hasAnyRecord, loadRecords, randomSeed, TITLE_COUNT } from '../logic';
import { startRun } from '../run';
import { FS, PixelText, ditherTexture, flash, gotoWhenFree, shake } from '../ui';
import { Z, addMute, devHook, drawAlley, drawLightPool, flicker } from './sort/common';
import { entrySceneFor } from './Intro';

const HERO_X = 108;
/** 下の「タップしてスタート」の部分の高さ */
const BOTTOM_H = 112;

export class TitleScene extends Phaser.Scene {
  private started = false;
  private beams!: Phaser.GameObjects.Graphics;
  private beamT = 0;
  private hero!: Phaser.GameObjects.Sprite;
  /** 路地裏の絵の上端(縦に長い画面では下にずらし、上に夜空を足す) */
  private top = 0;
  private feetY = 204;

  constructor() { super(SCENES.title); }

  create(): void {
    this.started = false;
    // ステージ2で人ごとに塗り替えた絵を捨てる(遊ぶたびにたまり続けないように)
    purgeAccessorySheets(this);
    const { W, H } = layout;
    this.top = Math.max(0, H - 214 - BOTTOM_H);
    this.feetY = this.top + 204;
    const FEET_Y = this.feetY;
    const panelTop = this.top + 214;

    // 背景:夜空(足りないぶん) → 遠くのビル → サーチライト → 壁と地面
    this.add.rectangle(0, 0, W, this.top + 1, 0x000024).setOrigin(0).setDepth(Z.far);
    this.stars();
    drawAlley(this, 0, this.top);
    this.beams = this.add.graphics().setDepth(Z.sky);
    flicker(this, this.beams);

    // 足もとの光の輪
    const pool = this.add.graphics().setDepth(Z.ground + 1);
    drawLightPool(pool, HERO_X, FEET_Y + 1, 40, 6);

    // ヒーロー(2倍)とオーラ
    const aura = this.add.sprite(HERO_X, FEET_Y - 44, 'fx_aura').setScale(2).setDepth(Z.aura);
    aura.play(animKey('fx_aura', 'play'));
    flicker(this, aura);
    this.hero = this.add.sprite(HERO_X, FEET_Y, 'hero').setOrigin(...originFor('hero')).setScale(2).setDepth(Z.actor);
    this.hero.play(animKey('hero', 'idle'));

    // キラキラをときどき散らす
    this.time.addEvent({ delay: 260, loop: true, callback: () => this.sparkle() });
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.kiran() });

    // ロゴ:上から落ちてきて、ドンと止まる
    // (跳ね返りで上に戻ると、低い画面では「STUPID」の上が一瞬切れるので、落ちてドンと止めて小さく弾ませる)
    const logo = this.add.image(Math.round(W / 2), -40, 'logo').setDepth(Z.stamp);
    const logoY = Math.round(Math.max(40, this.top * 0.62));
    this.tweens.add({
      targets: logo, y: logoY, duration: 300, ease: 'Quad.easeIn', delay: 150,
      onUpdate: () => { logo.y = Math.round(logo.y); },
      onComplete: () => {
        shake(this, 3, 180);
        tagline.setVisible(true);
        this.tweens.add({ targets: logo, y: logoY + 3, duration: 70, yoyo: true, ease: 'Quad.easeOut', onUpdate: () => { logo.y = Math.round(logo.y); } });
      }
    });
    // ロゴの下の帯:何をするゲームかをひとことで。ロゴが止まったら出す
    const tagline = this.tagline(logoY + 36).setVisible(false);
    // ロゴのふちを時々光らせる
    this.time.addEvent({
      delay: 1800, loop: true, startAt: 900, callback: () => {
        const glint = this.add.sprite(logo.x + Phaser.Math.Between(-80, 80), logo.y + Phaser.Math.Between(-18, 10), 'fx_kiran').setDepth(Z.stamp + 1);
        glint.play(animKey('fx_kiran', 'play'));
        glint.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => glint.destroy());
      }
    });

    // 下の部分
    const pg = this.add.graphics().setDepth(900);
    pg.fillStyle(UI.panel, 1).fillRect(0, panelTop, W, H - panelTop);
    pg.fillStyle(UI.black, 1).fillRect(0, panelTop, W, 1);
    pg.fillStyle(UI.gold, 1).fillRect(0, panelTop + 1, W, 1);
    pg.fillStyle(UI.bad, 1).fillRect(0, panelTop + 2, W, 2);
    pg.fillStyle(0x15122a, 1);
    for (let y = panelTop + 8; y < H; y += 4) pg.fillRect(0, y, W, 1);
    const mid = panelTop + 26;
    const start = new PixelText(this, Math.round(W / 2), mid, 'タップしてスタート', {
      size: FS.big, color: UI.gold, outline: true
    }).setOrigin(0.5, 0.5);
    this.time.addEvent({ delay: 480, loop: true, callback: () => start.setVisible(!start.visible) });
    // 下向きの三角で「押す」ことを示す
    const arrow = this.add.graphics().setDepth(1000);
    arrow.fillStyle(UI.gold, 1);
    for (let i = 0; i < 4; i++) arrow.fillRect(Math.round(W / 2) - 4 + i, mid + 14 + i, 8 - i * 2, 1);
    this.tweens.add({ targets: arrow, y: 2, duration: 300, yoyo: true, repeat: -1, ease: 'Stepped' });

    const got = loadRecords().titles.length;
    new PixelText(this, Math.round(W / 2), mid + 30, `称号{gold}${got}{/}/${TITLE_COUNT}`, {
      size: FS.body, color: UI.textDim
    }).setOrigin(0.5, 0);
    new PixelText(this, Math.round(W / 2), H - Math.max(8, layout.safeBottom + 4), 'ホーム画面に追加すると\n記録が消えにくくなります', {
      size: FS.body, color: 0x8a84a0, align: 'center'
    }).setOrigin(0.5, 1);

    // 音のボタン(スタートのタップとは別)
    const mute = addMute(this, W - 13, 13);

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      audio.unlock();
      if (over.some((o) => o.parentContainer === mute)) return;
      this.begin();
    });
    this.input.keyboard?.on('keydown-SPACE', () => { audio.unlock(); this.begin(); });
    this.input.keyboard?.on('keydown-ENTER', () => { audio.unlock(); this.begin(); });
    devHook(this, { begin: () => this.begin() });
  }

  /** ロゴの下の帯(上下に金の線、暗くした帯に2行) */
  private tagline(y: number): Phaser.GameObjects.Container {
    const { W } = layout;
    const h = 34;
    const c = this.add.container(0, y).setDepth(Z.stamp);
    const dim = this.add.tileSprite(0, 0, W, h, ditherTexture(this)).setOrigin(0);
    const g = this.add.graphics();
    // 字の後ろは黒くして読みやすく(金の線のすぐ内側だけ市松もようで透けて見える)
    g.fillStyle(UI.black, 1).fillRect(0, 3, W, h - 6);
    g.fillStyle(UI.gold, 1).fillRect(0, 0, W, 1).fillRect(0, h - 1, W, 1);
    const l1 = new PixelText(this, Math.round(W / 2), 4, '敵と味方の区別がつかないヒーローに', { size: FS.body, color: UI.text }).setOrigin(0.5, 0);
    const l2 = new PixelText(this, Math.round(W / 2), 18, 'ワルと市民を教えて、街を守れ！', { size: FS.body, color: UI.gold }).setOrigin(0.5, 0);
    c.add([dim, g, l1, l2]);
    return c;
  }

  update(_t: number, dt: number): void {
    this.beamT += dt;
    this.drawBeams();
  }

  /** 夜空をなめるサーチライト。1コマおきに見せて、透けているように */
  private drawBeams(): void {
    const g = this.beams;
    g.clear();
    const t = this.beamT / 1000;
    const beams = [
      { x: 64, a: -0.3 + Math.sin(t * 0.9) * 0.4, c: 0xb8a860 },
      { x: 152, a: 0.3 + Math.sin(t * 0.7 + 2) * 0.4, c: 0x6a9ac0 }
    ];
    for (const b of beams) {
      const len = 240;
      const spread = 0.06;
      const bx = b.x, by = this.top + 170;
      const x1 = bx + Math.sin(b.a - spread) * len, y1 = by - Math.cos(b.a - spread) * len;
      const x2 = bx + Math.sin(b.a + spread) * len, y2 = by - Math.cos(b.a + spread) * len;
      g.fillStyle(b.c, 1);
      g.fillTriangle(bx, by, Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2));
    }
  }

  /** 足した夜空に、またたく星 */
  private stars(): void {
    const { W } = layout;
    if (this.top < 4) return;
    const g = this.add.graphics().setDepth(Z.far);
    const twinkle = this.add.graphics().setDepth(Z.far);
    const pts: [number, number][] = [];
    for (let i = 0; i < Math.round(this.top * 0.5); i++) {
      const x = Phaser.Math.Between(0, W - 1), y = Phaser.Math.Between(0, this.top - 1);
      if (i % 5 === 0) pts.push([x, y]);
      else g.fillStyle(i % 3 ? 0x6d6db6 : 0xdadaff, 1).fillRect(x, y, 1, 1);
    }
    this.time.addEvent({
      delay: 120, loop: true, callback: () => {
        twinkle.clear();
        for (const [x, y] of pts) {
          if (Math.random() < 0.5) continue;
          twinkle.fillStyle(0xffffff, 1).fillRect(x, y, 1, 1);
          if (Math.random() < 0.3) twinkle.fillStyle(0x9a9ae6, 1).fillRect(x - 1, y, 3, 1).fillRect(x, y - 1, 1, 3).fillStyle(0xffffff, 1).fillRect(x, y, 1, 1);
        }
      }
    });
  }

  private sparkle(): void {
    const FEET_Y = this.feetY;
    const x = HERO_X + Phaser.Math.Between(-40, 40);
    const y = FEET_Y - Phaser.Math.Between(10, 100);
    const s = this.add.sprite(x, y, 'fx_sparkle').setDepth(Z.actorFront);
    s.play(animKey('fx_sparkle', 'play'));
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  }

  private kiran(): void {
    const k = this.add.sprite(HERO_X + 14, this.feetY - 92, 'fx_kiran').setScale(2).setDepth(Z.actorFront);
    k.play(animKey('fx_kiran', 'play'));
    k.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => k.destroy());
  }

  /** スタート:音を鳴らし始め、ステージを選ぶ画面へ(初めての人は路地裏へ) */
  private begin(): void {
    if (this.started) return;
    this.started = true;
    audio.unlock();
    audio.playBgm('title');
    audio.sfx('button');
    flash(this, 0xffffff, 2);
    this.hero.play(animKey('hero', 'okay'));
    this.kiran();
    // 初めての人は、開いているステージが路地裏だけなので、選ぶ画面を出さずに始める
    const first = !hasAnyRecord();
    this.time.delayedCall(320, () => {
      if (first) {
        // 新しいプレイは、切り替えを受け付けてから作る(StageSelect と同じ)
        gotoWhenFree(this, entrySceneFor('alley'), undefined, { kind: 'wipe', onCovered: () => startRun(this, randomSeed(), false, 'alley') });
      } else {
        gotoWhenFree(this, SCENES.stageSelect, undefined, { kind: 'wipe' });
      }
    });
  }
}
