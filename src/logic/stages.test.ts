import { describe, expect, it } from 'vitest';
import { IMAGES, sheetByKey } from '../art/sheets';
import { ATTACKS, ATTACK_KINDS, BIG_PROPS, BOSS, BOSS4, LEAK, LIFT, MALL_PROP_SIZE, PROP_COST, PSY, TOWER_WAVES } from './rules';
import {
  FREE_STAGE_IDS, MALL_SHEETS, STAGES, STAGE_IDS, bgForWave, isStageId, propsForWave, rushAfter, sheetKeyFor, stageTexts, unlockBannerText,
  type StageDef
} from './stages';
import { TITLES } from './titles';

// ボスを市民に仕分けたときの額(bossRampageCost)は stats.test.ts でまとめて確かめる

describe('ステージの定義', () => {
  it('番号、名前、ボス戦の数字、開く順。ステージ2は曲もボスの絵も別', () => {
    expect(STAGE_IDS).toEqual(['alley', 'garage', 'mall', 'tower']);
    expect(STAGE_IDS.map((id) => [STAGES[id].no, STAGES[id].name, STAGES[id].shortName])).toEqual([
      [1, '路地裏', '路地裏'], [2, '地下駐車場', '地下駐車場'], [3, 'ショッピングモール', 'モール'], [4, '高層ビル', 'ビル']
    ]);
    expect(STAGES.garage.bgm.street).not.toBe(STAGES.alley.bgm.street);
    expect(STAGES.garage.bgm.boss).not.toBe(STAGES.alley.bgm.boss);
    expect(STAGES.garage.bossSheet).not.toBe(STAGES.alley.bossSheet);
    expect(STAGES.garage.bossFight).toEqual({ carAtHpRatio: 0.5, carIdleCostPerSec: 1_000_000, carHoldSec: 1.3, carMinSec: 1.5 });
    expect(STAGES.garage.unlockAfter).toBe('alley');
    // 仕組みとラッシュ
    expect(STAGE_IDS.map((id) => [STAGES[id].mechanic, STAGES[id].rush])).toEqual([
      ['none', null], ['gang', null], ['ufo', { kind: 'sale', afterWave: 2 }], ['psychic', { kind: 'elevator', afterWave: 3 }]
    ]);
    // ステージ1〜3は、どの波も同じ背景と物。高層ビルは波ごとに4つの階
    for (const id of STAGE_IDS.filter((i) => i !== 'tower')) expect(STAGES[id].floors).toBeNull();
    expect(STAGES.tower.floors).toHaveLength(4);
  });

  it('ステージ3:地下駐車場のボスを倒すと開く。見た目と物、母艦は1秒¥150万、倒すと噴水が壊れる', () => {
    const d = STAGES.mall;
    expect(d.unlockAfter).toBe('garage');
    expect(d.lockedText).toBe('地下駐車場をクリアすると遊べる');
    expect(d.looks).toEqual(['mascot', 'clerk', 'dancer', 'uncle']);
    expect(d.props).toEqual(['gacha', 'mannequin', 'showcase', 'fountain', 'escalator']);
    expect(d.bossFight).toEqual({ carAtHpRatio: 0.5, carIdleCostPerSec: 1_500_000, carHoldSec: 1.3, carMinSec: 1.5 });
    expect(d.bossProp).toBe('mothership');
    expect(d.bossDefeatProp).toBe('fountain');
    expect(PROP_COST.fountain).toBe(1_500_000);
    expect(d.bossSheet).toBe('boss3');
    expect(d.bg).toEqual({ far: 'bg_mall_far', wall: 'bg_mall_wall', ground: 'bg_mall_ground' });
    expect(d.disguiseSheets).toEqual({ clerk: 'boss3_disguise_clerk', uncle: 'boss3_disguise_uncle', mascot: 'boss3_disguise_mascot' });
    expect(TITLES.filter((t) => t.stages?.length === 1 && t.stages[0] === 'mall').map((t) => t.id)).toEqual(['ufoGuide', 'saleGuardian', 'ufoHunter']);
    expect(stageTexts()).toContain('地下駐車場をクリアすると遊べる');
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

  it('絵のキーは全部 sheets.ts にある(全部のステージ)', () => {
    const imageKeys = new Set(IMAGES.map((i) => i.key));
    for (const id of STAGE_IDS) {
      const d = STAGES[id];
      for (const k of Object.values(d.bg)) expect(imageKeys.has(k), k).toBe(true);
      expect(() => sheetByKey(d.bossSheet)).not.toThrow();
      for (const k of Object.values(d.disguiseSheets)) expect(() => sheetByKey(k!)).not.toThrow();
      for (const p of [...d.props, ...(d.bossProp ? [d.bossProp] : [])]) expect(() => sheetByKey(`prop_${p}`)).not.toThrow();
      for (const look of d.disguises) expect(sheetKeyFor(look, 'boss', id)).toBe(d.disguiseSheets[look]);
      // 波ごとに変わる背景と物(高層ビルの階)
      for (const f of d.floors ?? []) {
        for (const k of Object.values(f.bg)) expect(imageKeys.has(k), k).toBe(true);
        for (const p of f.props) expect(() => sheetByKey(`prop_${p}`), p).not.toThrow();
      }
      // 人の絵(高層ビルは市民とヴィランで同じ絵)
      for (const look of d.looks) for (const t of ['civ', 'bad'] as const) expect(() => sheetByKey(sheetKeyFor(look, t, id)), look).not.toThrow();
    }
    // ステージ3のUFOの吸い上げる光の絵
    for (const k of Object.values(MALL_SHEETS)) expect(() => sheetByKey(k), k).not.toThrow();
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

describe('波ごとの舞台とラッシュ', () => {
  it('floors がないステージは、どの波も bg と props。あるステージは波ごとに floors から読む', () => {
    const mall = STAGES.mall;
    for (const no of [1, 2, 3] as const) {
      expect(bgForWave(mall, no)).toBe(mall.bg);
      expect(propsForWave(mall, no)).toBe(mall.props);
    }
    const bg = (n: number) => ({ far: `far${n}`, wall: `wall${n}`, ground: `ground${n}` });
    const tower: StageDef = {
      ...mall,
      floors: [1, 2, 3, 4].map((n) => ({ bg: bg(n), props: n === 4 ? ['fountain'] : ['gacha'] }))
    };
    expect(bgForWave(tower, 1)).toEqual(bg(1));
    expect(bgForWave(tower, 4)).toEqual(bg(4));
    expect(propsForWave(tower, 4)).toEqual(['fountain']);
    // 波の数より floors が短いときは bg と props にもどる
    expect(bgForWave({ ...tower, floors: tower.floors!.slice(0, 2) }, 3)).toBe(mall.bg);
  });

  it('ラッシュは rush の波のあとだけ。種類を渡すとその種類のときだけ', () => {
    expect(rushAfter(STAGES.mall, 2)).toBe(true);
    expect(rushAfter(STAGES.mall, 2, 'sale')).toBe(true);
    expect(rushAfter(STAGES.mall, 2, 'elevator')).toBe(false);
    expect(rushAfter(STAGES.mall, 3)).toBe(false);
    expect(STAGE_IDS.filter((id) => id !== 'mall' && id !== 'tower').some((id) => [1, 2, 3].some((no) => rushAfter(STAGES[id], no as 1 | 2 | 3)))).toBe(false);
    const tower: StageDef = { ...STAGES.mall, rush: { kind: 'elevator', afterWave: 3 } };
    expect(rushAfter(tower, 3, 'elevator')).toBe(true);
    expect(rushAfter(tower, 3, 'sale')).toBe(false);
  });
});

describe('ステージ4(高層ビル)の定義', () => {
  const d = STAGES.tower;

  it('番号、名前、仕組み、ラッシュ、開く順。ステージを選ぶ画面には入れ、フリープレイには入れない', () => {
    expect([d.no, d.name, d.shortName]).toEqual([4, '高層ビル', 'ビル']);
    expect(d.mechanic).toBe('psychic');
    expect(d.rush).toEqual({ kind: 'elevator', afterWave: 3 });
    expect(rushAfter(d, 3, 'elevator')).toBe(true);
    expect(rushAfter(d, 2)).toBe(false);
    expect(d.unlockAfter).toBe('mall');
    expect(d.lockedText).toBe('モールをクリアすると遊べる');
    expect(STAGE_IDS).toContain('tower');
    expect(FREE_STAGE_IDS).not.toContain('tower');
    expect(STAGE_IDS).toEqual(['alley', 'garage', 'mall', 'tower']);
    expect(isStageId('tower')).toBe(true);
    expect(d.waves).toBe(TOWER_WAVES);
    expect(d.bossSheet).toBe('boss4');
    expect(d.bossProp).toBe('chandelier');
    expect(d.bossDefeatProp).toBe('champagne');
    expect(d.disguises).toEqual(['lady', 'magician', 'waiter']);
    expect(d.disguiseSheets).toEqual({ lady: 'tw_boss_lady', magician: 'tw_boss_magician', waiter: 'tw_boss_waiter' });
    for (const look of d.disguises) expect(sheetKeyFor(look, 'boss', 'tower')).toBe(d.disguiseSheets[look]);
    for (const look of d.looks) {
      expect(sheetKeyFor(look, 'civ', 'tower')).toBe(`tw_${look}`);
      expect(sheetKeyFor(look, 'bad', 'tower')).toBe(`tw_${look}`);
    }
  });

  it('波ごとの背景と物(1階、18階、35階、最上階)。ソファはどの階にもある', () => {
    expect(d.floors).toHaveLength(4);
    expect([1, 2, 3, 4].map((n) => bgForWave(d, n as 1 | 2 | 3 | 4).far)).toEqual(['bg_tower1_far', 'bg_tower2_far', 'bg_tower3_far', 'bg_tower4_far']);
    for (const n of [1, 2, 3] as const) {
      expect(bgForWave(d, n).wall).toBe('bg_tower_wall');
      expect(bgForWave(d, n).ground).toBe('bg_tower_ground');
    }
    expect(bgForWave(d, 4)).toEqual({ far: 'bg_tower4_far', wall: 'bg_party_wall', ground: 'bg_party_ground' });
    expect(d.bg).toEqual(bgForWave(d, 1));
    expect([1, 2, 3, 4].map((n) => propsForWave(d, n as 1 | 2 | 3 | 4))).toEqual([
      ['sofa', 'plant', 'flowers'], ['sofa', 'plant', 'copier'], ['sofa', 'tank', 'wine'], ['sofa', 'champagne', 'piano']
    ]);
  });

  it('物の値段と大きさ(STAGE4「壊れる物」)。ソファは壊れない、ピアノはめったに壊れない、水槽とピアノは大きな物', () => {
    expect([PROP_COST.sofa, PROP_COST.plant, PROP_COST.flowers, PROP_COST.copier, PROP_COST.tank, PROP_COST.wine, PROP_COST.champagne, PROP_COST.piano])
      .toEqual([0, 50_000, 200_000, 800_000, 3_000_000, 5_000_000, 10_000_000, 30_000_000]);
    expect(PROP_COST.chandelier).toBe(BOSS4.chandelierCost);
    expect(BIG_PROPS).toContain('tank');
    expect(BIG_PROPS).toContain('piano');
    expect(BIG_PROPS).not.toContain('sofa');
    for (const k of ATTACK_KINDS) {
      expect(ATTACKS[k].propBreakChance.sofa).toBe(0);
      expect(ATTACKS[k].propBreakChance.chandelier).toBe(0);
      if (k !== 'special') expect(ATTACKS[k].propBreakChance.piano).toBeLessThanOrEqual(0.1);
      for (const p of ['plant', 'flowers', 'copier', 'tank', 'wine', 'champagne'] as const) {
        expect(ATTACKS[k].propBreakChance[p], `${k} ${p}`).toBeGreaterThan(ATTACKS[k].propBreakChance.piano);
      }
    }
  });

  it('波、もれ、念力、エレベーター、ボス戦の数字', () => {
    expect(TOWER_WAVES.map((w) => [w.people, w.seconds, w.villains, w.boss, w.decoys ?? 0]))
      .toEqual([[4, 26, [1, 2], false, 0], [5, 24, [2, 3], false, 1], [6, 26, [2, 3], false, 1], [6, 30, [2, 2], true, 1]]);
    expect(TOWER_WAVES[0].practiceLeak).toBe(true);
    expect(LEAK.bothChance).toBe(0.5);
    expect([PSY.raiseSec, PSY.liftSec, PSY.carrySec, PSY.dropSec, PSY.victimDistance, PSY.dropWindowPx]).toEqual([0.6, 0.8, 3, 0.4, 90, 20]);
    expect(PSY.cushionProp).toBe('sofa');
    expect(PSY.extraPropChance).toBe(0.7);
    expect([LIFT.people, LIFT.villains, LIFT.doorSec, LIFT.stepInSec, LIFT.markSec, LIFT.actSec, LIFT.closeSec, LIFT.slowScale])
      .toEqual([6, [2, 3], 0.3, 0.5, 1, 0.6, 0.5, 1.5]);
    expect([BOSS.hpTaps, BOSS4.choiceAtHpRatio, BOSS4.choiceSec, BOSS4.chandelierCost, BOSS.idleCostPerSec])
      .toEqual([40, 0.5, 3, 30_000_000, 500_000]);
    // 念力の選択は、女ボスが車に乗るのと同じ仕組みで知らせる(戻ってから倒れるまで最短1.5秒)
    expect(d.bossFight).toEqual({ carAtHpRatio: 0.5, carMinSec: 1.5 });
  });

  it('開いたときの帯は短い名前(STAGE4「ステージを選ぶ画面」)', () => {
    expect(unlockBannerText('garage')).toBe('地下駐車場が遊べる!');
    expect(unlockBannerText('mall')).toBe('モールが遊べる!');
    expect(unlockBannerText('tower')).toBe('ビルが遊べる!');
  });
});
