// タイトル、ステージ前の掛け合い、仕分けの3つのシーンで使う小さな道具。
//   drawAlley(this)            路地裏の背景(遠く、壁、地面)を置く
//   spotlightDim(this)         スポットライトの形に穴のあいた「暗くする網目」のテクスチャ
//   edgeGlow(g, side, level)   画面の左右の端を光らせる帯を描く
//   flicker(this, obj)         1コマおきに見えたり消えたりさせる(半透明の代わり)
//   devHook(this, extra)       開発中だけ window.__sh に中身を出す(自動テスト用)

import Phaser from 'phaser';
import { UI } from '../../config';
import { layout } from '../../layout';
import { audio } from '../../audio';
import { MuteButton, goto, type GotoOptions } from '../../ui';

/** 背景の重なり(ゲームの絵は 900 より下) */
export const Z = {
  far: 0,
  sky: 1,
  wall: 2,
  ground: 3,
  dim: 5,
  glow: 6,
  shadow: 8,
  aura: 9,
  actor: 10,
  actorFront: 11,
  stamp: 20
} as const;

export interface AlleyLayers {
  far: Phaser.GameObjects.Image;
  wall: Phaser.GameObjects.TileSprite;
  ground: Phaser.GameObjects.TileSprite;
}

/** 路地裏の背景を置く。y はアクション部分の上端(ふつう0) */
export function drawAlley(scene: Phaser.Scene, scrollX = 0, y = 0): AlleyLayers {
  const { W } = layout;
  const far = scene.add.image(0, y, 'bg_alley_far').setOrigin(0).setDepth(Z.far);
  const wall = scene.add.tileSprite(0, y, W, 130, 'bg_alley_wall').setOrigin(0).setDepth(Z.wall);
  const ground = scene.add.tileSprite(0, y + 124, W, 90, 'bg_alley_ground').setOrigin(0).setDepth(Z.ground);
  wall.tilePositionX = Math.round(scrollX);
  ground.tilePositionX = Math.round(scrollX);
  return { far, wall, ground };
}

/**
 * アクション部分を暗くする網目のテクスチャ。真ん中にスポットライトの形の穴があいている。
 * 穴のまわりは網目を粗くして、光がぼやけて見えるようにする。
 * @param cx 光の真ん中、@param feetY 光の輪の中心(足もと)
 */
export function spotlightDim(scene: Phaser.Scene, cx: number, feetY: number, key = 'sort_spot_dim'): string {
  if (scene.textures.exists(key)) return key;
  const { W, actionH } = layout;
  const tex = scene.textures.createCanvas(key, W, actionH)!;
  const ctx = tex.context;
  const img = ctx.createImageData(W, actionH);
  const d = img.data;
  // 光の形:上から差す円すい(上が細く、下が太い)と、足もとの楕円
  const topY = -10;
  const topHalf = 18;
  const botHalf = 58;
  for (let y = 0; y < actionH; y++) {
    const t = Math.max(0, Math.min(1, (y - topY) / (feetY - topY)));
    const half = topHalf + (botHalf - topHalf) * t;
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - cx);
      let r = dx / half; // 円すいの中なら1より小さい
      if (y > feetY) {
        // 足もとの楕円
        const ex = (x - cx) / botHalf;
        const ey = (y - feetY) / 12;
        r = Math.sqrt(ex * ex + ey * ey);
      }
      let dark: boolean;
      if (r < 0.92) dark = false;
      else if (r < 1.08) dark = (x % 2 === 0 && y % 2 === 0); // 4つに1つ
      else if (r < 1.25) dark = (x + y) % 2 === 0; // 半分
      else dark = !(x % 2 === 0 && y % 2 === 0); // 4つに3つ
      if (!dark) continue;
      const i = (y * W + x) * 4;
      d[i] = 0; d[i + 1] = 0; d[i + 2] = 8; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return key;
}

