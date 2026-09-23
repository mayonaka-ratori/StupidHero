// スワイプ。決めた四角の中から始まった指の動きだけを受け付ける。
// 画面の左右の端(CSSで16ピクセル以内)から始まった動きは無視する(Safariの「戻る」とぶつかるため)。
// 使い方:
//   const swipe = new SwipeInput(this, new Phaser.Geom.Rectangle(40, 60, 136, 150), {
//     onMove: (dx) => card.x = 108 + dx,            // 動いている間ずっと(左右に何ドット動いたか)
//     onSwipe: (dir) => judge(dir === 'left' ? 'bad' : 'civ'),   // 一定以上動いたか、素早くはじいたとき
//     onCancel: () => card.x = 108                    // 足りずに指を離したとき
//   });
//   swipe.enabled = false;                            // 一時的に止める
//   swipe.setArea(rect);                              // 受け付ける四角を変える
// シーンが一時停止したら、動かしている最中の指を放して onCancel を呼ぶ(再開のタップで勝手に決まらないように)。
// シーンが終わると自動で後始末する。

import Phaser from 'phaser';
import { px } from '../hires';
import { layout } from '../layout';

export type SwipeDir = 'left' | 'right';

export interface SwipeOptions {
  onStart?: (x: number, y: number) => void;
  onMove?: (dx: number, dy: number) => void;
  onSwipe?: (dir: SwipeDir, dx: number) => void;
  onCancel?: () => void;
  /** これだけ動いたら決まる(ドット) */
  distance?: number;
  /** はじいたとみなす速さ(ドット/ミリ秒) */
  flickSpeed?: number;
  /** はじいたときに最低これだけは動いていること(ドット) */
  flickMin?: number;
  /** 画面の端の、無視する幅(CSSピクセル) */
  edgeCss?: number;
}

export class SwipeInput {
  enabled = true;
  /** 最後に指を離したときの速さ(ドット/ミリ秒。調整用) */
  lastSpeed = 0;
  private area: Phaser.Geom.Rectangle;
  private opt: Required<Omit<SwipeOptions, 'onStart' | 'onMove' | 'onSwipe' | 'onCancel'>> & SwipeOptions;
  private pointerId = -1;
  private startX = 0;
  private startY = 0;
  private samples: { t: number; x: number }[] = [];

  constructor(private scene: Phaser.Scene, area: Phaser.Geom.Rectangle, opt: SwipeOptions = {}) {
    this.area = area;
    this.opt = { distance: 40, flickSpeed: 0.25, flickMin: 10, edgeCss: 16, ...opt };
    const input = scene.input;
    input.on('pointerdown', this.down, this);
    input.on('pointermove', this.move, this);
    input.on('pointerup', this.up, this);
    input.on('pointerupoutside', this.up, this);
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.onPause, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** いま指で動かしている最中か */
  get active(): boolean { return this.pointerId >= 0; }

  setArea(area: Phaser.Geom.Rectangle): this {
    this.area = area;
    return this;
  }

  /** 動かしている最中の指を放す(onCancel は呼ばない) */
  reset(): void {
    this.pointerId = -1;
    this.samples = [];
  }

  /** シーンが一時停止した:動かしている最中なら、指を放して元に戻す */
  private onPause(): void {
    if (this.pointerId < 0) return;
    this.reset();
    this.opt.onCancel?.();
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.onPause, this);
    const input = this.scene.input;
    input.off('pointerdown', this.down, this);
    input.off('pointermove', this.move, this);
    input.off('pointerup', this.up, this);
    input.off('pointerupoutside', this.up, this);
  }

  /** 指を離す直前の速さ。最後の動きから100ミリ秒以内の動きで測る。離す前に止まっていたら0 */
  private speed(now: number): number {
    const s = this.samples;
    const last = s[s.length - 1];
    if (!last || s.length < 2 || now - last.t > 80) return 0;
    const first = s.find((q) => last.t - q.t <= 100) ?? s[0];
    const from = first === last ? s[s.length - 2] : first;
    return (last.x - from.x) / Math.max(1, last.t - from.t);
  }

  /** 論理座標の x が、画面(ブラウザの窓)の左右の端に近いか */
  private nearEdge(x: number): boolean {
    const canvas = this.scene.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const cssX = rect.left + (x / layout.W) * rect.width;
    return cssX < this.opt.edgeCss || cssX > window.innerWidth - this.opt.edgeCss;
  }

  private down(ptr: Phaser.Input.Pointer): void {
    if (!this.enabled || this.pointerId >= 0) return;
    const p = { id: ptr.id, ...px(ptr) };
    if (!this.area.contains(p.x, p.y) || this.nearEdge(p.x)) return;
    this.pointerId = p.id;
    this.startX = p.x;
    this.startY = p.y;
    this.samples = [{ t: performance.now(), x: p.x }];
    this.opt.onStart?.(p.x, p.y);
  }

  private move(ptr: Phaser.Input.Pointer): void {
    if (ptr.id !== this.pointerId) return;
    const p = px(ptr);
    if (!this.enabled) { this.reset(); this.opt.onCancel?.(); return; }
    const now = performance.now();
    this.samples.push({ t: now, x: p.x });
    while (this.samples.length > 2 && now - this.samples[0].t > 100) this.samples.shift();
    this.opt.onMove?.(Math.round(p.x - this.startX), Math.round(p.y - this.startY));
  }

  private up(ptr: Phaser.Input.Pointer): void {
    if (ptr.id !== this.pointerId) return;
    const p = px(ptr);
    this.pointerId = -1;
    if (!this.enabled) { this.opt.onCancel?.(); return; }
    const dx = p.x - this.startX;
    const v = this.speed(performance.now());
    this.lastSpeed = v;
    this.samples = [];
    const dir: SwipeDir = dx < 0 ? 'left' : 'right';
    const far = Math.abs(dx) >= this.opt.distance;
    const flick = Math.abs(v) >= this.opt.flickSpeed && Math.abs(dx) >= this.opt.flickMin && Math.sign(v) === Math.sign(dx);
    if (far || flick) this.opt.onSwipe?.(dir, Math.round(dx));
    else this.opt.onCancel?.();
  }
}
