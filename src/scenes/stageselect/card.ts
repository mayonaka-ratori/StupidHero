// ステージを選ぶ画面の、ステージ1つぶんのカード。
//   const card = new StageCard(this, entry, { x, y, w, h, thumbH });
//   card.update(dt)          毎フレーム(背景を少しずつ流す、NEW の札の点滅)
//   card.contains(x, y)      タップがカードの上か
//   card.pressed()           選んだときの演出(ふちが光って、ヒーローが走り出す)
//   card.shakeLock()         開いていないカードをタップしたとき
//   await card.unlock()      鍵がこわれて開く演出
// 上に背景の絵を小さく切り出して、そのステージの人とボスを立たせる。下にステージの名前と記録。
// 開いていないカードは、絵を暗くして人を黒い影にし、鍵のマークと def.lockedText を出す。

import Phaser from 'phaser';
import { UI } from '../../config';
import { animKey, originFor } from '../../art/sheets';
import { accessorySheet } from '../../art/recolor';
import { ACCESSORY_COLORS, STAGES, formatYen, titlesFor, type StageSelectEntry } from '../../logic';
import { FS, PixelText } from '../../ui';

export interface CardBox { x: number; y: number; w: number; h: number; thumbH: number }

/** 絵の中で人が立つ高さ(背景の絵の座標)。壁の下の方と地面が見える */
const FEET_SCENE = 172;

/** 鍵のマーク(1:金、2:黒のふち、3:影、4:穴) */
const LOCK = [
  '....2222....',
  '...211112...',
  '..21222212..',
  '..212..212..',
  '..212..212..',
  '.2222222222.',
  '.2111111112.',
  '.2111441112.',
  '.2111441112.',
  '.2111141112.',
  '.2111141112.',
  '.2333333332.',
  '..22222222..'
];

export function drawLock(g: Phaser.GameObjects.Graphics, cx: number, cy: number, scale = 1): void {
  const colors: Record<string, number> = { 1: UI.gold, 2: 0x000000, 3: 0xa8781c, 4: 0x3a2a08 };
  const w = LOCK[0].length, h = LOCK.length;
  const x0 = Math.round(cx - (w * scale) / 2), y0 = Math.round(cy - (h * scale) / 2);
  LOCK.forEach((row, y) => Array.from(row).forEach((ch, x) => {
    if (ch === '.') return;
    g.fillStyle(colors[ch], 1).fillRect(x0 + x * scale, y0 + y * scale, scale, scale);
  }));
}

interface ActorDef { key: string; x: number; anim: string; flip?: boolean; color?: number; frame?: number; hero?: boolean }

/** カードの絵に立たせる人と物。x は絵の幅に対する割合(0〜1)、または右端からのドット(負の数) */
function actorsFor(entry: StageSelectEntry): ActorDef[] {
  if (entry.id === 'garage') {
    const red = ACCESSORY_COLORS.red.color;
    return [
      { key: 'prop_van', x: -62, anim: '', frame: 0 },
      { key: 'hero', x: 0.14, anim: 'idle', hero: true },
      { key: 'guard_bad', x: 0.42, anim: 'sortIdle', flip: true, color: red },
      { key: 'clubber_bad', x: 0.58, anim: 'sortIdle', flip: true, color: red },
      { key: entry.def.bossSheet, x: -30, anim: 'idle', flip: true }
    ];
  }
  return [
    { key: 'prop_trash', x: 0.36, anim: '', frame: 0 },
    { key: 'hero', x: 0.14, anim: 'idle', hero: true },
    { key: 'hoodie_bad', x: 0.48, anim: 'sortIdle', flip: true },
    { key: 'villain_mohawk', x: 0.62, anim: 'idle', flip: true },
    { key: entry.def.bossSheet, x: -30, anim: 'idle', flip: true }
  ];
}

export class StageCard {
  readonly root: Phaser.GameObjects.Container;
  readonly box: CardBox;
  locked: boolean;
  private frame: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Graphics;
  private layers: Phaser.GameObjects.TileSprite[] = [];
  private actors: Phaser.GameObjects.Container;
  private sprites: { s: Phaser.GameObjects.Sprite; def: ActorDef }[] = [];
  private maskG: Phaser.GameObjects.Graphics;
  private lockG: Phaser.GameObjects.Graphics;
  private info: Phaser.GameObjects.Container;
  private badge?: Phaser.GameObjects.Container;
  private blinkers: PixelText[] = [];
  private scroll = 0;
  private t = 0;
  private flashUntil = 0;
  private readonly tw: number;
  private readonly cropTop: number;

