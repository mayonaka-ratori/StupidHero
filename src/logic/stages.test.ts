import { describe, expect, it } from 'vitest';
import { IMAGES, sheetByKey } from '../art/sheets';
import { ATTACKS, ATTACK_KINDS, BIG_PROPS, MALL_PROP_SIZE, PROP_COST } from './rules';
import { MALL_SHEETS, STAGES, STAGE_IDS, isStageId, sheetKeyFor, stageTexts } from './stages';
import type { StageId } from './types';

/**
 * 絵がもうあるステージ。ショッピングモールの絵は絵の担当が作っている途中なので、キーの名前だけ下で確かめる
 * (絵の担当が src/art/sheets.ts にモールの絵を足したら、'mall' を足す)
 */
const ART_READY: readonly StageId[] = ['alley', 'garage'];

describe('ステージの定義', () => {
  it('番号、名前、値段とボス戦の数字、開く順。ステージ2は曲もボスの絵も別', () => {
    expect(STAGE_IDS).toEqual(['alley', 'garage', 'mall']);
    expect(STAGE_IDS.map((id) => [STAGES[id].no, STAGES[id].name, STAGES[id].shortName])).toEqual([
      [1, '路地裏', '路地裏'], [2, '地下駐車場', '地下駐車場'], [3, 'ショッピングモール', 'モール']
    ]);
    expect(STAGES.garage.bgm.street).not.toBe(STAGES.alley.bgm.street);
    expect(STAGES.garage.bgm.boss).not.toBe(STAGES.alley.bgm.boss);
    expect(STAGES.garage.bossSheet).not.toBe(STAGES.alley.bossSheet);
    expect(STAGES.alley.bossRampageCost).toBe(10_000_000);
    expect(STAGES.garage.bossRampageCost).toBe(15_000_000);
    expect(STAGES.garage.bossFight).toEqual({ carAtHpRatio: 0.5, carIdleCostPerSec: 1_000_000, carHoldSec: 1.3, carMinSec: 1.5 });
    expect(STAGES.garage.unlockAfter).toBe('alley');
    expect(STAGES.alley.unlocks).toBe('garage');
    // 仕組みとラッシュ
    expect(STAGE_IDS.map((id) => [STAGES[id].mechanic, STAGES[id].hasRush])).toEqual([['none', false], ['gang', false], ['ufo', true]]);
  });

  it('ステージ3:地下駐車場のボスを倒すと開く。親玉は¥2,000万、母艦は1秒¥150万、倒すと噴水が壊れる', () => {
    const d = STAGES.mall;
    expect(STAGES.garage.unlocks).toBe('mall');
    expect(d.unlockAfter).toBe('garage');
    expect(d.lockedText).toBe('地下駐車場をクリアすると遊べる');
    expect(d.bossRampageCost).toBe(20_000_000);
    expect(d.bossFight).toEqual({ carAtHpRatio: 0.5, carIdleCostPerSec: 1_500_000, carHoldSec: 1.3, carMinSec: 1.5 });
    expect(d.bossProp).toBe('mothership');
    expect(d.bossDefeatProp).toBe('fountain');
    expect(PROP_COST.fountain).toBe(1_500_000);
    expect(d.bossSheet).toBe('boss3');
    expect(d.bg).toEqual({ far: 'bg_mall_far', wall: 'bg_mall_wall', ground: 'bg_mall_ground' });
    expect(d.disguiseSheets).toEqual({ clerk: 'boss3_disguise_clerk', uncle: 'boss3_disguise_uncle', mascot: 'boss3_disguise_mascot' });
    expect(d.onlyTitles).toEqual(['ufoGuide', 'saleGuardian', 'ufoHunter']);
    expect(stageTexts()).toContain('地下駐車場をクリアすると遊べる');
  });

  it('ステージ3の絵のキーの名前(絵は絵の担当が作る)', () => {
    const d = STAGES.mall;
    for (const look of d.looks) {
      expect(sheetKeyFor(look, 'civ', 'mall')).toBe(`${look}_civ`);
      expect(sheetKeyFor(look, 'bad', 'mall')).toBe(`${look}_bad`);
    }
    expect(d.looks).toEqual(['mascot', 'clerk', 'dancer', 'uncle']);
    for (const look of d.disguises) expect(sheetKeyFor(look, 'boss', 'mall')).toBe(`boss3_disguise_${look}`);
    expect(d.props.map((p) => `prop_${p}`)).toEqual(['prop_gacha', 'prop_mannequin', 'prop_showcase', 'prop_fountain', 'prop_escalator']);
    expect(MALL_SHEETS).toEqual({ ufo: 'prop_ufo', mothership: 'prop_mothership', beam: 'fx_beam', glitch: 'fx_glitch' });
  });

  it('ステージ3の物の値段と大きさ(STAGE3の表)。噴水とエスカレーターは大きな物。UFOと母艦はふつうの攻撃では壊れない', () => {
    expect([PROP_COST.gacha, PROP_COST.mannequin, PROP_COST.showcase, PROP_COST.fountain, PROP_COST.escalator])
      .toEqual([50_000, 100_000, 300_000, 1_500_000, 8_000_000]);
    expect(PROP_COST.ufo).toBe(3_000_000);
    expect(MALL_PROP_SIZE.gacha).toEqual({ w: 24, h: 32 });
    expect(MALL_PROP_SIZE.mannequin).toEqual({ w: 24, h: 56 });
    expect(MALL_PROP_SIZE.showcase).toEqual({ w: 32, h: 32 });
    expect(MALL_PROP_SIZE.fountain).toEqual({ w: 64, h: 40 });
    expect(MALL_PROP_SIZE.escalator).toEqual({ w: 96, h: 64 });
    expect(BIG_PROPS).toContain('fountain');
    expect(BIG_PROPS).toContain('escalator');
    expect(BIG_PROPS).not.toContain('ufo');
    for (const k of ATTACK_KINDS) {
      expect(ATTACKS[k].propBreakChance.ufo).toBe(0);
      expect(ATTACKS[k].propBreakChance.mothership).toBe(0);
      for (const p of STAGES.mall.props) expect(ATTACKS[k].propBreakChance[p], `${k} ${p}`).toBeGreaterThan(0);
    }
  });

  it('絵のキーは全部 sheets.ts にある', () => {
    const imageKeys = new Set(IMAGES.map((i) => i.key));
    for (const id of ART_READY) {
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
