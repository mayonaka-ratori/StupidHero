import { describe, expect, it } from 'vitest';
import { buildShareText, freeWorstCaption, shareCaption, worstCaption, xPostUrl } from './share';
import { StatsTracker, WORST_SCENE_RANK } from './stats';
import type { StageId, WorstScene } from './types';

describe('共有文', () => {
  it('見出し、ハッシュタグ、URLの3行だけ(数字や称号の数は入れない)', () => {
    const text = buildShareText({ caption: 'おばあちゃんに全力パンチ!', url: 'https://example.com/stupidhero/' });
    expect(text).toBe(['おばあちゃんに全力パンチ!', '#StupidHero', 'https://example.com/stupidhero/'].join('\n'));
  });

  it('ひどい場面(市民がさらわれた、物が落ちたも)があればその見出し、ボスを倒しただけや何もないときは称号', () => {
    const titleName = '街のほんものヒーロー';
    const strong = (Object.keys(WORST_SCENE_RANK) as WorstScene[]).filter((s) => s !== 'bossDefeated');
    for (const worstScene of strong) {
      expect(shareCaption({ worstScene, caption: `${worstScene}の見出し`, titleName }), worstScene).toBe(`${worstScene}の見出し`);
    }
    expect(shareCaption({ worstScene: 'bossDefeated', caption: 'ボスを倒した!', titleName })).toBe('称号「街のほんものヒーロー」');
    expect(shareCaption({ worstScene: null, caption: 'ひどいことはなかった!', titleName })).toBe('称号「街のほんものヒーロー」');
  });

  it('大きな物が壊れた場面の文はステージごと(路地裏は「街」)。市民がさらわれた、市民に物が落ちたの文', () => {
    const caption = (stageId: StageId, scene: WorstScene): string => {
      const st = new StatsTracker(9, stageId);
      st.reportScene(scene);
      return worstCaption(st.snapshot());
    };
    const big: [StageId, string][] = [
      ['alley', '街がこわれた!'], ['garage', '駐車場ボロボロ!'], ['mall', 'モールがこわれた!'], ['tower', 'ビルがこわれた!']
    ];
    for (const [stageId, text] of big) expect(caption(stageId, 'bigPropBroken'), stageId).toBe(text);
    expect(caption('mall', 'abducted')).toBe('市民がさらわれた!');
    expect(caption('tower', 'dropped')).toBe('市民に物が落ちた!');
  });

  it('Xに投稿のURL', () => {
    expect(xPostUrl('あ #B')).toBe('https://x.com/intent/tweet?text=%E3%81%82%20%23B');
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

  it('タイムセールラッシュとエレベーターラッシュで市民をなぐった場面は、前やあとに巻きぞえがあっても「なぐった」の文', () => {
    const cases = [
      {
        name: 'タイムセールラッシュ', hit: (st: StatsTracker) => st.rushHit('civ'),
        start: () => { const st = new StatsTracker(9, 'mall'); st.startRush({ alienCount: 3, civCount: 2 }); return st; }
      },
      {
        name: 'エレベーターラッシュ', hit: (st: StatsTracker) => st.liftHit('civ'),
        start: () => { const st = new StatsTracker(9, 'tower'); st.startLift({ villainCount: 3, civCount: 2 }); return st; }
      }
    ];
    for (const c of cases) {
      const st = c.start();
      // 前の巻きぞえではなく、写真と同じ直前の1回(ラッシュでなぐった)で決める
      st.hurtCiv('collateral', 'suit');
      c.hit(st);
      expect(st.reportScene('civHit', 'punch'), c.name).toBe(true);
      st.hurtCiv('collateral', 'dancer');
      expect(st.reportScene('civHit', 'charge'), c.name).toBe(false);
      const s = st.snapshot();
      expect(s.civHurtByHero, c.name).toBe(0);
      expect(s.civHurtByCollateral, c.name).toBe(2);
      expect(s.worstCause, c.name).toBe('punch');
      expect(worstCaption(s), c.name).toBe('市民をなぐった!');
    }
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
    // 地下駐車場の背景で大きな物が壊れても「駐車場ボロボロ!」にしない
    const g = new StatsTracker(9, 'garage');
    g.reportScene('bigPropBroken');
    expect(freeWorstCaption(g.snapshot())).toBe('街がこわれた!');
  });
});
