// ステージ4の朝日。高層ビルのボスを倒すと、大きな窓の外が明るくなり、朝日が出る(docs/STAGE4.md「倒したとき」)。
// 終わりの場面(Ending)も、はじめから朝の空で使う。
//
// 奥の絵(bg_tower4_far)の夜空の部分(地平線より上)に、朝焼けの空の帯を重ねる。街の明かりは奥の絵のまま。
// 半透明は使わず、地平線から上へ1段ずつ空を塗りかえて明るくしていく。太陽は地平線で切って、下から少しずつ出す。
//   const sun = new Sunrise(scene, wallScrollX, DEPTH_OF.far + 0.3);
//   sun.start(1600);   // 1.6秒かけて朝になる。sun.showNow() ならすぐ朝

import Phaser from 'phaser';
import { layout } from '../../layout';
import { windowSpotOk } from './choice';

/** 奥の絵の地平線(街のいちばん上)。これより上を空として塗りかえる */
export const HORIZON_Y = 90;
/** 空の帯の色(上から地平線へ)。夜の紺から、紫、桃色、だいだい、黄色へ */
const SKY_BANDS = [0x2c3a86, 0x4c4a9e, 0x7a58a6, 0xb46a9c, 0xe4847e, 0xf6a86a, 0xffd48a] as const;
/** 太陽の色(ふちと真ん中) */
const SUN_RIM = 0xffd060;
const SUN_CORE = 0xfff4c8;
const SUN_R = 11;
const SKY_KEY = 'tower_sunrise_sky';
const SUN_KEY = 'tower_sunrise_sun';

/** 朝焼けの空(横 W、縦 HORIZON_Y)。帯のさかいめは市松もようで混ぜる */
function skyTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(SKY_KEY)) return SKY_KEY;
  const W = layout.W;
  const tex = scene.textures.createCanvas(SKY_KEY, W, HORIZON_Y)!;
  const ctx = tex.context;
  const n = SKY_BANDS.length;
  const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
  for (let y = 0; y < HORIZON_Y; y++) {
    // 下ほど帯を細くする(地平線の近くで色が早く変わる)
    const t = Math.pow(y / HORIZON_Y, 1.4) * n;
    const i = Math.min(n - 1, Math.floor(t));
    const f = t - i;
    for (let x = 0; x < W; x++) {
      // 帯の終わりの3割は、次の色と市松もようで混ぜる
      const mix = i < n - 1 && f > 0.7 && (x + y) % 2 === 0;
      ctx.fillStyle = hex(SKY_BANDS[mix ? i + 1 : i]);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // 薄い雲(明るい色の横線を少し)
  ctx.fillStyle = hex(0xffc8a0);
  for (const [x, y, w] of [[18, 52, 22], [26, 54, 12], [132, 44, 26], [140, 46, 14], [186, 60, 18]] as const) ctx.fillRect(x, y, w, 1);
  tex.refresh();
  return SKY_KEY;
}

/** 太陽(丸。ふちの色と真ん中の色) */
function sunTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(SUN_KEY)) return SUN_KEY;
  const d = SUN_R * 2 + 1;
  const tex = scene.textures.createCanvas(SUN_KEY, d, d)!;
  const ctx = tex.context;
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const r = Math.hypot(x - SUN_R, y - SUN_R);
      if (r > SUN_R + 0.3) continue;
      ctx.fillStyle = r > SUN_R - 2 ? '#' + SUN_RIM.toString(16) : '#' + SUN_CORE.toString(16);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  tex.refresh();
  return SUN_KEY;
}

export class Sunrise {
  private sky: Phaser.GameObjects.Image;
  private sun: Phaser.GameObjects.Image;
  private sunX: number;
  /** いま空を塗りかえた一番上の行(HORIZON_Y なら、まだ夜) */
  private top = HORIZON_Y;
  /** 太陽が地平線から出ている高さ(0〜SUN_R*2) */
  private rise = 0;

  /**
   * @param wallScroll 壁の絵のずらし量(窓のカーテンの陰にならない所に太陽を置く)
   * @param depth 奥の絵より上、壁より下
   */
  constructor(private scene: Phaser.Scene, wallScroll: number, depth: number) {
    this.sky = scene.add.image(0, 0, skyTexture(scene)).setOrigin(0).setDepth(depth).setVisible(false);
    // 太陽はカーテンの陰にならない窓の所に置く(右寄りを先に探す)
    const spots = [160, 176, 150, 40, 56, 30, 190, 108];
    this.sunX = spots.find((x) => windowSpotOk(x - SUN_R, wallScroll) && windowSpotOk(x + SUN_R, wallScroll)) ?? 160;
    this.sun = scene.add.image(this.sunX, HORIZON_Y, sunTexture(scene)).setOrigin(0.5, 0).setDepth(depth + 0.01).setVisible(false);
  }

  /** すぐ朝にする(終わりの場面) */
  showNow(riseTo = SUN_R * 2 - 2): this {
    this.top = 0;
    this.rise = riseTo;
    this.apply();
    return this;
  }

  /** ms かけて朝になる。空は2ドットずつ、太陽は1ドットずつ上がる */
  start(ms = 1600): void {
    const steps = Math.ceil(HORIZON_Y / 2);
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration: ms, ease: 'Linear',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        this.top = HORIZON_Y - Math.min(HORIZON_Y, Math.round(t * steps) * 2);
        this.rise = Math.round(t * (SUN_R * 2 - 2));
        this.apply();
      }
    });
  }

  private apply(): void {
    const h = HORIZON_Y - this.top;
    this.sky.setVisible(h > 0).setCrop(0, this.top, this.sky.width, h);
    // 太陽は地平線より上の分だけ見せる
    this.sun.setVisible(this.rise > 0).setY(HORIZON_Y - this.rise).setCrop(0, 0, this.sun.width, this.rise);
  }
}
