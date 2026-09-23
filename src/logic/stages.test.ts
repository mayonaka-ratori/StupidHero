import { describe, expect, it } from 'vitest';
import { IMAGES, sheetByKey } from '../art/sheets';
import { ATTACKS, ATTACK_KINDS, PROP_COST } from './rules';
import { STAGES, STAGE_IDS, isStageId, sheetKeyFor, stageTexts } from './stages';

describe('ステージの定義', () => {
  it('番号、名前、曲、ボスの絵', () => {
    expect(STAGE_IDS).toEqual(['alley', 'garage']);
    expect(STAGE_IDS.map((id) => [STAGES[id].no, STAGES[id].name])).toEqual([[1, '路地裏'], [2, '地下駐車場']]);
    expect(STAGES.alley.bgm).toEqual({ street: 'street', boss: 'boss' });
    expect(STAGES.garage.bgm).toEqual({ street: 'street2', boss: 'boss2' });
    expect(STAGES.alley.bossSheet).toBe('boss');
    expect(STAGES.garage.bossSheet).toBe('boss2');
    expect(STAGES.alley.bossRampageCost).toBe(10_000_000);
    expect(STAGES.garage.bossRampageCost).toBe(15_000_000);
    expect(STAGES.garage.bossFight).toEqual({ carAtHpRatio: 0.5, carIdleCostPerSec: 1_000_000, carHoldSec: 1.3, carMinSec: 1.5 });
    expect(STAGES.garage.unlockAfter).toBe('alley');
    expect(STAGES.alley.unlocks).toBe('garage');
  });

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

  it('壊れる物の値段。ワゴンは¥500万。ワゴンと高級車はふつうの攻撃では壊れない', () => {
    expect(PROP_COST.van).toBe(5_000_000);
    for (const p of ['bosscar', 'pillar', 'barrier', 'cone', 'extinguisher'] as const) expect(PROP_COST[p]).toBeGreaterThan(0);
    for (const k of ATTACK_KINDS) {
      expect(ATTACKS[k].propBreakChance.van).toBe(0);
      expect(ATTACKS[k].propBreakChance.bosscar).toBe(0);
    }
  });

  it('id の確かめと、画面に出す文', () => {
    expect(isStageId('garage')).toBe(true);
    expect(isStageId('moon')).toBe(false);
    expect(stageTexts()).toContain('路地裏をクリアすると遊べる');
  });
});
