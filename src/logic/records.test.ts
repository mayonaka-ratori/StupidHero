import { beforeEach, describe, expect, it } from 'vitest';
import { RECORDS_KEY, canPersist, clearRecords, loadRecords, saveResult, type RecordStorage } from './records';
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
  defeated: 5, defeatedBySort: 5, defeatedByGo: 0, bossDefeated: true,
  civHurt: 2, civHurtByHero: 2, civHurtByCollateral: 0, civHurtByVillain: 0,
  damage: 10_000_000, damageByProps: 10_000_000, damageByMischief: 0, damageByBoss: 0,
  propsBroken: { trash: 0, window: 0, sign: 0, vending: 0, car: 0 },
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
    expect(a.titlesTotal).toBe(12);
    expect(a.stage).toEqual({ mostDefeated: 5, fewestHurt: 2, highestDamage: 10_000_000, fastestBossSec: 8, plays: 1 });

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
    expect(loadRecords(st)).toEqual({ version: 1, stages: {}, titles: [] });
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
});
