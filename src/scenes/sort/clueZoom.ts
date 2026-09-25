// 仕分けの画面の「持ち物」の窓。いまの人の手がかりの場所(src/art/clueSpots.ts)を切り出して3倍で見せる。
//   const zoom = new ClueZoom(this, 142, 90);
//   zoom.setPerson(textureKey, person.sheetKey);  // 人が入れ替わったとき(小物を塗り替えたシートのキーでよい)
//   zoom.sync(card, idle);                        // 毎フレーム。idle のときは人の絵と同じコマを見せる(動きについていく)
//   zoom.clear();                                 // 人がいないとき
// 絵は同じテクスチャの Sprite を setCrop で切り出して拡大するだけ(ドットのまま、にじまない)。
//
// ステージ4(高層ビル)は「まわり」の窓にする(docs/STAGE4.md の「まわり」の窓):
//   zoom.setSurround(rect, objects);   // 画面の四角 rect(机の小物のあたり)を3倍で映す。映すのは objects だけ
// 人の絵ではなく、画面の決まった四角を小さなカメラで映す。窓の上の札の字も「まわり」にする。
// setPerson、sync、clear は、このときは何もしない(机はだれが出ても同じ場所にあるので)。

import Phaser from 'phaser';
import { UI } from '../../config';
import { CLUE_H, CLUE_W, clueSpotFor, type ClueRect } from '../../art/clueSpots';
import { frameIndex, sheetByKey } from '../../art/sheets';
import { FRAME_PAD, FS, PixelText, UIX, drawFrame } from '../../ui';

/** 何倍で見せるか */
const ZOOM = 3;
/** 窓の大きさ */
const ZOOM_W = CLUE_W * ZOOM + FRAME_PAD * 2 + 2;
const ZOOM_H = FRAME_PAD * 2 + 2 + FS.body + 3 + CLUE_H * ZOOM + 1;

export class ClueZoom {
  private g: Phaser.GameObjects.Graphics;
  private title: PixelText;
  private img: Phaser.GameObjects.Sprite;
  private rect: ClueRect = clueSpotFor('');
  /** 「まわり」の窓のカメラ(ステージ4だけ) */
  private cam: Phaser.Cameras.Scene2D.Camera | null = null;
  /** 絵を置く左上 */
  private ix: number;
  private iy: number;

  constructor(private scene: Phaser.Scene, x: number, y: number, depth: number) {
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
  get objects(): Phaser.GameObjects.Components.Visible[] {
    const out: Phaser.GameObjects.Components.Visible[] = [this.g, this.title, this.img];
    if (this.cam) out.push(this.cam as unknown as Phaser.GameObjects.Components.Visible);
    return out;
  }

  /**
   * 「まわり」の窓にする(ステージ4)。画面の四角 rect(大きさは CLUE_W×CLUE_H)を3倍で映す。
   * 映すのは show に入れたもの(背景、照明、机、小物、もれ、糸、風船)だけで、人やハンコや字は映さない
   */
  setSurround(rect: ClueRect, show: readonly Phaser.GameObjects.GameObject[]): void {
    const scene = this.scene;
    this.title.setText('まわり');
    this.img.setVisible(false);
    this.rect = rect;
    const cam = scene.cameras.add(this.ix, this.iy, CLUE_W * ZOOM, CLUE_H * ZOOM);
    cam.setZoom(ZOOM).setScroll(rect.x, rect.y).setRoundPixels(true);
    this.cam = cam;
    const allowed = new Set<Phaser.GameObjects.GameObject>(show);
    const hide = (o: Phaser.GameObjects.GameObject): void => { if (!allowed.has(o)) o.cameraFilter |= cam.id; };
    for (const o of scene.children.list) hide(o);
    // あとから出てくるもの(ハンコ、帯、光など)も映さない
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, hide);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, hide));
  }

  /** いまの人の絵にする(はじめは仕分けの動きの1コマ目) */
  setPerson(textureKey: string, sheetKey: string): void {
    if (this.cam) return;
    this.rect = clueSpotFor(sheetKey);
    const f = frameIndex(sheetByKey(sheetKey), 'sortIdle', 0);
    this.img.setTexture(textureKey, f);
    this.img.setCrop(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    this.img.setPosition(this.ix - this.rect.x * ZOOM, this.iy - this.rect.y * ZOOM).setVisible(true);
  }

  /** 人の絵と同じコマにする。idle でないとき(歩いて入ってくるところ)は仕分けの動きの1コマ目のまま */
  sync(card: Phaser.GameObjects.Sprite, idle: boolean): void {
    if (this.cam || !this.img.visible || !idle || card.texture.key !== this.img.texture.key) return;
    if (card.frame.name !== this.img.frame.name) this.img.setFrame(card.frame.name);
  }

  clear(): void {
    if (this.cam) return;
    this.img.setVisible(false);
  }
}
