import { describe, expect, it } from 'vitest';
import { createStage } from '../logic/stage';
import type { StageId } from '../logic/types';
import { CLUE_SPOTS, clueSpotFor } from './clueSpots';
import { sheetByKey } from './sheets';

/** 仕分けに出る人の、絵のキー → 見た目(ボスは化けた見た目)。40の種で、表のキーは全部出る(下のテストで確かめる) */
const sheetsOf = (id: StageId): Map<string, string> => {
  const out = new Map<string, string>();
  for (let seed = 1; seed <= 40; seed++) for (const w of createStage(seed, id).waves) for (const p of w.people) out.set(p.sheetKey, p.disguise ?? p.look);
  return out;
};

describe('「持ち物」の窓の四角', () => {
  const all = new Map([...sheetsOf('alley'), ...sheetsOf('garage'), ...sheetsOf('mall')]);

  it('仕分けに出るシートは全部、表にある。表のキーは全部仕分けに出る。四角はコマの中に入る', () => {
    for (const key of all.keys()) {
      expect(CLUE_SPOTS[key], key).toBeDefined();
      const r = clueSpotFor(key);
      const d = sheetByKey(key);
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= d.frameW && r.y + r.h <= d.frameH, key).toBe(true);
    }
    expect(Object.keys(CLUE_SPOTS).filter((k) => !all.has(k))).toEqual([]);
    expect(clueSpotFor('guard_civ#ff0000')).toBe(CLUE_SPOTS.guard_civ);
  });

  it('同じ見た目なら、市民もワルもボスの化けた姿も、手がかりの出し分けの絵も同じ四角(映る場所で正体が分からない)', () => {
    const byLook = new Map<string, object>();
    for (const [key, look] of all) {
      const r = clueSpotFor(key);
      const seen = byLook.get(look);
      if (seen) expect(r, `${look} ${key}`).toEqual(seen);
      byLook.set(look, r);
    }
  });
});
