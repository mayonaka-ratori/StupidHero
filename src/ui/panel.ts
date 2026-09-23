// 下の操作部分の背景(layout.panelTop から画面の下まで)。
// 使い方:
//   addPanel(this);                        // 背景を置く(depth は DEPTH.panel)
//   const r = panelRect();                 // 中身を置ける四角 { x, y, w, h }(左右8ドット、下はホームバーのぶんをあける)
//   new Button(this, r.x, r.bottom - 56, 96, 56, '待て!', { color: 'stop' });

import Phaser from 'phaser';
import { UI } from '../config';
import { layout } from '../layout';
import { DEPTH } from './theme';

export interface PanelRect { x: number; y: number; w: number; h: number; right: number; bottom: number }

/** 操作部分の背景を置く */
export function addPanel(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const { W, H, panelTop } = layout;
  const g = scene.add.graphics().setDepth(DEPTH.panel);
  g.fillStyle(UI.panel, 1).fillRect(0, panelTop, W, H - panelTop);
  g.fillStyle(UI.black, 1).fillRect(0, panelTop, W, 1);
  g.fillStyle(UI.panelLine, 1).fillRect(0, panelTop + 1, W, 2);
  // 下のほうに、目立たない横じま(メガドライブの背景らしく)
  g.fillStyle(0x15122a, 1);
  for (let y = panelTop + 6; y < H; y += 4) g.fillRect(0, y, W, 1);
  return g;
}

/** 操作部分の中で、ものを置ける四角 */
export function panelRect(margin = 8): PanelRect {
  const { W, H, panelTop, safeBottom } = layout;
  const x = margin;
  const y = panelTop + 3 + margin;
  const bottom = H - Math.max(margin, safeBottom + 4);
  return { x, y, w: W - margin * 2, h: bottom - y, right: W - margin, bottom };
}
