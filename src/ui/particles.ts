// 流れに乗って動く小さな粒の演出。半透明は使わず、1〜2ドットの四角と1コマおきの点滅で見せる。
// 使い方:
//   const s = new CurlSmoke(this, { x: () => car.frontX, y: () => car.smokeY, depth: 50 });
//   s.stopAfter(3000);   // 3秒たったら出すのをやめる(出ている粒は消えるまで流れて、全部消えたら自分で片づく)
//   s.stop();            // すぐ出すのをやめる
//   const b = new HermiteSparks(this, { from: () => ({ x, y }), to: () => ({ x: ufo.x, y: ufo.bottom }), depth: 700 });
//   b.stop();
// どちらもシーンの時計の速さに合わせて動く(ヒットストップの間は止まり、早送りの間は速くなる)。
// シーンが終わると片づく。
//
// CurlSmoke:煙。粒を curl(flow.ts)の渦の流れに乗せて上へ流す。出たばかりの粒はまっすぐ上り、
//   古くなるほど渦に流されてうねる。粒は十字の形(3×3)、2ドット、1ドットと縮み、最後は1コマおきに点滅して消える。
//   煙を出すものより奥(重なりの順が小さい)に置くと、煙は出すものの後ろから上って見え、顔や車体にかからない。
// HermiteSparks:光の粒が from から to へ吸いこまれる。道すじはエルミート曲線(flow.ts の hermite)で、
//   横へふくらんで出て、to には下からまっすぐ上へ入る。左右交互にふくらませるので、らせんを巻くように見える。

import Phaser from 'phaser';
import { curl, hermite } from './flow';

type Num = number | (() => number);
const val = (n: Num): number => (typeof n === 'function' ? n() : n);

/** 黒い煙の色(出たばかり → 古い)。明るい背景(モール)用。R、G、B は8段階の色から選ぶ */
export const SMOKE_DARK = [0x242424, 0x494949, 0x6d6d6d] as const;
/** 灰色の煙の色(出たばかり → 古い)。暗い背景(地下駐車場)用。黒い煙だと暗い床や壁に溶けて、汚れに見える */
export const SMOKE_LIGHT = [0x6d6d6d, 0x929292, 0xb6b6b6, 0xdbdbdb] as const;
/** 燃えているものから飛ぶ火の粉の色(出たばかり → 古い) */
export const EMBER = [0xffffb6, 0xffdb00, 0xff9200, 0xb62400] as const;

/** 1フレームで進める時間(秒)。シーンの時計の速さをかける(ヒットストップの間は0) */
function stepSec(scene: Phaser.Scene, delta: number): number {
  return (Math.min(delta, 50) / 1000) * scene.time.timeScale;
}

/** シーンの毎フレームで step を呼び、シーンが終わったら片づける土台 */
abstract class FlowEmitter {
  protected readonly g: Phaser.GameObjects.Graphics;
  protected emitting = true;
  protected frame = 0;
  private stopAt = Infinity;
  private elapsed = 0;

  constructor(protected readonly scene: Phaser.Scene, depth: number) {
    this.g = scene.add.graphics().setDepth(depth);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** 出すのをやめる(出ている粒は消えるまで動く) */
  stop(): this { this.emitting = false; return this; }

  /** ms ミリ秒たったら出すのをやめる(シーンの時計で数える) */
  stopAfter(ms: number): this { this.stopAt = this.elapsed + ms / 1000; return this; }

  /** すぐ消す */
  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    if (this.g.active) this.g.destroy();
  }

  private onUpdate(_t: number, delta: number): void {
    const dt = stepSec(this.scene, delta);
    // 止まっている間は、絵もそのままにする(点滅も止める)
    if (dt <= 0) return;
    this.frame++;
    this.elapsed += dt;
    if (this.elapsed >= this.stopAt) this.emitting = false;
    const alive = this.step(dt, this.elapsed);
    if (!this.emitting && alive === 0) this.destroy();
  }

  /** 粒を動かして描く。残っている粒の数を返す */
  protected abstract step(dt: number, time: number): number;
}

