import { describe, expect, it } from 'vitest';
import { createStage } from '../logic/stage';
import { leakSpots } from '../logic/tower';
import { CLUE_H, CLUE_W } from './clueSpots';
import { sheetByKey } from './sheets';
import { FX4 } from './world4/fx';
import {
  CALM_LOOK, DESK_TOP_ROW, FLOAT_PX, PARTY_FOOD_FRAMES, TOWER_DESK, TOWER_DESK_H, TOWER_DESK_W, TOWER_DESKS, TOWER_ITEM_FRAMES, TOWER_ITEM_ROWS,
  TOWER_ITEM_SIZE, TOWER_LAMP, TOWER_LAMP_H, TOWER_LAMP_W, deskRect, itemRestDy, leakLook, towerDeskFor, type TowerItem
} from './towerSpots';

/** 仕分けの画面の人(2倍)がいる所。足もと (108, 204)、コマ 64×64 の絵のある所はおよそ x=20〜44 */
const PERSON = { left: 108 - 12 * 2 - 8, top: 204 - 58 * 2 };

describe('高層ビルの仕分けの画面の照明と机', () => {
  it('小物の絵のある行は、fx_psy_items の絵と合っている', () => {
    const d = sheetByKey('fx_psy_items');
    const grids = FX4.fx_psy_items(d.frameW, d.frameH, d.rows[0].frames);
    for (const [item, f] of Object.entries(TOWER_ITEM_FRAMES) as [TowerItem, number][]) {
      const rows: number[] = [];
      for (let y = 0; y < TOWER_ITEM_SIZE; y++) for (let x = 0; x < TOWER_ITEM_SIZE; x++) if (grids[f].get(x, y)) rows.push(y);
      expect({ top: Math.min(...rows), bottom: Math.max(...rows) }, item).toEqual(TOWER_ITEM_ROWS[item]);
    }
  });

  it('料理のコマ(ケーキ、肉料理)は、ほかの小物と同じく下の端が7段目で、コマの横の真ん中あたりにある', () => {
    const d = sheetByKey('fx_psy_items');
    const grids = FX4.fx_psy_items(d.frameW, d.frameH, d.rows[0].frames);
    expect(d.rows[0].frames).toBe(8);
    for (const [food, f] of Object.entries(PARTY_FOOD_FRAMES)) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let y = 0; y < TOWER_ITEM_SIZE; y++) for (let x = 0; x < TOWER_ITEM_SIZE; x++) if (grids[f].get(x, y)) { xs.push(x); ys.push(y); }
      expect(Math.max(...ys), food).toBe(7);
      expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - (TOWER_ITEM_SIZE - 1) / 2) <= 1, food).toBe(true);
    }
  });

  it('階ごとの小物は仕様の通り(1階は名刺とペン、18階はペンとマグカップ、35階はグラスとナプキン、最上階はグラスとキャンドル)', () => {
    expect(TOWER_DESKS.map((d) => d.items.map((i) => i.item))).toEqual([
      ['card', 'pen'], ['pen', 'cup'], ['glass', 'napkin'], ['glass', 'candle']
    ]);
    expect(towerDeskFor(3)).toBe(TOWER_DESKS[2]);
  });

  it('小物は机の天板の上にのり、机からはみ出さない', () => {
    for (const d of TOWER_DESKS) for (const { item, dx } of d.items) {
      const bottom = itemRestDy(item) - TOWER_ITEM_SIZE / 2 + TOWER_ITEM_ROWS[item].bottom;
      expect(bottom, item).toBe(-TOWER_DESK_H + DESK_TOP_ROW);
      expect(Math.abs(dx) + TOWER_ITEM_SIZE / 2 <= TOWER_DESK_W / 2, item).toBe(true);
    }
  });

  it('窓の四角は16×14で、1つ目の小物が浮く前も浮いたあとも入る', () => {
    for (const d of TOWER_DESKS) {
      const r = d.rect;
      expect([r.w, r.h]).toEqual([CLUE_W, CLUE_H]);
      const { item, dx } = d.items[0];
      const rows = TOWER_ITEM_ROWS[item];
      for (const lift of [0, FLOAT_PX, FLOAT_PX + 1]) {
        const cy = itemRestDy(item) - lift;
        const top = cy - TOWER_ITEM_SIZE / 2 + rows.top;
        const bottom = cy - TOWER_ITEM_SIZE / 2 + rows.bottom;
        expect(top >= r.y && bottom < r.y + r.h, `${item} ${lift}`).toBe(true);
        // 小物の横の真ん中も四角の真ん中
        expect(dx - r.x).toBe(CLUE_W / 2);
      }
      // 机の天板の端も少し映る
      expect(r.y + r.h > -TOWER_DESK_H + DESK_TOP_ROW).toBe(true);
    }
  });

  it('照明と机は画面に入り、人の絵と重ならない(照明は頭の上、机は人の左)', () => {
    const lampHalf = (TOWER_LAMP_W / 2) * TOWER_LAMP.scale;
    // 左上の字(STAGE、人数、時間。右の端は x=52 くらい)の右で、右上のボタン(x=170から)の左、頭より上
    expect(TOWER_LAMP.x - lampHalf >= 52 && TOWER_LAMP.x + lampHalf <= 170).toBe(true);
    expect(TOWER_LAMP.y + TOWER_LAMP_H * TOWER_LAMP.scale < PERSON.top).toBe(true);
    const deskLeft = TOWER_DESK.x - TOWER_DESK_W / 2;
    const deskRight = TOWER_DESK.x + TOWER_DESK_W / 2;
    // 左の端の赤い光(いちばん強くて17ドット)と、人の間
    expect(deskLeft >= 17 && deskRight <= PERSON.left).toBe(true);
    for (const d of TOWER_DESKS) {
      const r = deskRect(d, TOWER_DESK.x, TOWER_DESK.y);
      expect(r.x >= 0 && r.x + r.w <= PERSON.left && r.y >= 0 && r.y + r.h <= 214).toBe(true);
    }
  });
});

describe('もれの見せ方(leakLook)', () => {
  it('照明:もれは紫と火花2つ、切れかけの蛍光灯はうすい黄色(火花なし)', () => {
    expect(leakLook({ light: 'leak', item: null })).toMatchObject({ lampFrame: 1, lampSparks: true, itemFloat: false });
    expect(leakLook({ light: 'flicker', item: null })).toMatchObject({ lampFrame: 2, lampSparks: false, itemFloat: false });
  });

  it('小物:もれはもや、手品は糸、風船は風船。どれも小物が浮く', () => {
    expect(leakLook({ light: null, item: 'leak' })).toMatchObject({ lampFrame: 0, itemFloat: true, haze: true, thread: false, balloon: false });
    expect(leakLook({ light: null, item: 'thread' })).toMatchObject({ itemFloat: true, haze: false, thread: true, balloon: false });
    expect(leakLook({ light: null, item: 'balloon' })).toMatchObject({ itemFloat: true, haze: false, thread: false, balloon: true });
  });

  it('親玉とふつうの市民は何も出ない。ヴィランはかならずどこかに紫が出る', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const w of createStage(seed, 'tower').waves) for (const p of w.people) {
        const look = leakLook(leakSpots(p));
        if (p.truth === 'boss' || (p.truth === 'civ' && !p.decoy)) expect(look, p.id).toEqual(CALM_LOOK);
        if (p.truth === 'bad') expect(look.lampFrame === 1 || look.haze, p.id).toBe(true);
        if (p.decoy) expect(look.lampFrame !== 1 && !look.haze, p.id).toBe(true);
      }
    }
  });
});
