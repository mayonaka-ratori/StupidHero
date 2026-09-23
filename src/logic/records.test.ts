import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_RECORDS_KEY, RECORDS_KEY, canPersist, clearRecords, isStageUnlocked, loadRecords, saveResult, stageSelectInfo,
  type RecordStorage
} from './records';
import type { StageStats } from './types';

class MemStorage implements RecordStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
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
    trash: 0, window: 0, sign: 0, vending: 0, car: 0, van: 0, bosscar: 0, pillar: 0, barrier: 0, cone: 0, extinguisher: 0
  },
  defeatedByWipe: 0, defeatedByVan: 0, groupsWiped: 0, groupsEscaped: 0, escapedByVan: 0, vansStopped: 0,
  escaped: 0, civSavedByStop: 0, badSparedByStop: 0,
  grannyHit: false, bossSortedCiv: false, bossFightSec: 8,
  villainTotal: 9, allDefeated: false, worstScene: null, worstAttack: null,
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
    expect(a.titlesTotal).toBe(14);
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

  it('壊れたデータや知らない称号は捨てる', () => {
    const st = new MemStorage();
    st.setItem(RECORDS_KEY, '{not json');
    expect(loadRecords(st)).toEqual({ version: 2, stages: {}, titles: [] });
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
    expect(canPersist(broken)).toBe(false);
    expect(canPersist(new MemStorage())).toBe(true);
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
    expect(h.titlesTotal).toBe(14);
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
    expect(info.map((i) => [i.id, i.unlocked, i.titlesCollected])).toEqual([['alley', true, 1], ['garage', true, 0]]);
    expect(info[0].record?.plays).toBe(3);
    expect(info[1].record).toBeNull();
    expect(info[1].def.name).toBe('地下駐車場');
  });

  it('開いていないときの選ぶ画面', () => {
    const info = stageSelectInfo(loadRecords(new MemStorage()));
    expect(info[1].unlocked).toBe(false);
    expect(info[1].def.lockedText).toBe('路地裏をクリアすると遊べる');
  });

  it('前の形(v1)の記録を読める。称号は路地裏のもの、ボス戦の記録があればステージ2が開く。v1は消さない', () => {
    const st = new MemStorage();
    const v1 = JSON.stringify({
      version: 1,
      stages: { alley: { mostDefeated: 7, fewestHurt: 1, highestDamage: 24_000_000, fastestBossSec: 6.2, plays: 4 } },
      titles: ['soSo', 'demolition']
    });
    st.setItem(LEGACY_RECORDS_KEY, v1);
    const r = loadRecords(st);
    expect(r.version).toBe(2);
    expect(r.stages.alley).toEqual({
      mostDefeated: 7, fewestHurt: 1, highestDamage: 24_000_000, fastestBossSec: 6.2, plays: 4, clears: 1,
      titles: ['soSo', 'demolition']
    });
    expect(r.titles).toEqual(['soSo', 'demolition']);
    expect(isStageUnlocked('garage', r)).toBe(true);

    // 保存すると v2 に書き、前の記録を引きつぐ。v1 はそのまま残る
    const s = saveResult('alley', stats({ defeated: 8 }), 'realHero', st);
    expect(s.firstPlay).toBe(false);
    expect(s.newRecords).toEqual(['mostDefeated']);
    expect(s.stage.plays).toBe(5);
    expect(s.stage.clears).toBe(2);
    expect(s.titlesCollected).toBe(3);
    expect(s.unlockedNow).toEqual([]);
    expect(st.getItem(LEGACY_RECORDS_KEY)).toBe(v1);
    expect(JSON.parse(st.getItem(RECORDS_KEY)!).version).toBe(2);
    expect(loadRecords(st).stages.alley!.plays).toBe(5);
  });

  it('前の形でボス戦の記録がなければ、ステージ2は閉じたまま', () => {
    const st = new MemStorage();
    st.setItem(LEGACY_RECORDS_KEY, JSON.stringify({
      version: 1, stages: { alley: { mostDefeated: 3, fewestHurt: 0, highestDamage: 0, fastestBossSec: null, plays: 1 } }, titles: ['soSo']
    }));
    const r = loadRecords(st);
    expect(r.stages.alley!.clears).toBe(0);
    expect(isStageUnlocked('garage', r)).toBe(false);
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
});
