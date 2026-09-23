import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  AGES, BOSS_HINTS, BOSS_PROFILE_LINES, INTRO, NAMES, OPERATOR_HINTS, PROFILE_LINES, REACTIONS, TITLE_COMMENTS,
  allTexts, introFor, mischiefLine, reactionList, say, shout, tsukkomi, waveIntroFor, type AnyReactionKey
} from './content';
import {
  BOSS2_NAMES, GARAGE_INTRO, GARAGE_INTRO_REPLAY, GARAGE_OVERRIDES, GARAGE_REACTIONS, GARAGE_WAVE_INTRO,
  LINK_HINTS, LINK_PROFILES, allLinkTexts
} from './garageContent';
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

describe('ステージ2の文', () => {
  const garageTexts = [
    ...GARAGE_INTRO, ...GARAGE_INTRO_REPLAY, ...Object.values(GARAGE_WAVE_INTRO).flat(),
    ...Object.values(GARAGE_REACTIONS).flat(), ...Object.values(GARAGE_OVERRIDES).flat()
  ].map((s) => s.text);

  it('allTexts に入っている(文字数の確かめとフォントの読みこみのため)', () => {
    const all = new Set(allTexts());
    for (const t of garageTexts) expect(all.has(t), t).toBe(true);
    for (const t of allLinkTexts()) expect(all.has(t), t).toBe(true);
    for (const n of BOSS2_NAMES) expect(all.has(n)).toBe(true);
  });

  it('つながりの文は、どの見た目を入れても1行12文字まで', () => {
    for (const t of allLinkTexts()) {
      const lines = t.split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const l of lines) expect([...l].length, t).toBeLessThanOrEqual(12);
      expect(t).not.toContain('{n}');
    }
    // ギャング向けも市民向けも、プロフィールにも一言にもある
    for (const list of [LINK_HINTS, LINK_PROFILES]) {
      expect(list.some((t) => t.for !== 'civ')).toBe(true);
      expect(list.some((t) => t.for !== 'bad')).toBe(true);
    }
  });

  it('4つの見た目に、市民とギャングの文と一言が何通りもある。名前は重ならない', () => {
    for (const look of ['guard', 'mechanic', 'clubber', 'officelady'] as const) {
      expect(PROFILE_LINES[look].civ!.length).toBeGreaterThanOrEqual(5);
      expect(PROFILE_LINES[look].bad!.length).toBeGreaterThanOrEqual(5);
      expect(OPERATOR_HINTS[look].civ!.length).toBeGreaterThanOrEqual(5);
      expect(OPERATOR_HINTS[look].bad!.length).toBeGreaterThanOrEqual(5);
      expect(NAMES[look].length).toBeGreaterThanOrEqual(8);
    }
    for (const d of ['guard', 'mechanic', 'officelady'] as const) {
      expect(BOSS_PROFILE_LINES[d].length).toBeGreaterThanOrEqual(3);
      expect(BOSS_HINTS[d].length).toBeGreaterThanOrEqual(3);
    }
    const all = [...Object.values(NAMES).flat(), ...BOSS2_NAMES];
    expect(new Set(all).size).toBe(all.length);
  });

  it('掛け合いで、新しい手がかりと仲間を呼ぶことと車で逃げることを伝える', () => {
    const joined = introFor('garage').map((s) => s.text.replace('\n', '')).join('/');
    for (const word of ['おそろい', '合図', '前の人', '口笛', '仲間を呼ぶ', '集まったら行け', 'まとめて', '3秒', '車', '止まる']) {
      expect(joined).toContain(word);
    }
    expect(introFor('garage', true)).toBe(GARAGE_INTRO_REPLAY);
    expect(introFor('alley')).toBe(INTRO);
    expect(waveIntroFor('garage', 3)[0].text).toContain('女ボス');
    expect(waveIntroFor('alley', 1)[0].text).toContain('5人');
  });

  it('地下駐車場のセリフに「路地裏」は出ない。地下駐車場だけの種類も say で出せる', () => {
    const rng = createRng(4);
    const keys = [...Object.keys(REACTIONS), ...Object.keys(GARAGE_REACTIONS)] as AnyReactionKey[];
    for (const k of keys) {
      for (const s of reactionList(k, 'garage')) expect(s.text).not.toContain('路地裏');
    }
    for (const k of Object.keys(GARAGE_OVERRIDES)) expect(Object.keys(REACTIONS)).toContain(k);
    expect(GARAGE_REACTIONS.gathered).toContain(say('gathered', rng, 'garage'));
    expect(GARAGE_OVERRIDES.bossReveal).toContain(say('bossReveal', rng, 'garage'));
    expect(REACTIONS.bossReveal).toContain(say('bossReveal', rng));
    expect(REACTIONS.oops).toContain(say('oops', rng, 'garage'));
    expect(GARAGE_REACTIONS.whistle).toContain(mischiefLine('clubber', rng));
  });

  it('新しい称号のひとこと', () => {
    expect(TITLE_COMMENTS.roundUp.who).toBe('operator');
    expect(TITLE_COMMENTS.gangDriver.who).toBe('operator');
  });
});
