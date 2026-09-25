import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import { createStage } from './stage';
import {
  AGES, BOTH_PROFILE_LINES, BOSS_HINTS, BOSS_PROFILE_LINES, INTRO, JUDGE_LINES, NAMES, OPERATOR_HINTS, PROFILE_LINES, REACTIONS,
  STREET_TEXTS, TITLE_COMMENTS, allTexts, introFor, judgeLine, mischiefLine, reactionList, rushEndLine, rushIntroFor,
  say, shout, streetTextsFor, titleCommentFor, tsukkomi, waveIntroFor, type AnyReactionKey,
  liftEndLine, liftIntroFor, towerFloorLabel
} from './content';
import {
  BOSS4_HINTS, BOSS4_PROFILE_LINES, LIFT_BAND, LIFT_INTRO_AGAIN, LIFT_INTRO_FIRST, TOWER_ENDING, TOWER_GARAGE_OVERRIDES, TOWER_INTRO,
  TOWER_OPERATOR_HINTS, TOWER_OVERRIDES, TOWER_PROFILE_LINES, TOWER_REACTIONS, TOWER_TITLE_COMMENTS, TOWER_WAVE_INTRO
} from './towerContent';
import {
  GARAGE_INTRO, GARAGE_OPERATOR_HINTS, GARAGE_OVERRIDES, GARAGE_PROFILE_LINES, GARAGE_REACTIONS,
  GARAGE_WAVE_INTRO, LINK_HINTS, allLinkTexts
} from './garageContent';
import { MALL_LOOKS } from './mall';
import {
  BOSS3_HINTS, MALL_GARAGE_OVERRIDES, MALL_INTRO, MALL_OPERATOR_HINTS, MALL_OVERRIDES, MALL_PROFILE_LINES, MALL_REACTIONS,
  MALL_WAVE_INTRO, RUSH_BAND, RUSH_INTRO_AGAIN, RUSH_INTRO_FIRST
} from './mallContent';
import { TOWER_LOOKS } from './stages';
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
    for (const t of TITLES) expect(TITLE_COMMENTS[t.id], t.id).toBeDefined();
    expect(TITLE_COMMENTS.roundUp.who).toBe('operator');
    expect(TITLE_COMMENTS.gangDriver.who).toBe('operator');
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

