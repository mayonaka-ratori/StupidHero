// 一時停止。画面が隠れたとき(アプリの切り替えや通知)と、中断ボタンのときに、シーンを止めて
// 「タップで再開」を重ねて出す。タップで再開する。
// 使い方(ゲームのシーンの create の中で):
//   const pause = new PauseControl(this, {
//     onPause: () => audio.suspend(),      // 止めたとき(なくてもよい)
//     onResume: () => audio.resume()       // タップで再開したとき。タップの中で呼ばれるので音の再開にも使える
//   });
//   new IconButton(this, 204, 12, 'pause', () => pause.pause());
//   pause.enabled = false;                 // 結果画面などで、隠れても止めないとき
// 止めている間は、そのシーンの時計、動き、アニメがすべて止まる。上に 'UiPause' というシーンが重なる。
// 音の担当は pauseEvents.on('pause' | 'resume', fn) でも受け取れる。止めている間は曲も止める(下の pauseEvents.on)。

import Phaser from 'phaser';
import { UI } from '../config';
import { audio } from '../audio';
import { layout } from '../layout';
import { PixelText } from './text';
import { FS } from './theme';

export const PAUSE_SCENE = 'UiPause';

/** 止めた/再開したを知らせる。('pause', reason) と ('resume') */
export const pauseEvents = new Phaser.Events.EventEmitter();
// 止めている間は曲も止める
pauseEvents.on('pause', () => audio.pauseBgm());
pauseEvents.on('resume', () => audio.resumeBgm());

export type PauseReason = 'button' | 'hidden';

export interface PauseOptions {
  onPause?: (reason: PauseReason) => void;
  onResume?: () => void;
  /** 画面が隠れたら自動で止める(ふつう true) */
  auto?: boolean;
  /** 重ねて出す文字 */
  title?: string;
  hint?: string;
}

export class PauseControl {
  enabled = true;
  private isPaused = false;
  private opt: PauseOptions;
  private onVis = (): void => { if (document.hidden) this.pause('hidden'); };
  private onEnd = (): void => this.destroy();

  constructor(private scene: Phaser.Scene, opt: PauseOptions = {}) {
    this.opt = opt;
    if (opt.auto !== false) {
      document.addEventListener('visibilitychange', this.onVis);
      window.addEventListener('pagehide', this.onVis);
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onEnd);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.onEnd);
  }

  get paused(): boolean { return this.isPaused; }

  pause(reason: PauseReason = 'button'): void {
    if (!this.enabled || this.isPaused) return;
    const sp = this.scene.scene;
    if (!sp.isActive() && !sp.isPaused()) return;
    this.isPaused = true;
    const mgr = this.scene.game.scene;
    if (!mgr.getScene(PAUSE_SCENE)) mgr.add(PAUSE_SCENE, PauseOverlay, false);
    sp.pause();
    sp.launch(PAUSE_SCENE, { control: this, title: this.opt.title, hint: this.opt.hint });
    sp.bringToTop(PAUSE_SCENE);
    this.opt.onPause?.(reason);
    pauseEvents.emit('pause', reason);
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    const sp = this.scene.scene;
    sp.stop(PAUSE_SCENE);
    sp.resume();
    this.opt.onResume?.();
    pauseEvents.emit('resume');
  }

  destroy(): void {
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('pagehide', this.onVis);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onEnd);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.onEnd);
    if (this.isPaused) {
      this.isPaused = false;
      this.scene.game.scene.stop(PAUSE_SCENE);
      // 止めたままシーンが終わったときも、曲などを戻す
      pauseEvents.emit('resume');
    }
  }
}

/** 市松もようのテクスチャ(半透明を使わずに暗くするため) */
export function ditherTexture(scene: Phaser.Scene, key = '__ui_dither', color = '#000000'): string {
  if (scene.textures.exists(key)) return key;
  const c = document.createElement('canvas');
  c.width = 2; c.height = 2;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, 1, 1);
  g.fillRect(1, 1, 1, 1);
  scene.textures.addCanvas(key, c);
  return key;
}

interface OverlayData { control: PauseControl; title?: string; hint?: string }

/** main.ts でゲームの起動時に登録しておく */
export class PauseOverlay extends Phaser.Scene {
  private shownAt = 0;
  constructor() { super(PAUSE_SCENE); }

  create(data: OverlayData): void {
    const { W, H } = layout;
    this.shownAt = performance.now();
    this.add.tileSprite(0, 0, W, H, ditherTexture(this)).setOrigin(0);
    const cy = Math.round(H * 0.42);
    const g = this.add.graphics();
    g.fillStyle(UI.black, 1).fillRect(0, cy - 26, W, 60);
    g.fillStyle(UI.panelLine, 1).fillRect(0, cy - 26, W, 1).fillRect(0, cy + 33, W, 1);
    new PixelText(this, W / 2, cy - 18, data.title ?? 'ひとやすみ中', { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0);
    const hint = new PixelText(this, W / 2, cy + 8, data.hint ?? 'タップで再開', { size: FS.body, color: UI.text }).setOrigin(0.5, 0);
    this.time.addEvent({ delay: 500, loop: true, callback: () => hint.setVisible(!hint.visible) });
    this.input.on('pointerdown', () => {
      // 止めたときと同じタップで再開しないように、少し待つ
      if (performance.now() - this.shownAt < 300) return;
      data.control.resume();
    });
  }
}
