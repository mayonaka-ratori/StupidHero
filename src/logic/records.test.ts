import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_RECORDS_KEY, RECORDS_KEY, clearRecords, emptyFreeRecord, hasAnyRecord, hasSeenRush, isStageUnlocked, loadRecords, markIntroSeen,
  markRushSeen,
  needsIntro, saveResult, stageSelectInfo, type RecordStorage
} from './records';
import type { StageStats } from './types';

class MemStorage implements RecordStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
}

const broken: RecordStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); }
};

const stats = (over: Partial<StageStats> = {}): StageStats => ({
  stageId: 'alley', defeated: 5, defeatedBySort: 5, defeatedByGo: 0, bossDefeated: true,
  civHurt: 2, civHurtByHero: 2, civHurtByCollateral: 0, civHurtByVillain: 0,
  damage: 10_000_000, damageByProps: 10_000_000, damageByMischief: 0, damageByBoss: 0,
  propsBroken: {
    trash: 0, window: 0, sign: 0, vending: 0, car: 0, van: 0, bosscar: 0, pillar: 0, barrier: 0, cone: 0, extinguisher: 0,
    gacha: 0, mannequin: 0, showcase: 0, fountain: 0, escalator: 0, ufo: 0, mothership: 0,
    sofa: 0, plant: 0, flowers: 0, copier: 0, tank: 0, wine: 0, champagne: 0, piano: 0, chandelier: 0
  },
  defeatedByWipe: 0, defeatedByVan: 0, groupsWiped: 0, groupsEscaped: 0, escapedByVan: 0, vansStopped: 0,
  defeatedByUfo: 0, ufosDowned: 0, escapedByUfo: 0, civHurtByAbduction: 0, civHurtByDrop: 0, rush: null, free: null,
  escaped: 0, civSavedByStop: 0, badSparedByStop: 0,
  grannyHit: false, grannyPunched: false, bossSortedCiv: false, bossFightSec: 8,
  villainTotal: 9, allDefeated: false, worstScene: null, worstAttack: null,
  sortCorrect: 0, sortTotal: 0, sortByHero: 0, sortByHeroCorrect: 0, sortWaves: [],
  ...over
});

