// ステージ4(高層ビル)のボス戦の演出。決まりは docs/STAGE4.md の「ボス戦」「念力の選択」「倒したとき」。
// 数え方(3秒、押したか、被害額)は logic の PsyChoice と applyChoice。ここは見た目だけ。
//
// - ChoiceStage:天井のシャンデリア(はじめから下がっている)と、念力で浮かせる客。
//     start(客の絵) → 客が親玉の左上へ、シャンデリアがヒーローの真上へ浮く。showMarks() で待てと行けのマーク。
//     lowerGuest()(待て)/ dropGuest()(押さなかった)、pushBack(hero)(行け)/ fall()(押さなかった)
// - WindowCracks:手が止まっている間、親玉が念力で皿やグラスを窓へ投げる。当たった所にひびを描く
// - furnitureOut:親玉を市民に仕分けていたとき、ボス戦の始まりに家具が浮いて窓の外へ飛んでいく(見た目だけ)
// 半透明は使わない。「光と揺れを弱くする」(settings.reduceFx)では、紫の火花を動かさず1コマ目で止める。

import Phaser from 'phaser';
import { animKey, frameIndex, originFor, sheetByKey } from '../../art/sheets';
import { audio } from '../../audio';
import { settings } from '../../settings';
import { waitMs } from '../../ui';
import { DEPTH_OF } from './depth';
import { spawnFx, throwDebris } from './effects';

/**
 * シャンデリアを下げる高さ(絵の上の真ん中)。上の体力のバー(y=26〜34)にかからないよう、バーの下に下げて、
 * 天井(CEILING_Y)からは鎖でつるす
 */
export const CHANDELIER_HANG_Y = 36;
/** 念力で浮かせたシャンデリアの高さ(絵の上の端。ヒーローの頭の上に下の端が来る) */
export const CHANDELIER_FLOAT_Y = 58;
/** 鎖をつるす天井の高さ */
const CEILING_Y = 6;
/** 鎖の色(明るい金と暗い金) */
const CHAIN = [0xd8a030, 0x7a4a10] as const;
/** シャンデリアの絵の高さ */
const CHANDELIER_H = 34;
/** 浮かせた客の足の位置(親玉の左上) */
const GUEST_DX = -30;
const GUEST_FEET_Y = 118;
/** マークの真ん中の、頭の上からの高さ(客は足から、シャンデリアは上の端から) */
const GUEST_MARK_DY = -72;
const CHANDELIER_MARK_DY = -12;
/** 窓のガラスの色(ひび) */
const GLASS = 0xdff2ff;
const GLASS_DARK = 0x8fb4d8;
/** 窓の上と下の端(壁の絵の、ガラスの見えるところ) */
const WINDOW_TOP = 16;
const WINDOW_BOTTOM = 100;
/** 壁の絵(bg_party_wall)のくり返しの幅と、カーテンのある横の範囲(絵の中の x) */
const WALL_PERIOD = 216;
const CURTAIN_X0 = 76;
const CURTAIN_X1 = 140;

/** 天井(CEILING_Y)から bottomY まで、シャンデリアの鎖を描く(x は鎖の真ん中) */
export function drawChain(g: Phaser.GameObjects.Graphics, x: number, bottomY: number): void {
  const x0 = Math.round(x) - 1;
  for (let y = CEILING_Y; y < Math.round(bottomY) + 1; y++) g.fillStyle(CHAIN[(y >> 1) % 2], 1).fillRect(x0, y, 2, 1);
}

/** 画面の x の窓が、カーテンの陰でないか(wallScroll は壁の絵のずらし量) */
export function windowSpotOk(x: number, wallScroll: number): boolean {
  const ix = (((Math.round(x + wallScroll)) % WALL_PERIOD) + WALL_PERIOD) % WALL_PERIOD;
  return ix < CURTAIN_X0 || ix > CURTAIN_X1;
}

/** 紫の火花を1つ置く(くり返し)。reduceFx なら止めたまま */
function psySpark(scene: Phaser.Scene, x: number, y: number, depth: number): Phaser.GameObjects.Sprite {
  const s = scene.add.sprite(Math.round(x), Math.round(y), 'fx_psy_spark', 0).setDepth(depth);
  const key = animKey('fx_psy_spark', 'play');
  if (!settings.reduceFx && scene.anims.exists(key)) s.play({ key, startFrame: Phaser.Math.Between(0, 3) });
  return s;
}

