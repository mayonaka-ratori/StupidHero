// 結果発表の2つのカメラ。
// - world:上のアクション部分(0,0,216,214)だけを映し、ヒーローについて横に動く。揺れるのもこれだけ
// - ui:画面全体を映し、動かない。下の操作部分と、吹き出しや中断ボタン
// 作ったものは、そのとき「どちらのカメラ用か」の設定に合わせて、もう片方のカメラから隠す。
// ふつうは world 用。inUi(() => new Button(...)) の中で作ったものは ui 用になる。
// (ui の fx.ts の popText、banner、flash なども world 用として作られるので、アクション部分に出る)

import Phaser from 'phaser';
import { layout } from '../../layout';

export class Layers {
  readonly world: Phaser.Cameras.Scene2D.Camera;
  readonly ui: Phaser.Cameras.Scene2D.Camera;
  private mode: 'world' | 'ui' = 'world';

  constructor(scene: Phaser.Scene) {
    const { W, H, actionH } = layout;
    this.world = scene.cameras.main;
    this.world.setViewport(0, 0, W, actionH);
    // タップは ui のカメラだけで受ける(動くカメラで当たりを調べると、ずれた位置のボタンが反応するため)
    this.world.inputEnabled = false;
    this.ui = scene.cameras.add(0, 0, W, H, false, 'ui');
    const onAdd = (obj: Phaser.GameObjects.GameObject): void => {
      if (this.mode === 'world') this.ui.ignore(obj);
      else this.world.ignore(obj);
    };
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdd);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdd));
  }

  /** この中で作ったものは ui のカメラだけに映る */
  inUi<T>(fn: () => T): T {
    const prev = this.mode;
    this.mode = 'ui';
    try { return fn(); } finally { this.mode = prev; }
  }

  /** 通りの x を画面の x に */
  screenX(x: number): number {
    return x - this.world.scrollX;
  }

  get left(): number { return this.world.scrollX; }
  get right(): number { return this.world.scrollX + layout.W; }
}
