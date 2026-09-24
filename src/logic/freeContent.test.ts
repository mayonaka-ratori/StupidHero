import { describe, expect, it } from 'vitest';
import { allTexts } from './content';
import {
  FREE_ATTACK, FREE_DECLARES, FREE_DRY_PRESS, FREE_INTRO, FREE_ITEM_ATTACK, FREE_OP, FREE_OP_KEYS, FREE_PASS,
  FREE_REDECLARE_HERO, FREE_REDECLARE_OP, FREE_STUBBORN, FREE_TOLD_YOU, allFreeSpeechTexts, allFreeTexts,
  createFreeLines, declareList, freeOpTier
} from './freeContent';
import { FREE_ITEMS, FREE_ITEM_NAME } from './freeNames';
import { createRng } from './rng';
import { STAGE_IDS } from './stages';
import type { FreeRule, FreeVillainLook, Look } from './types';

const LOOKS: readonly Look[] = [
  'hoodie', 'suit', 'shopper', 'mohawk', 'granny',
  'guard', 'mechanic', 'clubber', 'officelady',
  'mascot', 'clerk', 'dancer', 'uncle'
];
const FREE_VILLAINS: readonly FreeVillainLook[] = ['fp_mohawk', 'fp_gang', 'fp_alien'];
const ALL_LOOKS: readonly (Look | FreeVillainLook)[] = [...LOOKS, ...FREE_VILLAINS];
const RULES: readonly FreeRule[] = [
  { kind: 'allBad' }, { kind: 'allCiv' }, ...FREE_ITEMS.map((item): FreeRule => ({ kind: 'item', item }))
];

describe('フリープレイの文の決まり', () => {
  const texts = allFreeSpeechTexts();

  it('どの文も1行12文字まで、2行まで(空の行もない)', () => {
    const wrong = allFreeTexts().filter((t) => {
      const lines = t.split('\n');
      return lines.length > 2 || lines.some((l) => l.length === 0 || [...l].length > 12);
    });
    expect(wrong, `決まりに合わない文:\n${wrong.map((t) => JSON.stringify(t)).join('\n')}`).toEqual([]);
  });

  it('半角スペース、エムダッシュ、半角の!?を使わない。小物の名前の書き忘れ({item} など)もない', () => {
    for (const t of texts) {
      expect(t).not.toMatch(/[ —―!?]/);
      expect(t).not.toMatch(/[{}]/);
    }
  });

  it('全部の文が allTexts に入っている(文字数の確かめとフォントの読みこみのため)', () => {
    const all = new Set(allTexts());
    for (const t of allFreeTexts()) expect(all.has(t), t).toBe(true);
  });

  it('オペレーターが自分の仕分けを責める一言は出さない', () => {
    for (const t of texts) expect(t).not.toMatch(/私が|私だ|仕分けたの|ワルにしたの/);
  });

  it('掛け合いは3枚で、仕様の文の流れ(仕分けなし、見れば分かる、待てと行けで直す)', () => {
    expect(FREE_INTRO.map((s) => s.who)).toEqual(['operator', 'hero', 'operator']);
    const joined = FREE_INTRO.map((s) => s.text.replace('\n', '')).join('/');
    for (const word of ['仕分けなし', '見れば分かる', '待てと行けで直して']) expect(joined).toContain(word);
  });
});

