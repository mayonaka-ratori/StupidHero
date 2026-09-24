// 称号の一覧。全部のステージの17個(TITLES)を1列のカードで並べ、ずらして見る。取った称号は名前(金色)と条件、まだの称号は「？？？」とヒント。
// 画面に入りきらないときは、指で上下にずらして見る(マウスのホイールでも動く)。
// 開き方:openTitleList(this, { earned, current })。開いたシーンは眠らせておき、もどるで起こす
// (結果画面なら、称号の発表や数え上げをやり直さずに元のまま戻る)。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { px } from '../hires';
import { TITLES, loadRecords, type TitleDef, type TitleId } from '../logic';
import { Button, DEPTH, FS, PixelText, preloadFont } from '../ui';
import { addMute } from './sort/common';

export interface TitleListData {
  /** 開いたシーンの key(もどるで起こす) */
  from?: string;
  /** 取った称号。省略するとこのスマホの記録から読む */
  earned?: readonly TitleId[];
  /** 今回取った称号(カードを少し明るくする) */
  current?: TitleId;
}

/** 称号の一覧を開く。from のシーンは眠らせ、もどるで起こす */
export function openTitleList(from: Phaser.Scene, data: Omit<TitleListData, 'from'> = {}): void {
  from.scene.launch(SCENES.titleList, { ...data, from: from.scene.key });
  from.scene.bringToTop(SCENES.titleList);
  from.scene.sleep();
}

/** まだ取っていないカードの色 */
const LOCKED = { edge: 0x6a6488, fill: 0x1c1a2c };
/** 今回取った称号のカードの色 */
const CURRENT_FILL = 0x22307a;
/** まだの称号の名前の色 */
const UIDIM = 0x8a84a0;

/** 開発用:window.titleListDev から中身をさわれる(テスト用) */
interface TitleListDev { scene?: TitleListScene; back?: Button; scrollMax?: number; earned?: TitleId[] }
const dev: TitleListDev = {};

export class TitleListScene extends Phaser.Scene {
  private from?: string;
  private leaving = false;

  constructor() { super(SCENES.titleList); }

