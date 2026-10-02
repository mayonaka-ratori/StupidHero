import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import { createStage } from './stage';
import {
  AGES, ATTACK_SHOUTS, BOTH_PROFILE_LINES, BOSS_HINTS, BOSS_PROFILE_LINES, INTRO, JUDGE_LINES, MISCHIEF_LINES, NAMES, OPERATOR_HINTS,
  PROFILE_LINES, REACTIONS,
  STREET_TEXTS, TITLE_COMMENTS, allTexts, introFor, judgeLine, mischiefLine, reactionList, rushEndLine, rushIntroFor,
  say, shout, streetTextsFor, titleCommentFor, tsukkomi, waveIntroFor, type AnyReactionKey,
  liftEndLine, liftIntroFor, towerFloorLabel
} from './content';
import { allLessonTexts } from './lesson';
import {
  BOSS4_HINTS, BOSS4_PROFILE_LINES, LIFT_BAND, LIFT_INTRO_AGAIN, LIFT_INTRO_FIRST, TOWER_ENDING, TOWER_GARAGE_OVERRIDES, TOWER_INTRO,
  TOWER_DOUBT_HINTS, TOWER_ODD_LINES, TOWER_OPERATOR_HINTS, TOWER_OVERRIDES, TOWER_PROFILE_LINES, TOWER_REACTIONS, TOWER_STREET_TEXTS,
  TOWER_TITLE_COMMENTS, TOWER_WAVE_INTRO
} from './towerContent';
import {
  GARAGE_INTRO, GARAGE_OPERATOR_HINTS, GARAGE_OVERRIDES, GARAGE_PROFILE_LINES, GARAGE_REACTIONS,
  GARAGE_WAVE_INTRO, LINK_HINTS, allLinkTexts
} from './garageContent';
import {
  MALL_GARAGE_OVERRIDES, MALL_INTRO, MALL_OPERATOR_HINTS, MALL_OVERRIDES, MALL_REACTIONS, MALL_STREET_TEXTS,
  MALL_WAVE_INTRO, RUSH_BAND, RUSH_INTRO_AGAIN, RUSH_INTRO_FIRST
} from './mallContent';
import { GANG_LOOKS, MALL_LOOKS, STAGES, STAGE_IDS, TOWER_LOOKS } from './stages';
import { titlesFor } from './titles';
import type { DisguiseLook, Look, Speech, StageId, WaveNo } from './types';

