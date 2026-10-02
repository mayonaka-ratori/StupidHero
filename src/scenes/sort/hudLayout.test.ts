import { describe, expect, it } from 'vitest';
import {
  CHIP, COL_RIGHT, COL_X, EDGE_LABEL_Y, SEC_Y, STRIP_X, STRIP_Y, chipAt, overlaps, shareTagBox, shareTagText, stopTagBox, stripBox, textBox,
  type Box
} from './hudLayout';

/** 左の列のほかの部品(Sort.ts の buildAction と同じ所) */
const STAGE: Box = { x: 4, y: 3, w: 36, h: 12 };
const COUNT: Box = { x: 4, y: 18, w: 54, h: 12 };
const BAR: Box = { x: 4, y: 35, w: 40, h: 6 };
const SEC: Box = { x: COL_X, y: SEC_Y, w: 32, h: 16 };
/** 右上の音と中断のボタン(丸の見た目。音の丸の左の端から、画面の右の端まで) */
const ICONS: Box = { x: 216 - 34 - 9, y: 4, w: 34 + 9, h: 18 };
/** 左の端の「◀ワル」(縦に3字。真ん中が EDGE_LABEL_Y) */
const EDGE: Box = { x: 5, y: EDGE_LABEL_Y - 19, w: 12, h: 38 };
/** 人の絵(2倍)の頭のあたりが始まる所。札はこれより左に収める */
const PERSON_LEFT = 76;

describe('仕分けの画面の左上の札', () => {
  // 波の人数は4〜8人。念のため10人まで
  const counts = [4, 5, 6, 7, 8, 10];

  it('「▲5人ぶん」は1行12字まで、半角の空白を入れない', () => {
    for (const n of counts) {
      const t = shareTagText(n);
      expect(t).not.toContain(' ');
      expect([...t].length).toBeLessThanOrEqual(12);
    }
  });

  it('「▲5人ぶん」と「時計ストップ中」は、左の列の中に収まる(人の絵にかからない)', () => {
    for (const n of counts) {
      const b = shareTagBox(n);
      expect(b.x + b.w).toBeLessThanOrEqual(COL_RIGHT);
    }
    for (const shown of [false, true]) {
      const b = stopTagBox(shown);
      expect(b.x + b.w).toBeLessThanOrEqual(COL_RIGHT);
      expect(b.x + b.w).toBeLessThan(PERSON_LEFT);
    }
  });

  it('札は、時間の数字、バー、何人目、ステージ、ボタン、「◀ワル」と重ならない', () => {
    const others = [STAGE, COUNT, BAR, SEC, ICONS, EDGE];
    for (const n of counts) for (const o of others) expect(overlaps(shareTagBox(n), o)).toBe(false);
    for (const shown of [false, true]) for (const o of others) expect(overlaps(stopTagBox(shown), o)).toBe(false);
  });

  it('2つの札が一緒に出ても重ならない(「時計ストップ中」を下へずらす)', () => {
    for (const n of counts) expect(overlaps(shareTagBox(n), stopTagBox(true))).toBe(false);
    // 「▲5人ぶん」が出ていないときは、時間の数字のすぐ下
    expect(stopTagBox(false).y).toBe(shareTagBox(5).y);
  });

  it('「見た小物」の並び(ステージ2)とどの札も重ならない', () => {
    for (let n = 1; n <= 8; n++) {
      const strip = stripBox(STRIP_X, STRIP_Y, n);
      for (const m of counts) expect(overlaps(shareTagBox(m), strip)).toBe(false);
      for (const shown of [false, true]) expect(overlaps(stopTagBox(shown), strip)).toBe(false);
      // 札の行(いまの人の白いわくから下)は、ボタンの丸の下から
      const rows: Box = { ...strip, y: chipAt(STRIP_X, STRIP_Y, 0).y - 2, h: strip.y + strip.h - (chipAt(STRIP_X, STRIP_Y, 0).y - 2) };
      expect(overlaps(rows, ICONS)).toBe(false);
    }
  });

  it('「見た小物」の札の並べ方(1行に4つ、2行目は下に)', () => {
    expect(chipAt(STRIP_X, STRIP_Y, 0)).toEqual({ x: 83, y: 36 });
    expect(chipAt(STRIP_X, STRIP_Y, 3).x).toBe(83 + 34 * 3);
    expect(chipAt(STRIP_X, STRIP_Y, 4)).toEqual({ x: 83, y: 62 });
    // 札は並びの所の中
    const b = stripBox(STRIP_X, STRIP_Y, 8);
    for (let i = 0; i < 8; i++) {
      const c = chipAt(STRIP_X, STRIP_Y, i);
      expect(c.x - 2).toBeGreaterThanOrEqual(b.x);
      expect(c.x + CHIP + 2).toBeLessThanOrEqual(b.x + b.w);
      expect(c.y + CHIP).toBeLessThanOrEqual(b.y + b.h);
    }
  });

  it('字の大きさの見積もり(全角は字の大きさ、半角は半分)', () => {
    expect(textBox('▲5人ぶん', 12)).toEqual({ w: 12 + 6 + 36, h: 12 });
    expect(textBox('時計\nストップ中', 12, 2)).toEqual({ w: 60, h: 26 });
  });
});
