// 結果発表の通りの並べ方(planStreet と planGarage)。画面には頼らない計算だけを確かめる。
// Phaser は読みこまない(読みこんだら失敗にする)。

import { describe, expect, it, vi } from 'vitest';
import { createRng, createStage, STAGES, type Person, type Stage, type StageId } from '../../logic';
import { FIRST_X, GAP, GATHER_ROOM, VAN_Y, planGarage, planStreet, type StreetPlan } from './plan';

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
        : planStreet(w.people, passBad, rng);
      out.push({ stage, people: w.people, passBad, plan });
    }
  }
  return out;
}

/** 両方のステージで同じ決まり。守れていないところを文で返す(全部そろえて最後に1回だけ確かめる) */
function commonRules({ stage, people, plan }: Case): string[] {
  const bad: string[] = [];
  const at = `seed ${stage.seed} 波${people[0].wave}`;
  const xs = plan.people.map((s) => s.x);
  // 波の人は全員1回ずつ。ボスは最後で、ほかは出てくる順のまま
  const nonBoss = people.filter((p) => p.truth !== 'boss').map((p) => p.id);
  const boss = people.filter((p) => p.truth === 'boss').map((p) => p.id);
  if (plan.people.map((s) => s.person.id).join() !== [...nonBoss, ...boss].join()) bad.push(`${at}: 並ぶ順`);
  // 左から右へ並び、間はだいたい GAP 以上。1人目は FIRST_X のあたり
  if (Math.abs(xs[0] - FIRST_X) > 6) bad.push(`${at}: 1人目 x=${xs[0]}`);
  for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] < GAP - 12) bad.push(`${at}: 間がせまい ${xs[i - 1]}→${xs[i]}`);
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

describe('planStreet(路地裏)', () => {
  const all = cases('alley', 60);

  it('ボスは最後、人は道の中に左から右へ並ぶ', () => {
    expect(all.flatMap(commonRules)).toEqual([]);
  });

  it('見逃したワルのすぐ先には、悪さの相手の通りがかりの市民がいる', () => {
    for (const { plan, passBad } of all) {
      for (const s of plan.people) {
        if (!passBad.has(s.person.id)) continue;
        expect(plan.passers.some((p) => p.x > s.x + 60 && p.x < s.x + 80), s.person.id).toBe(true);
      }
    }
  });

  it('物は路地裏の物だけ。自販機と車は必ずある。組の集まる場所はない', () => {
    const kinds = new Set(all.flatMap(({ plan }) => plan.props.map((p) => p.kind)));
    expect([...kinds].filter((k) => !STAGES.alley.props.includes(k))).toEqual([]);
    expect(all.every(({ plan }) => plan.props.some((p) => p.kind === 'vending'))).toBe(true);
    expect(all.every(({ plan }) => plan.props.filter((p) => p.kind === 'car').length === 1)).toBe(true);
    expect(all.every(({ plan }) => plan.gathers.length === 0)).toBe(true);
  });
});

describe('planGarage(地下駐車場)', () => {
  const all = cases('garage', 60);

  it('ボスは最後、人は道の中に左から右へ並ぶ', () => {
    expect(all.flatMap(commonRules)).toEqual([]);
  });

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
      for (const g of plan.gathers) {
        const near = (x: number) => x > g.x - 60 && x < g.vanX + 64 + 12;
        for (const p of plan.props) if (!p.wall && p.kind !== 'van' && near(p.x)) bad.push(`seed ${stage.seed}: ${p.kind} ${p.x}`);
        for (const p of plan.passers) if (near(p.x)) bad.push(`seed ${stage.seed}: 通りがかり ${p.x}`);
        for (const c of plan.props) if (c.kind === 'car' && c.x > g.vanX && c.x < g.vanX + 300) bad.push(`seed ${stage.seed}: 車 ${c.x}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('物は地下駐車場の物だけ。通りがかりの市民は4つの見た目で、小物の色がある', () => {
    const kinds = new Set(all.flatMap(({ plan }) => plan.props.map((p) => p.kind)));
    expect([...kinds].filter((k) => !STAGES.garage.props.includes(k))).toEqual([]);
    const passers = all.flatMap(({ plan }) => plan.passers);
    expect(passers.length).toBeGreaterThan(0);
    expect([...new Set(passers.map((p) => p.look))].sort()).toEqual(['clubber', 'guard', 'mechanic', 'officelady']);
    expect(passers.filter((p) => p.key !== `${p.look}_civ` || typeof p.color !== 'number')).toEqual([]);
  });
});
