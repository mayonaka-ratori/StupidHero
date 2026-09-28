// 結果発表の通りの並べ方(planStreet、planGarage、planMall、planTower、フリープレイの planFree)。画面には頼らない計算だけを確かめる。
// Phaser は読みこまない(読みこんだら失敗にする)。

import { describe, expect, it, vi } from 'vitest';
import {
  FLOOR_LOOKS, PSY, PSY_LAYOUT, createFreePlay, createRng, createStage, freeRoleOf, freeTiming, propsForWave, resolvePsyDrop, STAGES,
  type Person, type PropKind, type Stage, type StageId
} from '../../logic';
import {
  FIRST_X, GAP, GATHER_ROOM, MALL_HALF, PSY_AHEAD, PSY_ROOM, PSY_ROWS, RUSH_DX, THREAT_DX, TOWER_HALF, UFO_DX, UFO_HALF, UFO_UNDER_KINDS, VAN_Y,
  planFree, planGarage, planMall, planStreet, planTower, type PropSpot, type StreetPlan
} from './plan';

vi.mock('phaser', () => {
  throw new Error('plan.ts のテストで Phaser を読みこんだ');
});

/** 地面(足の y)。歩道は 124〜150、車道は 150〜214 */
const GROUND = { top: 124, road: 150, bottom: 214 };

interface Case { stage: Stage; people: Person[]; passBad: Set<string>; plan: StreetPlan }

/** いろいろな種と仕分けで並べる。見逃したワルは半分くらい */
function cases(stageId: StageId, n: number): Case[] {
  const out: Case[] = [];
  for (let i = 0; i < n; i++) {
    const stage = createStage(i * 97 + 3, stageId);
    const rng = createRng(`plan-${stageId}-${i}`);
    for (const w of stage.waves) {
      const passBad = new Set(w.people.filter((p) => p.truth === 'bad' && rng.chance(0.5)).map((p) => p.id));
      const plan = stageId === 'garage'
        ? planGarage(w.people, passBad, STAGES.garage.props, rng)
        : stageId === 'mall'
          ? planMall(w.people, passBad, STAGES.mall.props, rng, w.no === 2)
          : stageId === 'tower'
            ? planTower(w.people, passBad, propsForWave(STAGES.tower, w.no), FLOOR_LOOKS[w.no - 1], w.no - 1, rng)
            : planStreet(w.people, passBad, rng);
      out.push({ stage, people: w.people, passBad, plan });
    }
  }
  return out;
}

/** ケースの名前(失敗したときの文の頭) */
const labelOf = ({ stage, people }: Case): string => `seed ${stage.seed} 波${people[0].wave}`;

/**
 * どのステージでも同じ決まり(フリープレイも)。守れていないところを文で返す(全部そろえて最後に1回だけ確かめる)。
 * gap は人と人の間(ステージは GAP、フリープレイは波ごとの gap)
 */
function commonRules({ label: at, people, plan, gap = GAP }: { label: string; people: readonly Person[]; plan: StreetPlan; gap?: number }): string[] {
  const bad: string[] = [];
  const xs = plan.people.map((s) => s.x);
  // 波の人は全員1回ずつ。ボスは最後で、ほかは出てくる順のまま
  const nonBoss = people.filter((p) => p.truth !== 'boss').map((p) => p.id);
  const boss = people.filter((p) => p.truth === 'boss').map((p) => p.id);
  if (plan.people.map((s) => s.person.id).join() !== [...nonBoss, ...boss].join()) bad.push(`${at}: 並ぶ順`);
  // 左から右へ並び、間はだいたい gap 以上。1人目は FIRST_X のあたり
  if (Math.abs(xs[0] - FIRST_X) > 6) bad.push(`${at}: 1人目 x=${xs[0]}`);
  for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] < gap - 12) bad.push(`${at}: 間がせまい ${xs[i - 1]}→${xs[i]}`);
  // 人と通りがかりの市民は車道の中に立つ
  for (const s of [...plan.people, ...plan.passers]) {
    if (s.y < GROUND.road || s.y > GROUND.bottom) bad.push(`${at}: 道の外 y=${s.y}`);
  }
  // 壁の物は地面より上、ほかの物は地面の中
  for (const p of plan.props) {
    const ok = p.wall ? p.y < GROUND.top : p.y >= GROUND.top - 10 && p.y <= GROUND.bottom;
    if (!ok) bad.push(`${at}: ${p.kind} y=${p.y}`);
    if (p.x <= 0) bad.push(`${at}: ${p.kind} x=${p.x}`);
  }
  // 終わりは最後の人の先
  if (plan.endX !== xs[xs.length - 1] + 120) bad.push(`${at}: endX`);
  return bad;
}