/** 念力の選択で浮かせる物(客とシャンデリア)と、そのまわりの紫の火花 */
export class ChoiceStage {
  readonly chandelier: Phaser.GameObjects.Sprite;
  private guest: Phaser.GameObjects.Sprite | null = null;
  private guestKey = '';
  private sparks: { s: Phaser.GameObjects.Sprite; of: 'guest' | 'chandelier'; dx: number; dy: number }[] = [];
  private marks: { stop: Phaser.GameObjects.Sprite | null; go: Phaser.GameObjects.Sprite | null } = { stop: null, go: null };
  /** 念力で浮いている間だけ、ゆらゆら揺らす */
  private floating = { guest: false, chandelier: false };
  private baseY = { guest: GUEST_FEET_Y, chandelier: CHANDELIER_HANG_Y };
  private cracks: Phaser.GameObjects.Graphics | null = null;
  /** 天井からの鎖(天井につるしている間だけ見せる) */
  private chain: Phaser.GameObjects.Graphics;
  private hanging = true;

  constructor(private scene: Phaser.Scene, heroX: number, private bossX: number, private feetY: number) {
    // シャンデリアははじめから天井に下がっている(パーティ会場の飾り)
    this.chandelier = scene.add.sprite(heroX, CHANDELIER_HANG_Y, 'prop_chandelier', 0)
      .setOrigin(...originFor('prop_chandelier')).setDepth(DEPTH_OF.propBack - 0.5);
    this.chain = scene.add.graphics().setDepth(DEPTH_OF.propBack - 0.6);
    this.drawChain();
  }

  /** 鎖(2ドットの幅で、明るい金と暗い金の輪を交互に) */
  private drawChain(): void {
    const g = this.chain.clear();
    if (this.hanging) drawChain(g, this.chandelier.x, this.chandelier.y);
  }

  /** 浮かせる客の足の x */
  get guestX(): number { return this.bossX + GUEST_DX; }

  /**
   * 親玉が客とシャンデリアをいっしょに浮かせる(0.55秒)。客は親玉のうしろから浮き上がって左上へ、
   * シャンデリアは天井から離れてヒーローの真上へ下りてくる
   */
  async start(guestKey: string): Promise<void> {
    const sc = this.scene;
    this.guestKey = guestKey;
    const g = sc.add.sprite(this.bossX - 8, this.feetY - 2, guestKey, this.frame(guestKey, 'surprised'))
      .setOrigin(...originFor(guestKey)).setDepth(DEPTH_OF.boss - 0.5);
    this.guest = g;
    this.chandelier.setFrame(1);
    // 鎖が切れて、シャンデリアが念力で浮く
    this.hanging = false;
    this.drawChain();
    audio.sfx('psy');
    sc.tweens.add({ targets: g, x: this.guestX, y: GUEST_FEET_Y, duration: 550, ease: 'Sine.easeOut', onUpdate: () => { g.x = Math.round(g.x); g.y = Math.round(g.y); } });
    sc.tweens.add({ targets: this.chandelier, y: CHANDELIER_FLOAT_Y, duration: 550, ease: 'Sine.easeInOut', onUpdate: () => { this.chandelier.y = Math.round(this.chandelier.y); } });
    this.jiggle(this.chandelier);
    await waitMs(sc, 550);
    if (!sc.sys.isActive()) return;
    this.baseY = { guest: GUEST_FEET_Y, chandelier: CHANDELIER_FLOAT_Y };
    this.floating = { guest: true, chandelier: true };
    // 紫の火花:客の手足のまわりと、シャンデリアのふち
    for (const [dx, dy] of [[-12, -40], [12, -30], [-6, -8], [10, -54]] as const) {
      this.sparks.push({ s: psySpark(sc, 0, 0, DEPTH_OF.boss - 0.4), of: 'guest', dx, dy });
    }
    for (const [dx, dy] of [[-26, 10], [26, 12], [-14, 30], [16, 32]] as const) {
      this.sparks.push({ s: psySpark(sc, 0, 0, DEPTH_OF.propBack), of: 'chandelier', dx, dy });
    }
    this.update(sc.time.now);
  }

