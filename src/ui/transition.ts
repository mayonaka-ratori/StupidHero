// 画面の切り替え。ドット風のワイプ(四角が斜めに広がって画面をふさぎ、次のシーンでまたひらく)で次のシーンへ行く。
// 使い方:
//   goto(this, SCENES.sort, { wave: 1 });                  // ふつうのワイプ(合わせて約0.4秒)
//   goto(this, SCENES.result, data, { kind: 'fade' });       // 段階的に暗くなるフェード
//   goto(this, SCENES.title, undefined, { ms: 600, color: 0xffffff });   // 白いワイプ、ゆっくり
// 切り替えの途中でもう一度呼んでも無視する(ボタンの連打で2回行かないように)。
// 途中はタップを受け付けない。上に 'UiWipe' というシーンが重なる。

import Phaser from 'phaser';
import { layout } from '../layout';

export const WIPE_SCENE = 'UiWipe';

export interface GotoOptions {
  kind?: 'wipe' | 'fade';
  /** 閉じてから開くまで全部の時間(ミリ秒) */
  ms?: number;
  color?: number;
  /** 閉じきったときに呼ぶ(次のシーンが始まる前) */
  onCovered?: () => void;
}

let busy = false;

/** いま切り替えの途中か */
export const isTransitioning = (): boolean => busy;

export function goto(from: Phaser.Scene, to: string, data?: object, opt: GotoOptions = {}): void {
  if (busy) return;
  busy = true;
  const mgr = from.game.scene;
  if (!mgr.getScene(WIPE_SCENE)) mgr.add(WIPE_SCENE, WipeScene, false);
  mgr.start(WIPE_SCENE, { from: from.scene.key, to, data, opt });
  mgr.bringToTop(WIPE_SCENE);
}

interface WipeData { from: string; to: string; data?: object; opt: GotoOptions }

const CELL = 8;

class WipeScene extends Phaser.Scene {
  constructor() { super(WIPE_SCENE); }

  create(d: WipeData): void {
    const { W, H } = layout;
    const kind = d.opt.kind ?? 'wipe';
    const total = d.opt.ms ?? 400;
    const half = total / 2;
    const color = d.opt.color ?? 0x000000;
    // 下のシーンのタップを止める
    this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    const cols = Math.ceil(W / CELL);
    const rows = Math.ceil(H / CELL);
    const spread = 0.6; // 左上と右下で、どれだけずれて始まるか

    const draw = (t: number, opening: boolean): void => {
      g.clear();
      g.fillStyle(color, 1);
      if (kind === 'fade') {
        // 4段階で暗くなる
        const step = Math.round(t * 4) / 4;
        g.setAlpha(step);
        g.fillRect(0, 0, W, H);
        return;
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const delay = ((i / cols) * 0.6 + (j / rows) * 0.4) * spread;
        let p = Phaser.Math.Clamp((t * (1 + spread) - delay) / 1, 0, 1);
        if (opening) p = 1 - p;
        const s = Math.round(p * CELL / 2) * 2;
        if (s <= 0) continue;
        const o = (CELL - s) / 2;
        g.fillRect(i * CELL + o, j * CELL + o, s, s);
      }
    };

    let t0 = this.time.now;
    let phase: 'close' | 'open' = 'close';
    draw(0, false);
    const tick = (): void => {
      const t = Math.min(1, (this.time.now - t0) / half);
      if (phase === 'close') {
        draw(t, false);
        if (t >= 1) {
          phase = 'open';
          d.opt.onCovered?.();
          const mgr = this.game.scene;
          mgr.stop(d.from);
          mgr.start(d.to, d.data);
          mgr.bringToTop(WIPE_SCENE);
          // 次のシーンの create が終わってから開き始める
          t0 = this.time.now + 34;
        }
      } else if (this.time.now >= t0) {
        draw(t, true);
        if (t >= 1) {
          this.events.off(Phaser.Scenes.Events.UPDATE, tick);
          busy = false;
          this.scene.stop();
        }
      }
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, tick);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.events.off(Phaser.Scenes.Events.UPDATE, tick); busy = false; });
  }
}