/** 足もとの光の輪(明るい点を網目に並べる)を Graphics に描く */
export function drawLightPool(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rx: number, ry: number, color = 0xfff2b8): void {
  g.fillStyle(color, 1);
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    for (let x = -half; x <= half; x++) {
      const inner = (x * x) / (rx * rx) + (y * y) / (ry * ry) < 0.35;
      const on = inner ? (x + y) % 2 === 0 : (x % 2 === 0 && (y % 2 === 0));
      if (on) g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

/**
 * 画面の端を光らせる帯。level は0〜1(大きいほど太く明るい)。
 * 内側ほど網目を粗くして、光がにじんでいるように見せる。
 */
export function edgeGlow(g: Phaser.GameObjects.Graphics, side: 'left' | 'right', color: number, level: number, top = 0, bottom = layout.actionH): void {
  const { W } = layout;
  const solid = 2 + Math.round(level * 4);
  const soft = 3 + Math.round(level * 8);
  const xAt = (i: number): number => (side === 'left' ? i : W - 1 - i);
  g.fillStyle(color, 1);
  for (let i = 0; i < solid; i++) g.fillRect(xAt(i), top, 1, bottom - top);
  for (let k = 0; k < soft; k++) {
    const i = solid + k;
    const step = k < soft / 3 ? 2 : k < (soft * 2) / 3 ? 3 : 4;
    for (let y = top + (k % 2); y < bottom; y += step) g.fillRect(xAt(i), y, 1, 1);
  }
  // 明るい芯
  g.fillStyle(0xffffff, 1);
  if (level > 0.5) g.fillRect(xAt(0), top, 1, bottom - top);
}

/** 1コマおきに見えたり消えたりさせる。止めるときは返り値を呼ぶ */
export function flicker(scene: Phaser.Scene, obj: { setVisible(v: boolean): unknown; active?: boolean }, every = 1): () => void {
  let n = 0;
  const tick = (): void => {
    if (obj.active === false) { scene.events.off(Phaser.Scenes.Events.UPDATE, tick); return; }
    n++;
    obj.setVisible(Math.floor(n / every) % 2 === 0);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  const stop = (): void => { scene.events.off(Phaser.Scenes.Events.UPDATE, tick); };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  return stop;
}

/** 音のオン/オフのボタン(音のエンジンとつなぐ) */
export function addMute(scene: Phaser.Scene, x: number, y: number): MuteButton {
  return new MuteButton(scene, x, y, {
    isMuted: () => audio.isMuted(),
    toggle: () => { audio.unlock(); return audio.toggleMuted(); }
  });
}

/** どこをタップしても音を鳴らせるようにする(iPhoneはタップのあとでないと鳴らない) */
export function unlockOnTap(scene: Phaser.Scene): void {
  scene.input.on('pointerdown', () => audio.unlock());
}

/**
 * 次のシーンへ(ワイプ)。ui の goto は、シーンの更新中(タイマーや tween の中)に初めて呼ぶと
 * ワイプのシーンの登録が保留になり、直後の start が「Scene key not found」で失敗して止まってしまう。
 * ゲームの更新の外(setTimeout)から呼んで避ける。
 */
export function gotoSafe(
  scene: Phaser.Scene, to: string, data?: object, opt: GotoOptions = { kind: 'wipe' }, onResult?: (accepted: boolean) => void
): void {
  // 切り替えの途中だと goto は受け付けない。そのときは onResult(false) で知らせる
  window.setTimeout(() => { onResult?.(goto(scene, to, data, opt)); }, 0);
}

/** 開発中だけ、自動テストから中身をさわれるようにする */
export function devHook(scene: Phaser.Scene, extra: Record<string, unknown> = {}): void {
  if (!import.meta.env.DEV) return;
  (window as unknown as { __sh: unknown }).__sh = { scene, game: scene.game, key: scene.scene.key, ...extra };
}

/** 色の文字列 */
export const RED = UI.bad;
export const BLUE = UI.civ;
/** 暗い背景の上でも見える青 */
export const BLUE_LIGHT = 0x5c9cff;