  /** 毎フレーム:浮いている物をゆらし、火花とマークをついて行かせる */
  update(now: number): void {
    const bob = Math.round(Math.sin(now / 260) * 1.5);
    const g = this.guest;
    if (g && this.floating.guest) g.y = this.baseY.guest + bob;
    if (this.floating.chandelier) this.chandelier.y = this.baseY.chandelier - bob;
    for (const sp of this.sparks) {
      const o = sp.of === 'guest' ? g : this.chandelier;
      if (!o) continue;
      sp.s.setPosition(Math.round(o.x + sp.dx), Math.round(o.y + sp.dy));
    }
    if (g && this.marks.stop) this.marks.stop.setPosition(g.x, g.y + GUEST_MARK_DY);
    if (this.marks.go) this.marks.go.setPosition(this.chandelier.x, this.chandelier.y + CHANDELIER_MARK_DY);
  }

  /** 客の上に待て、シャンデリアの上に行けのマーク(2倍の大きさ) */
  showMarks(): void {
    const sc = this.scene;
    const mk = (key: string): Phaser.GameObjects.Sprite => {
      const s = sc.add.sprite(0, 0, key, 0).setScale(2).setDepth(DEPTH_OF.fxTop);
      const a = animKey(key, 'play');
      if (sc.anims.exists(a)) s.play(a);
      return s;
    };
    if (this.guest) this.marks.stop = mk('fx_mark_stop');
    this.marks.go = mk('fx_mark_go');
    this.update(sc.time.now);
  }

  /** マークを消す(which を省くと両方) */
  hideMark(which?: 'stop' | 'go'): void {
    for (const k of which ? [which] : (['stop', 'go'] as const)) {
      this.marks[k]?.destroy();
      this.marks[k] = null;
    }
  }

  private stopSparks(of: 'guest' | 'chandelier'): void {
    this.sparks = this.sparks.filter((sp) => {
      if (sp.of !== of) return true;
      sp.s.destroy();
      return false;
    });
  }

  /** 待て:客がゆっくり床に下りて、会場の外(左)へ逃げていく */
  lowerGuest(): void {
    const g = this.guest;
    if (!g) return;
    const sc = this.scene;
    this.hideMark('stop');
    this.floating.guest = false;
    this.stopSparks('guest');
    audio.sfx('psy', { pitch: 0.8, volume: 0.6 });
    sc.tweens.add({
      targets: g, y: this.feetY - 6, duration: 800, ease: 'Sine.easeInOut',
      onUpdate: () => { g.y = Math.round(g.y); },
      onComplete: () => {
        if (!g.active) return;
        spawnFx(sc, 'fx_dust', g.x, this.feetY - 10, { depth: DEPTH_OF.boss - 0.4 });
        // 左向きに歩いて逃げる(絵は右向き)
        g.setFlipX(true);
        const walk = animKey(this.guestKey, 'walk');
        if (sc.anims.exists(walk)) { g.play(walk); g.anims.timeScale = 1.6; }
        sc.tweens.add({
          targets: g, x: -40, duration: 1700, ease: 'Linear',
          onUpdate: () => { g.x = Math.round(g.x); },
          onComplete: () => g.destroy()
        });
      }
    });
    this.guest = null;
  }

  /** 押さなかった(客):客が床に落ちて、のびる。少しして点滅して消える */
  dropGuest(): void {
    const g = this.guest;
    if (!g) return;
    const sc = this.scene;
    this.hideMark('stop');
    this.floating.guest = false;
    this.stopSparks('guest');
    const knocked = animKey(this.guestKey, 'knocked');
    if (sc.anims.exists(knocked)) g.play(knocked);
    sc.tweens.add({
      targets: g, y: this.feetY - 4, duration: 260, ease: 'Quad.easeIn',
      onUpdate: () => { g.y = Math.round(g.y); },
      onComplete: () => {
        if (!g.active) return;
        g.anims.stop();
        g.setFrame(this.frame(this.guestKey, 'down'));
        audio.sfx('hit', { pitch: 0.7 });
        spawnFx(sc, 'fx_dust', g.x - 8, this.feetY - 8, { depth: DEPTH_OF.boss - 0.4 });
        const stars = sc.add.sprite(g.x + 10, this.feetY - 22, 'fx_stars', 0).setDepth(DEPTH_OF.boss - 0.3);
        const a = animKey('fx_stars', 'play');
        if (sc.anims.exists(a)) stars.play(a);
        sc.time.delayedCall(1600, () => {
          let n = 0;
          const ev = sc.time.addEvent({
            delay: 70, repeat: 9, callback: () => {
              n++;
              g.setVisible(n % 2 === 0); stars.setVisible(n % 2 === 0);
              if (ev.getRepeatCount() === 0) { g.destroy(); stars.destroy(); }
            }
          });
        });
      }
    });
    this.guest = null;
  }

