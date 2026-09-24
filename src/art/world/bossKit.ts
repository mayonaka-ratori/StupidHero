// 3つのステージのボスの絵で共通に使う道具(96×96のコマ)。

import { PixelGrid } from '../lib';
import { type Look, type Pose, drawPerson, stretchPose } from './figure';
import { idleFrames, walkFrames } from './poses';
import { type Painter, type Pt, bbox, shifted } from './pix';

/** 96×96のコマに人を描く */
export const P96 = (look: Look, p: Pose): PixelGrid => drawPerson(look, p, 96, 96);

/** 足の裏(y=91)にそろえる。centerX で体の真ん中(x=48)にもそろえる */
export function alignFeet(g: PixelGrid, centerX = false): PixelGrid {
  const b = bbox(g);
  if (!b) return g;
  return shifted(g, centerX ? 48 - Math.round((b.x0 + b.x1) / 2) : 0, 91 - b.y1);
}

/** 空中のコマ:体の真ん中を (48, 46) にそろえる */
export function alignCenter(g: PixelGrid): PixelGrid {
  const b = bbox(g);
  if (!b) return g;
  return shifted(g, 48 - Math.round((b.x0 + b.x1) / 2), 46 - Math.round((b.y0 + b.y1) / 2));
}

export interface ScrapStyle {
  /** 首から下へ何ドットのところから飛ばすか */
  dy: number;
  /** step 1つで飛ぶ距離の増え方 */
  spread: number;
  /** 切れはしの色。i 番目の切れはしは colors[i % 長さ] */
  colors: readonly string[];
  /** この外に出た切れはしは描かない */
  xMax: number;
  yMin: number;
}

/** 化けていた服の切れはし。step が大きいほど遠くへ飛ぶ */
export function drawScraps(P: Painter, pose: Pose, step: number, style: ScrapStyle): void {
  const c: Pt = [pose.neck[0], pose.neck[1] + style.dy];
  const pieces: [number, number, number][] = [
    [-2.4, 14, 0], [-0.5, 18, 1], [0.4, 16, 2], [1.4, 17, 1], [2.3, 15, 0], [3.0, 19, 2], [-1.4, 20, 1], [4.2, 16, 2]
  ];
  const shapes = [['111.', '.111', '..1.'], ['.11', '111', '1..'], ['11..', '.111', '.11.', '..1.']];
  pieces.forEach(([ang, d, sh], i) => {
    const r = d * (0.35 + step * style.spread) + (i % 3);
    const x = Math.round(c[0] + Math.cos(ang) * r * 1.4), y = Math.round(c[1] + Math.sin(ang) * r - step * 3);
    if (y > 88 || y < style.yMin || x < 1 || x > style.xMax) return;
    const m = P.mask();
    shapes[(sh + step) % shapes.length].forEach((row, j) => { for (let q = 0; q < row.length; q++) if (row[q] === '1') m.set(x + q, y + j); });
    P.fill(m, style.colors[i % style.colors.length], { sep: 'outline', flat: true });
  });
}

/**
 * 化けたボスのシート(待機、歩き、仕分けの3行)。市民の動きを使い、体を少し大きくする(sy は縦、sx は横の倍率)。
 * walk を渡すとその歩き、tweak を渡すと大きくしたあとの動きをさらに変える
 */
export function disguiseRows(
  look: Look, base: Pose, sort: Pose[], opt: { sx: number; sy?: number; walk?: Pose[]; tweak?: (p: Pose) => Pose }
): PixelGrid[][] {
  const st = (p: Pose): Pose => {
    const s = stretchPose(p, opt.sy ?? 1.1, opt.sx);
    return opt.tweak ? opt.tweak(s) : s;
  };
  const draw = (ps: Pose[]): PixelGrid[] => ps.map((p) => drawPerson(look, st(p)));
  return [draw(idleFrames(base)), draw(opt.walk ?? walkFrames(base)), draw(sort)];
}