describe('records', () => {
  beforeEach(() => clearRecords(null));

  it('初めては新記録なし、2回目から良くなった項目だけ', () => {
    const st = new MemStorage();
    const a = saveResult('alley', stats(), 'soSo', st);
    expect(a.firstPlay).toBe(true);
    expect(a.newRecords).toEqual([]);
    expect(a.persisted).toBe(true);
    expect(a.titlesCollected).toBe(1);
    expect(a.titlesTotal).toBe(20);
    expect(a.stage).toEqual({
      mostDefeated: 5, fewestHurt: 2, highestDamage: 10_000_000, fastestBossSec: 8, plays: 1, clears: 1, titles: ['soSo']
    });

    const b = saveResult('alley', stats({ defeated: 7, civHurt: 3, damage: 20_000_000, bossFightSec: 6 }), 'demolition', st);
    expect(b.firstPlay).toBe(false);
    expect(b.newRecords).toEqual(['mostDefeated', 'highestDamage', 'fastestBossSec']);
    expect(b.stage.fewestHurt).toBe(2);
    expect(b.titleIsNew).toBe(true);
    expect(b.titlesCollected).toBe(2);

    const c = saveResult('alley', stats({ bossFightSec: null }), 'soSo', st);
    expect(c.titleIsNew).toBe(false);
    expect(c.titlesCollected).toBe(2);
    expect(c.stage.fastestBossSec).toBe(6);
    expect(c.stage.plays).toBe(3);
    expect(loadRecords(st).titles).toEqual(['soSo', 'demolition']);
  });

  it('最後に遊んだステージを覚える(ない記録や知らない id は null)', () => {
    const st = new MemStorage();
    expect(loadRecords(st).lastStage).toBeNull();
    saveResult('garage', stats(), 'soSo', st);
    expect(loadRecords(st).lastStage).toBe('garage');
    saveResult('alley', stats(), 'soSo', st);
    expect(loadRecords(st).lastStage).toBe('alley');
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, lastStage: 'moon' }));
    expect(loadRecords(st).lastStage).toBeNull();
  });

  it('壊れたデータや知らない称号は捨てる', () => {
    const st = new MemStorage();
    st.setItem(RECORDS_KEY, '{not json');
    expect(loadRecords(st)).toEqual({
      version: 2, stages: {}, titles: [], introSeen: [], rushSeen: [], free: emptyFreeRecord(), freeIntroSeen: false, freeMoreHintShown: false, lastStage: null
    });
    st.setItem(RECORDS_KEY, JSON.stringify({ stages: { alley: { mostDefeated: 'x', plays: 2 } }, titles: ['soSo', 'hack', 'soSo'] }));
    const r = loadRecords(st);
    expect(r.titles).toEqual(['soSo']);
    expect(r.stages.alley?.mostDefeated).toBeNull();
    expect(r.stages.alley?.plays).toBe(2);
  });

  it('localStorage が使えなくても落ちず、その場では覚えている', () => {
    const a = saveResult('alley', stats(), 'soSo', broken);
    expect(a.persisted).toBe(false);
    const b = saveResult('alley', stats({ defeated: 9 }), 'realHero', broken);
    expect(b.firstPlay).toBe(false);
    expect(b.newRecords).toContain('mostDefeated');
    expect(b.titlesCollected).toBe(2);
    expect(() => saveResult('alley', stats(), 'soSo', null)).not.toThrow();
    expect(() => loadRecords()).not.toThrow();
  });

  it('記録と称号はステージごと。称号の数は全部のステージを合わせて数える', () => {
    const st = new MemStorage();
    saveResult('alley', stats(), 'soSo', st);
    saveResult('alley', stats(), 'realHero', st);
    const g = saveResult('garage', stats({ stageId: 'garage', defeated: 9, damage: 3_000_000 }), 'soSo', st);
    expect(g.firstPlay).toBe(true);
    expect(g.titleIsNew).toBe(false); // 路地裏でもう取っている
    expect(g.titlesCollected).toBe(2);
    expect(g.stageTitlesCollected).toBe(1);
    const h = saveResult('garage', stats({ stageId: 'garage' }), 'roundUp', st);
    expect(h.titleIsNew).toBe(true);
    expect(h.titlesCollected).toBe(3);
    expect(h.titlesTotal).toBe(20);
    const r = loadRecords(st);
    expect(r.stages.alley!.titles).toEqual(['soSo', 'realHero']);
    expect(r.stages.garage!.titles).toEqual(['soSo', 'roundUp']);
    expect(r.stages.alley!.plays).toBe(2);
    expect(r.stages.garage!.plays).toBe(2);
    expect(r.stages.garage!.mostDefeated).toBe(9);
    expect(r.stages.alley!.mostDefeated).toBe(5);
    expect(r.titles).toEqual(['soSo', 'realHero', 'roundUp']);
  });

  it('地下駐車場は、路地裏のボスを一度倒すと開く', () => {
    const st = new MemStorage();
    expect(isStageUnlocked('alley', loadRecords(st))).toBe(true);
    expect(isStageUnlocked('garage', loadRecords(st))).toBe(false);
    const a = saveResult('alley', stats({ bossDefeated: false, bossFightSec: null }), 'soSo', st);
    expect(a.unlockedNow).toEqual([]);
    expect(isStageUnlocked('garage', loadRecords(st))).toBe(false);
    const b = saveResult('alley', stats(), 'soSo', st);
    expect(b.unlockedNow).toEqual(['garage']);
    expect(b.stage.clears).toBe(1);
    expect(isStageUnlocked('garage', loadRecords(st))).toBe(true);
    const c = saveResult('alley', stats(), 'soSo', st);
    expect(c.unlockedNow).toEqual([]);
    const info = stageSelectInfo(loadRecords(st));
    expect(info.map((i) => [i.id, i.unlocked, i.titlesCollected])).toEqual([['alley', true, 1], ['garage', true, 0], ['mall', false, 0]]);
    expect(info[0].record?.plays).toBe(3);
    expect(info[1].record).toBeNull();
    expect(info[1].def.name).toBe('地下駐車場');
  });

  it('開いていないときの選ぶ画面', () => {
    const info = stageSelectInfo(loadRecords(new MemStorage()));
    expect(info[1].unlocked).toBe(false);
    expect(info[1].def.lockedText).toBe('路地裏をクリアすると遊べる');
    expect(info[2].id).toBe('mall');
    expect(info[2].unlocked).toBe(false);
    expect(info[2].def.lockedText).toBe('地下駐車場をクリアすると遊べる');
  });

  it('ショッピングモールは、地下駐車場のボスを一度倒すと開く(路地裏だけでは開かない)', () => {
    const st = new MemStorage();
    expect(saveResult('alley', stats(), 'soSo', st).unlockedNow).toEqual(['garage']);
    expect(isStageUnlocked('mall', loadRecords(st))).toBe(false);
    const g = saveResult('garage', stats({ stageId: 'garage' }), 'soSo', st);
    expect(g.unlockedNow).toEqual(['mall']);
    const info = stageSelectInfo(loadRecords(st));
    expect(info.map((i) => i.unlocked)).toEqual([true, true, true]);
    const m = saveResult('mall', stats({ stageId: 'mall' }), 'ufoHunter', st);
    expect(m.firstPlay).toBe(true);
    expect(m.titlesCollected).toBe(2);
    expect(m.titlesTotal).toBe(20);
    expect(loadRecords(st).stages.mall!.titles).toEqual(['ufoHunter']);
  });

  it('タイムセールラッシュを見たステージを覚える(掛け合いと同じ形)。おかしな値は捨てる', () => {
    const st = new MemStorage();
    expect(hasSeenRush('mall', loadRecords(st))).toBe(false);
    markRushSeen('mall', st);
    markRushSeen('mall', st);
    expect(loadRecords(st).rushSeen).toEqual(['mall']);
    expect(hasSeenRush('mall', loadRecords(st))).toBe(true);
    // rushSeen のない前の記録も読める
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], introSeen: ['alley'] }));
    expect(loadRecords(st).rushSeen).toEqual([]);
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], introSeen: [], rushSeen: ['mall', 'moon', 1, 'mall'] }));
    expect(loadRecords(st).rushSeen).toEqual(['mall']);
    // 書けなくても、その場では覚えている
    clearRecords(null);
    markRushSeen('mall', broken);
    expect(hasSeenRush('mall', loadRecords(broken))).toBe(true);
  });

  it('v2 が壊れていたら v1 を読む。知らないステージは捨てる', () => {
    const st = new MemStorage();
    st.setItem(RECORDS_KEY, '{broken');
    st.setItem(LEGACY_RECORDS_KEY, JSON.stringify({ version: 1, stages: { alley: { plays: 2 } }, titles: ['soSo'] }));
    expect(loadRecords(st).stages.alley!.plays).toBe(2);
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: { moon: { plays: 1 }, garage: { plays: 1, titles: ['gangDriver', 'x'] } }, titles: [] }));
    const r = loadRecords(st);
    expect(Object.keys(r.stages)).toEqual(['garage']);
    expect(r.stages.garage!.titles).toEqual(['gangDriver']);
    expect(r.titles).toEqual(['gangDriver']);
  });

  it('掛け合いを見たステージを覚える。見たか遊んだステージは次からとばす', () => {
    const st = new MemStorage();
    const r0 = loadRecords(st);
    expect(r0.introSeen).toEqual([]);
    expect(hasAnyRecord(r0)).toBe(false);
    expect(needsIntro('alley', r0)).toBe(true);
    expect(needsIntro('garage', r0)).toBe(true);

    markIntroSeen('alley', st);
    markIntroSeen('alley', st);
    const r1 = loadRecords(st);
    expect(r1.introSeen).toEqual(['alley']);
    expect(needsIntro('alley', r1)).toBe(false);
    expect(needsIntro('garage', r1)).toBe(true);
    // 見ただけでは「遊んだ」にならない
    expect(hasAnyRecord(r1)).toBe(false);

    // 結果を保存しても、見た印は消えない
    saveResult('alley', stats(), 'soSo', st);
    expect(loadRecords(st).introSeen).toEqual(['alley']);
    expect(hasAnyRecord(loadRecords(st))).toBe(true);

    // 掛け合いを見ずに遊んだステージ(前の版で遊んだ人など)も、とばす
    saveResult('garage', stats({ stageId: 'garage' }), 'soSo', st);
    expect(needsIntro('garage', loadRecords(st))).toBe(false);
  });

  it('introSeen のない前の記録や、おかしな値でも読める', () => {
    const st = new MemStorage();
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: { alley: { plays: 0 } }, titles: [] }));
    expect(loadRecords(st).introSeen).toEqual([]);
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], introSeen: ['garage', 'moon', 3, 'garage'] }));
    expect(loadRecords(st).introSeen).toEqual(['garage']);
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], introSeen: 'alley' }));
    expect(loadRecords(st).introSeen).toEqual([]);
    // v1 の記録で遊んだことがあれば、掛け合いはとばす
    const v1 = new MemStorage();
    v1.setItem(LEGACY_RECORDS_KEY, JSON.stringify({ version: 1, stages: { alley: { plays: 2 } }, titles: [] }));
    expect(needsIntro('alley', loadRecords(v1))).toBe(false);
    expect(hasAnyRecord(loadRecords(v1))).toBe(true);
  });

  it('localStorage が使えなくても、見た印はその場で覚えている', () => {
    expect(() => markIntroSeen('alley', broken)).not.toThrow();
    expect(needsIntro('alley', loadRecords(broken))).toBe(false);
    clearRecords(null);
    expect(needsIntro('alley', loadRecords(broken))).toBe(true);
  });
});
