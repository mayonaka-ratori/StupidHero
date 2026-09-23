// 一時停止。画面が隠れたとき(アプリの切り替えや通知)と、中断ボタンのときに、シーンを止めて
// 小さなメニューを重ねて出す。メニューには設定の切りかえ(光と揺れを弱くする、ゆっくりモード、音)と
// 「つづける」「タイトルへ」がある。設定は settings.set で覚える(src/settings.ts)。
// 「タイトルへ」はシーンを止めたままワイプでタイトルへ行く(そのプレイは記録しないで終わる)。
// 使い方(ゲームのシーンの create の中で):
//   const pause = new PauseControl(this, {
//     onPause: () => audio.suspend(),      // 止めたとき(なくてもよい)
//     onResume: () => audio.resume()       // 「つづける」で再開したとき。タップの中で呼ばれるので音の再開にも使える
//   });
//   new IconButton(this, 204, 12, 'pause', () => pause.pause());
//   pause.enabled = false;                 // 結果画面などで、隠れても止めないとき
// 止めている間は、そのシーンの時計、動き、アニメがすべて止まる。上に 'UiPause' というシーンが重なる。
// 音の担当は pauseEvents.on('pause' | 'resume', fn) でも受け取れる。止めている間は曲も止める(下の pauseEvents.on)。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { audio } from '../audio';
import { layout } from '../layout';
import { settings } from '../settings';
import { Button } from './button';
import { WindowFrame } from './frame';
import { MuteButton } from './iconButton';
import { PixelText } from './text';
import { DEPTH, FS } from './theme';
import { goto } from './transition';

export const PAUSE_SCENE = 'UiPause';

/** 止めた/再開したを知らせる。('pause', reason) と ('resume') */
export const pauseEvents = new Phaser.Events.EventEmitter();
// 止めている間は曲も止める
pauseEvents.on('pause', () => audio.pauseBgm());
pauseEvents.on('resume', () => audio.resumeBgm());

export type PauseReason = 'button' | 'hidden' | 'rotate';

/** 横向きの「縦にしてね」を出す条件(index.html の CSS と同じ) */
const LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 540px)';

/** いま動いているシーンの PauseControl */
const liveControls = new Set<PauseControl>();

export interface PauseOptions {
  onPause?: (reason: PauseReason) => void;
  onResume?: () => void;
  /** 画面が隠れたら自動で止める(ふつう true) */
  auto?: boolean;
  /** メニューの見出し(ふつう「一時停止」) */
  title?: string;
}

