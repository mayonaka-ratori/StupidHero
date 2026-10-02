// 称号の一覧。全部のステージとフリープレイの24個(TITLES)を1列のカードで並べ、ずらして見る。取った称号は名前(金色)と条件、まだの称号は「？？？」とヒント。
// 画面に入りきらないときは、指で上下にずらして見る(マウスのホイールでも動く)。
// カードの右上には、その称号を取れる場所の小さな印(路・駐・モ・ビ・フ)を出し、取った場所の印を金色にする。
// 1つの場所だけで取れる称号は、印の代わりに「高層ビルだけ」「フリープレイだけ」の札を出す(取っていてもいなくても)。
// その場所がまだ開いていなければ、ヒントの代わりに「高層ビルで分かる」と出す(開いていないステージの中身を明かさない)。
// 一覧を最後に開いたあとに取った称号には、赤い NEW をつける(開いたら、並べた称号だけを見たことにする。records.ts の markTitleListSeen)。
// 記録は開くたびにこのスマホ(storage)から読み直す(結果画面から2回開いたときに、同じ NEW をまた出さないように)。
// focus を渡すと、その場所で取れる称号だけを並べ、その場所で取ったものだけを金色のカードにする
// (ステージを選ぶ画面で、カードの「このステージの称号3/13」をタップしたとき)。
// 開き方:openTitleList(this, { storage, current, focus })。開いたシーンは眠らせておき、もどるで起こす
// (結果画面なら、称号の発表や数え上げをやり直さずに元のまま戻る。タイトルとステージを選ぶ画面からも開ける)。

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { px } from '../hires';
import {
  FREE_NAME, STAGES, TITLES, isFreeUnlocked, isStageUnlocked, loadRecords, markTitleListSeen, placesOf, titlesAt,
  unseenTitles, type RecordStorage, type Records, type TitleDef, type TitleId, type TitlePlace
} from '../logic';
import { Button, DEPTH, FS, PixelText, preloadFont } from '../ui';
import { addMute } from './sort/common';

export interface TitleListData {
  /** 開いたシーンの key(もどるで起こす) */
  from?: string;
  /** 記録の読み書きをする場所(開くたびにここから読み直し、見た称号を書く。省略すると localStorage) */
  storage?: RecordStorage;
  /** 今回取った称号(カードを少し明るくする) */
  current?: readonly TitleId[];
  /** この場所で取れる称号だけを並べる */
  focus?: TitlePlace;
}

/** 称号の一覧を開く。from のシーンは眠らせ、もどるで起こす */
export function openTitleList(from: Phaser.Scene, data: Omit<TitleListData, 'from'> = {}): void {
  from.scene.launch(SCENES.titleList, { ...data, from: from.scene.key });
  from.scene.bringToTop(SCENES.titleList);
  from.scene.sleep();
}

/** 場所の名前(「〜で分かる」と見出しに使う) */
export const PLACE_NAME: Readonly<Record<TitlePlace, string>> = {
  alley: STAGES.alley.name, garage: STAGES.garage.name, mall: STAGES.mall.name, tower: STAGES.tower.name, free: FREE_NAME
};
/** 「〜だけ」の札の名前(ショッピングモールは長いので短い名前) */
const ONLY_NAME: Readonly<Record<TitlePlace, string>> = { ...PLACE_NAME, mall: STAGES.mall.shortName };
/** 小さな印の字 */
export const PLACE_MARK: Readonly<Record<TitlePlace, string>> = { alley: '路', garage: '駐', mall: 'モ', tower: 'ビ', free: 'フ' };

/** まだ取っていないカードの色 */
const LOCKED = { edge: 0x6a6488, fill: 0x1c1a2c };
/** 今回取った称号のカードの色 */
const CURRENT_FILL = 0x22307a;
/** まだの称号の名前の色 */
const UIDIM = 0x8a84a0;
/** 「〜だけ」の札の色 */
const ONLY_FILL = 0x9a2a6a;
/** 印の大きさ(1つぶんの幅と高さ) */
const MARK = 14;