  /** 行け:ヒーローが跳んでシャンデリアを天井へ押し返す(0.6秒)。ヒーローは足の位置 heroFeet に戻る */
  async pushBack(hero: Phaser.GameObjects.Sprite, heroFeet: number): Promise<void> {
    const sc = this.scene;
    this.hideMark('go');
    this.floating.chandelier = false;
    this.stopSparks('chandelier');
    const up = animKey('hero', 'uppercut');
    if (sc.anims.exists(up)) { hero.play(up); hero.anims.timeScale = 1; }
    audio.sfx('charge', { pitch: 1.3, volume: 0.6 });
    spawnFx(sc, 'fx_dust', hero.x, heroFeet - 8);
    // 拳がシャンデリアの下の端に届く高さまで跳ぶ
    const topY = this.chandelier.y + CHANDELIER_H + 58;
    await this.tweenY(hero, topY, 200, 'Quad.easeOut');
    if (!sc.sys.isActive()) return;
    spawnFx(sc, 'fx_hit_big', this.chandelier.x, this.chandelier.y + CHANDELIER_H - 4, { depth: DEPTH_OF.fxTop });
    audio.sfx('bigHit', { pitch: 1.2, volume: 0.7 });
    this.chandelier.setFrame(0);
    sc.tweens.add({
      targets: this.chandelier, y: CHANDELIER_HANG_Y, duration: 260, ease: 'Back.easeOut',
      onUpdate: () => { this.chandelier.y = Math.round(this.chandelier.y); },
      // 天井の鎖にかけ直す
      onComplete: () => { this.hanging = true; this.drawChain(); }
    });
    await this.tweenY(hero, heroFeet, 260, 'Quad.easeIn');
    this.jiggle(this.chandelier);
  }

  /** 押さなかった(シャンデリア):ヒーローの前に落ちて割れ、床にひびが入る */
  async fall(): Promise<void> {
    const sc = this.scene;
    this.hideMark('go');
    this.floating.chandelier = false;
    this.stopSparks('chandelier');
    const c = this.chandelier;
    const floorY = this.feetY + 3 - CHANDELIER_H;
    await this.tweenY(c, floorY, 300, 'Quad.easeIn');
    if (!sc.sys.isActive()) return;
    // 割れたシャンデリアはヒーローの足もとに散らばる(ヒーローより手前に描いて、隠れないようにする)
    c.setFrame(2).setDepth(DEPTH_OF.hero + 0.5);
    audio.sfx('smash');
    this.crackFloor(c.x, this.feetY);
    for (const dx of [-24, 0, 24]) spawnFx(sc, 'fx_dust', c.x + dx, this.feetY - 6, { depth: DEPTH_OF.prop + 0.5 });
    for (let i = 0; i < 8; i++) throwDebris(sc, c.x, this.feetY - 8, Phaser.Math.Between(-60, 60), Phaser.Math.Between(-10, 20), 480);
  }

  /** 床のひび(シャンデリアの落ちた所から、左右にぎざぎざに走る) */
  private crackFloor(x: number, y: number): void {
    const g = this.cracks ?? this.scene.add.graphics().setDepth(DEPTH_OF.scorch);
    this.cracks = g;
    const dark = 0x1a0a10;
    // 落ちたところは割れて穴があく
    g.fillStyle(dark, 1).fillRect(x - 18, y - 2, 36, 5).fillRect(x - 12, y - 4, 24, 9);
    for (const dir of [-1, 1]) {
      let cx = x + dir * 16, cy = y;
      for (let i = 0; i < 14; i++) {
        cx += dir * Phaser.Math.Between(1, 3);
        cy += Phaser.Math.Between(-1, 1);
        g.fillStyle(dark, 1).fillRect(Math.round(cx), Math.round(cy), 2, 1);
        if (i % 5 === 3) g.fillRect(Math.round(cx), Math.round(cy) + 1, 1, 2);
      }
    }
  }