export class PauseControl {
  enabled = true;
  private isPaused = false;
  /** 「タイトルへ」を押して、出ていく途中 */
  private quitting = false;
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
    liveControls.add(this);
    // 横向きのまま始まったシーン(横向きで読みこみ直したときなど)も止める
    if (isLandscape()) scene.events.once(Phaser.Scenes.Events.CREATE, () => { if (isLandscape()) this.pause('rotate'); });
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
    sp.launch(PAUSE_SCENE, { control: this, title: this.opt.title });
    sp.bringToTop(PAUSE_SCENE);
    this.opt.onPause?.(reason);
    pauseEvents.emit('pause', reason);
  }

  resume(): void {
    if (!this.isPaused || this.quitting) return;
    this.isPaused = false;
    const sp = this.scene.scene;
    sp.stop(PAUSE_SCENE);
    sp.resume();
    refreshMuteButtons(this.scene);
    this.opt.onResume?.();
    pauseEvents.emit('resume');
  }

  /**
   * 止めたまま、ワイプでほかのシーン(ふつうタイトル)へ行く。そのプレイはそこで終わる(記録しない)。
   * シーンは止めたままなので、そのシーンのタイマーや「次の波へ」は動かない。
   */
  quit(to: string = SCENES.title): void {
    if (!this.isPaused || this.quitting) return;
    this.quitting = true;
    // もう止めない(ワイプの途中で画面が隠れても、メニューを出し直さない)
    this.enabled = false;
    // 曲は止めてから「再開」を知らせる(止めた曲は戻らず、次のシーンの曲は鳴るようになる)
    this.isPaused = false;
    audio.stopBgm();
    pauseEvents.emit('resume');
    const mgr = this.scene.game.scene;
    mgr.stop(PAUSE_SCENE);
    // ゲームの更新の外から呼ぶ(gotoSafe と同じ)。ほかの切り替えの途中なら、終わるまで待つ
    const tryGo = (): void => {
      const sys = this.scene.sys;
      if (!sys || (!sys.isActive() && !sys.isPaused())) return;
      if (!goto(this.scene, to, undefined, { kind: 'wipe' })) window.setTimeout(tryGo, 50);
    };
    window.setTimeout(tryGo, 0);
  }

  /** 横向きになったとき:止められたら(もう止まっていても)true */
  holdForRotate(): boolean {
    if (this.isPaused) return true;
    this.pause('rotate');
    return this.isPaused;
  }

  destroy(): void {
    liveControls.delete(this);
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

/** シーンの中の音のボタンの見た目を、いまの状態に合わせる(メニューで音を切りかえたとき) */
function refreshMuteButtons(scene: Phaser.Scene): void {
  const walk = (list: Phaser.GameObjects.GameObject[]): void => {
    for (const o of list) {
      if (o instanceof MuteButton) o.refresh();
      else if (o instanceof Phaser.GameObjects.Container) walk(o.list);
    }
  };
  if (scene.sys?.displayList) walk(scene.children.list);
}

function isLandscape(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(LANDSCAPE_QUERY).matches;
}

/**
 * 横向きになったらゲームを止める(main.ts で一度だけ呼ぶ)。
 * PauseControl のあるシーンではその pause を使い、縦に戻ると「タップで再開」が見えている。
 * PauseControl のないシーン(タイトル、結果画面)では、縦に戻るまでゲームの時計ごと止める。
 */
export function watchOrientation(game: Phaser.Game): void {
  if (typeof window.matchMedia !== 'function') return;
  const mq = window.matchMedia(LANDSCAPE_QUERY);
  let slept = false;
  const apply = (): void => {
    if (mq.matches) {
      for (const c of liveControls) if (c.holdForRotate()) return;
      game.loop.sleep();
      if (!slept) { slept = true; audio.pauseBgm(); }
    } else if (slept) {
      slept = false;
      game.loop.wake(true);
      audio.resumeBgm();
    }
  };
  mq.addEventListener('change', apply);
  // 画面が隠れて戻ったとき、Phaser が時計を動かし直すので、横向きのままならもう一度止める
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(apply, 0); });
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

interface OverlayData { control: PauseControl; title?: string }

/** メニューのウィンドウの幅 */
const MENU_W = 204;
/** 切りかえの行の、左右の字の位置 */
const ROW_X = 12;

/** main.ts でゲームの起動時に登録しておく */
export class PauseOverlay extends Phaser.Scene {
  private shownAt = 0;
  constructor() { super(PAUSE_SCENE); }

