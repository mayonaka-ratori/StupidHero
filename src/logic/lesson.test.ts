import { beforeEach, describe, expect, it } from 'vitest';
import { LESSON_HINTS, LESSON_LINES, allLessonTexts, lessonDue } from './lesson';
import { RECORDS_KEY, clearRecords, loadRecords, markIntroSeen, markLessonSeen, needsLesson, saveResult } from './records';
import { MemStorage, makeStats } from './testHelpers';

describe('待てと行けを止めて教える', () => {
  beforeEach(() => clearRecords(null));

  it('文は1行12字まで、2行まで。半角スペース、エムダッシュ、半角の!?を使わない。オペレーターが言う', () => {
    for (const t of allLessonTexts()) {
      const lines = t.split('\n');
      expect(lines.length, t).toBeLessThanOrEqual(2);
      for (const l of lines) expect([...l].length, t).toBeLessThanOrEqual(12);
      expect(t).not.toMatch(/[ —―!?]/);
    }
    for (const s of [...Object.values(LESSON_LINES), ...Object.values(LESSON_HINTS)]) expect(s.who).toBe('operator');
    expect(LESSON_LINES.stop.text).toContain('待て');
    expect(LESSON_LINES.go.text).toContain('行け');
    // フリープレイと同じく「倒す」で言う
    expect(LESSON_LINES.go.text).toContain('倒');
  });

  it('待ては市民をワルにした人(hitCiv)のときだけ。行けはいつも。フリープレイと、もう教えたときは止めない', () => {
    expect(lessonDue({ kind: 'stop', enc: 'hitCiv', free: false, seen: false })).toBe(true);
    for (const enc of ['hitBad', 'bossFight', 'passBad', 'passCiv'] as const) {
      expect(lessonDue({ kind: 'stop', enc, free: false, seen: false }), enc).toBe(false);
    }
    expect(lessonDue({ kind: 'go', free: false, seen: false })).toBe(true);
    expect(lessonDue({ kind: 'stop', enc: 'hitCiv', free: true, seen: false })).toBe(false);
    expect(lessonDue({ kind: 'go', free: true, seen: false })).toBe(false);
    expect(lessonDue({ kind: 'stop', enc: 'hitCiv', free: false, seen: true })).toBe(false);
    expect(lessonDue({ kind: 'go', free: false, seen: true })).toBe(false);
  });

  it('教えたことは種類ごとに端末に残り、ほかの記録を消さない', () => {
    const st = new MemStorage();
    expect(needsLesson('stop', loadRecords(st))).toBe(true);
    expect(needsLesson('go', loadRecords(st))).toBe(true);
    saveResult('alley', makeStats({}), 'soSo', st);
    markIntroSeen('alley', st);
    markLessonSeen('stop', st);
    const r = loadRecords(st);
    expect(needsLesson('stop', r)).toBe(false);
    expect(needsLesson('go', r)).toBe(true);
    expect(r.stages.alley?.plays).toBe(1);
    expect(r.introSeen).toEqual(['alley']);
    markLessonSeen('go', st);
    markLessonSeen('stop', st);
    expect(loadRecords(st).lessonSeen).toEqual(['stop', 'go']);
  });

  it('前の記録(lessonSeen がない)は、まだ教えていないとして読む。おかしな値は捨てる', () => {
    const st = new MemStorage();
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], introSeen: [], rushSeen: [] }));
    expect(needsLesson('stop', loadRecords(st))).toBe(true);
    expect(loadRecords(st).lessonSeen).toBeUndefined();
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], introSeen: [], rushSeen: [], lessonSeen: ['go', 'jump', 3, 'go'] }));
    expect(loadRecords(st).lessonSeen).toEqual(['go']);
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], introSeen: [], rushSeen: [], lessonSeen: 'stop' }));
    expect(needsLesson('stop', loadRecords(st))).toBe(true);
  });

  it('記録に書けなくても、その場では覚えている', () => {
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('y'); } };
    markLessonSeen('go', broken);
    expect(needsLesson('go', loadRecords(broken))).toBe(false);
  });
});