  private tweenY(o: Phaser.GameObjects.Sprite, y: number, ms: number, ease: string): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: o, y, duration: ms, ease,
        onUpdate: () => { o.y = Math.round(o.y); },
        onComplete: () => resolve()
      });
    });
  }

  /** 左右に少しゆらす(持ち上がった瞬間、天井にもどった瞬間) */
  private jiggle(o: Phaser.GameObjects.Sprite): void {
    const x0 = o.x;
    this.scene.tweens.add({ targets: o, x: x0 + 2, duration: 60, yoyo: true, repeat: 2, onUpdate: () => { o.x = Math.round(o.x); }, onComplete: () => { o.x = x0; } });
  }

  private frame(key: string, row: string): number {
    const def = sheetByKey(key);
    return def.rows.some((r) => r.name === row) ? frameIndex(def, row, 0) : 0;
  }

  destroy(): void {
    for (const sp of this.sparks) sp.s.destroy();
    this.sparks = [];
    this.hideMark();
  }
}

/** 窓のひび。当たった所に描く(同じ所には描かない。数に上限あり) */
export class WindowCracks {
  private g: Phaser.GameObjects.Graphics;
  private spots: { x: number; y: number }[];
  private next = 0;

  constructor(private scene: Phaser.Scene, wallScroll: number) {
    this.g = scene.add.graphics().setDepth(DEPTH_OF.wall + 0.5);
    // 窓のガラスの見える所(カーテンの陰を除く)を、親玉に近い右から順に
    const cand = [
      { x: 196, y: 40 }, { x: 176, y: 70 }, { x: 206, y: 84 }, { x: 160, y: 30 }, { x: 34, y: 42 }, { x: 18, y: 74 },
      { x: 58, y: 64 }, { x: 146, y: 88 }, { x: 44, y: 26 }, { x: 122, y: 50 }, { x: 100, y: 34 }, { x: 70, y: 86 }
    ];
    this.spots = cand.filter((p) => windowSpotOk(p.x - 6, wallScroll) && windowSpotOk(p.x + 6, wallScroll));
    if (this.spots.length === 0) this.spots = cand;
  }

  /** 窓のひびの場所の表の i 番目(カーテンの陰でない所) */
  spotAt(i: number): { x: number; y: number } {
    return this.spots[i % this.spots.length];
  }

  /**
   * 親玉の手 (fromX, fromY) から皿かグラスを窓へ投げる。当たったら窓にひびを描いて onHit(当たった所)。
   * 窓のひびの数が上限をこえたら、同じ所にもう一度当てる
   */
  throwDish(fromX: number, fromY: number, onHit: (at: { x: number; y: number }) => void): void {
    const sc = this.scene;
    const at = this.spots[this.next % this.spots.length];
    const fresh = this.next < this.spots.length;
    this.next++;
    // グラスとマグカップを交互に
    const item = sc.add.sprite(Math.round(fromX), Math.round(fromY), 'fx_psy_items', this.next % 2 === 0 ? 3 : 2).setDepth(DEPTH_OF.fx);
    audio.sfx('psy', { pitch: 1.3, volume: 0.4 });
    const x0 = fromX, y0 = fromY;
    sc.tweens.addCounter({
      from: 0, to: 1, duration: 240, ease: 'Linear',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        item.x = Math.round(x0 + (at.x - x0) * t);
        item.y = Math.round(y0 + (at.y - y0) * t - 20 * 4 * t * (1 - t));
        item.angle = Math.floor(t * 8) * 45;
      },
      onComplete: () => {
        item.destroy();
        if (!sc.sys.isActive()) return;
        if (fresh) this.crack(at.x, at.y);
        audio.sfx('break', { pitch: 1.1 + Math.random() * 0.2 });
        spawnFx(sc, 'fx_hit', at.x, at.y, { depth: DEPTH_OF.fxTop });
        for (let i = 0; i < 3; i++) this.shard(at.x, at.y);
        onHit(at);
      }
    });
  }

  /** ガラスの割れたかけらが床へ落ちる */
  private shard(x: number, y: number): void {
    const sc = this.scene;
    const s = sc.add.rectangle(x, y, 2, 2, Math.random() < 0.5 ? GLASS : GLASS_DARK).setOrigin(0).setDepth(DEPTH_OF.fxTop);
    sc.tweens.add({
      targets: s, y: Phaser.Math.Between(150, 190), x: x + Phaser.Math.Between(-14, 14), duration: Phaser.Math.Between(420, 640), ease: 'Quad.easeIn',
      onUpdate: () => { s.x = Math.round(s.x); s.y = Math.round(s.y); }, onComplete: () => s.destroy()
    });
  }

  /** (x, y) を真ん中に、放射状のひびを描く */
  crack(x: number, y: number): void {
    const g = this.g;
    g.fillStyle(GLASS, 1).fillRect(x - 1, y - 1, 3, 3);
    const dirs: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
    dirs.forEach(([dx, dy], i) => {
      if (i % 3 === 1 && Math.random() < 0.5) return;
      const len = Phaser.Math.Between(4, 9);
      for (let k = 2; k <= len; k++) {
        const jx = k > 4 && (k + i) % 3 === 0 ? dy : 0, jy = k > 4 && (k + i) % 3 === 0 ? -dx : 0;
        const px = Math.round(x + dx * k + jx), py = Math.round(y + dy * k + jy);
        if (py < WINDOW_TOP || py > WINDOW_BOTTOM) break;
        g.fillStyle(k % 2 === 0 ? GLASS : GLASS_DARK, 1).fillRect(px, py, 1, 1);
      }
    });
  }
}