  create(data: TitleListData = {}): void {
    const { W, H } = layout;
    this.from = data.from;
    this.leaving = false;
    const earned = new Set<TitleId>(data.earned ?? loadRecords().titles);
    if (import.meta.env.DEV) (window as unknown as { titleListDev: TitleListDev }).titleListDev = dev;
    dev.scene = this;
    dev.earned = [...earned];

    // ─── 背景と見出し(動かない部分) ───
    const fixed: Phaser.GameObjects.GameObject[] = [];
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(UI.panel, 1).fillRect(0, 0, W, H);
    bg.fillStyle(0x15122a, 1);
    for (let y = 2; y < H; y += 4) bg.fillRect(0, y, W, 1);
    fixed.push(bg);
    const got = TITLES.filter((t) => earned.has(t.id)).length;
    fixed.push(
      new PixelText(this, Math.floor(W / 2), 4, '称号の一覧', { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0),
      new PixelText(this, Math.floor(W / 2), 22, `{gold}${got}{/}/${TITLES.length}取った`, { size: FS.big, color: UI.text, outline: true }).setOrigin(0.5, 0),
      addMute(this, W - 11, 12).setDepth(DEPTH.ui + 1)
    );

    const bottom = H - Math.max(6, layout.safeBottom + 4);
    const btnH = 28;
    const back = new Button(this, 6, bottom - btnH, W - 12, btnH, 'もどる', { color: 0x4a3f78 });
    back.on('press', () => { audio.unlock(); audio.sfx('button'); this.close(); });
    fixed.push(back);
    dev.back = back;

    // ─── カード(ずらせる部分) ───
    const top = 42;
    const viewH = bottom - btnH - 5 - top;
    // 1列に並べる(2列だとヒントの文が細かく折り返されて読みにくい)
    const gap = 3;
    const cw = W - 10;
    const wrap = cw - 10;
    const cards: Phaser.GameObjects.GameObject[] = [];
    let y = top + 1;
    for (const t of TITLES) {
      const b = this.card(t, 2, y, cw, wrap, earned.has(t.id), t.id === data.current);
      cards.push(...b.objs);
      y += b.h + gap;
    }
    const contentH = y - top;
    const scrollMax = Math.max(0, contentH - viewH);
    dev.scrollMax = scrollMax;

    // カードは別のカメラで映す(見出しとボタンにかぶらないように、その四角の中だけに出す)
    const cam = this.cameras.add(0, top, W, viewH);
    cam.setScroll(0, top);
    this.cameras.main.ignore(cards);
    cam.ignore(fixed);

    // ずらせるときは、右に細い目印を出す
    const bar = this.add.graphics().setDepth(DEPTH.ui + 1);
    cam.ignore(bar);
    let scroll = 0;
    const setScroll = (v: number): void => {
      scroll = Phaser.Math.Clamp(Math.round(v), 0, scrollMax);
      cam.setScroll(0, top + scroll);
      bar.clear();
      if (scrollMax <= 0) return;
      const th = Math.max(16, Math.round((viewH * viewH) / contentH));
      const ty = top + Math.round(((viewH - th) * scroll) / scrollMax);
      bar.fillStyle(UI.black, 1).fillRect(W - 4, top, 3, viewH);
      bar.fillStyle(UI.textDim, 1).fillRect(W - 3, ty, 1, th);
    };
    setScroll(0);
    let dragFrom: { y: number; scroll: number } | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      audio.unlock();
      const ly = px(p).y;
      if (ly >= top && ly < top + viewH) dragFrom = { y: ly, scroll };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragFrom || !p.isDown) return;
      setScroll(dragFrom.scroll - (px(p).y - dragFrom.y));
    });
    const up = (): void => { dragFrom = null; };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => setScroll(scroll + dy / 4));

    void preloadFont(TITLES.flatMap((t) => [t.name, t.condition, t.hint]).concat(['ヒント:', '？？？']), [12]);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.cameras.remove(cam); });
  }

  /** カード1枚を作って描く。高さを返す */
  private card(t: TitleDef, x: number, y: number, w: number, wrap: number, got: boolean, current: boolean):
  { h: number; objs: Phaser.GameObjects.GameObject[] } {
    const g = this.add.graphics().setDepth(DEPTH.ui - 1);
    const objs: Phaser.GameObjects.GameObject[] = [g];
    const tx = x + 5;
    let ty = y + 5;
    const name = new PixelText(this, tx, ty, got ? t.name : '？？？', { size: FS.body, color: got ? UI.gold : UIDIM, wrap });
    objs.push(name);
    ty += Math.ceil(name.height) + 2;
    const body = new PixelText(this, tx, ty, got ? t.condition : `ヒント:${t.hint}`, { size: FS.body, color: got ? UI.text : UI.textDim, wrap });
    objs.push(body);
    ty += Math.ceil(body.height);
    const h = ty - y + 5;
    // 取った称号は青に金色のふち(今回の称号は少し明るく)、まだの称号は暗い灰色
    const c = got ? { edge: UI.gold, fill: current ? CURRENT_FILL : UI.winFill } : LOCKED;
    g.fillStyle(UI.black, 1).fillRect(x + 1, y, w - 2, h).fillRect(x, y + 1, w, h - 2);
    g.fillStyle(c.edge, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(c.fill, 1).fillRect(x + 2, y + 2, w - 4, h - 4);
    return { h, objs };
  }

  /** もどる:開いたシーンを起こす */
  private close(): void {
    if (this.leaving) return;
    this.leaving = true;
    const from = this.from;
    // ゲームの更新の外で切り替える
    window.setTimeout(() => {
      if (from && this.scene.manager.getScene(from)) this.scene.wake(from);
      this.scene.stop();
    }, 0);
  }
}
