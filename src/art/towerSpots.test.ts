import { describe, expect, it } from 'vitest';
import { TOWER_SPOT_ITEMS } from '../logic/rules';
import { createStage } from '../logic/stage';
import { leakSpots } from '../logic/tower';
import { sheetByKey } from './sheets';
import { FX4 } from './world4/fx';
import {
  CALM_LOOK, DESK_TOP_ROW, FLOAT_PX, PARTY_FOOD_FRAMES, TOWER_DESK, TOWER_DESK_H, TOWER_DESK_W, TOWER_DESKS, TOWER_ITEM_FRAMES, TOWER_ITEM_ROWS,
  TOWER_ITEM_SIZE, TOWER_LAMP, TOWER_LAMP_H, TOWER_LAMP_W, itemRestDy, leakLook, towerDeskFor, type TowerItem
} from './towerSpots';

/** 仕分けの画面の人(2倍)がいる所。足もと (108, 204)、コマ 64×64 の絵のある所はおよそ x=20〜44 */
const PERSON = { left: 108 - 12 * 2 - 8, top: 204 - 58 * 2 };

describe('高層ビルの仕分けの画面の照明と机', () => {
  // 小物の絵(fx_psy_items)は1回だけ作って、下の2つのテストで使う
  const items = sheetByKey('fx_psy_items');
  const grids = FX4.fx_psy_items(items.frameW, items.frameH, items.rows[0].frames);

  it('小物の絵のある行は、fx_psy_items の絵と合っている', () => {
    for (const [item, f] of Object.entries(TOWER_ITEM_FRAMES) as [TowerItem, number][]) {
      const rows: number[] = [];
      for (let y = 0; y < TOWER_ITEM_SIZE; y++) for (let x = 0; x < TOWER_ITEM_SIZE; x++) if (grids[f].get(x, y)) rows.push(y);
      expect({ top: Math.min(...rows), bottom: Math.max(...rows) }, item).toEqual(TOWER_ITEM_ROWS[item]);
    }
  });

  it('料理のコマ(ケーキ、肉料理)は、ほかの小物と同じく下の端が7段目で、コマの横の真ん中あたりにある', () => {
    expect(items.rows[0].frames).toBe(8);
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
    // ロジックの側の表(「グラスが浮いてる!?」を出す階を決める)と同じ
    expect(TOWER_DESKS.map((d) => d.items[0].item)).toEqual([...TOWER_SPOT_ITEMS]);
  });

  it('小物は机の天板の上にのり、机からはみ出さない', () => {
    for (const d of TOWER_DESKS) for (const { item, dx } of d.items) {
      const bottom = itemRestDy(item) - TOWER_ITEM_SIZE / 2 + TOWER_ITEM_ROWS[item].bottom;
      expect(bottom, item).toBe(-TOWER_DESK_H + DESK_TOP_ROW);
      expect(Math.abs(dx) + TOWER_ITEM_SIZE / 2 <= TOWER_DESK_W / 2, item).toBe(true);
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
    // 浮いた小物(もやを含む)も、人の左に収まる
    for (const d of TOWER_DESKS) {
      const { item, dx } = d.items[0];
      const cx = TOWER_DESK.x + dx;
      const cy = TOWER_DESK.y + itemRestDy(item) - FLOAT_PX;
      expect(cx - 8 >= 0 && cx + 8 <= PERSON.left && cy - 7 >= 0, item).toBe(true);
    }
  });
});

describe('もれの見せ方(leakLook)', () => {
  it('照明:もれは紫と火花(2か所とももれていれば2つ、照明だけなら1つ)。切れかけの蛍光灯はうすい黄色、紫のセロハンは紫だが火花なし', () => {
    expect(leakLook({ light: 'leak', item: 'leak' })).toMatchObject({ lampFrame: 1, lampSparks: 2 });
    expect(leakLook({ light: 'leak', item: null })).toMatchObject({ lampFrame: 1, lampSparks: 1, itemFloat: false });
    expect(leakLook({ light: 'flicker', item: null })).toMatchObject({ lampFrame: 2, lampSparks: 0, itemFloat: false });
    expect(leakLook({ light: 'cellophane', item: null })).toMatchObject({ lampFrame: 4, lampSparks: 0, itemFloat: false });
  });

  it('小物:もれはもや、手品は糸、手品の煙は糸と煙、風船は風船。どれも小物が浮く。もやはもれだけ', () => {
    expect(leakLook({ light: null, item: 'leak' })).toMatchObject({ lampFrame: 0, itemFloat: true, haze: true, thread: false, smoke: false, balloon: false });
    expect(leakLook({ light: null, item: 'thread' })).toMatchObject({ itemFloat: true, haze: false, thread: true, smoke: false, balloon: false });
    expect(leakLook({ light: null, item: 'smoke' })).toMatchObject({ itemFloat: true, haze: false, thread: true, smoke: true, balloon: false });
    expect(leakLook({ light: null, item: 'balloon' })).toMatchObject({ itemFloat: true, haze: false, thread: false, smoke: false, balloon: true });
  });

  it('親玉とふつうの市民ともれを隠すヴィランは何も出ない。ほかのヴィランはかならず火花が出る。紛らわしい市民には火花ももやも出ない', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const w of createStage(seed, 'tower').waves) for (const p of w.people) {
        const look = leakLook(leakSpots(p));
        const hidden = p.truth === 'bad' && !p.leak!.light && !p.leak!.item;
        if (p.truth === 'boss' || (p.truth === 'civ' && !p.decoy) || hidden) expect(look, p.id).toEqual(CALM_LOOK);
        else if (p.truth === 'bad') expect(look.lampSparks > 0 || look.haze, p.id).toBe(true);
        if (p.decoy) expect(look.lampSparks === 0 && look.lampFrame !== 1 && !look.haze, p.id).toBe(true);
      }
    }
  });
});
