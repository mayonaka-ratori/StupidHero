// 見分ける手がかりの出し分け(tells.ts)を確かめる。絵のほうは src/art/tellSheets.test.ts。
import { describe, expect, it } from 'vitest';
import { judgeLine } from './content';
import { createRng } from './rng';
import { REASON_MAX, reasonFor, stripReasonMarkup } from './reasons';
import { createStage } from './stage';
import { TELLS, baseSheetKey, bossItemsFor, fitsTell, tellDef, tellSheetKey, tellsFor } from './tells';
import type { Look, Person, Stage, StageId } from './types';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 104729 + 11);
const stagesOf = (id: StageId): Stage[] => SEEDS.map((s) => createStage(s, id));
const ALL: Record<'alley' | 'garage' | 'mall', Stage[]> = { alley: stagesOf('alley'), garage: stagesOf('garage'), mall: stagesOf('mall') };
const everyone = (list: Stage[]): Person[] => list.flatMap((s) => s.waves.flatMap((w) => w.people.map((p) => p)));
const findBossKey = (s: Stage): string | undefined => everyone([s]).find((p) => p.truth === 'boss')?.sheetKey;

describe('手がかりの出し分け', () => {
  it('同じ種なら同じ出し分け(別の乱数で選ぶので、何度作っても同じ)', () => {
    for (const id of ['alley', 'garage', 'mall'] as const) {
      const a = createStage(42, id), b = createStage(42, id);
      expect(everyone([a]).map((p) => [p.tell, p.sheetKey])).toEqual(everyone([b]).map((p) => [p.tell, p.sheetKey]));
    }
  });

  it('出し分けのある人は全員 tell を持ち、絵のキーはそれに合う。ない人(ボス、モヒカン、おばあさん、市民の宇宙人側)は持たない', () => {
    const bad: string[] = [];
    for (const list of Object.values(ALL)) {
      for (const p of everyone(list)) {
        const defs = tellsFor(p.look, p.truth);
        if (defs.length === 0) {
          if (p.tell) bad.push(`${p.look} ${p.truth} に tell ${p.tell}`);
          continue;
        }
        const def = tellDef(p.look, p.truth, p.tell);
        if (!def) { bad.push(`${p.look} ${p.truth} の tell ${p.tell} がない`); continue; }
        const base = `${p.look}_${p.truth}`;
        if (p.sheetKey !== tellSheetKey(base, def)) bad.push(`${p.look} ${p.tell} の絵のキー ${p.sheetKey}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('どの出し分けも出てくる(偏りすぎない:見た目と正体ごとに、どれも1割より多い)', () => {
    for (const list of Object.values(ALL)) {
      const count = new Map<string, number>();
      const total = new Map<string, number>();
      for (const p of everyone(list)) {
        if (!p.tell) continue;
        const k = `${p.look}_${p.truth}`;
        count.set(`${k}:${p.tell}`, (count.get(`${k}:${p.tell}`) ?? 0) + 1);
        total.set(k, (total.get(k) ?? 0) + 1);
      }
      for (const [k, n] of total) {
        const [look, truth] = k.split('_') as [Look, 'civ' | 'bad'];
        const defs = tellsFor(look, truth);
        for (const d of defs) expect((count.get(`${k}:${d.id}`) ?? 0) / n, `${k} ${d.id}`).toBeGreaterThan(0.1);
      }
    }
  });

  it('プロフィールと一言は、その人の出し分けと食いちがわない(黄色い物の一言はナイフの柄かバナナの人だけ)', () => {
    const bad: string[] = [];
    for (const list of Object.values(ALL)) {
      for (const p of everyone(list)) {
        for (const text of [p.profile.line, p.hint.text]) {
          if (!fitsTell(text, p.look, p.truth, p.tell)) bad.push(`${p.look} ${p.truth} ${p.tell}: ${text}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('ステージ3:「今、色が…？」の一言は、体の色がちらつく宇宙人だけ。「顔色が悪くない？」はどちらにも出る', () => {
    const flash = '今、色が…？\n気のせい？', pale = '顔色が\n悪くない？';
    expect(fitsTell(flash, 'uncle', 'bad', 'flicker')).toBe(true);
    expect(fitsTell(flash, 'uncle', 'bad', 'hatch')).toBe(false);
    expect(fitsTell(pale, 'uncle', 'bad', 'flicker')).toBe(true);
    expect(fitsTell(pale, 'uncle', 'bad', 'hatch')).toBe(true);
    const hatch = everyone(ALL.mall).filter((p) => p.tell === 'hatch');
    expect(hatch.length).toBeGreaterThan(0);
    for (const p of hatch) expect(p.hint.text, p.sheetKey).not.toContain('今、色が');
  });

  it('路地裏のボスの化けた姿(スーツと買い物袋)は、市民と同じ3つの小物のどれかを持つ(持ち物でボスでないと分からない)', () => {
    const count = new Map<string, number>();
    const total = new Map<string, number>();
    for (const s of ALL.alley) {
      const boss = everyone([s]).find((p) => p.truth === 'boss')!;
      expect(boss.tell).toBeUndefined();
      const items = bossItemsFor(baseSheetKey(boss.sheetKey));
      if (boss.disguise === 'granny') { expect(boss.sheetKey).toBe('boss_disguise_granny'); continue; }
      expect(items.map((d) => d.id)).toEqual(tellsFor(boss.look, 'civ').map((d) => d.id));
      expect(items.map((d) => tellSheetKey(`boss_disguise_${boss.look}`, d))).toContain(boss.sheetKey);
      count.set(boss.sheetKey, (count.get(boss.sheetKey) ?? 0) + 1);
      total.set(boss.look, (total.get(boss.look) ?? 0) + 1);
    }
    for (const look of ['suit', 'shopper'] as const) {
      for (const d of tellsFor(look, 'civ')) {
        expect((count.get(tellSheetKey(`boss_disguise_${look}`, d)) ?? 0) / total.get(look)!, `${look} ${d.id}`).toBeGreaterThan(0.15);
      }
    }
    // 同じ種なら同じ小物
    expect(findBossKey(createStage(42, 'alley'))).toBe(findBossKey(createStage(42, 'alley')));
  });

  it('決めつけのセリフも、その人の出し分けと食いちがわない(肩章の人に「腕章があやしい!」と言わない)', () => {
    const rng = createRng(5);
    const bad: string[] = [];
    for (const list of Object.values(ALL)) {
      for (const p of everyone(list).slice(0, 600)) {
        if (p.truth === 'boss') continue;
        for (let i = 0; i < 6; i++) {
          const s = judgeLine(p.look, rng, p);
          if (!fitsTell(s.text, p.look, p.truth, p.tell)) bad.push(`${p.look} ${p.tell}: ${s.text}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('答え合わせの決め手は出し分けごとの文で、1行に入る', () => {
    for (const [look, byTruth] of Object.entries(TELLS)) {
      for (const d of [...(byTruth?.civ ?? []), ...(byTruth?.bad ?? [])]) {
        if (d.reason) expect([...d.reason].length, `${look} ${d.id} ${d.reason}`).toBeLessThanOrEqual(REASON_MAX);
      }
    }
    for (const list of Object.values(ALL)) {
      for (const s of list.slice(0, 50)) {
        for (const w of s.waves) {
          for (const p of w.people) {
            const r = reasonFor(p, w);
            expect([...stripReasonMarkup(r)].length, r).toBeLessThanOrEqual(REASON_MAX);
            const def = tellDef(p.look, p.truth, p.tell);
            if (def?.reason) expect(r).toBe(def.reason);
          }
        }
      }
    }
  });

  it('ステージ2の「同じ色の{item}」のつながりの文は、その人の小物の形の呼び名で言う', () => {
    let seen = 0;
    for (const p of everyone(ALL.garage)) {
      if (!p.link || !(p.link.where === 'hint' ? p.hint.text : p.profile.line).includes('同じ色の')) continue;
      const def = tellDef(p.look, p.truth, p.tell)!;
      const text = p.link.where === 'hint' ? p.hint.text : p.profile.line;
      expect(text, `${p.look} ${p.tell}`).toContain(def.noun ?? def.item!.civ);
      seen++;
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('ステージ2の組の仲間は同じ色だが、小物の形はちがうこともある(形ではなく色で見分ける)', () => {
    let mixed = 0;
    for (const s of ALL.garage) {
      for (const w of s.waves) {
        for (const g of w.groups) {
          const members = w.people.filter((p) => p.group === g.id);
          expect(new Set(members.map((p) => p.accessory!.id)).size).toBe(1);
          if (new Set(members.map((p) => p.accessory!.item)).size > 1) mixed++;
        }
      }
    }
    expect(mixed).toBeGreaterThan(50);
  });
});