  constructor(private scene: Phaser.Scene, readonly entry: StageSelectEntry, box: CardBox) {
    this.box = box;
    this.locked = !entry.unlocked;
    const { w, thumbH } = box;
    this.tw = w - 10;
    this.cropTop = Math.max(0, Math.min(124, FEET_SCENE - (thumbH - 7)));
    this.root = scene.add.container(box.x, box.y).setDepth(100);
    this.glow = scene.add.graphics();
    this.frame = scene.add.graphics();
    this.root.add([this.frame, this.glow]);

    // ─── 絵(背景を切り出して、人を立たせる)───
    const tx = 5, ty = 5, tw = this.tw;
    const bg = entry.def.bg;
    const far = scene.add.tileSprite(tx, ty, tw, thumbH, bg.far).setOrigin(0);
    far.tilePositionY = this.cropTop;
    const wallH = Math.max(0, Math.min(thumbH, 130 - this.cropTop));
    const wall = scene.add.tileSprite(tx, ty, tw, Math.max(1, wallH), bg.wall).setOrigin(0).setVisible(wallH > 0);
    wall.tilePositionY = this.cropTop;
    const gTop = 124 - this.cropTop;
    const ground = scene.add.tileSprite(tx, ty + gTop, tw, Math.max(1, thumbH - gTop), bg.ground).setOrigin(0);
    this.layers = [far, wall, ground];
    this.root.add(this.layers);

    this.actors = scene.add.container(tx, ty);
    const feet = thumbH - 7;
    for (const a of actorsFor(entry)) {
      const x = a.x < 0 ? tw + a.x : Math.round(tw * a.x);
      const key = a.color !== undefined ? accessorySheet(scene, a.key, a.color) : a.key;
      const s = scene.add.sprite(x, a.anim ? feet : feet + 3, key, a.frame ?? 0).setOrigin(...originFor(a.key)).setFlipX(!!a.flip);
      if (a.anim) s.play({ key: animKey(key, a.anim), startFrame: Math.floor(Math.random() * 2) });
      this.actors.add(s);
      this.sprites.push({ s, def: a });
    }
    this.root.add(this.actors);
    // 絵の外にはみ出さない(ボスの頭など)
    this.maskG = scene.make.graphics({}, false);
    this.drawMask();
    this.actors.setMask(this.maskG.createGeometryMask());

    // 絵の上の札:STAGE1
    const tag = scene.add.container(tx + 2, ty + 2);
    const tagText = new PixelText(scene, 4, 2, `STAGE${entry.def.no}`, { size: FS.body, color: UI.gold });
    const tg = scene.add.graphics();
    tg.fillStyle(0x000000, 1).fillRect(0, 0, Math.ceil(tagText.width) + 8, 16);
    tg.fillStyle(UI.bad, 1).fillRect(0, 15, Math.ceil(tagText.width) + 8, 1);
    tag.add([tg, tagText]);
    this.root.add(tag);

    // 鍵(絵の真ん中に大きく)
    this.lockG = scene.add.graphics();
    this.root.add(this.lockG);

    // ─── 下:名前と記録 ───
    this.info = scene.add.container(0, 0);
    this.root.add(this.info);
    this.applyLocked();
  }

  /** 開いているか(見た目も合わせる) */
  private applyLocked(): void {
    const locked = this.locked;
    this.drawFrame(false);
    for (const l of this.layers) {
      if (locked) l.setTint(0x2c2848); else l.clearTint();
    }
    for (const { s, def } of this.sprites) {
      if (def.hero) s.setVisible(!locked);
      if (locked) s.setTintFill(0x07060e); else s.clearTint();
    }
    this.lockG.clear();
    if (locked) drawLock(this.lockG, 5 + Math.floor(this.tw / 2), 5 + Math.floor(this.box.thumbH / 2) - 4, 3);
    this.buildInfo();
  }

  private drawMask(): void {
    const g = this.maskG;
    g.clear();
    g.fillStyle(0xffffff, 1).fillRect(this.root.x + 5, this.root.y + 5, this.tw, this.box.thumbH);
  }

  /** ふちを描く。lit は選んだときの白い光 */
  private drawFrame(lit: boolean): void {
    const { w, h, thumbH } = this.box;
    const g = this.frame;
    g.clear();
    const edge = lit ? 0xffffff : this.locked ? 0x5a5478 : UI.gold;
    const inner = lit ? 0xffffff : this.locked ? 0x2a2640 : UI.bad;
    const body = this.locked ? 0x100e1e : UI.winFill;
    g.fillStyle(0x000000, 1).fillRect(1, 0, w - 2, h).fillRect(0, 1, w, h - 2);
    g.fillStyle(edge, 1).fillRect(2, 1, w - 4, h - 2).fillRect(1, 2, w - 2, h - 4);
    g.fillStyle(inner, 1).fillRect(2, 2, w - 4, h - 4);
    g.fillStyle(body, 1).fillRect(3, 3, w - 6, h - 6);
    // 絵のまわりの黒い線
    g.fillStyle(0x000000, 1).fillRect(4, 4, this.tw + 2, thumbH + 2);
    // 情報の欄の横線(走査線ふう)
    g.fillStyle(this.locked ? 0x16142a : 0x121c56, 1);
    for (let y = thumbH + 8; y < h - 4; y += 3) g.fillRect(4, y, w - 8, 1);
  }

