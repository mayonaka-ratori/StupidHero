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

  it('地下駐車場のたとえは三角コーン、ワゴン、高級車(路地裏の物は出さない)', () => {
    expect(damageAnalogy(10_000, 'garage').text).toBe('三角コーン1個分');
    expect(damageAnalogy(300_000, 'garage').text).toBe('三角コーン30個分');
    expect(damageAnalogy(490_000, 'garage').unit).toBe('cone');
    expect(damageAnalogy(500_000, 'garage').text).toBe('ワゴン0.1台分');
    expect(damageAnalogy(8_060_000, 'garage').text).toBe('ワゴン1.6台分');
    expect(damageAnalogy(50_000_000, 'garage').text).toBe('ワゴン10台分');
    expect(damageAnalogy(199_000_000, 'garage').unit).toBe('van');
    expect(damageAnalogy(200_000_000, 'garage').text).toBe('高級車10台分');
    expect(damageAnalogy(0, 'garage').text).toBe('被害ゼロ');
    for (let yen = 10_000; yen < 2_000_000_000; yen = Math.ceil(yen * 1.37)) {
      const t = damageAnalogy(yen, 'garage').text;
      expect(t).not.toMatch(/ゴミ箱|自販機|一軒家|^車/);
      expect(damageAnalogy(yen, 'garage').count).toBeGreaterThan(0);
    }
    expect(formatDamage(24_000_000, 'garage')).toBe('¥2,400万(ワゴン4.8台分)');
    // 路地裏(省略したとき)は今まで通り
    expect(damageAnalogy(24_000_000, 'alley').text).toBe('自販機30台分');
    expect(formatDamage(24_000_000)).toBe('¥2,400万(自販機30台分)');
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
