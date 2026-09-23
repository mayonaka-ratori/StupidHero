// 公開版(コミット 876e008)との比べ合わせ。
// fixtures/ の JSON は、公開版の src/logic をそのまま動かして作った「固定の答え」。作り直さないこと
// (ステージ1の中身をわざと変えたときだけ、理由を書いて作り直す)。
// 公開版からある項目だけを比べる。ステージ2で増えた項目(groups、accessory、link など)は比べない。

import { beforeEach, describe, expect, it } from 'vitest';
import alleyV1 from './fixtures/alley-v1.json';
import recordsV1 from './fixtures/records-v1.json';
import {
  ATTACK_SHOUTS, INTRO, INTRO_REPLAY, MISCHIEF_LINES, introFor, reactionList, titleCommentFor, waveIntroFor,
  type ReactionKey
} from './content';
import { LEGACY_RECORDS_KEY, RECORDS_KEY, clearRecords, isStageUnlocked, loadRecords, saveResult, type RecordStorage } from './records';
import { createStage } from './stage';
import { StatsTracker } from './stats';
import { decideTitle, titlesFor } from './titles';
import type { Person, Stage, StageStats, TitleId, WaveNo } from './types';

/** undefined の項目は書かない(JSON と同じ形にする) */
function pick<T extends object>(obj: T, keys: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

/** 公開版の Person にある項目だけ */
const PERSON_KEYS = ['id', 'index', 'wave', 'look', 'truth', 'sheetKey', 'profile', 'hint', 'disguise', 'mischief'] as const;
const asPublished = (s: Stage) => ({
  ...pick(s, ['id', 'name', 'seed', 'villainTotal', 'peopleTotal']),
  waves: s.waves.map((w) => ({
    ...pick(w, ['no', 'seconds', 'badCount', 'hasBoss']),
    people: w.people.map((p: Person) => ({
      ...pick(p, PERSON_KEYS),
      profile: pick(p.profile, ['name', 'age', 'line']),
      hint: pick(p.hint, ['text', 'face'])
    }))
  }))
});

describe('ステージ1は公開版(876e008)と同じ', () => {
  it(`createStage(seed) の中身が同じ(${alleyV1.stages.length}個の種)`, () => {
    for (const { seed, stage } of alleyV1.stages) {
      expect(asPublished(createStage(seed)), `seed ${seed}`).toEqual(stage);
    }
  });

  it('掛け合い、セリフ、称号のひとことが同じ', () => {
    const sp = alleyV1.speech;
    expect(INTRO).toEqual(sp.INTRO);
    expect(INTRO_REPLAY).toEqual(sp.INTRO_REPLAY);
    expect(introFor('alley')).toEqual(sp.INTRO);
    expect(introFor('alley', true)).toEqual(sp.INTRO_REPLAY);
    for (const no of [1, 2, 3] as WaveNo[]) expect(waveIntroFor('alley', no), `wave ${no}`).toEqual(sp.WAVE_INTRO[no]);
    for (const [k, list] of Object.entries(sp.REACTIONS)) expect(reactionList(k as ReactionKey, 'alley'), k).toEqual(list);
    expect(ATTACK_SHOUTS).toEqual(sp.ATTACK_SHOUTS);
    for (const [k, list] of Object.entries(sp.MISCHIEF_LINES)) expect(MISCHIEF_LINES[k as keyof typeof MISCHIEF_LINES], k).toEqual(list);
    for (const [id, c] of Object.entries(sp.TITLE_COMMENTS)) expect(titleCommentFor(id as TitleId, 'alley'), id).toEqual(c);
  });

  it(`称号の並びと、decideTitle の答えが同じ(${alleyV1.titles.length}通りの記録)`, () => {
    expect(titlesFor('alley').map((t) => ({ id: t.id, name: t.name, pose: t.pose }))).toEqual(alleyV1.titleDefs);
    // 新しく増えた項目は、路地裏で遊んだときと同じ値(0 など)にする
    const zero = new StatsTracker(9, 'alley').snapshot();
    for (const { stats, title, name } of alleyV1.titles) {
      const s = { ...zero, ...stats, propsBroken: { ...zero.propsBroken, ...stats.propsBroken } } as StageStats;
      const t = decideTitle(s);
      expect({ id: t.id, name: t.name }, JSON.stringify(stats)).toEqual({ id: title, name });
    }
  });
});

class MemStorage implements RecordStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('公開版が保存した記録を今の版で読める', () => {
  beforeEach(() => clearRecords(null));

  it('キーは公開版と同じ stupidhero.records.v1 を読む', () => {
    expect(LEGACY_RECORDS_KEY).toBe(recordsV1.key);
    expect(RECORDS_KEY).not.toBe(recordsV1.key);
  });

  it('遊んだ回数、記録、称号を引きつぎ、ボスを倒していればステージ2が開く', () => {
    const st = new MemStorage();
    st.setItem(recordsV1.key, recordsV1.cleared.text);
    const old = recordsV1.cleared.loaded.stages.alley;
    const r = loadRecords(st);
    expect(r.stages.alley).toMatchObject(old);
    expect(r.stages.alley!.titles).toEqual(recordsV1.cleared.loaded.titles);
    expect(r.titles).toEqual(recordsV1.cleared.loaded.titles);
    expect(isStageUnlocked('garage', r)).toBe(true);

    // 続けて遊ぶと、回数が増え、前の記録と比べて新記録を決める。公開版の文字列は消さない
    const zero = new StatsTracker(9, 'alley').snapshot();
    const s = saveResult('alley', { ...zero, defeated: 5, civHurt: 1, damage: 70_000_000, bossDefeated: true, bossFightSec: 6 }, 'demolition', st);
    expect(s.firstPlay).toBe(false);
    expect(s.stage.plays).toBe(old.plays + 1);
    expect(s.newRecords).toEqual(['highestDamage']);
    expect(s.titleIsNew).toBe(false);
    expect(s.titlesCollected).toBe(recordsV1.cleared.loaded.titles.length);
    expect(s.unlockedNow).toEqual([]);
    expect(st.getItem(recordsV1.key)).toBe(recordsV1.cleared.text);

    // ステージ2も遊べて、記録は別に残る
    const g = saveResult('garage', { ...new StatsTracker(10, 'garage').snapshot(), defeated: 3 }, 'soSo', st);
    expect(g.firstPlay).toBe(true);
    expect(loadRecords(st).stages.alley!.plays).toBe(old.plays + 1);
    expect(loadRecords(st).stages.garage!.plays).toBe(1);
  });

  it('ボスを倒していない記録なら、引きつぐがステージ2は閉じたまま', () => {
    const st = new MemStorage();
    st.setItem(recordsV1.key, recordsV1.noBoss.text);
    const r = loadRecords(st);
    expect(r.stages.alley).toMatchObject(recordsV1.noBoss.loaded.stages.alley);
    expect(r.titles).toEqual(recordsV1.noBoss.loaded.titles);
    expect(isStageUnlocked('garage', r)).toBe(false);
  });
});