interface SmokeDot { x: number; y: number; age: number; life: number; ember: boolean; rise: number }

export interface CurlSmokeOptions {
  /** 煙が出る所(毎フレーム読むので、動くものに合わせられる) */
  x: Num;
  y: Num;
  depth: number;
  /** 煙の色(出たばかり → 古い)。省略すると SMOKE_DARK */
  colors?: readonly number[];
  /** 1秒に出す粒の数 */
  rate?: number;
  /** 粒が消えるまでの秒(いちばん短い、いちばん長い) */
  life?: [number, number];
  /** 上る速さ(ドット/秒) */
  rise?: number;
  /** 渦に流される強さ(ドット/秒) */
  swirl?: number;
  /** 渦の大きさ(ドット) */
  cell?: number;
  /** 出る所の横の幅(左右にこれだけ散らす) */
  spread?: number;
  /** 横に流す風(ドット/秒。マイナスで左) */
  wind?: number;
  /** 粒のうち火の粉にする割合(0〜1)。火の粉は速く上って、早く消える */
  embers?: number;
  /** 一度に出ている粒の上限 */
  max?: number;
}

/** 渦を巻きながら上っていく煙 */
export class CurlSmoke extends FlowEmitter {
  private dots: SmokeDot[] = [];
  private carry = 0;
  private readonly o: Required<Omit<CurlSmokeOptions, 'x' | 'y' | 'depth'>>;
  private readonly seed = Math.floor(Math.random() * 1e6);

  constructor(scene: Phaser.Scene, private readonly opt: CurlSmokeOptions) {
    super(scene, opt.depth);
    this.o = {
      colors: opt.colors ?? SMOKE_DARK, rate: opt.rate ?? 40, life: opt.life ?? [0.9, 1.6], rise: opt.rise ?? 18,
      swirl: opt.swirl ?? 34, cell: opt.cell ?? 16, spread: opt.spread ?? 5, wind: opt.wind ?? 0,
      embers: opt.embers ?? 0, max: opt.max ?? 140
    };
  }

  protected step(dt: number, time: number): number {
    const o = this.o;
    if (this.emitting) {
      this.carry += o.rate * dt;
      const x0 = val(this.opt.x), y0 = val(this.opt.y);
      while (this.carry >= 1) {
        this.carry--;
        if (this.dots.length >= o.max) continue;
        const ember = Math.random() < o.embers;
        const life = (o.life[0] + Math.random() * (o.life[1] - o.life[0])) * (ember ? 0.5 : 1);
        this.dots.push({
          x: x0 + (Math.random() * 2 - 1) * o.spread, y: y0 - Math.random() * 3,
          age: 0, life, ember, rise: o.rise * (ember ? 2.2 : 0.8 + Math.random() * 0.4)
        });
      }
    }
    const g = this.g.clear();
    // 消えた粒は、配列を作り直さずに詰めて消す
    let n = 0;
    for (const d of this.dots) {
      d.age += dt;
      const p = d.age / d.life;
      if (p >= 1) continue;
      this.dots[n++] = d;
      // 出たばかりはまっすぐ上り、古くなるほど渦に流される。上る勢いは少しずつ落ちる
      const v = curl(d.x / o.cell, d.y / o.cell, time * 0.8, this.seed);
      const sw = o.swirl * (0.25 + 0.75 * p) * (d.ember ? 0.6 : 1);
      d.x += (v.x * sw + o.wind * p) * dt;
      d.y += (v.y * sw - d.rise * (1 - 0.5 * p)) * dt;
      // 最後の3割は1コマおきに点滅させて消えていくように見せる(半透明の代わり)
      if (p > 0.7 && (this.frame + (d.life * 100 | 0)) % 2 === 0) continue;
      const ramp = d.ember ? EMBER : o.colors;
      const c = ramp[Math.min(ramp.length - 1, Math.floor(p * ramp.length))];
      const x = Math.round(d.x), y = Math.round(d.y);
      g.fillStyle(c, 1);
      if (d.ember || p >= 0.65) g.fillRect(x, y, 1, 1);
      else if (p >= 0.3) g.fillRect(x, y, 2, 2);
      // 出たばかりは十字の形にして、となりの粒とつながって1つのかたまりに見えるようにする
      else g.fillRect(x - 1, y, 3, 1).fillRect(x, y - 1, 1, 3);
    }
    this.dots.length = n;
    return n;
  }
}

