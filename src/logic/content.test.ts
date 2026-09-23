import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  AGES, BOSS_HINTS, BOSS_PROFILE_LINES, INTRO, NAMES, OPERATOR_HINTS, PROFILE_LINES, REACTIONS, TITLE_COMMENTS,
  allTexts, introFor, mischiefLine, reactionList, say, shout, titleCommentFor, tsukkomi, waveIntroFor, type AnyReactionKey
} from './content';
import {
  GARAGE_INTRO, GARAGE_INTRO_REPLAY, GARAGE_OPERATOR_HINTS, GARAGE_OVERRIDES, GARAGE_PROFILE_LINES, GARAGE_REACTIONS,
  GARAGE_WAVE_INTRO, LINK_HINTS, LINK_PROFILES, allLinkTexts
} from './garageContent';
import { TITLES, titlesFor } from './titles';
import type { GangLook } from './types';

const GANG_LOOKS: readonly GangLook[] = ['guard', 'mechanic', 'clubber', 'officelady'];

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
    const all = Object.values(NAMES).flat();
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

  it('あわてた顔は市民の一言にもギャングの一言にも出る。同じ文はいつも同じ顔', () => {
    for (const look of GANG_LOOKS) {
      const civPanic = GARAGE_OPERATOR_HINTS[look].civ.filter((h) => h.face === 'panic').length;
      const badPanic = GARAGE_OPERATOR_HINTS[look].bad.filter((h) => h.face === 'panic').length;
      expect(civPanic, look).toBeGreaterThan(0);
      expect(badPanic, look).toBeGreaterThan(0);
      expect(Math.abs(civPanic - badPanic), look).toBeLessThanOrEqual(1);
    }
    const faceOf = new Map<string, string>();
    const all = [
      ...GANG_LOOKS.flatMap((l) => [...GARAGE_OPERATOR_HINTS[l].civ, ...GARAGE_OPERATOR_HINTS[l].bad]),
      ...LINK_HINTS
    ];
    for (const h of all) {
      const seen = faceOf.get(h.text);
      if (seen) expect(h.face, h.text).toBe(seen);
      faceOf.set(h.text, h.face);
    }
    // つながりの一言にも、あわてた顔がある(市民にも出る)
    expect(LINK_HINTS.some((t) => t.face === 'panic' && t.for !== 'bad')).toBe(true);
  });

  it('プロフィールには市民とギャングの両方に出る文がある。小物の名前で言い分けない', () => {
    for (const look of GANG_LOOKS) {
      const { civ, bad } = GARAGE_PROFILE_LINES[look];
      const both = civ.filter((l) => bad.includes(l));
      expect(both.length, look).toBeGreaterThanOrEqual(2);
      for (const l of [...civ, ...bad]) expect(l).not.toMatch(/タオル|バンダナ/);
    }
  });

  it('つながりの文は、どれも市民にもギャングにも出る(文だけでは決まらない)', () => {
    for (const t of [...LINK_HINTS, ...LINK_PROFILES]) expect(t.for, t.text).toBe('both');
  });

  it('仲間が誰も来ないときのセリフ(オペレーターとヒーロー)', () => {
    const rng = createRng(9);
    expect(say('alone', rng, 'garage').who).toBe('operator');
    expect(say('aloneHero', rng, 'garage').who).toBe('hero');
    expect(GARAGE_REACTIONS.alone.length).toBeGreaterThanOrEqual(2);
    expect(GARAGE_REACTIONS.aloneHero.length).toBeGreaterThanOrEqual(2);
  });

  it('地下駐車場のセリフと称号のひとことに「街」「路地裏」は出ない', () => {
    const keys = [...Object.keys(REACTIONS), ...Object.keys(GARAGE_REACTIONS)] as AnyReactionKey[];
    for (const k of keys) {
      for (const s of reactionList(k, 'garage')) expect(s.text, k).not.toMatch(/街|路地裏/);
    }
    for (const t of titlesFor('garage')) expect(titleCommentFor(t.id, 'garage').text, t.id).not.toMatch(/街|路地裏/);
    expect(titleCommentFor('demolition', 'garage').text).toContain('駐車場');
    // 路地裏は今まで通り
    for (const t of TITLES) expect(titleCommentFor(t.id)).toBe(t.comment);
    expect(titleCommentFor('demolition', 'alley')).toBe(TITLE_COMMENTS.demolition);
    expect(reactionList('pass')).toBe(REACTIONS.pass);
    expect(reactionList('escaped')).toBe(REACTIONS.escaped);
  });

  it('初めての掛け合いは10枚くらい', () => {
    expect(GARAGE_INTRO.length).toBeLessThanOrEqual(11);
    expect(GARAGE_INTRO.some((s) => s.who === 'hero')).toBe(true);
  });

  it('禁則で最後の行が1字だけになりやすい言い回し(〜っちゃった)を使わない', () => {
    const texts = [
      ...GARAGE_INTRO, ...GARAGE_INTRO_REPLAY, ...Object.values(GARAGE_WAVE_INTRO).flat(),
      ...Object.values(GARAGE_REACTIONS).flat(), ...Object.values(GARAGE_OVERRIDES).flat()
    ].map((s) => s.text);
    // 行の終わりの字の前に、行の頭に来られない字(小さいかな、ー)が2つ続くと、折り返したときに1字だけ残る
    for (const t of texts) {
      for (const line of t.split('\n')) expect(line, t).not.toMatch(/[ぁぃぅぇぉっゃゅょァィゥェォッャュョー]{2}[^！？…、。]$/);
    }
  });
});