/** kinds にない物(そのステージに置いてはいけない物)を文で返す */
function strayProps(label: string, plan: StreetPlan, kinds: readonly PropKind[]): string[] {
  return plan.props.filter((q) => !kinds.includes(q.kind)).map((q) => `${label}: ${q.kind}`);
}

/**
 * 同じ列の物を x の順に並べて、となりどうしが allow ドットより多く重なる組を文で返す。
 * half は物の横の半分の幅
 */
function overlaps(label: string, row: readonly PropSpot[], half: (k: PropKind) => number, allow = 0): string[] {
  const bad: string[] = [];
  const sorted = [...row].sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (a.x + half(a.kind) - (b.x - half(b.kind)) > allow) bad.push(`${label}: ${a.kind} ${a.x} と ${b.kind} ${b.x}`);
  }
  return bad;
}

/**
 * l〜r の区域(両端は含まない)に入っている物と通りがかりの市民を文で返す。
 * 物は横の半分の幅 half(省くと0)ぶんでもかかれば入っているとし、skip が true の物は見ない。
 * 通りがかりの市民は、区域を左右に pad ずつ広げて見る
 */
function intrudersIn(
  label: string, plan: StreetPlan, l: number, r: number,
  opt: { half?: (k: PropKind) => number; skip?: (p: PropSpot) => boolean; pad?: number } = {}
): string[] {
  const { half = () => 0, skip = () => false, pad = 0 } = opt;
  const bad: string[] = [];
  for (const q of plan.props) {
    if (skip(q)) continue;
    const h = half(q.kind);
    if (q.x + h > l && q.x - h < r) bad.push(`${label}: ${q.kind} ${q.x}`);
  }
  for (const q of plan.passers) if (q.x > l - pad && q.x < r + pad) bad.push(`${label}: 通りがかり ${q.x}`);
  return bad;
}

/** ステージごとの並べ方(最初に1回だけ作り、どのテストでも使い回す) */
const CASES: Readonly<Record<StageId, Case[]>> = {
  alley: cases('alley', 60),
  garage: cases('garage', 60),
  mall: cases('mall', 60),
  tower: cases('tower', 50)
};

describe.each([
  { id: 'alley', name: 'planStreet(路地裏)' },
  { id: 'garage', name: 'planGarage(地下駐車場)' },
  { id: 'mall', name: 'planMall(ショッピングモール)' },
  { id: 'tower', name: 'planTower(高層ビル)' }
] as const)('$name の共通の決まり', ({ id }) => {
  it('ボスは最後、人は道の中に左から右へ並ぶ', () => {
    expect(CASES[id].flatMap((c) => commonRules({ ...c, label: labelOf(c) }))).toEqual([]);
  });

  it('物はそのステージの物だけ(高層ビルはその階の物だけ)', () => {
    expect(CASES[id].flatMap((c) => strayProps(labelOf(c), c.plan, propsForWave(STAGES[id], c.people[0].wave)))).toEqual([]);
  });
});

describe('planStreet(路地裏)', () => {
  const all = CASES.alley;

  it('見逃したワルのすぐ先には、悪さの相手の通りがかりの市民がいる', () => {
    for (const { plan, passBad } of all) {
      for (const s of plan.people) {
        if (!passBad.has(s.person.id)) continue;
        expect(plan.passers.some((p) => p.x > s.x + 60 && p.x < s.x + 80), s.person.id).toBe(true);
      }
    }
  });

  it('自販機と車は必ずある。組の集まる場所はない', () => {
    expect(all.every(({ plan }) => plan.props.some((p) => p.kind === 'vending'))).toBe(true);
    expect(all.every(({ plan }) => plan.props.filter((p) => p.kind === 'car').length === 1)).toBe(true);
    expect(all.every(({ plan }) => plan.gathers.length === 0)).toBe(true);
  });
});