/**
 * 親玉を市民に仕分けていたとき:正体を現した親玉が、会場の家具を念力で浮かせて窓の外へ投げる。
 * 見た目だけ(被害額は結果発表で数え済み)。家具は窓を割って外へ出ると、壁より奥になって小さくなり、落ちていく
 */
export async function furnitureOut(scene: Phaser.Scene, cracks: WindowCracks, feetY: number): Promise<void> {
  // 会場の小さなテーブル、観葉植物、テーブルの上のキャンドル(ソファとピアノは置いたまま)
  // 飛んでいく先は、カーテンの陰でない窓(窓のひびの場所の表から)
  const items: { key: string; frame: number; x: number; to: { x: number; y: number } }[] = [
    { key: 'tw_desk', frame: 0, x: 116, to: cracks.spotAt(4) },
    { key: 'prop_plant', frame: 0, x: 60, to: cracks.spotAt(3) },
    { key: 'fx_psy_items', frame: 5, x: 180, to: cracks.spotAt(0) }
  ];
  audio.sfx('psy');
  items.forEach((it, i) => scene.time.delayedCall(i * 220, () => {
    if (!scene.sys.isActive()) return;
    const s = scene.add.sprite(it.x, feetY - 4, it.key, it.frame).setOrigin(0.5, 1).setDepth(DEPTH_OF.fx);
    const spark = psySpark(scene, it.x, feetY - 10, DEPTH_OF.fx + 0.1);
    const y0 = feetY - 4;
    // 浮き上がる(0.4秒)→ 窓へ飛ぶ(0.35秒)→ 窓を割って外へ落ちる(0.5秒)
    scene.tweens.addCounter({
      from: 0, to: 1, duration: 400, ease: 'Sine.easeOut',
      onUpdate: (tw) => { const t = tw.getValue() ?? 0; s.y = Math.round(y0 - 34 * t); spark.setPosition(s.x, s.y - 6); },
      onComplete: () => {
        spark.destroy();
        const x1 = s.x, y1 = s.y;
        scene.tweens.addCounter({
          from: 0, to: 1, duration: 350, ease: 'Quad.easeIn',
          onUpdate: (tw) => {
            const t = tw.getValue() ?? 0;
            s.x = Math.round(x1 + (it.to.x - x1) * t);
            s.y = Math.round(y1 + (it.to.y - y1) * t);
            s.angle = Math.floor(t * 4) * 45;
          },
          onComplete: () => {
            cracks.crack(it.to.x, it.to.y);
            audio.sfx('break');
            spawnFx(scene, 'fx_hit', it.to.x, it.to.y, { depth: DEPTH_OF.fxTop });
            // 窓の外(壁より奥)で小さくなって落ちていく
            s.setDepth(DEPTH_OF.far + 0.5).setScale(0.5);
            scene.tweens.add({
              targets: s, y: it.to.y + 60, duration: 500, ease: 'Quad.easeIn',
              onUpdate: () => { s.y = Math.round(s.y); }, onComplete: () => s.destroy()
            });
          }
        });
      }
    });
  }));
  await waitMs(scene, 2 * 220 + 400 + 350 + 300);
}
