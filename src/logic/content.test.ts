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

  it('どの文も1行12文字まで、2行まで(空の行もない)', () => {
    const wrong = texts.filter((t) => {
      const lines = t.split('\n');
      return lines.length > 2 || lines.some((l) => l.length === 0 || [...l].length > 12);
    });
    expect(wrong, `決まりに合わない文:\n${wrong.map((t) => JSON.stringify(t)).join('\n')}`).toEqual([]);
  });

  it('半角スペース、エムダッシュ、半角の!?を使わない', () => {
    for (const t of [...texts, ...Object.values(NAMES).flat()]) {
      expect(t).not.toMatch(/[ —―!?]/);
    }
  });

  it('名前は見た目ごとに十分あり(ステージ2の見た目は8人以上)、全部のステージで重ならない。ボスの偽名もこの一覧から', () => {
    for (const [look, names] of Object.entries(NAMES)) {
      expect(names.length, look).toBeGreaterThanOrEqual(6);
      expect(new Set(names).size, look).toBe(names.length);
    }
    for (const look of GANG_LOOKS) expect(NAMES[look].length, look).toBeGreaterThanOrEqual(8);
    // ボス(路地裏も地下駐車場も)の名前は、化けた姿の見た目の一覧から選ぶ
    for (const d of Object.keys(BOSS_PROFILE_LINES) as (keyof typeof NAMES)[]) expect(NAMES[d]?.length, d).toBeGreaterThanOrEqual(6);
    const all = Object.values(NAMES).flat();
    const dup = all.filter((n, i) => all.indexOf(n) !== i);
    expect(dup, '重なっている名前').toEqual([]);
  });

  it('見た目ごとに、市民とワルの文と一言が何通りもある。ボスの化けた姿にも文と一言がある', () => {
    for (const look of ['hoodie', 'suit', 'shopper', 'guard', 'mechanic', 'clubber', 'officelady'] as const) {
      expect(PROFILE_LINES[look].civ!.length, look).toBeGreaterThanOrEqual(5);
      expect(PROFILE_LINES[look].bad!.length, look).toBeGreaterThanOrEqual(5);
      expect(OPERATOR_HINTS[look].civ!.length, look).toBeGreaterThanOrEqual(4);
      expect(OPERATOR_HINTS[look].bad!.length, look).toBeGreaterThanOrEqual(4);
      expect(AGES[look][0], look).toBeLessThan(AGES[look][1]);
    }
    expect(PROFILE_LINES.mohawk.civ).toBeUndefined();
    expect(PROFILE_LINES.granny.bad).toBeUndefined();
    for (const d of ['suit', 'granny', 'shopper', 'guard', 'mechanic', 'officelady'] as const) {
      expect(BOSS_PROFILE_LINES[d].length, d).toBeGreaterThanOrEqual(3);
      expect(BOSS_HINTS[d].length, d).toBeGreaterThanOrEqual(3);
    }
  });

  it('選ぶ関数', () => {
    const rng = createRng(1);
    expect(REACTIONS.oops).toContain(say('oops', rng));
    expect(REACTIONS.oops).toContain(say('oops', rng, 'garage'));
    expect(REACTIONS.bossReveal).toContain(say('bossReveal', rng));
    expect(GARAGE_OVERRIDES.bossReveal).toContain(say('bossReveal', rng, 'garage'));
    expect(GARAGE_REACTIONS.gathered).toContain(say('gathered', rng, 'garage'));
    expect(GARAGE_REACTIONS.whistle).toContain(mischiefLine('clubber', rng));
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

  it('つながりの文は、見た目を入れたあとに {n} が残らない(字数は allTexts の決まりで確かめる)', () => {
    for (const t of allLinkTexts()) expect(t).not.toContain('{n}');
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

  it('禁則で最後の行が1字だけになりやすい言い回し(〜っちゃった)を使わない', () => {
    // 行の終わりの字の前に、行の頭に来られない字(小さいかな、ー)が2つ続くと、折り返したときに1字だけ残る
    for (const t of garageTexts) {
      for (const line of t.split('\n')) expect(line, t).not.toMatch(/[ぁぃぅぇぉっゃゅょァィゥェォッャュョー]{2}[^！？…、。]$/);
    }
  });
});
