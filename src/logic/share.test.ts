import { describe, expect, it } from 'vitest';
import { buildShareText, shareCaption, xPostUrl } from './share';

describe('共有文', () => {
  it('見出し、ハッシュタグ、URLの3行だけ(数字や称号の数は入れない)', () => {
    const text = buildShareText({ caption: 'おばあちゃんに全力パンチ!', url: 'https://example.com/stupidhero/' });
    expect(text).toBe(['おばあちゃんに全力パンチ!', '#StupidHero', 'https://example.com/stupidhero/'].join('\n'));
    expect(text).not.toMatch(/\d+\/\d+/);
  });

  it('ひどい場面があればその見出し、ボスを倒しただけや何もないときは称号', () => {
    const titleName = '街のほんものヒーロー';
    expect(shareCaption({ worstScene: 'grannyHit', caption: 'おばあちゃんに全力パンチ!', titleName })).toBe('おばあちゃんに全力パンチ!');
    expect(shareCaption({ worstScene: 'bigPropBroken', caption: '駐車場ボロボロ!', titleName })).toBe('駐車場ボロボロ!');
    expect(shareCaption({ worstScene: 'civHit', caption: '市民に突撃!', titleName })).toBe('市民に突撃!');
    expect(shareCaption({ worstScene: 'bossDefeated', caption: 'ボスを倒した!', titleName })).toBe('称号「街のほんものヒーロー」');
    expect(shareCaption({ worstScene: null, caption: 'ひどいことはなかった!', titleName })).toBe('称号「街のほんものヒーロー」');
  });

  it('Xに投稿のURL', () => {
    expect(xPostUrl('あ #B')).toBe('https://x.com/intent/tweet?text=%E3%81%82%20%23B');
  });
});
