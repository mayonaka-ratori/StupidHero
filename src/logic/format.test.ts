import { describe, expect, it } from 'vitest';
import { damageAnalogy, formatDamage, formatSeconds, formatYen, withCommas } from './format';

describe('format', () => {
  it('金額', () => {
    expect(formatYen(0)).toBe('¥0');
    expect(formatYen(5000)).toBe('¥5,000');
    expect(formatYen(30_000)).toBe('¥3万');
    expect(formatYen(200_000)).toBe('¥20万');
    expect(formatYen(3_000_000)).toBe('¥300万');
    expect(formatYen(10_000_000)).toBe('¥1,000万');
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

  it('被害額とたとえをまとめて', () => {
    expect(formatDamage(24_000_000)).toBe('¥2,400万(自販機30台分)');
  });

  it('秒数は切り上げ', () => {
    expect(formatSeconds(4.23)).toBe('4.3秒');
    expect(formatSeconds(5)).toBe('5.0秒');
    expect(formatSeconds(4.2)).toBe('4.2秒');
    expect(formatSeconds(5.01)).toBe('5.1秒');
  });
});