  private buildInfo(): void {
    const sc = this.scene;
    this.info.removeAll(true);
    this.blinkers = [];
    const { w, thumbH } = this.box;
    const e = this.entry;
    const y0 = thumbH + 9;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.info.add(o); return o; };
    const nameText = add(new PixelText(sc, 8, y0, e.def.name, { size: FS.big, color: this.locked ? 0x8a84a0 : UI.gold, outline: true }));
    const r1 = y0 + 20, r2 = r1 + 15;
    if (this.locked) {
      const g = add(sc.add.graphics());
      drawLock(g, 14, r1 + 6, 1);
      add(new PixelText(sc, 24, r1, e.def.lockedText ?? '', { size: FS.body, color: UI.text }));
      add(new PixelText(sc, 24, r2, `${e.def.unlockAfter ? STAGES[e.def.unlockAfter].name : ''}のボスを倒せばクリア`, { size: FS.body, color: UI.textDim }));
      return;
    }
    const total = titlesFor(e.id).length;
    // このステージで取れる称号のうち、いくつ取ったか(タイトルと結果画面の「称号2/14」は全部のステージを合わせた数)
    const cnt = add(new PixelText(sc, w - 8, y0 + 3, `このステージの称号{gold}${e.titlesCollected}{/}/${total}`, { size: FS.body, color: UI.textDim, outline: true }).setOrigin(1, 0));
    // ステージの名前とぶつかるときは、絵の右下に黒い帯をしいて出す
    if (8 + nameText.width + 6 > w - 8 - cnt.width) {
      const bx = 5 + this.tw - Math.ceil(cnt.width) - 6, by = 5 + thumbH - 15;
      const bg = add(sc.add.graphics());
      bg.fillStyle(0x000000, 1).fillRect(bx, by, Math.ceil(cnt.width) + 6, 15);
      bg.fillStyle(UI.gold, 1).fillRect(bx, by, 1, 15);
      cnt.setPosition(5 + this.tw - 3, by + 2);
      this.info.bringToTop(cnt);
    }
    // 下に余裕があれば「タップで出発」
    if (this.box.h - (thumbH + 9 + 20 + 30) >= 16) {
      const go = add(new PixelText(sc, w - 8, this.box.h - 19, 'タップで出発▶', { size: FS.body, color: UI.gold, outline: true }).setOrigin(1, 0));
      this.blinkers.push(go);
    }
    const rec = e.record;
    if (!rec) {
      add(new PixelText(sc, 8, r1, 'まだ遊んでいない', { size: FS.body, color: UI.textDim }));
      return;
    }
    const n = (v: number | null, unit: string): string => (v === null ? '-' : `{gold}${v}{/}${unit}`);
    add(new PixelText(sc, 8, r1, `最多撃破${n(rec.mostDefeated, '人')}`, { size: FS.body, color: UI.text }));
    add(new PixelText(sc, w - 8, r1, `最少負傷${n(rec.fewestHurt, '人')}`, { size: FS.body, color: UI.text }).setOrigin(1, 0));
    const dmg = add(new PixelText(sc, 8, r2, `最高被害額${rec.highestDamage === null ? '-' : `{gold}${formatYen(rec.highestDamage)}{/}`}`, { size: FS.body, color: UI.text }));
    if (rec.fastestBossSec !== null) {
      const boss = add(new PixelText(sc, w - 8, r2, `ボス戦{gold}${rec.fastestBossSec.toFixed(1)}{/}秒`, { size: FS.body, color: UI.text }).setOrigin(1, 0));
      // 金額が長くてぶつかるときは、ボス戦の秒数を出さない
      if (8 + dmg.width + 6 > w - 8 - boss.width) boss.setVisible(false);
    }
  }

  /** NEW などの札を絵の右上に出す(色が点滅する) */
  setBadge(text: string | null, color: number = UI.bad): void {
    this.badge?.destroy();
    this.badge = undefined;
    if (!text) return;
    const sc = this.scene;
    const c = sc.add.container(0, 0);
    const t = new PixelText(sc, 5, 2, text, { size: FS.body, color: 0xffffff, outline: true });
    const bw = Math.ceil(t.width) + 10;
    const g = sc.add.graphics();
    const draw = (on: boolean): void => {
      g.clear();
      g.fillStyle(0x000000, 1).fillRect(-1, -1, bw + 2, 18);
      g.fillStyle(on ? 0xffffff : UI.gold, 1).fillRect(0, 0, bw, 16);
      g.fillStyle(on ? color : 0x000000, 1).fillRect(1, 1, bw - 2, 14);
    };
    draw(true);
    c.add([g, t]);
    c.setPosition(this.box.w - bw - 8, 7);
    c.setData('draw', draw);
    this.root.add(c);
    this.badge = c;
  }

  contains(x: number, y: number): boolean {
    return x >= this.root.x && x < this.root.x + this.box.w && y >= this.root.y && y < this.root.y + this.box.h;
  }

  update(dt: number): void {
    this.t += dt;
    // 背景を少しずつ流す(遠くはゆっくり)。整数で動かして、ドットがにじまないように
    if (!this.locked) this.scroll += dt * 0.012;
    const sx = Math.floor(this.scroll);
    this.layers[0].tilePositionX = Math.floor(sx / 4);
    this.layers[1].tilePositionX = sx;
    this.layers[2].tilePositionX = sx;
    this.drawMask();
    for (const b of this.blinkers) b.setVisible(Math.floor(this.t / 400) % 2 === 0);
    if (this.badge) {
      const on = Math.floor(this.t / 250) % 3 !== 2;
      if (this.badge.getData('on') !== on) { this.badge.setData('on', on); (this.badge.getData('draw') as (v: boolean) => void)(on); }
    }
    // 選べるカードのふちで、光が1周まわる
    const g = this.glow;
    g.clear();
    const lit = this.scene.time.now < this.flashUntil;
    if (lit) { this.drawFrame(Math.floor(this.t / 50) % 2 === 0); return; }
    if (this.locked) return;
    const { w, h } = this.box;
    const per = 2 * (w + h);
    // 反対側からもう1つ。2つの光がふちを追いかけっこする
    for (const off of [0, per / 2]) {
      const p = Math.floor((this.t * 0.22 + off) % per);
      for (let k = 0; k < 8; k++) {
        const q = (p - k * 4 + per) % per;
        let x: number, y: number;
        if (q < w) { x = q; y = 1; } else if (q < w + h) { x = w - 2; y = q - w; } else if (q < 2 * w + h) { x = w - (q - w - h); y = h - 2; } else { x = 1; y = h - (q - 2 * w - h); }
        const sz = k < 2 ? 3 : 2;
        g.fillStyle(k === 0 ? 0xffffff : k < 4 ? 0xfff2b8 : 0xff8a50, 1).fillRect(Math.round(x) - 1, Math.round(y) - 1, sz, sz);
      }
    }
  }

  /** 選んだとき:ふちが白く点滅して、ヒーローが右へ走り出す */
  pressed(): void {
    this.flashUntil = this.scene.time.now + 420;
    const hero = this.sprites.find((a) => a.def.hero)?.s;
    if (hero) {
      hero.play(animKey('hero', 'run'));
      this.scene.tweens.add({ targets: hero, x: this.tw + 40, duration: 420, ease: 'Quad.easeIn', onUpdate: () => { hero.x = Math.round(hero.x); } });
    }
    for (const { s, def } of this.sprites) {
      if (def.hero || !def.anim || !def.key.includes('_')) continue;
      if (this.scene.anims.exists(animKey(s.texture.key, 'surprised'))) s.play(animKey(s.texture.key, 'surprised'));
    }
    this.scene.tweens.add({ targets: this.root, y: this.box.y - 3, duration: 60, yoyo: true, ease: 'Stepped' });
  }

  /** 開いていないカードをタップしたとき:鍵がガタガタ揺れる */
  shakeLock(): void {
    const base = 0;
    let n = 0;
    this.scene.time.addEvent({
      delay: 40, repeat: 7, callback: () => {
        n++;
        this.lockG.x = n % 2 === 0 ? base - 2 : base + 2;
        if (n >= 8) this.lockG.x = base;
      }
    });
  }

  /** 鍵がこわれて開く。こわれた瞬間に onBreak を呼ぶ */
  unlock(onBreak: (x: number, y: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let n = 0;
      this.scene.time.addEvent({
        delay: 50, repeat: 11, callback: () => {
          n++;
          this.lockG.x = n % 2 === 0 ? -2 : 2;
          this.lockG.y = n % 4 < 2 ? 0 : -1;
          if (n < 12) return;
          this.lockG.setPosition(0, 0);
          this.locked = false;
          this.applyLocked();
          this.flashUntil = this.scene.time.now + 300;
          onBreak(this.root.x + 5 + Math.floor(this.tw / 2), this.root.y + 5 + Math.floor(this.box.thumbH / 2));
          resolve();
        }
      });
    });
  }

  /** 開いていない見た目にもどす(開く演出の前) */
  setLockedLook(on: boolean): void {
    this.locked = on;
    this.applyLocked();
  }
}
