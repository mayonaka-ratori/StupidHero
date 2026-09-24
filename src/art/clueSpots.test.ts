import { describe, expect, it } from 'vitest';
import { createStage } from '../logic/stage';
import type { Person, StageId } from '../logic/types';
import { CLUE_SPOTS, clueSpotFor } from './clueSpots';
import { sheetByKey } from './sheets';

const people = (id: StageId): Person[] => {
  const out: Person[] = [];
  for (let seed = 1; seed <= 150; seed++) for (const w of createStage(seed, id).waves) out.push(...w.people);
  return out;
};

describe('「持ち物」の窓の四角', () => {
  const all = [...people('alley'), ...people('garage'), ...people('mall')];

  it('仕分けに出るシートは全部、表にある。四角はコマの中に入る', () => {
    for (const p of all) {
      expect(CLUE_SPOTS[p.sheetKey], p.sheetKey).toBeDefined();
      const r = clueSpotFor(p.sheetKey);
      const d = sheetByKey(p.sheetKey);
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= d.frameW && r.y + r.h <= d.frameH, p.sheetKey).toBe(true);
    }
    expect(clueSpotFor('guard_civ#ff0000')).toBe(CLUE_SPOTS.guard_civ);
  });

  it('同じ見た目なら、市民もワルもボスの化けた姿も同じ四角(映る場所で正体が分からない)', () => {
    const byLook = new Map<string, object>();
    for (const p of all) {
      const look = p.disguise ?? p.look;
      const r = clueSpotFor(p.sheetKey);
      const seen = byLook.get(look);
      if (seen) expect(r, `${look} ${p.sheetKey}`).toEqual(seen);
      byLook.set(look, r);
    }
  });
});
