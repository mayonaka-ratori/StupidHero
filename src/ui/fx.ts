// ハデな演出の小さな道具。どれも半透明を使わず、1コマおきの点滅やドット単位の動きで見せる。
// 使い方:
//   flash(this);                         // 画面を白く一瞬光らせる(2コマ)。flash(this, 0xff0000, 4) で赤く4コマ
//   shake(this, 4, 250);                 // カメラを4ドットの幅で0.25秒揺らす
//   hitStop(this, 80);                   // 0.08秒だけ時計、動き、アニメを止める(タップは受け付けたまま)
//   if (isFrozen(this)) return;          // update の中で、止まっている間は動かさないとき
//   impact(this, 'big');                 // 光る+揺れる+止まるをまとめて('small' | 'big' | 'huge')
//   blink(sprite, 600);                  // 0.6秒、1コマおきに点滅させる(光って見せる)
//   popText(this, x, y, '¥80万', { color: UI.danger });   // 数字がぴょんと出て上に消える
//   await banner(this, 'ボス出現!');     // 黒い帯が横から入ってきて、文字を見せて去る
//   const alarm = new EdgeAlarm(this);  alarm.start();  alarm.stop();   // 画面の左右の端を赤く点滅
//   enableTapSparks(this);               // タップしたところに小さな火花を出す

import Phaser from 'phaser';
import { UI } from '../config';
import { layout } from '../layout';
import { PixelText } from './text';
import { DEPTH, FS } from './theme';
import { px } from '../hires';

/** 画面全体を一瞬光らせる */
export function flash(scene: Phaser.Scene, color = 0xffffff, frames = 2): void {
  const { W, H } = layout;
  const r = scene.add.rectangle(0, 0, W, H, color).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.flash);
  let n = 0;
  const onUpdate = (): void => {
    n++;
    // 1コマおきに点滅させながら消える
    r.setVisible(n % 2 === 0 || n < 2);
    if (n >= frames * 2) { scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate); r.destroy(); }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
}

/** カメラを揺らす(px はドット) */
export function shake(scene: Phaser.Scene, px = 3, ms = 200, cam = scene.cameras.main): void {
  cam.shake(ms, new Phaser.Math.Vector2(px / cam.width, (px * 0.7) / cam.height), true);
}

const frozen = new WeakMap<Phaser.Scene, { until: number; anims: Phaser.GameObjects.Sprite[]; timer: number }>();

const cleanupSet = new WeakSet<Phaser.Scene>();

/** 止まっている最中か(hitStop の間) */
export const isFrozen = (scene: Phaser.Scene): boolean => frozen.has(scene);

/** ほんの少しの間、時計、動き(tween)、アニメを止める。タップは受け付けたまま */
export function hitStop(scene: Phaser.Scene, ms = 80): void {
  const cur = frozen.get(scene);
  if (cur) {
    // 止まっている最中なら延ばす
    const until = Math.max(cur.until, performance.now() + ms);
    if (until > cur.until) {
      clearTimeout(cur.timer);
      cur.until = until;
      cur.timer = window.setTimeout(() => unfreeze(scene), until - performance.now());
    }
    return;
  }
  const anims: Phaser.GameObjects.Sprite[] = [];
  scene.children.each((o) => {
    if (o instanceof Phaser.GameObjects.Sprite && o.anims.isPlaying) { o.anims.pause(); anims.push(o); }
  });
  scene.time.timeScale = 0;
  scene.tweens.timeScale = 0;
  const timer = window.setTimeout(() => unfreeze(scene), ms);
  frozen.set(scene, { until: performance.now() + ms, anims, timer });
  if (!cleanupSet.has(scene)) {
    cleanupSet.add(scene);
    scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      const f = frozen.get(scene);
      if (f) clearTimeout(f.timer);
      frozen.delete(scene);
      scene.time.timeScale = 1;
      scene.tweens.timeScale = 1;
    });
  }
}

function unfreeze(scene: Phaser.Scene): void {
  const f = frozen.get(scene);
  if (!f) return;
  frozen.delete(scene);
  if (!scene.sys || !scene.sys.settings.active) return;
  scene.time.timeScale = 1;
  scene.tweens.timeScale = 1;
  for (const s of f.anims) if (s.active) s.anims.resume();
}

/** 光る、揺れる、止まるをまとめて */
export function impact(scene: Phaser.Scene, power: 'small' | 'big' | 'huge' = 'big'): void {
  if (power === 'small') { shake(scene, 2, 120); hitStop(scene, 40); return; }
  if (power === 'big') { flash(scene, 0xffffff, 1); shake(scene, 4, 250); hitStop(scene, 80); return; }
  flash(scene, 0xffffff, 3); shake(scene, 7, 500); hitStop(scene, 160);
}

/** 1コマおきに点滅させる。終わると見える状態に戻る */
export function blink(target: Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown }, ms = 600): void {
  const scene = target.scene;
  const end = scene.time.now + ms;
  let n = 0;
  const onUpdate = (): void => {
    if (!target.active) { scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate); return; }
    n++;
    if (scene.time.now >= end) { target.setVisible(true); scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate); return; }
    target.setVisible(n % 2 === 0);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
}

export interface PopTextOptions { color?: number; size?: number; rise?: number; ms?: number }

