// ボス戦の演出の小さな道具。半透明は使わず、1コマおきの点滅で光を見せる。

import Phaser from 'phaser';
import { animKey } from '../../art/sheets';
import { DEPTH_OF } from './depth';

/** エフェクトの絵を1回流して消す(fx_hit_big、fx_explosion など) */
export function spawnFx(
  scene: Phaser.Scene, key: string, x: number, y: number,
  opt: { depth?: number; flipX?: boolean; speed?: number } = {}
): Phaser.GameObjects.Sprite {
  const s = scene.add.sprite(Math.round(x), Math.round(y), key, 0).setDepth(opt.depth ?? DEPTH_OF.fx);
  if (opt.flipX) s.setFlipX(true);
  const anim = animKey(key, 'play');
  if (scene.anims.exists(anim)) {
    s.play(anim);
    if (opt.speed) s.anims.timeScale = opt.speed;
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  } else {
    scene.time.delayedCall(250, () => s.destroy());
  }
  return s;
}

/** 光の拳が from から to へ飛んで消える(fx_punch はくり返しのアニメなので、動きが終わったら消す) */
export function flyPunch(scene: Phaser.Scene, fromX: number, toX: number, y: number, ms = 60): void {
  const s = scene.add.sprite(Math.round(fromX), Math.round(y), 'fx_punch', 0).setDepth(DEPTH_OF.fx);
  const anim = animKey('fx_punch', 'play');
  if (scene.anims.exists(anim)) s.play(anim);
  scene.tweens.add({
    targets: s, x: toX, duration: ms,
    onUpdate: () => { s.x = Math.round(s.x); },
    onComplete: () => s.destroy()
  });
}

/** 破片が弧を描いて飛ぶ */
export function throwDebris(scene: Phaser.Scene, x: number, y: number, dx: number, dy: number, ms = 420): void {
  const s = scene.add.sprite(Math.round(x), Math.round(y), 'fx_debris', Phaser.Math.Between(0, 3)).setDepth(DEPTH_OF.fxTop);
  const x0 = x, y0 = y;
  const peak = -18 - Math.random() * 14;
  scene.tweens.addCounter({
    from: 0, to: 1, duration: ms,
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      s.x = Math.round(x0 + dx * t);
      s.y = Math.round(y0 + dy * t + peak * 4 * t * (1 - t));
      s.setFrame(Math.floor(t * 8) % 4);
    },
    onComplete: () => s.destroy()
  });
}

/** 速い連打のときに走る集中線(横向きの光の線)。毎フレーム update を呼ぶ */
export class SpeedLines {
  private g: Phaser.GameObjects.Graphics;
  private n = 0;
  constructor(scene: Phaser.Scene, private top: number, private bottom: number, private w: number) {
    this.g = scene.add.graphics().setDepth(DEPTH_OF.speedLines);
  }

  /** power 0〜1。0なら消す */
  update(power: number): void {
    this.n++;
    const g = this.g;
    if (power <= 0) { if (g.visible) g.clear().setVisible(false); return; }
    // 1コマおきに見せる(半透明の代わり)
    g.setVisible(this.n % 2 === 0);
    if (this.n % 2 !== 0) return;
    g.clear();
    const count = Math.round(3 + power * 9);
    for (let i = 0; i < count; i++) {
      const y = Phaser.Math.Between(this.top, this.bottom);
      const len = Phaser.Math.Between(16, 30 + Math.round(power * 50));
      const x = Phaser.Math.Between(-20, this.w);
      g.fillStyle(i % 3 === 0 ? 0xfff2a8 : 0xffffff, 1).fillRect(x, y, len, 1);
    }
  }
}
