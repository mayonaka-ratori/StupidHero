// フリープレイのヒーローの光(fx_aura と同じ 64×64。置くときの基準はコマの真ん中。ヒーローの後ろに重ねる)。
//   fx_aura_attack:殴りかかるとき。赤いトゲトゲの形
//   fx_aura_pass:素通りするとき。水色の丸い形
//   *_line:「光と揺れを弱くする」のときの、点滅させないふち取り(1コマ)。形は光と同じ
// 色だけでなく形で見分けがつくように、殴りかかるほうは外へとがらせ、素通りのほうはなめらかな丸にする。
// 半透明は使わず、光のほうはゲームの中で1コマおきに点滅させる。左右反転しても変に見えない形にする。
import { gridFrames, md, OUTLINE, PixelGrid } from '../lib';

/** 赤(内側の明るい色、ふつう、とがった先の暗い色) */
const RED = [md(7, 5, 4), md(7, 1, 1), md(4, 0, 1)] as const;
/** 水色(白、ふつう、外側の濃い色) */
const CYAN = [md(7, 7, 7), md(4, 7, 7), md(1, 5, 7)] as const;

const CX = 32, CY = 33;
/** 体を包む楕円の大きさ(fx_aura とほぼ同じ) */
const RX = 17, RY = 25;
/** トゲの数 */
const SPIKES = 12;


/** 楕円のものさしで、真ん中からの距離(楕円の上で1) */
const ell = (x: number, y: number): number => Math.hypot((x + 0.5 - CX) / RX, (y + 0.5 - CY) / RY);
const angle = (x: number, y: number): number => Math.atan2(y + 0.5 - CY, x + 0.5 - CX);

/**
 * トゲの外の端(楕円のものさし)。三角の波で、とがった先が SPIKES 本。
 * phase でトゲの場所を回し、long でトゲを1本おきに長くする
 */
function spikeEdge(a: number, phase: number, long = 0): number {
  const u = ((a / (Math.PI * 2)) * SPIKES + phase + 100) % 1;
  const tri = 1 - Math.abs(u * 2 - 1);
  const k = Math.floor(((a / (Math.PI * 2)) * SPIKES + phase + 100)) % 2;
  return 1 + tri * (0.26 + (k === 0 ? long : 0));
}

/** 丸の外の端(楕円のものさし)。ほんの少しだけふくらんだりしぼんだりする */
const roundEdge = (i: number): number => 1.06 + (i % 2 ? 0.02 : 0);

/** 殴りかかるときの光:赤いトゲトゲの輪 */
export const auraAttack = (n: number): PixelGrid[] => gridFrames(64, 64, n, (g, i) => {
  const phase = i * 0.25, long = i % 2 ? 0.06 : 0.02;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const d = ell(x, y), e = spikeEdge(angle(x, y), phase, long);
    if (d < 0.8 || d > e) continue;
    // 体に近いほど明るく、トゲの先ほど暗い
    const t = (d - 0.8) / (e - 0.8);
    g.px(x, y, d < 0.88 ? RED[0] : t > 0.78 ? RED[2] : RED[1]);
  }
});

/** 素通りするときの光:水色の丸い輪と、立ちのぼる泡 */
export const auraPass = (n: number): PixelGrid[] => gridFrames(64, 64, n, (g, i) => {
  const e = roundEdge(i);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const d = ell(x, y) * (1.02 - Math.abs(Math.sin(angle(x, y))) * 0.02);
    if (d < 0.86 || d > e) continue;
    g.px(x, y, d < 0.92 ? CYAN[0] : d < 0.99 ? CYAN[1] : CYAN[2]);
  }
  // 泡(丸い粒)。輪の外を、コマごとに上へ動かす
  const bubbles: [number, number][] = [[9, 40], [55, 30], [12, 18], [52, 50]];
  bubbles.forEach(([bx, by], k) => {
    const y = by - ((i * 4 + k * 3) % 12);
    const r = k % 2 ? 1 : 2;
    if (r === 2) {
      g.px(bx, y - 1, CYAN[1]).px(bx - 1, y, CYAN[1]).px(bx + 1, y, CYAN[2]).px(bx, y + 1, CYAN[2]).px(bx - 1, y - 1, CYAN[0]);
    } else {
      g.px(bx, y, CYAN[0]).px(bx + 1, y, CYAN[1]);
    }
  });
});

/** 点滅させないふち取り:外の端に沿った2ドットの線(外が明るい色、内がふち色) */
function edgeLine(g: PixelGrid, inside: (x: number, y: number) => boolean, col: string): void {
  const inn = (x: number, y: number) => x >= 0 && y >= 0 && x < 64 && y < 64 && inside(x, y);
  const band: [number, number][] = [];
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    if (!inn(x, y)) continue;
    // 形のふち(外が1ドット先にある)
    if (!inn(x + 1, y) || !inn(x - 1, y) || !inn(x, y + 1) || !inn(x, y - 1)) band.push([x, y]);
  }
  for (const [x, y] of band) g.px(x, y, col);
  // 内側にもう1本、ふち色(明るい背景でも線が見えるように)
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    if (g.get(x, y) || !inn(x, y)) continue;
    if (g.get(x + 1, y) === col || g.get(x - 1, y) === col || g.get(x, y + 1) === col || g.get(x, y - 1) === col) g.px(x, y, OUTLINE);
  }
  // 中は空ける
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (g.get(x, y) !== col && g.get(x, y) !== OUTLINE) g.px(x, y, null);
}

export const auraAttackLine = (n: number): PixelGrid[] => gridFrames(64, 64, n, (g) => {
  edgeLine(g, (x, y) => ell(x, y) <= spikeEdge(angle(x, y), 0, 0.02), RED[1]);
});

export const auraPassLine = (n: number): PixelGrid[] => gridFrames(64, 64, n, (g) => {
  edgeLine(g, (x, y) => ell(x, y) * (1.02 - Math.abs(Math.sin(angle(x, y))) * 0.02) <= roundEdge(0), CYAN[1]);
});
