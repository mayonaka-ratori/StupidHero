// 仕分けの画面の「持ち物」の窓。いまの人の手がかりの場所(src/art/clueSpots.ts)を切り出して3倍で見せる。
//   const zoom = new ClueZoom(this, 142, 90);
//   zoom.setPerson(textureKey, person.sheetKey);  // 人が入れ替わったとき(小物を塗り替えたシートのキーでよい)
//   zoom.sync(card, idle);                        // 毎フレーム。idle のときは人の絵と同じコマを見せる(動きについていく)
//   zoom.clear();                                 // 人がいないとき
// 絵は同じテクスチャの Sprite を setCrop で切り出して拡大するだけ(ドットのまま、にじまない)。

import Phaser from 'phaser';
import { UI } from '../../config';
import { CLUE_H, CLUE_W, clueSpotFor, type ClueRect } from '../../art/clueSpots';
import { frameIndex, sheetByKey } from '../../art/sheets';
import { FRAME_PAD, FS, PixelText, UIX, drawFrame } from '../../ui';

/** 何倍で見せるか */
export const ZOOM = 3;
/** 窓の大きさ */
export const ZOOM_W = CLUE_W * ZOOM + FRAME_PAD * 2 + 2;
export const ZOOM_H = FRAME_PAD * 2 + 2 + FS.body + 3 + CLUE_H * ZOOM + 1;

export class ClueZoom {
  private g: Phaser.GameObjects.Graphics;
  private title: PixelText;
  private img: Phaser.GameObjects.Sprite;
  private rect: ClueRect = clueSpotFor('');
  /** 絵を置く左上 */
  private ix: number;
  private iy: number;

  constructor(scene: Phaser.Scene, x: number, y: number, depth: number) {
    this.g = scene.add.graphics().setDepth(depth);
    drawFrame(this.g, x, y, ZOOM_W, ZOOM_H, 'win');
    this.ix = x + FRAME_PAD + 1;
    this.iy = y + FRAME_PAD + 1 + FS.body + 3;
    // 絵の後ろは顔の窓と同じ明るい色にして、暗い服でも形が見えるようにする
    this.g.fillStyle(UI.black, 1).fillRect(this.ix - 1, this.iy - 1, CLUE_W * ZOOM + 2, CLUE_H * ZOOM + 2);
    this.g.fillStyle(UIX.faceBg, 1).fillRect(this.ix, this.iy, CLUE_W * ZOOM, CLUE_H * ZOOM);
    this.title = new PixelText(scene, x + Math.round(ZOOM_W / 2), y + FRAME_PAD + 1, '持ち物', { size: FS.body, color: UI.gold })
      .setOrigin(0.5, 0).setDepth(depth + 0.1);
    this.img = scene.add.sprite(0, 0, '__DEFAULT').setOrigin(0, 0).setScale(ZOOM).setDepth(depth + 0.1).setVisible(false);
  }

  /** 中断のときに隠すもの */
  get objects(): Phaser.GameObjects.Components.Visible[] { return [this.g, this.title, this.img]; }

  /** いまの人の絵にする(はじめは仕分けの動きの1コマ目) */
  setPerson(textureKey: string, sheetKey: string): void {
    this.rect = clueSpotFor(sheetKey);
    const f = frameIndex(sheetByKey(sheetKey), 'sortIdle', 0);
    this.img.setTexture(textureKey, f);
    this.img.setCrop(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    this.img.setPosition(this.ix - this.rect.x * ZOOM, this.iy - this.rect.y * ZOOM).setVisible(true);
  }

  /** 人の絵と同じコマにする。idle でないとき(歩いて入ってくるところ)は仕分けの動きの1コマ目のまま */
  sync(card: Phaser.GameObjects.Sprite, idle: boolean): void {
    if (!this.img.visible || !idle || card.texture.key !== this.img.texture.key) return;
    if (card.frame.name !== this.img.frame.name) this.img.setFrame(card.frame.name);
  }

  clear(): void {
    this.img.setVisible(false);
  }
}
