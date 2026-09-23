import { describe, expect, it } from 'vitest';
import { buildShareText, xPostUrl } from './share';

describe('共有文', () => {
  it('SPECの例と同じ形', () => {
    const text = buildShareText({
      stageName: '路地裏', defeated: 8, civHurt: 3, damage: 24_000_000,
      titleName: '歩く解体工事', titlesCollected: 3, titlesTotal: 12, url: 'https://example.com/stupidhero/'
    });
    expect(text).toBe([
      '【Stupid Hero】路地裏ステージ',
      '悪党8人撃破/市民3人負傷',
      '被害額¥2,400万(自販機30台分)',
      '称号「歩く解体工事」(3/12)',
      '#StupidHero',
      'https://example.com/stupidhero/'
    ].join('\n'));
  });

  it('Xに投稿のURL', () => {
    expect(xPostUrl('あ #B')).toBe('https://x.com/intent/tweet?text=%E3%81%82%20%23B');
  });
});

describe('共有文のステージ名', () => {
  it('ステージから取る', () => {
    const base = { defeated: 9, civHurt: 0, damage: 5_000_000, titleName: '一網打尽', titlesCollected: 5, titlesTotal: 14, url: 'u' };
    expect(buildShareText({ ...base, stageId: 'garage' }).split('\n')[0]).toBe('【Stupid Hero】地下駐車場ステージ');
    expect(buildShareText({ ...base, stageId: 'alley' }).split('\n')[0]).toBe('【Stupid Hero】路地裏ステージ');
    expect(buildShareText({ ...base, stageId: 'garage' }).split('\n')[3]).toBe('称号「一網打尽」(5/14)');
    // 被害額のたとえもステージの物で
    expect(buildShareText({ ...base, stageId: 'garage' }).split('\n')[2]).toBe('被害額¥500万(ワゴン1台分)');
    expect(buildShareText({ ...base, stageName: '地下駐車場' }).split('\n')[2]).toBe('被害額¥500万(ワゴン1台分)');
    expect(buildShareText({ ...base, stageId: 'alley' }).split('\n')[2]).toBe('被害額¥500万(自販機6.3台分)');
  });
});
