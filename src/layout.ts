import { ACTION_H, GAME_W, MAX_H, MIN_H } from './config';

/** 論理座標での画面の区切り。起動時に一度だけ決まる。 */
export interface Layout {
  /** 横幅(216固定) */
  W: number;
  /** 高さ(384〜468) */
  H: number;
  /** アクション部分の高さ(214) */
  actionH: number;
  /** 下の操作部分の上端(=actionH) */
  panelTop: number;
  /** 下の操作部分の高さ */
  panelH: number;
  /** ホームバーのぶん、ボタンを上にずらす量(論理ドット) */
  safeBottom: number;
}

export let layout: Layout = {
  W: GAME_W, H: MIN_H, actionH: ACTION_H, panelTop: ACTION_H, panelH: MIN_H - ACTION_H, safeBottom: 0
};

export function computeLayout(): Layout {
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  // 横向きのときは縦向きを想定した比率で作る(「縦にしてね」を出している間の仮の値)
  const ratio = vh >= vw ? vh / vw : vw / vh;
  const H = Math.max(MIN_H, Math.min(MAX_H, Math.round(GAME_W * ratio)));
  const probe = document.getElementById('safe-probe');
  const safeCss = probe ? probe.getBoundingClientRect().height : 0;
  const cssPerLogical = Math.min(vw / GAME_W, vh / H);
  const safeBottom = Math.ceil(safeCss / Math.max(cssPerLogical, 0.001));
  layout = { W: GAME_W, H, actionH: ACTION_H, panelTop: ACTION_H, panelH: H - ACTION_H, safeBottom };
  return layout;
}

/**
 * キャンバスを画面に合わせて拡大する。
 * 実際の画素の数で整数倍にし、整数倍だと小さくなりすぎるときだけ小数倍にする。
 */
export function fitCanvas(canvas: HTMLCanvasElement, W: number, H: number): void {
  const dpr = window.devicePixelRatio || 1;
  const devW = window.innerWidth * dpr;
  const devH = window.innerHeight * dpr;
  let s = Math.min(devW / W, devH / H);
  const si = Math.floor(s);
  if (si >= 1 && si / s >= 0.85) s = si;
  canvas.style.width = `${(W * s) / dpr}px`;
  canvas.style.height = `${(H * s) / dpr}px`;
}