// ステージごとのセリフの文(下の「ステージごとの文の決まり」で使う)
const ALLEY_SPEECH_TEXTS = [
  ...INTRO, ...([1, 2, 3] as const).flatMap((no) => waveIntroFor('alley', no)), ...Object.values(ATTACK_SHOUTS).flat(),
  ...Object.values(REACTIONS).flat(), ...Object.values(MISCHIEF_LINES).flat(), ...Object.values(TITLE_COMMENTS)
].map((s) => s.text);
const GARAGE_SPEECH_TEXTS = [
  ...GARAGE_INTRO, ...Object.values(GARAGE_WAVE_INTRO).flat(),
  ...Object.values(GARAGE_REACTIONS).flat(), ...Object.values(GARAGE_OVERRIDES).flat()
].map((s) => s.text);
const MALL_SPEECH_TEXTS = [
  ...MALL_INTRO, ...Object.values(MALL_WAVE_INTRO).flat(), ...Object.values(MALL_REACTIONS).flat(),
  ...Object.values(MALL_OVERRIDES).flat(), ...Object.values(MALL_GARAGE_OVERRIDES).flat(), ...RUSH_INTRO_FIRST, ...RUSH_INTRO_AGAIN
].map((s) => s.text);
const TOWER_SPEECH_TEXTS = [
  ...TOWER_INTRO, ...Object.values(TOWER_WAVE_INTRO).flat(), ...Object.values(TOWER_REACTIONS).flat(),
  ...Object.values(TOWER_OVERRIDES).flat(), ...Object.values(TOWER_GARAGE_OVERRIDES).flat(),
  ...LIFT_INTRO_FIRST, ...LIFT_INTRO_AGAIN, ...TOWER_ENDING, ...Object.values(TOWER_TITLE_COMMENTS)
].map((s) => s.text);
/** 全部の見た目(フリープレイのワルも入る) */
const LOOKS = Object.keys(NAMES) as Look[];

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
    // 文が多いので、外れを集めて1回だけ確かめる(1つずつ expect を呼ぶと遅い)
    expect([...texts, ...Object.values(NAMES).flat()].filter((t) => /[ —―!?]/.test(t))).toEqual([]);
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

  it('見た目ごとに、市民とワルの文と一言と名前が足りている。年齢の幅がある。モールと高層ビルは、どちらにも出る文が2つずつ。ボスの化けた姿にも文と一言が3つ以上(全部のステージ)', () => {
    const need = [
      { looks: ['hoodie', 'suit', 'shopper', ...GANG_LOOKS] as readonly Look[], lines: 5, hints: 4, names: 6, both: null },
      { looks: MALL_LOOKS, lines: 8, hints: 6, names: 8, both: 2 },
      { looks: TOWER_LOOKS, lines: 8, hints: 7, names: 10, both: 2 }
    ];
    for (const n of need) {
      for (const look of n.looks) {
        const { civ, bad } = PROFILE_LINES[look];
        expect(civ!.length, look).toBeGreaterThanOrEqual(n.lines);
        expect(bad!.length, look).toBeGreaterThanOrEqual(n.lines);
        expect(OPERATOR_HINTS[look].civ!.length, look).toBeGreaterThanOrEqual(n.hints);
        expect(OPERATOR_HINTS[look].bad!.length, look).toBeGreaterThanOrEqual(n.hints);
        expect(NAMES[look].length, look).toBeGreaterThanOrEqual(n.names);
        expect(AGES[look][0], look).toBeLessThan(AGES[look][1]);
        if (n.both !== null) expect(civ!.filter((l) => bad!.includes(l)).length, look).toBe(n.both);
      }
    }
    // モヒカンはいつもワル、おばあさんはいつも市民
    expect(PROFILE_LINES.mohawk.civ).toBeUndefined();
    expect(PROFILE_LINES.granny.bad).toBeUndefined();
    for (const d of Object.keys(BOSS_PROFILE_LINES) as DisguiseLook[]) {
      expect(BOSS_PROFILE_LINES[d].length, d).toBeGreaterThanOrEqual(3);
      expect(BOSS_HINTS[d].length, d).toBeGreaterThanOrEqual(3);
    }
  });

  it('オペレーターの一言は、同じ文ならいつも同じ顔(市民かワルかで顔を変えない。全部のステージと、つながりの一言とボスの一言)', () => {
    const faceOf = new Map<string, string>();
    const lists = [
      ...Object.values(OPERATOR_HINTS).flatMap((h) => [h.civ ?? [], h.bad ?? []]),
      ...Object.values(BOSS_HINTS),
      LINK_HINTS
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
    // 文が相手の一覧にもあれば、文だけでは決まらない。種50個で割合は0.33くらい(200個でも同じくらい)
    let ambiguous = 0;
    let total = 0;
    for (let seed = 1; seed <= 50; seed++) {
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
    for (const word of ['左', '右にスワイプ', '見た目', '動き', 'プロフィール', '一言', '持ち物']) {
      expect(joined).toContain(word);
    }
    expect(joined).not.toMatch(/待て|行け/);
    // 「持ち物」の窓のことを足して4枚にした(初めての1分を長くしないように、これより増やさない)
    expect(INTRO.length).toBeLessThanOrEqual(4);
    expect(INTRO.some((s) => s.who === 'hero')).toBe(true);
    expect(INTRO.some((s) => s.who === 'operator')).toBe(true);
  });
});