/** その場所で取った称号 */
function titlesGotAt(r: Records, place: TitlePlace): readonly TitleId[] {
  return place === 'free' ? r.free.titles : r.stages[place]?.titles ?? [];
}
/** その場所が開いているか */
function placeOpen(r: Records, place: TitlePlace): boolean {
  return place === 'free' ? isFreeUnlocked(r) : isStageUnlocked(place, r);
}

/** 1枚のカードに出すもの(テストでも見る) */
interface CardInfo { id: TitleId; got: boolean; known: boolean; marks: { place: TitlePlace; got: boolean }[]; only: TitlePlace | null; isNew: boolean; body: string }

/** 開発用:window.titleListDev から中身をさわれる(テスト用) */
interface TitleListDev { scene?: TitleListScene; back?: Button; scrollMax?: number; earned?: TitleId[]; cards?: CardInfo[]; focus?: TitlePlace | null }
const dev: TitleListDev = {};

export class TitleListScene extends Phaser.Scene {
  private from?: string;
  private leaving = false;

  constructor() { super(SCENES.titleList); }

  create(data: TitleListData = {}): void {
    const { W, H } = layout;
    this.from = data.from;
    this.leaving = false;
    const records = loadRecords(data.storage);
    const earned = new Set<TitleId>(records.titles);
    const current = new Set<TitleId>(data.current ?? []);
    const focus = data.focus ?? null;
    const list = focus ? TITLES.filter((t) => titlesAt(focus).includes(t)) : [...TITLES];
    // 一覧を最後に開いたあとに取った称号(NEW)。決めてから、ここに並べた称号だけを見たことにする
    const unseen = new Set<TitleId>(unseenTitles(records));
    markTitleListSeen(list.map((t) => t.id), data.storage);
    const gotHere = focus ? new Set(titlesGotAt(records, focus)) : earned;
    if (import.meta.env.DEV) (window as unknown as { titleListDev: TitleListDev }).titleListDev = dev;
    dev.scene = this;
    dev.earned = [...earned];
    dev.focus = focus;

    // ─── 背景と見出し(動かない部分) ───
    const fixed: Phaser.GameObjects.GameObject[] = [];
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(UI.panel, 1).fillRect(0, 0, W, H);
    bg.fillStyle(0x15122a, 1);
    for (let y = 2; y < H; y += 4) bg.fillRect(0, y, W, 1);
    fixed.push(bg);
    const got = list.filter((t) => gotHere.has(t.id)).length;
    const heading = focus ? `${PLACE_NAME[focus]}の称号` : '称号の一覧';
    fixed.push(
      new PixelText(this, Math.floor(W / 2), 4, heading, { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0),
      new PixelText(this, Math.floor(W / 2), 22, `{gold}${got}{/}/${list.length}取った`, { size: FS.big, color: UI.text, outline: true }).setOrigin(0.5, 0),
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
    const infos: CardInfo[] = [];
    let y = top + 1;
    for (const t of list) {
      const places = placesOf(t.id);
      const only = places.length === 1 ? places[0] : null;
      const known = earned.has(t.id);
      // 取れる場所がどれも開いていなければ、ヒントの代わりに「〜で分かる」
      const closed = !places.some((p) => placeOpen(records, p));
      const body = known ? t.condition : closed ? `${PLACE_NAME[places[0]]}で分かる` : `ヒント:${t.hint}`;
      const info: CardInfo = {
        id: t.id, got: gotHere.has(t.id), known, only, isNew: unseen.has(t.id), body,
        marks: only ? [] : places.map((p) => ({ place: p, got: titlesGotAt(records, p).includes(t.id) }))
      };
      infos.push(info);
      const b = this.card(t, info, 2, y, cw, wrap, current.has(t.id));
      cards.push(...b.objs);
      y += b.h + gap;
    }
    dev.cards = infos;
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
    this.input.keyboard?.on('keydown-ESC', () => this.close());

    void preloadFont(TITLES.flatMap((t) => [t.name, t.condition, t.hint]).concat(
      ['ヒント:', '？？？', 'NEW', 'だけ', 'で分かる', 'の称号', '取った', ...Object.values(PLACE_NAME), ...Object.values(PLACE_MARK), ONLY_NAME.mall]
    ), [10, 12, 16]);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.cameras.remove(cam); });
  }