interface Spark { x0: number; y0: number; mx: number; my: number; age: number; life: number }

export interface HermiteSparksOptions {
  /** 粒が出る所を1つ決める(粒ごとに呼ぶ) */
  from: () => { x: number; y: number };
  /** 粒が吸いこまれる所(毎フレーム読む) */
  to: () => { x: number; y: number };
  depth: number;
  /** 粒の色(出たばかり → 着く前)。先の色ほど明るくする */
  colors: readonly number[];
  /** 1秒に出す粒の数 */
  rate?: number;
  /** 着くまでの秒(いちばん短い、いちばん長い) */
  life?: [number, number];
  /** 出るときに横へふくらむ強さ(ドット) */
  bulge?: number;
  /** to に入るときの、上向きの勢い(ドット) */
  pull?: number;
}

/** 光の粒が、横へふくらんでから to へ吸いこまれる(道すじはエルミート曲線) */
export class HermiteSparks extends FlowEmitter {
  private sparks: Spark[] = [];
  private carry = 0;
  private flip = false;

  constructor(scene: Phaser.Scene, private readonly opt: HermiteSparksOptions) {
    super(scene, opt.depth);
  }

  protected step(dt: number): number {
    const o = this.opt;
    const [l0, l1] = o.life ?? [0.45, 0.8];
    const bulge = o.bulge ?? 70;
    if (this.emitting) {
      this.carry += (o.rate ?? 30) * dt;
      while (this.carry >= 1) {
        this.carry--;
        const f = o.from();
        // 左右交互にふくらませる(同じ向きばかりだと、片側に寄って見える)
        this.flip = !this.flip;
        const side = this.flip ? 1 : -1;
        this.sparks.push({
          x0: f.x, y0: f.y, age: 0, life: l0 + Math.random() * (l1 - l0),
          mx: side * bulge * (0.5 + Math.random() * 0.5), my: -bulge * 0.3 * Math.random()
        });
      }
    }
    const to = o.to();
    const pull = o.pull ?? 90;
    const g = this.g.clear();
    let n = 0;
    const at = (s: Spark, t: number): [number, number] => [
      hermite(s.x0, s.mx, to.x, 0, t),
      hermite(s.y0, s.my, to.y, -pull, t)
    ];
    for (const s of this.sparks) {
      s.age += dt;
      if (s.age >= s.life) continue;
      this.sparks[n++] = s;
      // だんだん速くなって吸いこまれる
      const t = (s.age / s.life) ** 1.4;
      const [x, y] = at(s, t);
      const c = o.colors[Math.min(o.colors.length - 1, Math.floor(t * o.colors.length))];
      // 1コマおきに、点だけのコマと、少し前の所にも点を打って流れた道すじを見せるコマを入れかえる
      // (粒ごとにずらして、ちらちらさせる)
      if ((this.frame + (s.life * 100 | 0)) % 2 === 0) {
        g.fillStyle(c, 1).fillRect(Math.round(x), Math.round(y), 1, 1);
        continue;
      }
      const [px, py] = at(s, Math.max(0, t - 0.08));
      g.fillStyle(o.colors[0], 1).fillRect(Math.round(px), Math.round(py), 1, 1);
      // 速くなってきたら、道すじを2つの点にして長く見せる
      if (t > 0.3) {
        const [qx, qy] = at(s, Math.max(0, t - 0.04));
        g.fillRect(Math.round(qx), Math.round(qy), 1, 1);
      }
      g.fillStyle(c, 1).fillRect(Math.round(x), Math.round(y), 1, 1);
      if (t > 0.5) g.fillRect(Math.round(x), Math.round(y) - 1, 1, 1);
    }
    this.sparks.length = n;
    return n;
  }
}