describe('セリフの選び方', () => {
  it('そのステージの言い換え → 路地裏の文 → ほかのステージで足した種類の順に探す。悪さの一言は仕組みごと、ツッコミは2回目から短い版、本性ちらりは仕組みごと', () => {
    // [種類, ステージ, 選ばれる一覧]
    const cases: [AnyReactionKey, StageId, readonly Speech[]][] = [
      // 言い換えがなければ路地裏の文
      ['oops', 'alley', REACTIONS.oops], ['oops', 'garage', REACTIONS.oops], ['oops', 'mall', REACTIONS.oops], ['oops', 'tower', REACTIONS.oops],
      ['pass', 'alley', REACTIONS.pass],
      // そのステージの言い換え
      ['pass', 'garage', GARAGE_OVERRIDES.pass], ['pass', 'tower', TOWER_OVERRIDES.pass],
      ['bossReveal', 'garage', GARAGE_OVERRIDES.bossReveal], ['bossReveal', 'mall', MALL_OVERRIDES.bossReveal],
      ['bossReveal', 'tower', TOWER_OVERRIDES.bossReveal],
      // そのステージで足した種類。母艦は女ボスの車と同じ種類で、言い方だけ変える
      ['gathered', 'garage', GARAGE_REACTIONS.gathered], ['ufoBeam', 'mall', MALL_REACTIONS.ufoBeam], ['psyCarry', 'tower', TOWER_REACTIONS.psyCarry],
      ['bossCar', 'garage', GARAGE_REACTIONS.bossCar], ['bossCar', 'mall', MALL_GARAGE_OVERRIDES.bossCar],
      ['bossWreck', 'tower', TOWER_GARAGE_OVERRIDES.bossWreck],
      // 路地裏の結果画面で次のステージが開いたときは、ほかのステージで足した種類を使う
      ['unlocked', 'alley', GARAGE_REACTIONS.unlocked], ['unlocked', 'garage', GARAGE_REACTIONS.unlocked],
      ['unlocked', 'mall', MALL_GARAGE_OVERRIDES.unlocked], ['unlocked', 'tower', TOWER_GARAGE_OVERRIDES.unlocked]
    ];
    for (const [k, id, list] of cases) expect(reactionList(k, id), `${k} ${id}`).toBe(list);
    // 行けを教える一言は「行け」と言う
    for (const [k, id] of [['teachUfo', 'mall'], ['teachPsy', 'tower']] as const) {
      for (const s of reactionList(k, id)) expect(s.text, k).toContain('行け');
    }
    const rng = createRng(1);
    expect(REACTIONS.oops).toContain(say('oops', rng));
    expect(ATTACK_SHOUTS.special).toContain(shout('special', rng));
    expect(REACTIONS.tsukkomi).toContain(tsukkomi(1, rng));
    expect(REACTIONS.tsukkomiShort).toContain(tsukkomi(2, rng));
    // 悪さの一言:路地裏は見た目ごと、ギャングは口笛、宇宙人は空への合図、ヴィランは念力
    expect(MISCHIEF_LINES.suit).toContain(mischiefLine('suit', rng));
    for (const look of GANG_LOOKS) expect(GARAGE_REACTIONS.whistle).toContain(mischiefLine(look, rng));
    for (const look of MALL_LOOKS) expect(MALL_REACTIONS.ufoSignal).toContain(mischiefLine(look, rng));
    for (const look of TOWER_LOOKS) expect(TOWER_REACTIONS.psyLift).toContain(mischiefLine(look, rng));
    // 本性ちらりは、宇宙人のステージと超能力のステージだけ別の文
    expect(streetTextsFor('alley')).toBe(STREET_TEXTS);
    expect(streetTextsFor('garage')).toBe(STREET_TEXTS);
    expect(streetTextsFor('mall')).toBe(MALL_STREET_TEXTS);
    expect(streetTextsFor('tower')).toBe(TOWER_STREET_TEXTS);
    // 市民のちらりは、どのステージも路地裏と同じ「ぺこり」(STAGE3.md、STAGE4.md)
    for (const id of STAGE_IDS) expect(streetTextsFor(id).peekCiv, id).toBe(STREET_TEXTS.peekCiv);
  });
});

describe('結果発表の決めつけと、待て・行けの使い方', () => {
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
  });

  it('結果発表の帯で待てと行けを教える', () => {
    expect(STREET_TEXTS.band).toContain('待て');
    expect(STREET_TEXTS.band).toContain('行け');
  });
});

