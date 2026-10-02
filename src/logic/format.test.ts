import { describe, expect, it } from 'vitest';
import { damageAnalogy, formatSeconds, formatYen, hurtBreakdown, withCommas } from './format';
import type { StageId } from './types';

describe('format', () => {
  it('金額', () => {
    expect(formatYen(0)).toBe('¥0');
    expect(formatYen(5000)).toBe('¥5,000');
    expect(formatYen(30_000)).toBe('¥3万');
    expect(formatYen(24_000_000)).toBe('¥2,400万');
    expect(formatYen(100_000_000)).toBe('¥1億');
    expect(formatYen(120_000_000)).toBe('¥1億2,000万');
    expect(formatYen(1_234_567_890)).toBe('¥12億3,456万');
    expect(formatYen(35_000)).toBe('¥3万');
    expect(withCommas(1234567)).toBe('1,234,567');
  });

  it('被害額のたとえ', () => {
    expect(damageAnalogy(24_000_000).text).toBe('自販機30台分');
    expect(damageAnalogy(24_000_000).count).toBe(30);
    expect(damageAnalogy(800_000).text).toBe('自販機1台分');
    expect(damageAnalogy(1_200_000).text).toBe('自販機1.5台分');
    expect(damageAnalogy(30_000).text).toBe('ゴミ箱1個分');
    expect(damageAnalogy(600_000).text).toBe('ゴミ箱20個分');
    expect(damageAnalogy(600_000).unit).toBe('trash');
    expect(damageAnalogy(790_000).text).not.toContain('自販機0.');
    expect(damageAnalogy(30_000_000).text).toBe('車10台分');
    expect(damageAnalogy(75_000_000).text).toBe('車25台分');
    expect(damageAnalogy(300_000_000).text).toBe('一軒家10軒分');
    expect(damageAnalogy(0).text).toBe('被害ゼロ');
  });

  it('ステージごとのたとえ(路地裏の物は出さない):地下駐車場は三角コーン、ワゴン、高級車。モールはガチャガチャ、噴水、エスカレーター。高層ビルは観葉植物、シャンパンタワー、ピアノ', () => {
    // [ステージ, 被害額, たとえ]。どの段階も、切りかわる額の前とあとを入れる
    const cases: [StageId, number, string][] = [
      ['garage', 10_000, '三角コーン1個分'],
      ['garage', 300_000, '三角コーン30個分'],
      ['garage', 490_000, '三角コーン49個分'],
      ['garage', 500_000, 'ワゴン0.1台分'],
      ['garage', 8_060_000, 'ワゴン1.6台分'],
      ['garage', 50_000_000, 'ワゴン10台分'],
      ['garage', 199_000_000, 'ワゴン40台分'],
      ['garage', 200_000_000, '高級車10台分'],
      ['mall', 50_000, 'ガチャガチャ1台分'],
      ['mall', 490_000, 'ガチャガチャ9.8台分'],
      ['mall', 500_000, '噴水0.3基分'],
      ['mall', 1_500_000, '噴水1基分'],
      ['mall', 30_000_000, '噴水20基分'],
      ['mall', 199_000_000, '噴水133基分'],
      ['mall', 200_000_000, 'エスカレーター25基分'],
      ['tower', 100_000, '観葉植物2鉢分'],
      ['tower', 490_000, '観葉植物9.8鉢分'],
      ['tower', 500_000, 'シャンパンタワー0.1基分'],
      ['tower', 25_000_000, 'シャンパンタワー2.5基分'],
      ['tower', 199_000_000, 'シャンパンタワー20基分'],
      ['tower', 200_000_000, 'ピアノ6.7台分'],
      ['tower', 300_000_000, 'ピアノ10台分']
    ];
    for (const [stageId, yen, text] of cases) expect(damageAnalogy(yen, stageId).text, `${stageId} ${yen}`).toBe(text);
  });

  it('市民のけがの内わけ(0は書かない。さらわれたは4つ目)', () => {
    const none = { civHurtByHero: 0, civHurtByCollateral: 0, civHurtByVillain: 0, civHurtByAbduction: 0, civHurtByDrop: 0 };
    expect(hurtBreakdown({ ...none, civHurtByHero: 1, civHurtByVillain: 2 })).toEqual(['なぐった1', 'ワルにやられた2']);
    expect(hurtBreakdown({ ...none, civHurtByHero: 1, civHurtByCollateral: 2, civHurtByVillain: 1, civHurtByAbduction: 3 }))
      .toEqual(['なぐった1', 'まきぞえ2', 'ワルにやられた1', 'さらわれた3']);
    expect(hurtBreakdown(none)).toEqual([]);
    // 物が落ちたは5つ目(高層ビル)
    expect(hurtBreakdown({ ...none, civHurtByVillain: 1, civHurtByDrop: 2 }))
      .toEqual(['ワルにやられた1', '物が落ちた2']);
  });

  it('秒数は切り上げ', () => {
    expect(formatSeconds(4.23)).toBe('4.3秒');
    expect(formatSeconds(5)).toBe('5.0秒');
    expect(formatSeconds(4.2)).toBe('4.2秒');
    expect(formatSeconds(5.01)).toBe('5.1秒');
  });
});
