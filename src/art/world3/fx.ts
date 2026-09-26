// ステージ3のエフェクト。半透明は使わず、ゲームの中で1コマおきに点滅させて透けて見せる。
// どちらも左右反転しても変に見えない形にする。置くときの基準はコマの真ん中。
import { gridFrames, md, PixelGrid } from '../lib';
import { GLITCH } from './palette';
import { hash } from '../world/wrap';

const W = md(7, 7, 7);


/**
 * UFOの吸い上げる光 32×64。上がせまく下が広い光の柱。ふちの線と、上へ流れる輪で描き、
 * 中はほとんど空けておく(中の買い物客が見えるように)。上の端をUFOの口に合わせて置く
 */
function ufoBeam(w: number, h: number, n: number): PixelGrid[] {
  return gridFrames(w, h, n, (g, i) => {
    const half = (y: number) => 6 + (y / (h - 1)) * 9;
    const cx = w / 2;
    for (let y = 0; y < h; y++) {
      const hw = half(y);
      const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw) - 1;
      // ふち(2本の線)
      g.px(x0, y, GLITCH[1]).px(x1, y, GLITCH[1]);
      g.px(x0 + 1, y, (y + i * 2) % 4 < 2 ? GLITCH[0] : GLITCH[2]).px(x1 - 1, y, (y + i * 2) % 4 < 2 ? GLITCH[0] : GLITCH[2]);
      // 上へ流れる輪(8ドットおき)
      if ((y + i * 2) % 8 === 0) for (let x = x0 + 2; x <= x1 - 2; x++) g.px(x, y, (x + y) % 2 ? GLITCH[0] : W);
      // 中の粒
      if (hash(0, Math.floor((y + i * 4) / 2), 5) > 0.55) {
        const x = Math.round(cx - hw + 3 + hash(1, Math.floor((y + i * 4) / 2), 6) * (hw * 2 - 6));
        g.px(x, y, W);
      }
    }
  });
}

/**
 * くずれのノイズ 64×64。黄緑の横長のかけらと、ずれた走査線。人の体の大きさ(真ん中あたり)に集める。
 * コマごとに場所を変える
 */
function glitch(w: number, h: number, n: number): PixelGrid[] {
  return gridFrames(w, h, n, (g, i) => {
    const cols = [GLITCH[0], GLITCH[1], GLITCH[2], W];
    for (let k = 0; k < 16; k++) {
      const y = 6 + Math.floor(hash(k, i, 1) * 52);
      const cx = 32 + (hash(k, i, 2) - 0.5) * 30;
      const len = 3 + Math.floor(hash(k, i, 3) * 10);
      const c = cols[Math.floor(hash(k, i, 4) * 3.2)];
      const x0 = Math.round(cx - len / 2);
      for (let x = x0; x < x0 + len; x++) g.px(x, y, c);
      if (len > 8) for (let x = x0 + 2; x < x0 + len - 1; x += 2) g.px(x, y + 1, GLITCH[2]);
    }
    // 走査線(1本の長い線と、点線)
    const sy = 14 + i * 11;
    for (let x = 14; x < 50; x++) if (hash(x, sy, i) > 0.2) g.px(x, sy, GLITCH[1]);
    for (let x = 18; x < 46; x += 3) g.px(x, 60 - sy + 10, GLITCH[0]);
    // 小さな四角いかけら
    for (let k = 0; k < 5; k++) {
      const x = 16 + Math.floor(hash(k, i, 7) * 30), y = 8 + Math.floor(hash(k, i, 8) * 46);
      g.px(x, y, W).px(x + 1, y, GLITCH[1]).px(x, y + 1, GLITCH[1]).px(x + 1, y + 1, GLITCH[2]);
    }
  });
}

export const FX3: Record<string, (w: number, h: number, n: number) => PixelGrid[]> = {
  fx_ufobeam: ufoBeam,
  fx_glitch: glitch
};
