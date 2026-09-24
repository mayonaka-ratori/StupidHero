// ステージ3のボス戦:母艦のまわりの演出(天井の穴、焼けた床、空からの光線、噴水の水しぶき)。
// 母艦そのものの動きは car.ts の BossCar(MOTHERSHIP_LOOK)。
// 半透明は使わず、光線の光は1コマおきの点滅で見せる。「光と揺れを弱くする」の設定では点滅させない。

import Phaser from 'phaser';
import { animKey, originFor } from '../../art/sheets';
import { MALL_SHEETS } from '../../logic';
import { settings } from '../../settings';
import { DEPTH_OF } from './depth';

/** 天窓の夜空の色と、割れたガラスのふち、折れた窓枠の色 */
const SKY = 0x07061a;
const GLASS = 0xbfe6ff;
const GLASS_DARK = 0x6f9fc8;
const FRAME = 0x5b5a7e;

/**
 * 母艦が天窓を破る:上の端にぎざぎざの穴をあけ、ガラスの破片を降らせる。
 * 穴は奥の吹き抜けの上(手前の壁より奥)に描き、そのまま残す
 */
export function breakCeiling(scene: Phaser.Scene, cx: number, halfW = 56): void {
  const g = scene.add.graphics().setDepth(DEPTH_OF.ceilingHole);
  const x0 = Math.round(cx - halfW), x1 = Math.round(cx + halfW);
  // ぎざぎざの下の端(真ん中ほど深く、上の階の店先まで破れる)。1列ずつ塗ってドット絵らしくする
  const bottom: number[] = [];
  for (let x = x0; x <= x1; x++) {
    const t = (x - cx) / halfW;
    const base = 36 - Math.round(t * t * 26);
    const jag = ((x * 7) % 5) - 2 + (x % 3 === 0 ? 2 : 0);
    bottom.push(Math.max(2, base + jag));
  }
  bottom.forEach((b, i) => g.fillStyle(SKY, 1).fillRect(x0 + i, 0, 1, b));
  // 割れたガラスのふち(2ドット)と、ところどころ下へとがった破片
  bottom.forEach((b, i) => {
    g.fillStyle(GLASS, 1).fillRect(x0 + i, b, 1, 1);
    g.fillStyle(GLASS_DARK, 1).fillRect(x0 + i, b + 1, 1, 1);
    if (i % 5 === 2) g.fillStyle(GLASS, 1).fillRect(x0 + i, b + 2, 1, 2);
  });
  // 折れた窓枠が穴の中へ垂れさがる
  for (const [dx, len] of [[-34, 8], [-6, 12], [22, 9], [44, 5]] as const) {
    const x = Math.round(cx + dx);
    const b = bottom[x - x0] ?? 10;
    g.fillStyle(FRAME, 1).fillRect(x, b - len + 2, 2, len);
    g.fillStyle(GLASS, 1).fillRect(x, b - len + 2, 1, 1);
  }
  // 穴の向こうの星
  for (const [dx, y] of [[-22, 5], [-8, 14], [14, 4], [26, 19], [-36, 9], [6, 25]] as const) {
    g.fillStyle(0xffffff, 1).fillRect(Math.round(cx + dx), y, 1, 1);
  }
  // ガラスの破片が降ってくる(小さな四角が落ちて消える)
  for (let i = 0; i < 14; i++) {
    const x = Phaser.Math.Between(x0 + 4, x1 - 4);
    const shard = scene.add.rectangle(x, Phaser.Math.Between(4, 20), i % 3 === 0 ? 2 : 1, 2, i % 2 ? GLASS : GLASS_DARK)
      .setOrigin(0).setDepth(DEPTH_OF.fxTop);
    scene.tweens.add({
      targets: shard, y: Phaser.Math.Between(150, 200), x: x + Phaser.Math.Between(-12, 12),
      duration: Phaser.Math.Between(450, 800), delay: i * 25, ease: 'Quad.easeIn',
      onUpdate: () => { shard.x = Math.round(shard.x); shard.y = Math.round(shard.y); },
      onComplete: () => shard.destroy()
    });
  }
}

