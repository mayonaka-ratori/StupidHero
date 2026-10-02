import { describe, expect, it } from 'vitest';
import { IMAGES, sheetByKey } from '../art/sheets';
import { ATTACKS, ATTACK_KINDS, BOSS4, PROP_COST, PSY } from './rules';
import { MALL_SHEETS, STAGES, STAGE_IDS, bgForWave, propsForWave, rushAfter, sheetKeyFor, type StageDef } from './stages';

// ボスを市民に仕分けたときの額(bossRampageCost)は stats.test.ts でまとめて確かめる。
// 開く順は records.test.ts、地下駐車場と高層ビルのボス戦の動きは boss.test.ts と bossChoice.test.ts、
// 波の人数と時間とワルの数は stage.test.ts と tower.test.ts、1つのステージだけで取れる称号は titleCollect.test.ts の
// 「1つの場所だけで取れる称号」で確かめる。開いていないときの文(lockedText)と、モールの母艦の1秒¥150万のような
// 表に書いただけの文と数字は、表を書き写すだけになるので確かめない

describe('ステージの定義', () => {
  it('どのステージも、結果発表の曲、ボス戦の曲、ラッシュの曲、ボスの絵がほかのステージと重ならない', () => {
    const unique = (list: readonly (string | null)[]): boolean => {
      const set = list.filter((v) => v !== null);
      return new Set(set).size === set.length;
    };
    for (const key of ['street', 'boss', 'rush'] as const) expect(unique(STAGE_IDS.map((id) => STAGES[id].bgm[key])), key).toBe(true);
    expect(unique(STAGE_IDS.map((id) => STAGES[id].bossSheet))).toBe(true);
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
  });

  it('ふつうの攻撃で壊れる物と壊れない物。モールの物はどの技でも壊れる。仕掛けの物とソファは壊れない。ピアノはめったに壊れない', () => {
    // 高層ビルの壊れる物(ソファとピアノのほか)は、どの技でもピアノより壊れやすい
    const towerProps = [...new Set(STAGES.tower.floors!.flatMap((f) => f.props))].filter((p) => p !== 'sofa' && p !== 'piano');
    for (const k of ATTACK_KINDS) {
      const chance = ATTACKS[k].propBreakChance;
      for (const p of STAGES.mall.props) expect(chance[p], `${k} ${p}`).toBeGreaterThan(0);
      // UFO、母艦、ワゴン、高級車、シャンデリアは仕掛けにだけ使う。ソファは念力で運ばれた物を受け止める
      for (const p of ['ufo', 'mothership', 'van', 'bosscar', 'sofa', 'chandelier'] as const) expect(chance[p], `${k} ${p}`).toBe(0);
      if (k !== 'special') expect(chance.piano, k).toBeLessThanOrEqual(0.1);
      for (const p of towerProps) expect(chance[p], `${k} ${p}`).toBeGreaterThan(chance.piano);
    }
    // ボス戦でシャンデリアが落ちたときの額は、物の値段の表と同じ
    expect(PROP_COST.chandelier).toBe(BOSS4.chandelierCost);
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

  it('高層ビルは波ごとに階の背景と物が変わり、波1は bg と props と同じ。どの階にもソファがある(念力で運ばれた物を受け止める)', () => {
    const d = STAGES.tower;
    expect(d.floors).toHaveLength(d.waves.length);
    expect(bgForWave(d, 1)).toEqual(d.bg);
    expect(propsForWave(d, 1)).toEqual(d.props);
    expect(new Set(d.floors!.map((f) => f.bg.far)).size).toBe(d.floors!.length);
    for (const [i, f] of d.floors!.entries()) expect(f.props, `波${i + 1}`).toContain(PSY.cushionProp);
  });
});
