// 画面を細かく描くための仕組み。
// ゲームの座標はこれまで通り横216の「論理ドット」のまま。キャンバスだけを RES 倍の細かさで作り、
// すべてのカメラを RES 倍に拡大して映す。ドット絵は拡大されてドットのまま、字だけは細かく描ける。
//
// - カメラ:cameras.add、setViewport、setZoom に渡す数は論理ドットのまま(ここで RES 倍にする)
// - 指の位置:pointer.x / pointer.y はキャンバスの細かさなので、画面の論理座標がほしいときは px(p) を使う
// - 画面の撮影:snapshotLogical を使う(論理ドットの大きさの画像が返る)

import Phaser from 'phaser';

/** 論理ドット1つが、キャンバスの何ピクセルか */
export let RES = 1;

let installed = false;

export function installHiRes(res: number): void {
  RES = Math.max(1, Math.round(res));
  if (installed) return;
  installed = true;
  const CM = Phaser.Cameras.Scene2D.CameraManager.prototype as unknown as {
    add: (x?: number, y?: number, w?: number, h?: number, makeMain?: boolean, name?: string) => Phaser.Cameras.Scene2D.Camera;
  };
  const Cam = Phaser.Cameras.Scene2D.BaseCamera.prototype as unknown as {
    setZoom: (x?: number, y?: number) => Phaser.Cameras.Scene2D.BaseCamera;
    setViewport: (x: number, y: number, w?: number, h?: number) => Phaser.Cameras.Scene2D.BaseCamera;
  };
  const origZoom = Cam.setZoom;
  const origViewport = Cam.setViewport;
  const origAdd = CM.add;
  const mul = (v: number | undefined): number | undefined => (v === undefined ? undefined : v * RES);
  Cam.setZoom = function (x = 1, y = x) { return origZoom.call(this, x * RES, y * RES); };
  Cam.setViewport = function (x, y, w, h) { return origViewport.call(this, x * RES, y * RES, mul(w), mul(h)); };
  CM.add = function (x, y, w, h, makeMain, name) {
    const cam = origAdd.call(this, mul(x), mul(y), mul(w), mul(h), makeMain, name);
    cam.setOrigin(0, 0);
    cam.setZoom(1);
    return cam;
  };
}

/** しばらくだけ RES を変えて fn を呼ぶ(共有カードのように、画面とは別の細かさで字を描くとき) */
export function withRes<T>(res: number, fn: () => T): T {
  const prev = RES;
  RES = Math.max(1, Math.round(res));
  try { return fn(); } finally { RES = prev; }
}

/** 指の位置を、画面の論理座標で */
export const px = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x / RES, y: p.y / RES });

/**
 * 画面の一部を、論理ドットの大きさの画像として撮る(ドットは1つおきに拾うので、絵はにじまない)。
 * cb には読みこみの終わった HTMLImageElement が渡る。
 */
export function snapshotLogical(game: Phaser.Game, x: number, y: number, w: number, h: number, cb: (img: HTMLImageElement) => void): void {
  game.renderer.snapshotArea(x * RES, y * RES, w * RES, h * RES, (big) => {
    if (!(big instanceof HTMLImageElement)) return;
    const done = (): void => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.drawImage(big, 0, 0, w * RES, h * RES, 0, 0, w, h);
      const img = new Image();
      img.onload = () => cb(img);
      img.src = c.toDataURL('image/png');
    };
    if (big.complete && big.naturalWidth) done(); else big.onload = done;
  });
}