describe('結果発表の決めつけと、待て・行けの使い方', () => {
  const LOOKS = Object.keys(NAMES) as Look[];

  it('どの見た目にも、ヒーローの決めつけが2つ以上あり、「ワルで間違いない!」で終わる(ステージ3は「宇宙人に決まってる!」、ステージ4は「ヴィランに決まってる!」)', () => {
    for (const look of LOOKS) {
      const list = JUDGE_LINES[look];
      expect(list.length, look).toBeGreaterThanOrEqual(2);
      const end = (MALL_LOOKS as readonly string[]).includes(look) ? '宇宙人に決まってる！'
        : (TOWER_LOOKS as readonly string[]).includes(look) ? 'ヴィランに決まってる！' : 'ワルで間違いない！';
      for (const s of list) {
        expect(s.who, s.text).toBe('hero');
        expect(s.text.split('\n')[1], s.text).toBe(end);
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
    expect(LINK_HINTS.some((t) => t.face === 'panic')).toBe(true);
  });

  it('プロフィールには市民とギャングの両方に出る文がある。小物の名前で言い分けない', () => {
    for (const look of GANG_LOOKS) {
      const { civ, bad } = GARAGE_PROFILE_LINES[look];
      const both = civ.filter((l) => bad.includes(l));
      expect(both.length, look).toBeGreaterThanOrEqual(2);
      for (const l of [...civ, ...bad]) expect(l).not.toMatch(/タオル|バンダナ/);
    }
  });

  it('地下駐車場のセリフと称号のひとことに「街」「路地裏」は出ない', () => {
    const keys = [...Object.keys(REACTIONS), ...Object.keys(GARAGE_REACTIONS)] as AnyReactionKey[];
    for (const k of keys) {
      for (const s of reactionList(k, 'garage')) expect(s.text, k).not.toMatch(/街|路地裏/);
    }
    for (const t of titlesFor('garage')) expect(titleCommentFor(t.id, 'garage').text, t.id).not.toMatch(/街|路地裏/);
    expect(titleCommentFor('demolition', 'garage').text).toContain('駐車場');
    // 路地裏は今まで通り
    for (const t of TITLES) expect(titleCommentFor(t.id)).toBe(TITLE_COMMENTS[t.id]);
    expect(titleCommentFor('demolition', 'alley')).toBe(TITLE_COMMENTS.demolition);
    expect(reactionList('pass')).toBe(REACTIONS.pass);
    expect(reactionList('escaped')).toBe(REACTIONS.escaped);
  });

  it('初めての掛け合いは5枚まで', () => {
    expect(GARAGE_INTRO.length).toBeLessThanOrEqual(5);
    expect(GARAGE_INTRO.some((s) => s.who === 'hero')).toBe(true);
  });

  it('禁則で最後の行が1字だけになりやすい言い回し(〜っちゃった)を使わない', () => {
    // 行の終わりの字の前に、行の頭に来られない字(小さいかな、ー)が2つ続くと、折り返したときに1字だけ残る
    for (const t of garageTexts) {
      for (const line of t.split('\n')) expect(line, t).not.toMatch(/[ぁぃぅぇぉっゃゅょァィゥェォッャュョー]{2}[^！？…、。]$/);
    }
  });
});

describe('ステージ3の文', () => {
  const mallSpeeches = [
    ...MALL_INTRO, ...Object.values(MALL_WAVE_INTRO).flat(), ...Object.values(MALL_REACTIONS).flat(),
    ...Object.values(MALL_OVERRIDES).flat(), ...Object.values(MALL_GARAGE_OVERRIDES).flat(), ...RUSH_INTRO_FIRST, ...RUSH_INTRO_AGAIN
  ];

  it('allTexts に入っている(字数の決まり、1行12字と2行までは allTexts の決まりで確かめる)', () => {
    const all = new Set(allTexts());
    for (const s of mallSpeeches) expect(all.has(s.text), s.text).toBe(true);
    for (const t of Object.values(streetTextsFor('mall'))) expect(all.has(t), t).toBe(true);
    expect(all.has(RUSH_BAND)).toBe(true);
    for (const look of MALL_LOOKS) {
      for (const l of [...MALL_PROFILE_LINES[look].civ, ...MALL_PROFILE_LINES[look].bad]) expect(all.has(l), l).toBe(true);
      for (const s of JUDGE_LINES[look]) expect(all.has(s.text), s.text).toBe(true);
    }
    expect(all.has(titleCommentFor('demolition', 'mall').text)).toBe(true);
    for (const id of ['ufoGuide', 'saleGuardian', 'ufoHunter'] as const) expect(all.has(TITLE_COMMENTS[id].text), id).toBe(true);
  });

  it('4つの見た目に、市民と宇宙人の文と一言がある。どちらにも出る文が2つずつ', () => {
    for (const look of MALL_LOOKS) {
      const { civ, bad } = MALL_PROFILE_LINES[look];
      expect(civ.length, look).toBeGreaterThanOrEqual(8);
      expect(bad.length, look).toBeGreaterThanOrEqual(8);
      expect(civ.filter((l) => bad.includes(l)).length, look).toBe(2);
      expect(OPERATOR_HINTS[look].civ!.length).toBeGreaterThanOrEqual(6);
      expect(OPERATOR_HINTS[look].bad!.length).toBeGreaterThanOrEqual(6);
      expect(NAMES[look].length, look).toBeGreaterThanOrEqual(8);
    }
    for (const d of ['clerk', 'uncle', 'mascot'] as const) {
      expect(BOSS_PROFILE_LINES[d].length).toBeGreaterThanOrEqual(3);
      expect(BOSS_HINTS[d]).toBe(BOSS3_HINTS[d]);
    }
  });

  it('同じ見た目の市民と宇宙人で、あわてた顔とあきれ顔の数が同じ(顔だけで分からない)。同じ文はいつも同じ顔', () => {
    const count = (l: readonly { face: string }[], face: string) => l.filter((h) => h.face === face).length;
    for (const look of MALL_LOOKS) {
      const { civ, bad } = MALL_OPERATOR_HINTS[look];
      for (const face of ['panic', 'deadpan']) expect(count(civ, face), `${look} ${face}`).toBe(count(bad, face));
      expect(count(civ, 'panic'), look).toBeGreaterThan(0);
    }
    const faceOf = new Map<string, string>();
    for (const h of [...Object.values(MALL_OPERATOR_HINTS).flatMap((x) => [...x.civ, ...x.bad]), ...Object.values(BOSS3_HINTS).flat()]) {
      const seen = faceOf.get(h.text);
      if (seen) expect(h.face, h.text).toBe(seen);
      faceOf.set(h.text, h.face);
    }
  });

  it('掛け合いは5枚で、くずれ、ぎこちない市民、UFO、全員は待てないことを伝える。タイムセールは言わない', () => {
    const joined = introFor('mall').map((s) => s.text.replace('\n', '')).join('/');
    for (const word of ['ショッピングモール', '宇宙人', 'くずれる', 'ぎこちない市民', '待って', 'UFO', 'さらう', '全員は待てない']) {
      expect(joined).toContain(word);
    }
    expect(joined).not.toContain('セール');
    expect(MALL_INTRO).toHaveLength(5);
    expect(MALL_INTRO[0].who).toBe('hero');
    expect(waveIntroFor('mall', 1)[1].text).toContain('くずれる');
    expect(waveIntroFor('mall', 3)[0].text).toContain('親玉');
    expect(waveIntroFor('mall', 3)[1].text).toContain('くずれない');
  });

  it('モールのセリフと称号のひとことに「街」「路地裏」「駐車場」は出ない', () => {
    const keys = [...Object.keys(REACTIONS), ...Object.keys(GARAGE_REACTIONS), ...Object.keys(MALL_REACTIONS)] as AnyReactionKey[];
    // 口笛と仲間とワゴンは地下駐車場だけで使う種類なので除く
    const garageOnly = new Set(Object.keys(GARAGE_REACTIONS).filter((k) => !(k in MALL_GARAGE_OVERRIDES)));
    for (const k of keys) {
      if (garageOnly.has(k)) continue;
      for (const s of reactionList(k, 'mall')) expect(s.text, k).not.toMatch(/街|路地裏|駐車場/);
    }
    for (const t of titlesFor('mall')) expect(titleCommentFor(t.id, 'mall').text, t.id).not.toMatch(/街|路地裏|駐車場/);
    expect(titleCommentFor('demolition', 'mall').text).toBe('モールの修理代、\n誰が払うの…');
    for (const k of Object.keys(MALL_OVERRIDES)) expect(Object.keys(REACTIONS)).toContain(k);
    for (const k of Object.keys(MALL_GARAGE_OVERRIDES)) expect(Object.keys(GARAGE_REACTIONS)).toContain(k);
  });

  it('say でモールの言い方が出る。母艦は女ボスの車と同じ種類、モールが開いたときの一言もある', () => {
    const rng = createRng(12);
    expect(MALL_REACTIONS.ufoBeam).toContain(say('ufoBeam', rng, 'mall'));
    expect(MALL_OVERRIDES.bossReveal).toContain(say('bossReveal', rng, 'mall'));
    expect(MALL_GARAGE_OVERRIDES.bossCar).toContain(say('bossCar', rng, 'mall'));
    expect(GARAGE_REACTIONS.bossCar).toContain(say('bossCar', rng, 'garage'));
    expect(say('unlocked', rng, 'mall').text).toMatch(/モールに行ける|次のステージ/);
    expect(GARAGE_REACTIONS.unlocked).toContain(say('unlocked', rng, 'garage'));
    // 路地裏と地下駐車場は今まで通り
    expect(GARAGE_REACTIONS.unlocked).toContain(say('unlocked', rng));
    expect(reactionList('pass', 'garage')).toBe(GARAGE_OVERRIDES.pass);
    expect(REACTIONS.oops).toContain(say('oops', rng, 'mall'));
    // 見逃した宇宙人は空へ合図を送る
    for (const look of MALL_LOOKS) expect(MALL_REACTIONS.ufoSignal).toContain(mischiefLine(look, rng));
    expect(say('teachUfo', rng, 'mall').text).toContain('行け');
    expect(say('ufoGo', rng, 'mall').who).toBe('hero');
    expect(say('rushMark', rng, 'mall').text).toBe('セールを荒らすなーっ！');
    expect(say('rushCivHit', rng, 'mall').text).toBe('あれ？');
  });

  it('本性ちらりは宇宙人なら「ピピッ…」。市民は今までと同じ', () => {
    expect(streetTextsFor('mall').peekBad).toBe('ピピッ…');
    expect(streetTextsFor('mall').peekCiv).toBe(STREET_TEXTS.peekCiv);
    expect(streetTextsFor('alley')).toBe(STREET_TEXTS);
    expect(streetTextsFor('garage')).toBe(STREET_TEXTS);
  });

  it('ラッシュの説明は、初めては2つ、見たことがあれば1つ。終わりの一言は市民を全員守れたかで変わる', () => {
    expect(rushIntroFor(false)).toHaveLength(2);
    expect(rushIntroFor(true)).toHaveLength(1);
    expect(rushIntroFor(false)[1].text).toContain('市民だけ待てを押して');
    expect(rushIntroFor(true)[0].text).toContain('市民だけ待てを押して');
    expect(RUSH_BAND).toBe('タイムセール開始！');
    expect(rushEndLine({ civs: 4, civsSaved: 4 }).face).toBe('hype');
    expect(rushEndLine({ civs: 4, civsSaved: 3 }).face).toBe('deadpan');
  });

  it('禁則で最後の行が1字だけになりやすい言い回しを使わない', () => {
    for (const t of mallSpeeches.map((s) => s.text)) {
      for (const line of t.split('\n')) expect(line, t).not.toMatch(/[ぁぃぅぇぉっゃゅょァィゥェォッャュョー]{2}[^！？…、。]$/);
    }
  });
});

describe('ステージ4の文', () => {
  const towerSpeeches = [
    ...TOWER_INTRO, ...Object.values(TOWER_WAVE_INTRO).flat(), ...Object.values(TOWER_REACTIONS).flat(),
    ...Object.values(TOWER_OVERRIDES).flat(), ...Object.values(TOWER_GARAGE_OVERRIDES).flat(),
    ...LIFT_INTRO_FIRST, ...LIFT_INTRO_AGAIN, ...TOWER_ENDING, ...Object.values(TOWER_TITLE_COMMENTS)
  ];

  it('禁則で最後の行が1字だけになりやすい言い回し(〜っちゃった)を使わない', () => {
    for (const s of towerSpeeches) {
      for (const line of s.text.split('\n')) expect(line, s.text).not.toMatch(/[ぁぃぅぇぉっゃゅょァィゥェォッャュョー]{2}[^！？…、。]$/);
    }
  });

  it('allTexts に入っている(字数の決まり、1行12字と2行までは allTexts の決まりで確かめる)', () => {
    const all = new Set(allTexts());
    for (const s of towerSpeeches) expect(all.has(s.text), s.text).toBe(true);
    for (const t of Object.values(streetTextsFor('tower'))) expect(all.has(t), t).toBe(true);
    expect(all.has(LIFT_BAND)).toBe(true);
    for (const look of TOWER_LOOKS) {
      for (const l of [...TOWER_PROFILE_LINES[look].civ, ...TOWER_PROFILE_LINES[look].bad]) expect(all.has(l), l).toBe(true);
      for (const h of [...TOWER_OPERATOR_HINTS[look].civ, ...TOWER_OPERATOR_HINTS[look].bad]) expect(all.has(h.text), h.text).toBe(true);
      for (const s of JUDGE_LINES[look]) expect(all.has(s.text), s.text).toBe(true);
    }
    for (const d of ['lady', 'magician', 'waiter'] as const) {
      for (const l of BOSS4_PROFILE_LINES[d]) expect(all.has(l), l).toBe(true);
      for (const h of BOSS4_HINTS[d]) expect(all.has(h.text), h.text).toBe(true);
    }
    expect(all.has(titleCommentFor('demolition', 'tower').text)).toBe(true);
  });

  it('8つの見た目に、名前が10人ずつ、市民とヴィランの文が8つずつと一言が6つずつある。どちらにも出る文が2つずつ', () => {
    for (const look of TOWER_LOOKS) {
      const { civ, bad } = TOWER_PROFILE_LINES[look];
      expect(civ, look).toHaveLength(8);
      expect(bad, look).toHaveLength(8);
      expect(civ.filter((l) => bad.includes(l)), look).toHaveLength(2);
      expect(OPERATOR_HINTS[look].civ, look).toHaveLength(6);
      expect(OPERATOR_HINTS[look].bad, look).toHaveLength(6);
      expect(NAMES[look], look).toHaveLength(10);
      expect(AGES[look][0], look).toBeLessThan(AGES[look][1]);
      expect(JUDGE_LINES[look], look).toHaveLength(3);
    }
    for (const d of ['lady', 'magician', 'waiter'] as const) {
      expect(BOSS_PROFILE_LINES[d]).toBe(BOSS4_PROFILE_LINES[d]);
      expect(BOSS_HINTS[d]).toBe(BOSS4_HINTS[d]);
    }
    expect(AGES.newbie).toEqual([22, 25]);
    expect(AGES.janitor).toEqual([40, 65]);
  });

  it('同じ見た目の市民とヴィランで、あわてた顔とあきれ顔の数が同じ。同じ文はいつも同じ顔', () => {
    const count = (l: readonly { face: string }[], face: string) => l.filter((h) => h.face === face).length;
    for (const look of TOWER_LOOKS) {
      const { civ, bad } = TOWER_OPERATOR_HINTS[look];
      for (const face of ['panic', 'deadpan']) expect(count(civ, face), `${look} ${face}`).toBe(count(bad, face));
      expect(count(civ, 'panic'), look).toBeGreaterThan(0);
    }
    // 手品師の「カードが浮いてる!?」は市民にもヴィランにも出る
    for (const t of ['civ', 'bad'] as const) {
      expect(TOWER_OPERATOR_HINTS.magician[t].map((h) => h.text)).toContain('カードが\n浮いてる！？');
    }
  });

  it('掛け合いは5枚で、もれ、紛らわしい市民、念力を伝える。エレベーターのことは言わない', () => {
    const joined = introFor('tower').map((s) => s.text.replace('\n', '')).join('/');
    for (const word of ['高層ビル', '超能力者', '周りをよく見て', '紫', '浮いたり', '手品', '風船', '念力']) {
      expect(joined).toContain(word);
    }
    expect(joined).not.toContain('エレベーター');
    expect(TOWER_INTRO).toHaveLength(5);
    expect(TOWER_INTRO[0].who).toBe('hero');
    expect(waveIntroFor('tower', 1)[0].text).toContain('4人');
    expect(waveIntroFor('tower', 2)[0].text).toContain('18階');
    expect(waveIntroFor('tower', 3)[0].text).toContain('35階');
    expect(waveIntroFor('tower', 4)[0].text).toContain('親玉');
    expect(waveIntroFor('tower', 4)[1].text).toContain('変えない');
    // ステージ1〜3には波4の一言がない
    for (const id of ['alley', 'garage', 'mall'] as const) expect(waveIntroFor(id, 4)).toEqual([]);
    expect(([1, 2, 3, 4] as const).map((n) => towerFloorLabel(n))).toEqual(['1F', '18F', '35F', '50F']);
  });

  it('ビルのセリフと称号のひとことに「街」「路地裏」「駐車場」「モール」は出ない', () => {
    const keys = [
      ...Object.keys(REACTIONS), ...Object.keys(TOWER_REACTIONS), ...Object.keys(TOWER_GARAGE_OVERRIDES)
    ] as AnyReactionKey[];
    for (const k of keys) {
      for (const s of reactionList(k, 'tower')) expect(s.text, k).not.toMatch(/街|路地裏|駐車場|モール/);
    }
    for (const t of titlesFor('tower')) expect(titleCommentFor(t.id, 'tower').text, t.id).not.toMatch(/街|路地裏|駐車場|モール/);
    expect(titleCommentFor('demolition', 'tower').text).toBe('ビルの修理代、\n誰が払うの…');
    for (const k of Object.keys(TOWER_OVERRIDES)) expect(Object.keys(REACTIONS)).toContain(k);
    for (const k of Object.keys(TOWER_GARAGE_OVERRIDES)) expect(Object.keys(GARAGE_REACTIONS)).toContain(k);
  });

  it('say でビルの言い方が出る。見逃したヴィランは念力で物を持ち上げる', () => {
    const rng = createRng(21);
    expect(TOWER_REACTIONS.psyCarry).toContain(say('psyCarry', rng, 'tower'));
    expect(TOWER_OVERRIDES.bossReveal).toContain(say('bossReveal', rng, 'tower'));
    expect(TOWER_OVERRIDES.pass).toContain(say('pass', rng, 'tower'));
    expect(TOWER_GARAGE_OVERRIDES.bossWreck).toContain(say('bossWreck', rng, 'tower'));
    expect(say('unlocked', rng, 'tower').text).toMatch(/高層ビルに行ける|最後のステージ/);
    // ほかのステージは今まで通り
    expect(MALL_GARAGE_OVERRIDES.unlocked).toContain(say('unlocked', rng, 'mall'));
    expect(REACTIONS.pass).toContain(say('pass', rng));
    expect(REACTIONS.oops).toContain(say('oops', rng, 'tower'));
    for (const look of TOWER_LOOKS) expect(TOWER_REACTIONS.psyLift).toContain(mischiefLine(look, rng));
    expect(say('teachPsy', rng, 'tower').text).toContain('行け');
    expect(say('psyGo', rng, 'tower').who).toBe('hero');
    expect(say('liftMark', rng, 'tower').text).toBe('乗ってくるなーっ！');
    expect(say('bossChoice', rng, 'tower').text).toBe('客は待て！\nシャンデリアは行け！');
  });

  it('本性ちらりはヴィランなら「フッ…」。市民は今までと同じ', () => {
    expect(streetTextsFor('tower').peekBad).toBe('フッ…');
    expect(streetTextsFor('tower').peekCiv).toBe(STREET_TEXTS.peekCiv);
    expect(streetTextsFor('mall').peekBad).toBe('ピピッ…');
  });

  it('エレベーターの説明は、初めては2つ、見たことがあれば1つ。着いたときの一言は市民を全員守れたかで変わる', () => {
    expect(liftIntroFor(false)).toHaveLength(2);
    expect(liftIntroFor(true)).toHaveLength(1);
    expect(liftIntroFor(false)[1].text).toContain('市民だけ待てを押して');
    expect(liftIntroFor(true)[0].text).toContain('市民だけ待てを押して');
    expect(LIFT_BAND).toBe('最上階へ！');
    expect(liftEndLine({ civs: 3, civsSaved: 3 }).face).toBe('hype');
    expect(liftEndLine({ civs: 3, civsSaved: 2 }).face).toBe('deadpan');
  });

  it('終わりの場面は3枚(オペレーター、ヒーロー、オペレーター)', () => {
    expect(TOWER_ENDING.map((s) => s.who)).toEqual(['operator', 'hero', 'operator']);
  });
});