  /** カード1枚を作って描く。高さを返す */
  private card(t: TitleDef, info: CardInfo, x: number, y: number, w: number, wrap: number, current: boolean):
  { h: number; objs: Phaser.GameObjects.GameObject[] } {
    const g = this.add.graphics().setDepth(DEPTH.ui - 1);
    const objs: Phaser.GameObjects.GameObject[] = [g];
    const tx = x + 5;
    let ty = y + 5;
    // 右上:取れる場所の印か「〜だけ」の札。その左に NEW(名前はさらにその左で折り返す)
    let right = x + w - 6;
    const tg = this.add.graphics().setDepth(DEPTH.ui - 1);
    objs.push(tg);
    if (info.only) {
      const label = `${ONLY_NAME[info.only]}だけ`;
      // 漢字を含む札は12の字(10の字は、かなと数字だけ)
      const size = /[一-鿿]/.test(label) ? FS.body : FS.small;
      const tag = new PixelText(this, right - 1, y + (size === FS.body ? 4 : 5), label, { size, color: 0xffffff }).setOrigin(1, 0);
      const tagW = Math.ceil(tag.width) + 6;
      tg.fillStyle(UI.black, 1).fillRect(right - tagW - 1, y + 3, tagW + 2, 16);
      tg.fillStyle(ONLY_FILL, 1).fillRect(right - tagW, y + 4, tagW, 14);
      objs.push(tag);
      right -= tagW + 4;
    } else {
      for (const m of [...info.marks].reverse()) {
        const mx = right - MARK;
        tg.fillStyle(UI.black, 1).fillRect(mx - 1, y + 3, MARK + 2, MARK + 2);
        tg.fillStyle(m.got ? UI.gold : 0x2a2640, 1).fillRect(mx, y + 4, MARK, MARK);
        objs.push(new PixelText(this, mx + MARK / 2, y + 5, PLACE_MARK[m.place], { size: FS.body, color: m.got ? UI.black : 0x6a6488 }).setOrigin(0.5, 0));
        right = mx - 2;
      }
      right -= 2;
    }
    if (info.isNew) {
      const nt = new PixelText(this, right - 3, y + 6, 'NEW', { size: FS.small, color: 0xffffff }).setOrigin(1, 0);
      const nw = Math.ceil(nt.width) + 6;
      tg.fillStyle(UI.black, 1).fillRect(right - nw - 1, y + 4, nw + 2, 14);
      tg.fillStyle(UI.bad, 1).fillRect(right - nw, y + 5, nw, 12);
      objs.push(nt);
      right -= nw + 4;
    }
    const name = new PixelText(this, tx, ty, info.known ? t.name : '？？？', { size: FS.body, color: info.known ? UI.gold : UIDIM, wrap: right - tx });
    objs.push(name);
    ty += Math.max(Math.ceil(name.height), MARK) + 2;
    const body = new PixelText(this, tx, ty, info.body, { size: FS.body, color: info.known ? UI.text : UI.textDim, wrap });
    objs.push(body);
    ty += Math.ceil(body.height);
    const h = ty - y + 5;
    // 取った称号は青に金色のふち(今回の称号は少し明るく)、まだの称号は暗い灰色
    const c = info.got ? { edge: UI.gold, fill: current ? CURRENT_FILL : UI.winFill } : LOCKED;
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
