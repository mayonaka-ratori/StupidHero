import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import { createStage } from './stage';
import {
  AGES, BOTH_PROFILE_LINES, BOSS_HINTS, BOSS_PROFILE_LINES, INTRO, JUDGE_LINES, NAMES, OPERATOR_HINTS, PROFILE_LINES, REACTIONS,
  STREET_TEXTS, TITLE_COMMENTS, allTexts, introFor, judgeLine, mischiefLine, reactionList, say, shout, titleCommentFor, tsukkomi,
  waveIntroFor, type AnyReactionKey
} from './content';
import {
  GARAGE_INTRO, GARAGE_OPERATOR_HINTS, GARAGE_OVERRIDES, GARAGE_PROFILE_LINES, GARAGE_REACTIONS,
  GARAGE_WAVE_INTRO, LINK_HINTS, LINK_PROFILES, allLinkTexts
} from './garageContent';
import { TITLES, titlesFor } from './titles';
import type { GangLook, Look } from './types';

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

  it('オペレーターの一言は、同じ文ならいつも同じ顔(市民かワルかで顔を変えない。全部のステージ)', () => {
    const faceOf = new Map<string, string>();
    const lists = [
      ...Object.values(OPERATOR_HINTS).flatMap((h) => [h.civ ?? [], h.bad ?? []]),
      ...Object.values(BOSS_HINTS)
    ];
    for (const h of lists.flat()) {
      const seen = faceOf.get(h.text);
      if (seen) expect(h.face, h.text).toBe(seen);
      faceOf.set(h.text, h.face);
    }
    expect(faceOf.get('袋、\nはち切れそう')).toBe('deadpan');
  });

  it('組の見た目(パーカー、スーツ、買い物袋)は、市民とワルで顔の数が同じ(顔だけで分からない)', () => {
    const count = (l: readonly { face: string }[]) => {
      const c: Record<string, number> = {};
      for (const h of l) c[h.face] = (c[h.face] ?? 0) + 1;
      return c;
    };
    for (const look of ['hoodie', 'suit', 'shopper'] as const) {
      expect(count(OPERATOR_HINTS[look].civ!), look).toEqual(count(OPERATOR_HINTS[look].bad!));
      expect(OPERATOR_HINTS[look].civ!.some((h) => h.face === 'panic'), look).toBe(true);
    }
  });

  it('組の見た目には、市民にもワルにも出るプロフィールの文が3つずつあり、どちらの一覧でも3割くらいになる', () => {
    for (const look of ['hoodie', 'suit', 'shopper'] as const) {
      const { civ, bad } = PROFILE_LINES[look];
      const both = civ!.filter((l) => bad!.includes(l));
      for (const l of BOTH_PROFILE_LINES[look]) expect(both, look).toContain(l);
      expect(both.length / civ!.length, look).toBeGreaterThanOrEqual(0.3);
      expect(both.length / bad!.length, look).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('路地裏の組の見た目の人は、プロフィールの文だけでは決められないことがよくある', () => {
    // 文が相手の一覧にもあれば、文だけでは決まらない
    let ambiguous = 0;
    let total = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const w of createStage(seed).waves) {
        for (const p of w.people) {
          if (p.truth === 'boss' || !['hoodie', 'suit', 'shopper'].includes(p.look)) continue;
          const other = PROFILE_LINES[p.look][p.truth === 'bad' ? 'civ' : 'bad']!;
          total++;
          if (other.includes(p.profile.line)) ambiguous++;
        }
      }
    }
    expect(ambiguous / total).toBeGreaterThan(0.25);
  });

  it('ボスの化けた姿には、3種類とも文と一言がある', () => {
    for (const d of ['suit', 'granny', 'shopper'] as const) {
      expect(BOSS_PROFILE_LINES[d].length).toBeGreaterThanOrEqual(3);
      expect(BOSS_HINTS[d].length).toBeGreaterThanOrEqual(3);
    }
  });

  it('掛け合いで仕分けのやり方だけを短く伝える(待てと行けは結果発表で教える)', () => {
    const joined = INTRO.map((s) => s.text.replace('\n', '')).join('/');
    for (const word of ['左', '右にスワイプ', '見た目', '動き', 'プロフィール', '一言']) {
      expect(joined).toContain(word);
    }
    expect(joined).not.toMatch(/待て|行け/);
    expect(INTRO.length).toBeLessThanOrEqual(3);
    expect(INTRO.some((s) => s.who === 'hero')).toBe(true);
    expect(INTRO.some((s) => s.who === 'operator')).toBe(true);
  });

  it('称号ごとにひとことがある(ステージ2の称号はオペレーターが言う)', () => {
    for (const t of TITLES) expect(TITLE_COMMENTS[t.id], t.id).toBe(t.comment);
    expect(TITLE_COMMENTS.roundUp.who).toBe('operator');
    expect(TITLE_COMMENTS.gangDriver.who).toBe('operator');
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

describe('結果発表の決めつけと、待て・行けの使い方', () => {
  const LOOKS = Object.keys(NAMES) as Look[];

  it('どの見た目にも、ヒーローの決めつけが2つ以上あり、「ワルで間違いない!」で終わる', () => {
    for (const look of LOOKS) {
      const list = JUDGE_LINES[look];
      expect(list.length, look).toBeGreaterThanOrEqual(2);
      for (const s of list) {
        expect(s.who, s.text).toBe('hero');
        expect(s.text.split('\n')[1], s.text).toBe('ワルで間違いない！');
      }
    }
    const rng = createRng(3);
    expect(JUDGE_LINES.hoodie).toContain(judgeLine('hoodie', rng));
    expect(JUDGE_LINES.officelady).toContain(judgeLine('officelady', rng));
    expect(REACTIONS.judge).toContain(judgeLine(undefined, rng));
  });

  it('決めつけは市民かワルかで変えない(見た目だけで決まる。文で正体が分からない)', () => {
    // JUDGE_LINES は見た目ごとの1つの一覧だけで、市民用とワル用に分かれていない
    for (const look of LOOKS) expect(Array.isArray(JUDGE_LINES[look]), look).toBe(true);
  });

  it('言いはる、自分のせいに気づく、当たった、待てで止めたワル、使い方のセリフがある', () => {
    for (const k of ['judgeRight', 'stubborn', 'teachStop', 'teachGo', 'ownFault', 'stopBad'] as const) {
      expect(REACTIONS[k].length, k).toBeGreaterThanOrEqual(1);
    }
    for (const s of [...REACTIONS.judgeRight, ...REACTIONS.stubborn]) expect(s.who).toBe('hero');
    for (const s of [...REACTIONS.teachStop, ...REACTIONS.teachGo, ...REACTIONS.ownFault, ...REACTIONS.stopBad]) expect(s.who).toBe('operator');
    expect(REACTIONS.teachStop[0].text).toContain('待て');
    expect(REACTIONS.teachGo[0].text).toContain('行け');
    // 謝らない
    for (const s of REACTIONS.stubborn) expect(s.text).not.toMatch(/ごめん|しまった|すみません/);
    // 始まりの一言(待てと行けの説明)は、初めての合図のときに言うのでなくした
    expect(Object.keys(REACTIONS)).not.toContain('streetWatch');
  });

  it('結果発表の帯と本性ちらりの文は allTexts に入っている', () => {
    const all = new Set(allTexts());
    for (const t of Object.values(STREET_TEXTS)) expect(all.has(t), t).toBe(true);
    for (const look of LOOKS) for (const s of JUDGE_LINES[look]) expect(all.has(s.text), s.text).toBe(true);
    expect(STREET_TEXTS.band).toContain('待て');
    expect(STREET_TEXTS.band).toContain('行け');
  });
});

describe('ステージ2の文', () => {
  const garageTexts = [
    ...GARAGE_INTRO, ...Object.values(GARAGE_WAVE_INTRO).flat(),
    ...Object.values(GARAGE_REACTIONS).flat(), ...Object.values(GARAGE_OVERRIDES).flat()
  ].map((s) => s.text);

  it('allTexts に入っている(文字数の確かめとフォントの読みこみのため)', () => {
    const all = new Set(allTexts());
    for (const t of garageTexts) expect(all.has(t), t).toBe(true);
    for (const t of allLinkTexts()) expect(all.has(t), t).toBe(true);
  });

  it('つながりの文は、番号と小物の呼び名を入れたあとに {n} と {item} が残らず、「さっきの」で呼ばない(字数は allTexts の決まりで確かめる)', () => {
    for (const t of allLinkTexts()) expect(t).not.toMatch(/\{n\}|\{item\}|さっき/);
    // ギャング向けも市民向けも、プロフィールにも一言にもある
    for (const list of [LINK_HINTS, LINK_PROFILES]) {
      expect(list.some((t) => t.for !== 'civ')).toBe(true);
      expect(list.some((t) => t.for !== 'bad')).toBe(true);
    }
  });

  it('4つの見た目に、市民とギャングの文と一言が何通りもある', () => {
    for (const look of ['guard', 'mechanic', 'clubber', 'officelady'] as const) {
      expect(PROFILE_LINES[look].civ!.length).toBeGreaterThanOrEqual(5);
      expect(PROFILE_LINES[look].bad!.length).toBeGreaterThanOrEqual(5);
      expect(OPERATOR_HINTS[look].civ!.length).toBeGreaterThanOrEqual(5);
      expect(OPERATOR_HINTS[look].bad!.length).toBeGreaterThanOrEqual(5);
    }
    for (const d of ['guard', 'mechanic', 'officelady'] as const) {
      expect(BOSS_PROFILE_LINES[d].length).toBeGreaterThanOrEqual(3);
      expect(BOSS_HINTS[d].length).toBeGreaterThanOrEqual(3);
    }
  });

  it('掛け合いで、新しい手がかりと仲間を呼ぶことと車で逃げることを伝える', () => {
    const joined = introFor('garage').map((s) => s.text.replace('\n', '')).join('/');
    for (const word of ['おそろい', '合図', '前の人', '口笛', '仲間を呼ぶ', '集まったら行け', '3秒', '車', '止まる']) {
      expect(joined).toContain(word);
    }
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

  it('初めての掛け合いは5枚まで', () => {
    expect(GARAGE_INTRO.length).toBeLessThanOrEqual(5);
    expect(GARAGE_INTRO.some((s) => s.who === 'hero')).toBe(true);
  });

  it('禁則で最後の行が1字だけになりやすい言い回し(〜っちゃった)を使わない', () => {
    const texts = [
      ...GARAGE_INTRO, ...Object.values(GARAGE_WAVE_INTRO).flat(),
      ...Object.values(GARAGE_REACTIONS).flat(), ...Object.values(GARAGE_OVERRIDES).flat()
    ].map((s) => s.text);
    // 行の終わりの字の前に、行の頭に来られない字(小さいかな、ー)が2つ続くと、折り返したときに1字だけ残る
    for (const t of texts) {
      for (const line of t.split('\n')) expect(line, t).not.toMatch(/[ぁぃぅぇぉっゃゅょァィゥェォッャュョー]{2}[^！？…、。]$/);
    }
  });
});
