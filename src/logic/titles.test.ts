import { describe, expect, it } from 'vitest';
import { TITLES, decideTitle, titlesFor } from './titles';
import type { StageStats } from './types';

const base = (over: Partial<StageStats> = {}): StageStats => ({
  stageId: 'alley', defeated: 5, defeatedBySort: 5, defeatedByGo: 0, bossDefeated: true,
  civHurt: 1, civHurtByHero: 1, civHurtByCollateral: 0, civHurtByVillain: 0,
  damage: 8_000_000, damageByProps: 8_000_000, damageByMischief: 0, damageByBoss: 0,
  propsBroken: {
    trash: 0, window: 0, sign: 0, vending: 0, car: 0, van: 0, bosscar: 0, pillar: 0, barrier: 0, cone: 0, extinguisher: 0
  },
  defeatedByWipe: 0, defeatedByVan: 0, groupsWiped: 0, groupsEscaped: 0, escapedByVan: 0, vansStopped: 0,
  escaped: 1, civSavedByStop: 0, badSparedByStop: 0,
  grannyHit: false, bossSortedCiv: false, bossFightSec: 8,
  villainTotal: 9, allDefeated: false, worstScene: null, worstAttack: null,
  ...over
});

describe('称号(ステージ2。路地裏の称号は published.test で公開版の答えと比べる)', () => {
  it('ステージごとの称号。おばあちゃんの敵は路地裏だけ、一網打尽は地下駐車場だけ', () => {
    expect(titlesFor('alley')).toHaveLength(12);
    expect(titlesFor('garage')).toHaveLength(13);
    // おばあさんは地下駐車場に出ないので、おばあちゃんの敵は路地裏だけ
    expect(titlesFor('garage').map((t) => t.id)).not.toContain('grannyFoe');
    expect(titlesFor('alley').map((t) => t.id)).not.toContain('roundUp');
    // どちらかのステージでは必ず取れる
    for (const t of TITLES) expect(titlesFor('alley').includes(t) || titlesFor('garage').includes(t), t.id).toBe(true);
  });

  it('一網打尽:まとめて吹き飛ばした組が2組以上', () => {
    const s = base({ stageId: 'garage', groupsWiped: 2 });
    expect(decideTitle(s).id).toBe('roundUp');
    expect(decideTitle({ ...s, groupsWiped: 1 }).id).toBe('soSo');
    // 待ての達人より後、追い打ちの鬼より先
    expect(decideTitle({ ...s, civSavedByStop: 3 }).id).toBe('stopMaster');
    expect(decideTitle({ ...s, defeatedByGo: 3 }).id).toBe('roundUp');
  });

  it('ギャングの運転手:車で逃げられた組が2組以上。ボスの親友より後、おばあちゃんの敵より先', () => {
    const s = base({ stageId: 'garage', groupsEscaped: 2, escaped: 5 });
    expect(decideTitle(s).id).toBe('gangDriver');
    expect(decideTitle({ ...s, groupsEscaped: 1 }).id).not.toBe('gangDriver');
    expect(decideTitle({ ...s, bossSortedCiv: true }).id).toBe('bossBuddy');
    expect(decideTitle({ ...s, grannyHit: true }).id).toBe('gangDriver');
    expect(decideTitle({ ...s, groupsWiped: 2 }).id).toBe('gangDriver');
  });
});
