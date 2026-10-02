import { describe, expect, it } from 'vitest';
import { ABDUCTED_CAPTION, DROPPED_CAPTION, STAGE_WORST_CAPTIONS, buildShareText, freeWorstCaption, shareCaption, worstCaption, xPostUrl } from './share';
import { StatsTracker } from './stats';

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

  it('市民がさらわれた場面も見出しになる。大きな物が壊れた場面はステージごとの言い方', () => {
    const titleName = '宇宙人の案内係';
    expect(ABDUCTED_CAPTION).toBe('市民がさらわれた!');
    expect(shareCaption({ worstScene: 'abducted', caption: ABDUCTED_CAPTION, titleName })).toBe('市民がさらわれた!');
    expect(STAGE_WORST_CAPTIONS.mall?.bigPropBroken).toBe('モールがこわれた!');
    expect(STAGE_WORST_CAPTIONS.garage?.bigPropBroken).toBe('駐車場ボロボロ!');
    expect(STAGE_WORST_CAPTIONS.alley).toBeUndefined();
  });

  it('Xに投稿のURL', () => {
    expect(xPostUrl('あ #B')).toBe('https://x.com/intent/tweet?text=%E3%81%82%20%23B');
  });
});

describe('共有文(ステージ4)', () => {
  it('市民に物が落ちた場面も見出しになる。大きな物が壊れた場面は「ビルがこわれた!」', () => {
    expect(DROPPED_CAPTION).toBe('市民に物が落ちた!');
    expect(shareCaption({ worstScene: 'dropped', caption: DROPPED_CAPTION, titleName: '空飛ぶ家具の見送り係' })).toBe('市民に物が落ちた!');
    expect(STAGE_WORST_CAPTIONS.tower?.bigPropBroken).toBe('ビルがこわれた!');
  });
});

