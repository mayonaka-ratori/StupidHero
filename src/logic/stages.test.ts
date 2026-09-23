import { describe, expect, it } from 'vitest';
import { IMAGES, sheetByKey } from '../art/sheets';
import { ATTACKS, ATTACK_KINDS } from './rules';
import { STAGES, STAGE_IDS, sheetKeyFor } from './stages';

describe('ステージの定義', () => {
  it('絵のキーは全部 sheets.ts にある', () => {
    const imageKeys = new Set(IMAGES.map((i) => i.key));
    for (const id of STAGE_IDS) {
      const d = STAGES[id];
      for (const k of Object.values(d.bg)) expect(imageKeys.has(k), k).toBe(true);
      expect(() => sheetByKey(d.bossSheet)).not.toThrow();
      for (const k of Object.values(d.disguiseSheets)) expect(() => sheetByKey(k!)).not.toThrow();
      for (const p of [...d.props, ...(d.bossProp ? [d.bossProp] : [])]) expect(() => sheetByKey(`prop_${p}`)).not.toThrow();
      for (const look of d.disguises) expect(sheetKeyFor(look, 'boss', id)).toBe(d.disguiseSheets[look]);
    }
    expect(sheetKeyFor('guard', 'bad', 'garage')).toBe('guard_bad');
    expect(sheetKeyFor('suit', 'boss')).toBe('boss_disguise_suit');
  });

  it('ワゴンと高級車はふつうの攻撃では壊れない', () => {
    for (const k of ATTACK_KINDS) {
      expect(ATTACKS[k].propBreakChance.van).toBe(0);
      expect(ATTACKS[k].propBreakChance.bosscar).toBe(0);
    }
  });
});