describe('planGarage(地下駐車場)', () => {
  const all = CASES.garage;

  it('見逃したギャングがいる組ごとに、集まる場所とワゴンが1つ。口笛を吹くのは組で最初に見逃した人', () => {
    let seen = 0;
    for (const { plan, passBad, people } of all) {
      const calledGroups = new Set(people.filter((p) => p.group && passBad.has(p.id)).map((p) => p.group!));
      expect(plan.gathers.map((g) => g.groupId).sort()).toEqual([...calledGroups].sort());
      const vans = plan.props.filter((p) => p.kind === 'van');
      expect(vans).toHaveLength(plan.gathers.length);
      for (const g of plan.gathers) {
        seen++;
        const order = plan.people.map((s) => s.person);
        const firstPassed = order.find((p) => p.group === g.groupId && passBad.has(p.id))!;
        expect(g.whistlerId).toBe(firstPassed.id);
        const i = plan.people.findIndex((s) => s.person.id === g.whistlerId);
        const whistler = plan.people[i];
        const next = plan.people[i + 1];
        // 口笛を吹く人のすぐ先に集まり、次の人との間は空けてある
        expect(g.x).toBeGreaterThan(whistler.x);
        if (next) {
          expect(next.x - whistler.x).toBeGreaterThanOrEqual(GAP + GATHER_ROOM - 12);
          expect(g.x).toBeLessThan(next.x);
        }
        expect(g.vanX).toBeGreaterThan(g.x);
        expect(g.vanY).toBe(VAN_Y);
        expect(vans.some((v) => v.x === g.vanX && v.y === g.vanY)).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('ワゴンのまわりには、ほかの物も通りがかりの市民も置かない。止めてある車はワゴンの逃げ道にかからない', () => {
    const bad: string[] = [];
    for (const { plan, stage } of all) {
      const at = `seed ${stage.seed}`;
      for (const g of plan.gathers) {
        bad.push(...intrudersIn(at, plan, g.x - 60, g.vanX + 64 + 12, { skip: (p) => p.wall || p.kind === 'van' }));
        for (const c of plan.props) if (c.kind === 'car' && c.x > g.vanX && c.x < g.vanX + 300) bad.push(`${at}: 車 ${c.x}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('通りがかりの市民は4つの見た目で、小物の色がある', () => {
    const passers = all.flatMap(({ plan }) => plan.passers);
    expect(passers.length).toBeGreaterThan(0);
    expect([...new Set(passers.map((p) => p.look))].sort()).toEqual(['clubber', 'guard', 'mechanic', 'officelady']);
    expect(passers.filter((p) => p.key !== `${p.look}_civ` || typeof p.color !== 'number')).toEqual([]);
  });
});

describe('planMall(ショッピングモール)', () => {
  const all = CASES.mall;

  it('奥の列の物は重ならない。エスカレーターは必ずある', () => {
    const bad: string[] = [];
    for (const { plan, stage } of all) {
      bad.push(...overlaps(`seed ${stage.seed}`, plan.props.filter((p) => p.y < 200), (k) => MALL_HALF[k] ?? 12));
      if (!plan.props.some((p) => p.kind === 'escalator')) bad.push(`seed ${stage.seed}: エスカレーターがない`);
    }
    expect(bad).toEqual([]);
  });

  it('ラッシュのある波(波2)だけ、ヒーローが立つ所の後ろにエスカレーター', () => {
    for (const { plan, people } of all) {
      const last = plan.people[plan.people.length - 1];
      if (people[0].wave !== 2) { expect(plan.rushX).toBeUndefined(); continue; }
      expect(plan.rushX).toBe(last.x + RUSH_DX);
      expect(plan.props.some((p) => p.kind === 'escalator' && Math.abs(p.x - plan.rushX!) <= 12)).toBe(true);
    }
  });

  it('UFOが下りてくる所(見逃した宇宙人の先)には、通りがかりの市民を置かない', () => {
    for (const { plan, passBad } of all) {
      for (const s of plan.people) {
        if (!passBad.has(s.person.id)) continue;
        expect(plan.passers.some((p) => Math.abs(p.x - (s.x + UFO_DX)) < 20), s.person.id).toBe(false);
      }
    }
  });

  it('UFOの落ちる真下に置く物は、UFO_DX の所(UFOの幅の中)に置く', () => {
    // 画面(street/ufo.ts)は見逃した宇宙人の x + UFO_DX にUFOを下ろし、UFOの幅の中の UFO_UNDER_KINDS の物を壊す。
    // 並べ方が同じ所に物を置いていれば、見逃した宇宙人の多く(7割)で真下に物がある
    let ufos = 0, under = 0;
    for (const { plan, passBad } of all) {
      for (const s of plan.people) {
        if (!passBad.has(s.person.id)) continue;
        ufos++;
        if (plan.props.some((p) => UFO_UNDER_KINDS.includes(p.kind) && p.y < 200 && Math.abs(p.x - (s.x + UFO_DX)) < UFO_HALF)) under++;
      }
    }
    expect(ufos).toBeGreaterThan(50);
    expect(under / ufos).toBeGreaterThan(0.6);
  });

  it('UFOの落ちる真下に、エスカレーターと噴水は来ない(ラッシュのエスカレーターは壊れる物に入らない)', () => {
    expect(UFO_UNDER_KINDS).not.toContain('escalator');
    expect(UFO_UNDER_KINDS).not.toContain('fountain');
    const big: readonly PropKind[] = ['fountain', 'escalator'];
    const bad: string[] = [];
    for (const { plan, passBad, stage } of all) {
      for (const s of plan.people) {
        if (!passBad.has(s.person.id)) continue;
        const ux = s.x + UFO_DX;
        for (const p of plan.props) {
          if (!big.includes(p.kind) || Math.abs(p.x - ux) >= UFO_HALF + (MALL_HALF[p.kind] ?? 12)) continue;
          // ラッシュのエスカレーター(ヒーローが立つ所の後ろ)は動かせないので、画面が壊さない
          if (p.kind === 'escalator' && plan.rushX !== undefined && Math.abs(p.x - plan.rushX) <= 12) continue;
          bad.push(`seed ${stage.seed}: UFO ${ux} の下に ${p.kind} ${p.x}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('planTower(高層ビル)', () => {
  const all = CASES.tower;

  it('見逃したヴィランごとに念力の場面が1つ。ヴィランは PSY_AHEAD 先に出て、次の人との間は PSY_ROOM 空ける', () => {
    let seen = 0;
    for (const { plan, passBad } of all) {
      const psy = plan.psy ?? [];
      const ids = plan.people.filter((s) => passBad.has(s.person.id)).map((s) => s.person.id);
      expect(psy.map((p) => p.villainId)).toEqual(ids);
      for (const p of psy) {
        seen++;
        const i = plan.people.findIndex((s) => s.person.id === p.villainId);
        expect(p.plan.villainX).toBe(plan.people[i].x + PSY_AHEAD);
        const next = plan.people[i + 1];
        if (next) {
          expect(next.x - plan.people[i].x).toBeGreaterThanOrEqual(GAP + PSY_ROOM - 12);
          // 次の人は、歩いてくる市民より先
          expect(next.x).toBeGreaterThan(p.plan.victimX + 40);
        }
      }
    }
    expect(seen).toBeGreaterThan(80);
  });

  it('念力の場面の物は、決めた所と列に置く(持ち上げる物は奥、1つ目の場所は手前、2つ目の場所は奥)', () => {
    for (const { plan } of all) {
      for (const p of plan.psy ?? []) {
        const at = (x: number, y: number, kind: string): boolean => plan.props.some((q) => q.x === x && q.y === y && q.kind === kind);
        expect(at(p.plan.lift.x, PSY_ROWS.back, p.plan.lift.kind)).toBe(true);
        p.plan.floor.forEach((f, j) => {
          const front = f.x - p.plan.villainX === PSY_LAYOUT.slotDx[0];
          expect(p.floorY[j]).toBe(front ? PSY_ROWS.front : PSY_ROWS.back);
          expect(at(f.x, p.floorY[j], f.kind)).toBe(true);
          // その物の真上で落とすと、その物に落ちる
          expect(resolvePsyDrop(p.plan, f.x).target).toEqual(f);
        });
        expect(p.plan.floor.filter((f) => f.kind === PSY.cushionProp)).toHaveLength(1);
      }
    }
  });

  it('念力の場面には、ほかの物も通りがかりの市民も置かない', () => {
    const bad: string[] = [];
    for (const { plan, stage } of all) {
      for (const p of plan.psy ?? []) {
        const own = [p.plan.lift, ...p.plan.floor];
        bad.push(...intrudersIn(`seed ${stage.seed}`, plan, p.plan.villainX - 24, p.plan.victimX + 20, {
          half: (k) => TOWER_HALF[k] ?? 12, skip: (q) => own.some((o) => o.x === q.x && o.kind === q.kind), pad: 14
        }));
      }
    }
    expect(bad).toEqual([]);
  });

  it('同じ列の物はほとんど重ならない(念力の場面の大きな物どうしで2ドットまで)', () => {
    const bad: string[] = [];
    for (const { plan, stage } of all) {
      for (const y of [PSY_ROWS.back, PSY_ROWS.front, 214]) {
        bad.push(...overlaps(`seed ${stage.seed}`, plan.props.filter((p) => p.y === y), (k) => TOWER_HALF[k] ?? 12, 2));
      }
    }
    expect(bad).toEqual([]);
  });

  it('ソファは階ごとの色のコマ。通りがかりの市民はその階の市民の絵', () => {
    for (const { plan, people } of all) {
      const no = people[0].wave;
      expect(plan.props.filter((p) => p.kind === 'sofa' && p.frame !== no - 1)).toEqual([]);
      expect(plan.passers.filter((p) => !FLOOR_LOOKS[no - 1].includes(p.look as never) || p.key !== `tw_${p.look}`)).toEqual([]);
    }
  });
});

describe('planFree(フリープレイ)', () => {
  const looks = [{ key: 'suit_civ', look: 'suit' as const }, { key: 'guard_civ', look: 'guard' as const, color: 0xd87400 }];
  const all: { label: string; plan: StreetPlan; gap: number; victims: Map<string, 'threat' | 'ufo'>; bg: StageId; people: Person[] }[] = [];
  for (let i = 0; i < 40; i++) {
    const fp = createFreePlay(i * 13 + 5, ['alley', 'garage', 'mall']);
    fp.waves.forEach((fw, wi) => {
      const people = fp.stage.waves[wi].people;
      const victims = new Map<string, 'threat' | 'ufo'>();
      for (const p of people) {
        if (freeRoleOf(fw, p) !== 'go') continue;
        if (p.look === 'fp_mohawk') victims.set(p.id, 'threat');
        if (p.look === 'fp_alien') victims.set(p.id, 'ufo');
      }
      const gap = freeTiming(fw.no, i % 4 === 0).gapPx;
      const plan = planFree(people, { gap, bg: fw.bgStage, props: STAGES[fw.bgStage].props, victims, passerLooks: looks }, createRng(`free-${i}-${wi}`));
      all.push({ label: `free ${i} 波${fw.no}`, plan, gap, victims, bg: fw.bgStage, people });
    });
  }

  it('人は波の順に、人と人の間(gap)をあけて道の中に並ぶ(ステージと同じ決まり)', () => {
    // フリープレイの波にはボスがいないので、ステージの決まり(ボスは最後)でも並ぶ順は波の順のまま
    expect(all.flatMap(({ label, people }) => people.filter((p) => p.truth === 'boss').map(() => `${label}: ボス`))).toEqual([]);
    expect(all.flatMap(commonRules)).toEqual([]);
  });

  it('悪さの相手は、モヒカンの72ドット先と、UFOが下りてくる所に1人ずつ。ほかの通りがかりの市民はいない', () => {
    for (const { plan, victims } of all) {
      expect(plan.passers).toHaveLength(victims.size);
      for (const s of plan.people) {
        const kind = victims.get(s.person.id);
        if (!kind) continue;
        const dx = kind === 'threat' ? THREAT_DX : UFO_DX;
        expect(plan.passers.some((p) => Math.abs(p.x - (s.x + dx)) <= 1), s.person.id).toBe(true);
      }
    }
  });

  it('ギャングの組は、口笛を吹く人(組の最初の人)の先に集まる場所。ワゴンは置かず、まわりに床の物はない', () => {
    let seen = 0;
    for (const { plan, people } of all) {
      const groups = new Set(people.filter((p) => p.look === 'fp_gang').map((p) => p.group));
      expect(plan.gathers).toHaveLength(groups.size);
      expect(plan.props.some((p) => p.kind === 'van')).toBe(false);
      for (const g of plan.gathers) {
        seen++;
        const first = people.find((p) => p.group === g.groupId)!;
        expect(g.whistlerId).toBe(first.id);
        const i = plan.people.findIndex((s) => s.person.id === g.whistlerId);
        const next = plan.people[i + 1];
        if (next) expect(next.x - plan.people[i].x).toBeGreaterThanOrEqual(GATHER_ROOM);
        for (const p of plan.props) if (!p.wall) expect(p.x > g.x - 80 && p.x < g.vanX + 96, `${p.kind} ${p.x}`).toBe(false);
      }
    }
    expect(seen).toBeGreaterThan(30);
  });

  it('物は背景のステージの物だけ', () => {
    expect(all.flatMap(({ label, plan, bg }) => strayProps(label, plan, STAGES[bg].props))).toEqual([]);
  });
});