describe('ステージ2の文', () => {
  it('つながりの文は、番号と小物の呼び名を入れたあとに {n} と {item} が残らず、「さっきの」で呼ばない(字数は allTexts の決まりで確かめる)', () => {
    for (const t of allLinkTexts()) expect(t).not.toMatch(/\{n\}|\{item\}|さっき/);
  });

  it('掛け合いは5枚までで、新しい手がかりと仲間を呼ぶことと車で逃げることを伝える', () => {
    const joined = introFor('garage').map((s) => s.text.replace('\n', '')).join('/');
    for (const word of ['同じ色', '合図', '前の人', '仲間を呼ぶ', '集まったら行け', '3秒', '車', '止まる']) {
      expect(joined).toContain(word);
    }
    expect(GARAGE_INTRO.length).toBeLessThanOrEqual(5);
    expect(GARAGE_INTRO.some((s) => s.who === 'hero')).toBe(true);
    expect(waveIntroFor('garage', 3)[0].text).toContain('女ボス');
  });

  it('あわてた顔は市民の一言にもギャングの一言にも出る(同じ文がいつも同じ顔かは、上の全部のステージの確かめで見る)', () => {
    for (const look of GANG_LOOKS) {
      const civPanic = GARAGE_OPERATOR_HINTS[look].civ.filter((h) => h.face === 'panic').length;
      const badPanic = GARAGE_OPERATOR_HINTS[look].bad.filter((h) => h.face === 'panic').length;
      expect(civPanic, look).toBeGreaterThan(0);
      expect(badPanic, look).toBeGreaterThan(0);
      expect(Math.abs(civPanic - badPanic), look).toBeLessThanOrEqual(1);
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
});

describe('ステージ3の文', () => {
  it('掛け合いは5枚までで、くずれ、ぎこちない市民、UFO、全員は待てないことを伝える。タイムセールは言わない', () => {
    const joined = introFor('mall').map((s) => s.text.replace('\n', '')).join('/');
    for (const word of ['ショッピングモール', '宇宙人', 'くずれる', 'ぎこちない市民', '待って', 'UFO', 'さらう', '全員は待てない']) {
      expect(joined).toContain(word);
    }
    expect(joined).not.toContain('セール');
    expect(MALL_INTRO.length).toBeLessThanOrEqual(5);
    expect(MALL_INTRO[0].who).toBe('hero');
    expect(waveIntroFor('mall', 1)[1].text).toContain('くずれる');
    expect(waveIntroFor('mall', 3)[0].text).toContain('親玉');
    expect(waveIntroFor('mall', 3)[1].text).toContain('くずれない');
  });
});

describe('ステージ4の文', () => {
  it('ふしぎに聞こえるプロフィールの文は、市民とヴィランに3つずつ(どちらにも出る文は入れない)。一言は市民とヴィランで同じ一覧で、疑う一言が1つずつある', () => {
    const DOUBT = /？|かな|だよね/;
    for (const look of TOWER_LOOKS) {
      const odd = TOWER_ODD_LINES[look];
      const lines = TOWER_PROFILE_LINES[look];
      expect(odd.civ, look).toHaveLength(3);
      expect(odd.bad, look).toHaveLength(3);
      for (const l of odd.civ) expect(lines.civ.includes(l) && !lines.bad.includes(l), `${look} ${l}`).toBe(true);
      for (const l of odd.bad) expect(lines.bad.includes(l) && !lines.civ.includes(l), `${look} ${l}`).toBe(true);
      const hints = TOWER_OPERATOR_HINTS[look];
      expect(hints.civ, look).toEqual(hints.bad);
      const doubt = TOWER_DOUBT_HINTS[look];
      expect(doubt.face, look).toBe('deadpan');
      expect(hints.civ.filter((h) => h.text === doubt.text), look).toHaveLength(1);
      // 疑う一言は「…?」「かな」のように疑う言い方。ほかのあきれ顔とあわてた顔の一言は、疑う言い方をしない
      // (「周りを見て」のふつうの顔の一言は、問いかけでもよい)
      expect(DOUBT.test(doubt.text), `${look} ${doubt.text}`).toBe(true);
      for (const h of hints.civ) {
        if (h.text === doubt.text || h.face === 'normal') continue;
        expect(DOUBT.test(h.text), `${look} ${h.text}`).toBe(false);
      }
    }
    // 前は市民に嘘の文があった(手品師の「タネもしかけもない」「何でも出せる」)
    const magic = [...TOWER_PROFILE_LINES.magician.civ, ...TOWER_PROFILE_LINES.magician.bad].join('/');
    expect(magic).not.toMatch(/しかけもない|何でも出せる/);
    // 「カードが浮いてる!?」は、手品師が出る最上階の机の小物(グラス)と合わず嘘になるので、見た目ごとの一言から外し、
    // 見えている物のことを言う一言の「グラスが浮いてる!?」にした
    const allHints = TOWER_LOOKS.flatMap((look) => [...TOWER_OPERATOR_HINTS[look].civ, ...TOWER_OPERATOR_HINTS[look].bad]);
    expect(allHints.map((h) => h.text).filter((t) => t.includes('カード'))).toEqual([]);
  });

  it('掛け合いは5枚までで、もれ、紛らわしい市民、念力を伝える。エレベーターのことは言わない', () => {
    const joined = introFor('tower').map((s) => s.text.replace('\n', '')).join('/');
    for (const word of ['高層ビル', 'ヴィラン', '周りをよく見て', '紫', '浮いたり', '手品', '風船', '火花が出ない', '念力']) {
      expect(joined).toContain(word);
    }
    expect(joined).not.toContain('エレベーター');
    expect(TOWER_INTRO.length).toBeLessThanOrEqual(5);
    expect(TOWER_INTRO[0].who).toBe('hero');
    // 紫でも火花がなければ市民(紫のセロハン、手品の紫の煙、紫の風船)
    expect(waveIntroFor('tower', 2)[1].text.replace('\n', '')).toContain('火花がなければ市民');
    // 波3から、もれを隠すヴィランが出る。プロフィールと一言を合わせて見ることを言う
    const wave3 = waveIntroFor('tower', 3).map((s) => s.text.replace('\n', '')).join('/');
    expect(wave3).toContain('変えないヴィラン');
    expect(wave3).toContain('両方あやしい');
    expect(waveIntroFor('tower', 4)[0].text).toContain('親玉');
    expect(waveIntroFor('tower', 4)[1].text).toContain('変えない');
    // ステージ1〜3には波4の一言がない
    for (const id of ['alley', 'garage', 'mall'] as const) expect(waveIntroFor(id, 4)).toEqual([]);
  });
});

/** 見た目ごとの市民とワルの一言(モールと高層ビルで形をそろえる) */
type HintsByLook = Readonly<Record<string, { civ: readonly { face: string }[]; bad: readonly { face: string }[] }>>;

describe.each([
  {
    stage: 'モール', id: 'mall', bad: '宇宙人', looks: MALL_LOOKS as readonly string[], hints: MALL_OPERATOR_HINTS as HintsByLook,
    overrides: MALL_OVERRIDES, garageOverrides: MALL_GARAGE_OVERRIDES, rush: 'ラッシュ', introFor: rushIntroFor, endLine: rushEndLine, civs: 4
  },
  {
    stage: '高層ビル', id: 'tower', bad: 'ヴィラン', looks: TOWER_LOOKS as readonly string[], hints: TOWER_OPERATOR_HINTS as HintsByLook,
    overrides: TOWER_OVERRIDES, garageOverrides: TOWER_GARAGE_OVERRIDES, rush: 'エレベーター', introFor: liftIntroFor, endLine: liftEndLine, civs: 3
  }
] as const)('$stage の文(モールと高層ビルで同じ形の決まり)', (c) => {
  it(`同じ見た目の市民と${c.bad}で、あわてた顔とあきれ顔の数が同じ(顔だけで分からない)`, () => {
    const count = (l: readonly { face: string }[], face: string) => l.filter((h) => h.face === face).length;
    for (const look of c.looks) {
      const { civ, bad } = c.hints[look];
      for (const face of ['panic', 'deadpan']) expect(count(civ, face), `${look} ${face}`).toBe(count(bad, face));
      expect(count(civ, 'panic'), look).toBeGreaterThan(0);
    }
  });

  // 壊した称号のひとことがそのステージの文になることは、下の「〜という言葉は出ない」で確かめる
  it('言い換えは、元からあるセリフの種類だけ', () => {
    for (const k of Object.keys(c.overrides)) expect(Object.keys(REACTIONS)).toContain(k);
    for (const k of Object.keys(c.garageOverrides)) expect(Object.keys(GARAGE_REACTIONS)).toContain(k);
  });

  it(`${c.rush}の説明は、初めては2つ、見たことがあれば1つ。終わりの一言は市民を全員守れたかで変わる`, () => {
    expect(c.introFor(false)).toHaveLength(2);
    expect(c.introFor(true)).toHaveLength(1);
    expect(c.introFor(false)[1].text).toContain('市民だけ待てを押して');
    expect(c.introFor(true)[0].text).toContain('市民だけ待てを押して');
    expect(c.endLine({ civs: c.civs, civsSaved: c.civs }).face).toBe('hype');
    expect(c.endLine({ civs: c.civs, civsSaved: c.civs - 1 }).face).toBe('deadpan');
  });
});

describe('ステージごとの文の決まり', () => {
  // 行の終わりの字の前に、行の頭に来られない字(小さいかな、ー)が2つ続くと、折り返したときに1字だけ残る
  const ONE_CHAR_TAIL = /[ぁぃぅぇぉっゃゅょァィゥェォッャュョー]{2}[^！？…、。]$/;

  it.each([
    { stage: '路地裏', texts: ALLEY_SPEECH_TEXTS },
    { stage: '地下駐車場', texts: GARAGE_SPEECH_TEXTS },
    { stage: 'モール', texts: MALL_SPEECH_TEXTS },
    { stage: '高層ビル', texts: TOWER_SPEECH_TEXTS }
  ])('$stage:禁則で最後の行が1字だけになりやすい言い回し(〜っちゃった)を使わない', ({ texts }) => {
    expect(texts.filter((t) => t.split('\n').some((line) => ONE_CHAR_TAIL.test(line)))).toEqual([]);
  });

  it('どのステージのセリフ、帯、本性ちらり、プロフィール、一言、決めつけ、称号のひとこと、待てと行けを教える一言も allTexts に入っている(1行12字と2行までの確かめと、フォントの読みこみのため)', () => {
    const all = new Set(allTexts());
    const texts = [
      ...ALLEY_SPEECH_TEXTS, ...GARAGE_SPEECH_TEXTS, ...allLinkTexts(), ...MALL_SPEECH_TEXTS, ...TOWER_SPEECH_TEXTS,
      ...STAGE_IDS.flatMap((id) => Object.values(streetTextsFor(id))), RUSH_BAND, LIFT_BAND,
      ...LOOKS.flatMap((look) => JUDGE_LINES[look].map((s) => s.text)),
      ...[...MALL_LOOKS, ...TOWER_LOOKS].flatMap((look) => [
        ...PROFILE_LINES[look].civ!, ...PROFILE_LINES[look].bad!,
        ...[...OPERATOR_HINTS[look].civ!, ...OPERATOR_HINTS[look].bad!].map((h) => h.text)
      ]),
      ...(['lady', 'magician', 'waiter'] as const).flatMap((d) => [...BOSS4_PROFILE_LINES[d], ...BOSS4_HINTS[d].map((h) => h.text)]),
      ...STAGE_IDS.flatMap((id) => titlesFor(id).map((t) => titleCommentFor(t.id, id).text)),
      ...allLessonTexts()
    ];
    expect(texts.filter((t) => !all.has(t))).toEqual([]);
  });

  it('波の始まりの一言に出てくる人数と階は、波の表と同じ', () => {
    const bad: string[] = [];
    for (const id of STAGE_IDS) {
      STAGES[id].waves.forEach((plan, i) => {
        const no = (i + 1) as WaveNo;
        for (const s of waveIntroFor(id, no)) {
          const people = s.text.match(/(\d+)人/);
          if (people && Number(people[1]) !== plan.people) bad.push(`${id} 波${no} 「${s.text}」は${plan.people}人`);
          const floor = s.text.match(/(\d+)階/);
          if (floor && `${floor[1]}F` !== towerFloorLabel(no)) bad.push(`${id} 波${no} 「${s.text}」は${towerFloorLabel(no)}`);
        }
      });
    }
    expect(bad).toEqual([]);
    // 確かめる文があること(数字を使わない言い方に変えたら、この確かめも見直す)
    expect(waveIntroFor('alley', 1)[0].text).toMatch(/\d+人/);
    expect(waveIntroFor('tower', 2)[0].text).toMatch(/\d+階/);
  });

  // 口笛と仲間とワゴンは地下駐車場だけで使う種類なので、モールでは見ない
  const garageOnly = Object.keys(GARAGE_REACTIONS).filter((k) => !(k in MALL_GARAGE_OVERRIDES));
  it.each([
    { id: 'garage', words: '「街」「路地裏」', ng: /街|路地裏/, keys: [...Object.keys(REACTIONS), ...Object.keys(GARAGE_REACTIONS)] },
    {
      id: 'mall', words: '「街」「路地裏」「駐車場」', ng: /街|路地裏|駐車場/,
      keys: [...Object.keys(REACTIONS), ...Object.keys(GARAGE_REACTIONS), ...Object.keys(MALL_REACTIONS)].filter((k) => !garageOnly.includes(k))
    },
    {
      id: 'tower', words: '「街」「路地裏」「駐車場」「モール」', ng: /街|路地裏|駐車場|モール/,
      keys: [...Object.keys(REACTIONS), ...Object.keys(TOWER_REACTIONS), ...Object.keys(TOWER_GARAGE_OVERRIDES)]
    }
  ] as const)('$id:セリフと称号のひとことに出ない言葉($words)', ({ id, ng, keys }) => {
    const bad: string[] = [];
    for (const k of keys as AnyReactionKey[]) for (const s of reactionList(k, id)) if (ng.test(s.text)) bad.push(`${k} ${s.text}`);
    for (const t of titlesFor(id)) if (ng.test(titleCommentFor(t.id, id).text)) bad.push(t.id);
    expect(bad).toEqual([]);
  });
});