/** 母艦の光線で焼けた床のあと。add を呼ぶたびに1つ増える(数に上限あり) */
export class ScorchMarks {
  private g: Phaser.GameObjects.Graphics;
  private count = 0;
  constructor(scene: Phaser.Scene, private max = 12) {
    this.g = scene.add.graphics().setDepth(DEPTH_OF.scorch);
  }

  /** (x, y) を真ん中に、焦げたあとを描く(ふちはぎざぎざ、真ん中に残り火) */
  add(x: number, y: number): void {
    if (this.count >= this.max) return;
    this.count++;
    const g = this.g;
    const w = Phaser.Math.Between(22, 28);
    const l = Math.round(x - w / 2), t = Math.round(y - 3);
    // 5段。上下の段ほど短く、左右の端を1ドットずつずらしてぎざぎざにする
    const rows = [[6, 5], [2, 3], [0, 0], [2, 1], [5, 6]];
    rows.forEach(([a, b], r) => {
      const ja = Phaser.Math.Between(-1, 1), jb = Phaser.Math.Between(-1, 1);
      g.fillStyle(0x4a2c2a, 1).fillRect(l + a + ja, t + r, w - a - b - ja + jb, 1);
    });
    g.fillStyle(0x221418, 1).fillRect(l + 5, t + 1, w - 10, 3).fillRect(l + 8, t, w - 16, 5);
    // 残り火(だいだいと黄色の点)
    g.fillStyle(0xff8a2a, 1).fillRect(l + Math.floor(w / 2) - 2, t + 2, 3, 1).fillRect(l + 7, t + 3, 1, 1).fillRect(l + w - 8, t + 1, 1, 1);
    g.fillStyle(0xffd23c, 1).fillRect(l + Math.floor(w / 2) - 1, t + 2, 1, 1);
  }
}

/**
 * 母艦の光線が上から床に落ちる。top から bottom まで fx_ufobeam を縦に整数倍にのばし、はみ出す分は切る。
 * 市民に仕分けた親玉が暴れるときは天窓の上から(top は画面の上の端)、母艦が高い所にいるときは砲口から。
 * ms たったら消える
 */
export function skyBeam(scene: Phaser.Scene, x: number, top: number, bottom: number, ms = 520): Phaser.GameObjects.Sprite {
  const key = MALL_SHEETS.beam;
  const len = Math.max(8, Math.round(bottom - top));
  const scale = Math.ceil(len / 64);
  const s = scene.add.sprite(Math.round(x), Math.round(top), key, 0).setOrigin(...originFor(key)).setScale(1, scale).setDepth(DEPTH_OF.fx);
  const crop = (): void => { s.setCrop(0, 0, s.width, Math.round(len / scale)); };
  crop();
  const anim = animKey(key, 'play');
  if (scene.anims.exists(anim)) s.play(anim);
  let n = 0;
  const blink = (): void => {
    n++;
    // コマが変わると切り方が戻ることがあるので毎フレーム切る。
    // 1コマおきに点滅(光と揺れを弱くする設定では点滅させない)
    crop();
    if (!settings.reduceFx) s.setVisible(n % 2 === 0);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, blink);
  const end = (): void => { scene.events.off(Phaser.Scenes.Events.UPDATE, blink); if (s.active) s.destroy(); };
  scene.time.delayedCall(ms, end);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, end);
  return s;
}

/** 噴水の水しぶき(水色の粒が弧を描いて飛ぶ) */
export function splash(scene: Phaser.Scene, x: number, y: number, count = 12): void {
  for (let i = 0; i < count; i++) {
    const d = scene.add.rectangle(Math.round(x), Math.round(y), 2, 2, i % 3 === 0 ? 0xffffff : i % 2 ? 0x7cc8ff : 0x3f8fe0)
      .setOrigin(0).setDepth(DEPTH_OF.fxTop);
    const dx = Phaser.Math.Between(-56, 56);
    const peak = Phaser.Math.Between(24, 48);
    const x0 = x, y0 = y;
    scene.tweens.addCounter({
      from: 0, to: 1, duration: Phaser.Math.Between(420, 620), delay: i * 12,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        d.x = Math.round(x0 + dx * t);
        d.y = Math.round(y0 + 16 * t - peak * 4 * t * (1 - t));
      },
      onComplete: () => d.destroy()
    });
  }
}
