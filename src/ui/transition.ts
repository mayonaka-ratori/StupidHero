// 画面の切り替え。ドット風のワイプ(四角が斜めに広がって画面をふさぎ、次のシーンでまたひらく)で次のシーンへ行く。
// 使い方:
//   goto(this, SCENES.sort, { wave: 1 });                  // ふつうのワイプ(合わせて約0.4秒)
//   goto(this, SCENES.result, data, { kind: 'fade' });       // 段階的に暗くなるフェード
//   goto(this, SCENES.title, undefined, { ms: 600, color: 0xffffff });   // 白いワイプ、ゆっくり
// 切り替えの途中でもう一度呼んでも無視する(ボタンの連打で2回行かないように)。goto は受け付けたら true、無視したら false を返す。
//   if (goto(this, SCENES.sort)) this.leaving = true;      // 受け付けたときだけ「出ていく途中」にする
//   gotoWhenFree(this, SCENES.street);                     // 自動で次へ進むとき:切り替えの途中なら、終わってから行く
// 画面が隠れている間はワイプを進めない。
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

export function goto(from: Phaser.Scene, to: string, data?: object, opt: GotoOptions = {}): boolean {
  if (busy) return false;
  busy = true;
  const mgr = from.game.scene;
  try {
    if (!mgr.getScene(WIPE_SCENE)) mgr.add(WIPE_SCENE, WipeScene, false);
    mgr.start(WIPE_SCENE, { from: from.scene.key, to, data, opt });
    mgr.bringToTop(WIPE_SCENE);
  } catch (e) {
    // ワイプが使えないときは、そのまま次のシーンへ行く(ゲームを止めない)
    busy = false;
    console.error(e);
    from.scene.start(to, data);
  }
  return true;
}

/**
 * 自動で次へ進むとき用。切り替えの途中なら、終わるのを待ってから行く。
 * シーンが止めてある(一時停止)間は待ち、シーンが終わっていたら行かない。
 */
export function gotoWhenFree(from: Phaser.Scene, to: string, data?: object, opt: GotoOptions = {}): void {
  const tryGo = (): void => {
    const sys = from.sys;
    if (!sys || (!sys.isActive() && !sys.isPaused())) return;
    if (sys.isPaused() || busy) { window.setTimeout(tryGo, 50); return; }
    if (!goto(from, to, data, opt)) window.setTimeout(tryGo, 50);
  };
  // ゲームの更新の外から呼ぶ(更新中に start すると失敗することがあるため。sort/common.ts の gotoSafe と同じ)
  window.setTimeout(tryGo, 0);
}

interface WipeData { from: string; to: string; data?: object; opt: GotoOptions }

const CELL = 8;

/** main.ts でゲームの起動時に登録しておく(あとから add すると、更新中に呼んだとき start が失敗するため) */
export class WipeScene extends Phaser.Scene {
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
    let last = t0;
    let phase: 'close' | 'open' = 'close';
    draw(0, false);
    const tick = (): void => {
      // 画面が隠れている間は進めない(戻ったときに時間が飛んでいても、その分は数えない)
      const now = this.time.now;
      const step = now - last;
      last = now;
      if (document.hidden) { t0 += step; return; }
      if (step > 100) t0 += step - 16;
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