/** 文字がぴょんと出て、上に動きながら点滅して消える */
export function popText(scene: Phaser.Scene, x: number, y: number, text: string, opt: PopTextOptions = {}): PixelText {
  const t = new PixelText(scene, Math.round(x), Math.round(y), text, {
    size: opt.size ?? FS.body, color: opt.color ?? UI.gold, outline: true
  }).setOrigin(0.5, 1).setDepth(DEPTH.fx);
  const rise = opt.rise ?? 14;
  const ms = opt.ms ?? 900;
  const y0 = Math.round(y);
  const hop = [-3, -5, -4, -3];
  let n = 0;
  const start = scene.time.now;
  const onUpdate = (): void => {
    if (!t.active) { scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate); return; }
    n++;
    const p = (scene.time.now - start) / ms;
    if (p >= 1) { scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate); t.destroy(); return; }
    const dy = n < hop.length ? hop[n] : -3 - Math.round((rise - 3) * p);
    t.y = y0 + dy;
    if (p > 0.6) t.setVisible(n % 2 === 0);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  return t;
}

export interface BannerOptions { y?: number; color?: number; band?: number; hold?: number; size?: number }

/** 黒い帯が右から入ってきて、文字を見せて左へ去る */
export function banner(scene: Phaser.Scene, text: string, opt: BannerOptions = {}): Promise<void> {
  const { W } = layout;
  const y = Math.round(opt.y ?? layout.actionH / 2);
  const size = opt.size ?? FS.big;
  const bandH = size + 14;
  const c = scene.add.container(W, y - Math.floor(bandH / 2)).setDepth(DEPTH.fx).setScrollFactor(0);
  const g = scene.add.graphics();
  g.fillStyle(UI.black, 1).fillRect(0, 0, W, bandH);
  g.fillStyle(opt.band ?? UI.bad, 1).fillRect(0, 1, W, 2).fillRect(0, bandH - 3, W, 2);
  const label = new PixelText(scene, Math.floor(W / 2), 7, text, { size, color: opt.color ?? UI.gold, outline: true }).setOrigin(0.5, 0);
  c.add([g, label]);
  return new Promise((resolve) => {
    scene.tweens.add({
      targets: c, x: 0, duration: 180, ease: 'Cubic.easeOut',
      onUpdate: () => { c.x = Math.round(c.x); },
      onComplete: () => {
        scene.tweens.add({
          targets: c, x: -W, delay: opt.hold ?? 900, duration: 160, ease: 'Cubic.easeIn',
          onUpdate: () => { c.x = Math.round(c.x); },
          onComplete: () => { c.destroy(); resolve(); }
        });
      }
    });
  });
}

/** 画面の左右の端を赤く点滅させる(残り時間が少ないときなど) */
export class EdgeAlarm {
  private g: Phaser.GameObjects.Graphics;
  private on = false;
  private n = 0;
  constructor(scene: Phaser.Scene, private top = 0, private bottom = layout.actionH, private color: number = UI.bad) {
    this.g = scene.add.graphics().setDepth(DEPTH.fx).setScrollFactor(0).setVisible(false);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this));
  }

  get running(): boolean { return this.on; }

  start(): this { this.on = true; this.n = 0; return this; }
  stop(): this { this.on = false; this.g.setVisible(false); return this; }

  private tick(): void {
    if (!this.on) return;
    this.n++;
    const lit = Math.floor(this.n / 10) % 2 === 0;
    this.g.setVisible(lit);
    if (this.n === 1) {
      const { W } = layout;
      const h = this.bottom - this.top;
      const g = this.g;
      g.clear();
      // 内側ほど細かく抜いた帯(半透明の代わり)
      g.fillStyle(this.color, 1).fillRect(0, this.top, 3, h).fillRect(W - 3, this.top, 3, h);
      for (let y = this.top; y < this.bottom; y += 2) {
        g.fillRect(3, y, 1, 1).fillRect(W - 4, y, 1, 1);
        if (y % 4 === 0) g.fillRect(4, y, 1, 1).fillRect(W - 5, y, 1, 1);
      }
    }
  }
}

/** タップしたところに小さな火花(4コマ) */
export function tapSpark(scene: Phaser.Scene, x: number, y: number, color = 0xffffff): void {
  const g = scene.add.graphics().setDepth(DEPTH.flash).setScrollFactor(0);
  let n = 0;
  const cx = Math.round(x), cy = Math.round(y);
  const onUpdate = (): void => {
    n++;
    const f = Math.floor(n / 2);
    if (f > 3) { scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate); g.destroy(); return; }
    g.clear();
    g.fillStyle(color, 1);
    const r = 3 + f * 3;
    // 8方向に点
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.fillRect(cx + dx * r - 1, cy + dy * r - 1, 2, 2);
    const d = Math.round(r * 0.7);
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.fillRect(cx + dx * d, cy + dy * d, 1, 1);
    if (f === 0) g.fillRect(cx - 1, cy - 1, 3, 3);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
}

/** タップのたびに火花を出す */
export function enableTapSparks(scene: Phaser.Scene, color = 0xffffff): void {
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => { const q = px(p); tapSpark(scene, q.x, q.y, color); });
}