  create(data: OverlayData): void {
    const { W, H } = layout;
    this.shownAt = performance.now();
    this.add.tileSprite(0, 0, W, H, ditherTexture(this)).setOrigin(0);
    // 下のシーンにタップが抜けないように、全体をふさぐ
    this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();

    const x = Math.round((W - MENU_W) / 2);
    const rows: { label: string; note?: string; get: () => boolean; set: (on: boolean) => void }[] = [
      {
        label: '光と揺れを弱くする', note: '画面が白く光る、揺れるを\nひかえめに',
        get: () => settings.reduceFx, set: (on) => settings.set('reduceFx', on)
      },
      {
        label: 'ゆっくりモード', note: '仕分けの時間が1.5倍。\n称号は同じ',
        get: () => settings.slowMode, set: (on) => settings.set('slowMode', on)
      },
      {
        label: '音', get: () => !audio.isMuted(), set: (on) => { audio.unlock(); audio.setMuted(!on); }
      }
    ];
    const rowH = (note?: string): number => (note ? 18 + note.split('\n').length * 14 : 26);
    const btnH = 30;
    const h = 34 + rows.reduce((n, r) => n + rowH(r.note) + 4, 0) + 6 + btnH + 10;
    const y = Math.max(4, Math.round((H - h) / 2 - 8));
    new WindowFrame(this, x, y, MENU_W, h, 'win');
    new PixelText(this, W / 2, y + 9, data.title ?? '一時停止', { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0);

    let ry = y + 32;
    for (const r of rows) {
      const hgt = rowH(r.note);
      this.toggleRow(x + 4, ry, MENU_W - 8, hgt, r);
      ry += hgt + 4;
    }

    const by = ry + 6;
    const bw = Math.floor((MENU_W - 12 * 2 - 8) / 2);
    const ready = (): boolean => performance.now() - this.shownAt >= 300;
    const resumeBtn = new Button(this, x + 12, by, bw, btnH, 'つづける', { color: 'civ', size: FS.body });
    const titleBtn = new Button(this, x + MENU_W - 12 - bw, by, bw, btnH, 'タイトルへ', { color: 0x4a3f78, size: FS.body });
    // 止めたときと同じタップで押さないように、少し待つ
    resumeBtn.on('press', () => { if (ready()) { audio.sfx('button'); data.control.resume(); } });
    titleBtn.on('press', () => { if (ready()) { audio.unlock(); audio.sfx('button'); data.control.quit(SCENES.title); } });
    // 開発用:テストの道具が「つづける」の場所を知るため
    if (import.meta.env.DEV) (window as unknown as { pauseDev?: unknown }).pauseDev = { resume: resumeBtn, title: titleBtn };
  }

  /** 1つの切りかえ。行のどこを押しても切りかわる(指が届きやすいように、行全体が当たり判定) */
  private toggleRow(
    x: number, y: number, w: number, h: number,
    r: { label: string; note?: string; get: () => boolean; set: (on: boolean) => void }
  ): void {
    // ウィンドウと同じ深さ(あとから置いた方が手前)
    const bg = this.add.graphics().setDepth(DEPTH.ui);
    new PixelText(this, x + ROW_X - 4, y + 4, r.label, { size: FS.body, color: UI.text });
    if (r.note) new PixelText(this, x + ROW_X - 4, y + 19, r.note, { size: FS.body, color: UI.textDim, lineSpacing: 2 });
    const sw = this.add.graphics().setDepth(DEPTH.ui);
    const swW = 34, swH = 16;
    const sx = x + w - swW - 6, sy = y + 3;
    const label = new PixelText(this, 0, sy + 2, '', { size: FS.small, color: UI.text });
    const draw = (): void => {
      const on = r.get();
      bg.clear();
      // 行の下に細い線(区切り)
      bg.fillStyle(UI.winInner, 1).fillRect(x + 4, y + h + 1, w - 8, 1);
      sw.clear();
      sw.fillStyle(UI.black, 1).fillRect(sx, sy, swW, swH);
      sw.fillStyle(on ? UI.civ : 0x3a3354, 1).fillRect(sx + 1, sy + 1, swW - 2, swH - 2);
      // つまみ(白い四角)。オンなら右、オフなら左
      const kx = on ? sx + swW - 13 : sx + 1;
      sw.fillStyle(UI.black, 1).fillRect(kx, sy + 1, 12, swH - 2);
      sw.fillStyle(0xffffff, 1).fillRect(kx + 1, sy + 2, 10, swH - 4);
      label.setText(on ? 'オン' : 'オフ').setColor(on ? UI.text : UI.textDim);
      label.x = on ? sx + 2 : sx + swW - 2 - label.width;
    };
    draw();
    const hit = this.add.zone(x, y, w, Math.max(24, h)).setOrigin(0).setInteractive();
    hit.on('pointerdown', () => {
      if (performance.now() - this.shownAt < 300) return;
      r.set(!r.get());
      audio.sfx('button');
      draw();
    });
  }
}
