import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  AGES, BOSS_HINTS, BOSS_PROFILE_LINES, INTRO, NAMES, OPERATOR_HINTS, PROFILE_LINES, REACTIONS, TITLE_COMMENTS,
  allTexts, mischiefLine, say, shout, tsukkomi
} from './content';
import { TITLES } from './titles';

describe('content の文の決まり', () => {
  const texts = allTexts();

  it('たくさんの文がある', () => {
    expect(texts.length).toBeGreaterThan(200);
  });

  it.each(texts.map((t) => [t]))('%j は1行12文字まで、2行まで', (t) => {
    const lines = t.split('\n');
    expect(lines.length).toBeLessThanOrEqual(2);
    for (const l of lines) {
      expect(l.length).toBeGreaterThan(0);
      expect([...l].length).toBeLessThanOrEqual(12);
    }
  });

  it('半角スペース、エムダッシュ、半角の!?を使わない', () => {
    for (const t of [...texts, ...Object.values(NAMES).flat()]) {
      expect(t).not.toMatch(/[ —―!?]/);
    }
  });

  it('名前は見た目ごとに十分あり、ステージの中で足りる', () => {
    for (const [look, names] of Object.entries(NAMES)) {
      expect(names.length, look).toBeGreaterThanOrEqual(6);
      expect(new Set(names).size).toBe(names.length);
    }
    const all = Object.values(NAMES).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('組の見た目は市民とワルの両方の文と一言がある。年齢の幅は共通', () => {
    for (const look of ['hoodie', 'suit', 'shopper'] as const) {
      expect(PROFILE_LINES[look].civ!.length).toBeGreaterThanOrEqual(5);
      expect(PROFILE_LINES[look].bad!.length).toBeGreaterThanOrEqual(5);
      expect(OPERATOR_HINTS[look].civ!.length).toBeGreaterThanOrEqual(4);
      expect(OPERATOR_HINTS[look].bad!.length).toBeGreaterThanOrEqual(4);
      expect(AGES[look][0]).toBeLessThan(AGES[look][1]);
    }
    expect(PROFILE_LINES.mohawk.civ).toBeUndefined();
    expect(PROFILE_LINES.granny.bad).toBeUndefined();
  });

  it('SPECの一言は市民にもワルにも入っている', () => {
    const has = (look: 'hoodie' | 'suit' | 'shopper', text: string) =>
      OPERATOR_HINTS[look].civ!.some((h) => h.text.replace('\n', '') === text) &&
      OPERATOR_HINTS[look].bad!.some((h) => h.text.replace('\n', '') === text);
    expect(has('hoodie', 'ポケットがふくらんでる…')).toBe(true);
    expect(has('suit', 'さっきからずっと走ってる')).toBe(true);
    expect(has('shopper', '袋がやけに重そう')).toBe(true);
  });

  it('ボスの化けた姿には、3種類とも文と一言がある', () => {
    for (const d of ['suit', 'granny', 'shopper'] as const) {
      expect(BOSS_PROFILE_LINES[d].length).toBeGreaterThanOrEqual(3);
      expect(BOSS_HINTS[d].length).toBeGreaterThanOrEqual(3);
    }
  });

  it('掛け合いで遊び方を伝える', () => {
    const joined = INTRO.map((s) => s.text.replace('\n', '')).join('/');
    for (const word of ['左にスワイプ', '右にスワイプ', '見た目', '動き', 'プロフィール', '一言', '待て', '行け']) {
      expect(joined).toContain(word);
    }
    expect(INTRO.some((s) => s.who === 'hero')).toBe(true);
    expect(INTRO.some((s) => s.who === 'operator')).toBe(true);
  });

  it('称号ごとにひとことがある', () => {
    for (const t of TITLES) expect(TITLE_COMMENTS[t.id]).toBe(t.comment);
  });

  it('選ぶ関数', () => {
    const rng = createRng(1);
    expect(REACTIONS.oops).toContain(say('oops', rng));
    expect(shout('special', rng).who).toBe('hero');
    expect(tsukkomi(1, rng).text).toContain('まあいいか');
    expect(REACTIONS.tsukkomiShort).toContain(tsukkomi(2, rng));
    expect(mischiefLine('suit', rng).who).toBe('operator');
    expect(say('pass').who).toBe('hero');
  });
});