describe('フリープレイの文の数', () => {
  it('全部の背景とルールに、決めつけが2〜3通りある', () => {
    for (const id of STAGE_IDS) {
      expect(FREE_DECLARES[id], id).toBeDefined();
      for (const rule of RULES) {
        const list = declareList(id, rule);
        expect(list.length, `${id} ${JSON.stringify(rule)}`).toBeGreaterThanOrEqual(2);
        expect(list.length, `${id} ${JSON.stringify(rule)}`).toBeLessThanOrEqual(3);
        for (const d of list) {
          expect(d.hero.who).toBe('hero');
          expect(d.op.who).toBe('operator');
          const h = d.hero.text.replace('\n', '');
          if (rule.kind === 'allBad') expect(h, h).toMatch(/ワル/);
          if (rule.kind === 'allCiv') expect(h, h).toMatch(/いい人|ワルはいな/);
          if (rule.kind === 'item') expect(h, h).toContain(`${FREE_ITEM_NAME[rule.item]}の人はワル`);
        }
      }
    }
  });

  it('全部の見た目に、殴りかかる一言と素通りの一言が5通り以上ある', () => {
    for (const look of ALL_LOOKS) {
      expect(new Set(FREE_ATTACK[look].map((s) => s.text)).size, look).toBeGreaterThanOrEqual(5);
      expect(new Set(FREE_PASS[look].map((s) => s.text)).size, look).toBeGreaterThanOrEqual(5);
      for (const s of [...FREE_ATTACK[look], ...FREE_PASS[look]]) expect(s.who).toBe('hero');
    }
  });

  it('波3の殴りかかる一言は、小物ごとに5通り以上あり、どれも小物の名前が入る', () => {
    for (const item of FREE_ITEMS) {
      expect(FREE_ITEM_ATTACK[item].length, item).toBeGreaterThanOrEqual(5);
      for (const s of FREE_ITEM_ATTACK[item]) expect(s.text, item).toContain('{item}');
    }
    const lines = createFreeLines(createRng(1));
    for (const item of FREE_ITEMS) {
      for (const look of ALL_LOOKS) {
        for (let i = 0; i < 5; i++) expect(lines.heroAttack(look, { kind: 'item', item }).text).toContain(FREE_ITEM_NAME[item]);
      }
    }
  });

  it('ヒーローのそのほかの一言と、言い直しは5通り以上', () => {
    for (const list of [FREE_STUBBORN, FREE_TOLD_YOU, FREE_DRY_PRESS, FREE_REDECLARE_HERO, FREE_REDECLARE_OP]) {
      expect(list.length).toBeGreaterThanOrEqual(5);
    }
    expect(FREE_TOLD_YOU.some((s) => s.text.replace('\n', '') === 'ほら、やっぱりワルじゃん！')).toBe(true);
    expect(FREE_STUBBORN.some((s) => s.text === 'でもルール通りだし！')).toBe(true);
    expect(FREE_DRY_PRESS.some((s) => s.text === '？')).toBe(true);
    expect(FREE_REDECLARE_OP.some((s) => s.text === 'また変えた！？')).toBe(true);
  });

  it('言い直しは、新しい小物の名前が入る(ヒーロー)', () => {
    const lines = createFreeLines(createRng(3));
    for (const from of FREE_ITEMS) {
      for (const to of FREE_ITEMS) {
        if (from === to) continue;
        for (let i = 0; i < 6; i++) {
          const r = lines.redeclare(from, to);
          expect(r.hero.text).toContain(`${FREE_ITEM_NAME[to]}の人がワル`);
          expect(r.op.who).toBe('operator');
        }
      }
    }
  });

  it('オペレーターの一言は、場面ごとに5通り以上あり、回数で言い方が変わる(どの段も2通り以上)', () => {
    for (const key of FREE_OP_KEYS) {
      const tiers = FREE_OP[key];
      const all = new Set(tiers.flat().map((s) => s.text));
      expect(all.size, key).toBeGreaterThanOrEqual(5);
      for (const t of tiers) {
        expect(t.length, key).toBeGreaterThanOrEqual(2);
        for (const s of t) expect(s.who).toBe('operator');
      }
      expect(freeOpTier(key, 1), key).toBe(0);
      expect(freeOpTier(key, 2), key).toBe(1);
      expect(freeOpTier(key, 5), key).toBe(2);
      expect(freeOpTier(key, 50), key).toBe(2);
    }
    // 仕様の例の文
    const texts = (key: (typeof FREE_OP_KEYS)[number], tier: 0 | 1 | 2) => FREE_OP[key][tier].map((s) => s.text);
    expect(texts('hitCiv', 2)).toContain('もうわざとでしょ');
    expect(texts('idle', 0)).toContain('…押して？');
    expect(texts('idle', 1)).toContain('ねえ、見てる？');
    expect(texts('idle', 2)).toContain('もう知らない');
    expect(texts('saved', 0)).toContain('セーフ！');
  });

  it('待っていても押さない(idle)は、だんだんあきらめる:3回目までに1段目から3段目まで進まず、4回目からあきらめる', () => {
    expect(freeOpTier('idle', 1)).toBe(0);
    expect(freeOpTier('idle', 3)).toBe(1);
    expect(freeOpTier('idle', 4)).toBe(2);
    const lines = createFreeLines(createRng(9));
    expect(FREE_OP.idle[2].map((s) => s.text)).toContain(lines.op('idle', 4).text);
  });
});

describe('createFreeLines は同じ文を続けて出さない', () => {
  it('どの種類も、直前と同じ文を選ばない(いくつもの種で)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const lines = createFreeLines(createRng(seed));
      const checkRun = (name: string, f: () => string) => {
        let prev = '';
        for (let i = 0; i < 40; i++) {
          const t = f();
          expect(t, `${name} seed=${seed}`).not.toBe(prev);
          prev = t;
        }
      };
      for (const look of ALL_LOOKS) {
        for (const rule of RULES) checkRun(`attack ${look}`, () => lines.heroAttack(look, rule).text);
        checkRun(`pass ${look}`, () => lines.heroPass(look).text);
      }
      checkRun('stubborn', () => lines.heroStubborn().text);
      checkRun('toldYou', () => lines.heroToldYou().text);
      checkRun('dryPress', () => lines.heroDryPress().text);
      for (const id of STAGE_IDS) for (const rule of RULES) checkRun(`declare ${id}`, () => lines.declare(id, rule).hero.text);
      checkRun('redeclare', () => lines.redeclare('balloon', 'hat').hero.text);
      for (const key of FREE_OP_KEYS) {
        for (const count of [1, 2, 3, 5, 9]) checkRun(`op ${key} ${count}`, () => lines.op(key, count).text);
      }
    }
  });

  it('場面をまぜて呼んでも、直前にだれかが言った文を続けて出さない', () => {
    const lines = createFreeLines(createRng(42));
    let prev = '';
    for (let i = 0; i < 300; i++) {
      const look = ALL_LOOKS[i % ALL_LOOKS.length];
      const s = i % 3 === 0 ? lines.heroAttack(look, { kind: 'allBad' })
        : i % 3 === 1 ? lines.heroPass(look)
          : lines.op(FREE_OP_KEYS[i % FREE_OP_KEYS.length], 1 + (i % 6));
      expect(s.text).not.toBe(prev);
      prev = s.text;
    }
  });

  it('同じ種なら同じ文が出る', () => {
    const a = createFreeLines(createRng(7));
    const b = createFreeLines(createRng(7));
    for (const look of ALL_LOOKS) expect(a.heroAttack(look, { kind: 'allBad' })).toEqual(b.heroAttack(look, { kind: 'allBad' }));
    expect(a.op('hitCiv', 3)).toEqual(b.op('hitCiv', 3));
  });
});