describe('いちばんひどい場面の説明の文(写真と同じ1回で、なぐったか巻きぞえかを決める)', () => {
  it('先に巻きぞえ、あとで直接なぐった:写真は巻きぞえの場面なので「まきぞえ」の文', () => {
    const st = new StatsTracker(9, 'alley');
    st.hurtCiv('collateral', 'suit');
    expect(st.reportScene('civHit', 'punch')).toBe(true);
    st.hurtCiv('hero', 'shopper');
    expect(st.reportScene('civHit', 'punch')).toBe(false);   // 同じ段なので写真は最初のまま
    const s = st.snapshot();
    expect(s.civHurtByHero).toBe(1);
    expect(s.worstCause).toBe('collateral');
    expect(worstCaption(s)).toBe('市民をまきぞえに!');
  });

  it('先に直接なぐり、あとで巻きぞえ:写真はなぐった場面なので技の文', () => {
    const st = new StatsTracker(9, 'alley');
    st.hurtCiv('hero', 'shopper');
    st.reportScene('civHit', 'stomp');
    st.hurtCiv('collateral', 'suit');
    st.reportScene('civHit', 'stomp');
    const s = st.snapshot();
    expect(s.worstCause).toBe('punch');
    expect(worstCaption(s)).toBe('市民を踏んだ!');
  });

  it('あとから足した技(アッパー、飛び蹴り、投げ、ヒップアタック)も技の文になる', () => {
    const want = { uppercut: '市民にアッパー!', flykick: '市民に飛び蹴り!', throw: '市民を投げた!', hip: '市民にヒップアタック!' } as const;
    for (const [k, text] of Object.entries(want)) {
      const st = new StatsTracker(9, 'alley');
      st.hurtCiv('hero', 'shopper');
      st.reportScene('civHit', k as keyof typeof want);
      expect(worstCaption(st.snapshot()), k).toBe(text);
    }
    const g = new StatsTracker(9, 'alley');
    g.hurtCiv('hero', 'granny');
    g.reportScene('grannyHit', 'hip');
    expect(worstCaption(g.snapshot())).toBe('おばあちゃんにヒップアタック!');
  });

  it('巻きぞえで当たったのがもっとひどい場面なら、その場面の巻きぞえの文になる', () => {
    const st = new StatsTracker(9, 'alley');
    st.hurtCiv('hero', 'shopper');
    st.reportScene('civHit', 'punch');
    st.hurtCiv('collateral', 'granny');
    expect(st.reportScene('grannyHit', 'special')).toBe(true);
    expect(worstCaption(st.snapshot())).toBe('おばあちゃんをまきぞえに!');
    const sp = new StatsTracker(9, 'alley');
    sp.hurtCiv('collateral', 'suit');
    sp.reportScene('specialOnCiv', 'special');
    expect(worstCaption(sp.snapshot())).toBe('市民を必殺技のまきぞえに!');
  });

  it('タイムセールラッシュで市民をなぐった場面は、あとで巻きぞえがあっても「なぐった」の文', () => {
    const st = new StatsTracker(9, 'mall');
    st.startRush({ alienCount: 3, civCount: 2 });
    st.rushHit('civ');
    st.reportScene('civHit', 'punch');
    st.hurtCiv('collateral', 'dancer');
    st.reportScene('civHit', 'charge');
    const s = st.snapshot();
    expect(s.civHurtByHero).toBe(0);
    expect(s.civHurtByCollateral).toBe(1);
    expect(s.worstCause).toBe('punch');
    expect(worstCaption(s)).toBe('市民をなぐった!');
  });

  it('エレベーターラッシュで市民をなぐった場面も「なぐった」の文', () => {
    const st = new StatsTracker(9, 'tower');
    st.startLift({ villainCount: 3, civCount: 2 });
    st.liftHit('civ');
    st.reportScene('civHit', 'punch');
    st.hurtCiv('collateral', 'suit');
    expect(worstCaption(st.snapshot())).toBe('市民をなぐった!');
  });

  it('worstCause のない古い形の数字は、けがの内わけとラッシュの数で決める(ラッシュでなぐったなら巻きぞえにしない)', () => {
    const base = { worstScene: 'civHit' as const, worstAttack: 'punch' as const, civHurtByHero: 0, civHurtByCollateral: 1 };
    expect(worstCaption(base)).toBe('市民をまきぞえに!');
    const rush = { aliens: 3, civs: 2, aliensDefeated: 3, aliensSpared: 0, civsSaved: 1, civsHit: 1 };
    expect(worstCaption({ ...base, rush })).toBe('市民をなぐった!');
    expect(worstCaption({ ...base, lift: rush })).toBe('市民をなぐった!');
    expect(worstCaption({ ...base, civHurtByHero: 1 })).toBe('市民をなぐった!');
  });

  it('市民に当たっていない場面は worstCause を残さない。渡した cause はそのまま使う', () => {
    const st = new StatsTracker(9, 'alley');
    st.hurtCiv('collateral', 'suit');
    st.reportScene('bigPropBroken');
    expect(st.snapshot().worstCause).toBeNull();
    const t = new StatsTracker(9, 'alley');
    t.reportScene('civHit', 'punch', 'collateral');
    expect(worstCaption(t.snapshot())).toBe('市民をまきぞえに!');
    // けがを数えずに伝えたとき(開発用の見本など)は、なぐったことにする
    const u = new StatsTracker(9, 'alley');
    u.reportScene('civHit');
    expect(u.snapshot().worstCause).toBe('punch');
  });

  it('フリープレイの文も同じ決め方(ステージの言い方は使わない)', () => {
    const st = new StatsTracker(9, 'garage');
    st.hurtCiv('collateral', 'suit');
    st.reportScene('civHit', 'punch');
    st.hurtCiv('hero', 'mechanic');
    st.reportScene('civHit', 'punch');
    expect(freeWorstCaption(st.snapshot())).toBe('市民をまきぞえに!');
  });
});
