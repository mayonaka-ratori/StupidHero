// いちばんひどい場面の写真を撮る(結果発表 Street、エレベーターラッシュ Elevator、ボス戦 Boss)。
//   shootAction(this, cb, { hide, alarms, show, shiftY })  上のアクション部分を撮る

import type Phaser from 'phaser';
import { layout } from '../layout';
import { snapshotLogical } from '../hires';
import { whenNoFlash, type EdgeAlarm } from '../ui';

type Visible = Phaser.GameObjects.Components.Visible;

export interface ShotOptions {
  /** 写さないもの(撮ったあと、次のフレームで戻す。戻すまでに消えたものは戻さない)。関数なら撮る瞬間に呼ぶ */
  hide?: Visible[] | (() => Visible[]);
  /** 画面の端の点滅(写さない) */
  alarms?: EdgeAlarm[];
  /** 撮るコマでは必ず出すもの(1コマおきに点滅する光など) */
  show?: Visible[];
  /** 写真を何ドット下へずらすか(上の空いたところは写真のいちばん上の行をのばしてうめる) */
  shiftY?: number;
}

/**
 * 撮った写真を dy ドット下へずらした、同じ大きさ(撮った高さ + dy)の写真にする。上の空いたところは写真のいちばん上の行
 * (空や天井)をのばしてうめる。結果画面は読みこみ中の写真も待ってから描くので、読みこみを待たずに返してよい
 */
function shiftShot(img: HTMLImageElement, dy: number): HTMLImageElement {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height + dy;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, img.width, 1, 0, 0, img.width, dy);
  g.drawImage(img, 0, dy);
  const out = new Image();
  out.src = c.toDataURL('image/png');
  return out;
}

/**
 * 上のアクション部分を撮る。画面全体の光(flash)が出ているコマは真っ白に写るので、光が消えるまで待つ。
 * シーンが止まっていたら撮らない
 */
export function shootAction(scene: Phaser.Scene, cb: (img: HTMLImageElement) => void, opt: ShotOptions = {}): void {
  whenNoFlash(scene, () => {
    if (!scene.sys.isActive()) return;
    const hidden = (typeof opt.hide === 'function' ? opt.hide() : opt.hide) ?? [];
    for (const o of hidden) o.setVisible(false);
    for (const a of opt.alarms ?? []) a.hideNow();
    for (const o of opt.show ?? []) o.setVisible(true);
    const dy = Math.max(0, Math.round(opt.shiftY ?? 0));
    snapshotLogical(scene.game, 0, 0, layout.W, layout.actionH - dy, (img) => cb(dy ? shiftShot(img, dy) : img));
    // 撮影はこのフレームの描画で行われるので、次のフレームで戻す
    if (hidden.length > 0) {
      scene.time.delayedCall(0, () => { for (const o of hidden) if ((o as unknown as Phaser.GameObjects.GameObject).active) o.setVisible(true); });
    }
  });
}
