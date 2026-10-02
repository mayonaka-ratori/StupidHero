import { describe, expect, it } from 'vitest';
import { allTexts } from './content';
import {
  FREE_ATTACK, FREE_DECLARES, FREE_DRY_PRESS, FREE_GO_CIV, FREE_GO_EARLY, FREE_INTRO, FREE_TEACH_PASS_GO, FREE_ITEM_ATTACK, FREE_OP, FREE_OP_GRANNY_HIT, FREE_OP_GRANNY_RULE,
  FREE_OP_PASS_VILLAIN, FREE_PASS, freeOpContextLines,
  FREE_REDECLARE_HERO, FREE_REDECLARE_OP, FREE_STUBBORN, FREE_TOLD_YOU, allFreeSpeechTexts, allFreeTexts,
  createFreeLines, declareList, freeOpTier, type FreeOpContext, type FreeOpKey
} from './freeContent';
import { FREE_ITEMS, FREE_ITEM_NAME, FREE_RULES } from './freeNames';
import { createRng } from './rng';
import { FREE_STAGE_IDS } from './stages';
import type { FreeVillainLook, Look, TowerLook } from './types';

// 高層ビルの見た目はフリープレイに出ない
const LOOKS: readonly Exclude<Look, TowerLook>[] = [
  'hoodie', 'suit', 'shopper', 'mohawk', 'granny',
  'guard', 'mechanic', 'clubber', 'officelady',
  'mascot', 'clerk', 'dancer', 'uncle'
];
const FREE_VILLAINS: readonly FreeVillainLook[] = ['fp_mohawk', 'fp_gang', 'fp_alien'];
const ALL_LOOKS: readonly (Exclude<Look, TowerLook> | FreeVillainLook)[] = [...LOOKS, ...FREE_VILLAINS];
const OP_KEYS = Object.keys(FREE_OP) as FreeOpKey[];

describe('フリープレイの文の決まり', () => {
  const texts = allFreeSpeechTexts();

  it('小物の名前の書き忘れ({item} など)がない', () => {
    expect(texts.filter((t) => /[{}]/.test(t))).toEqual([]);
  });

  // 1行12字と2行まで、半角スペースなどを使わない決まりは、content.test.ts が allTexts 全体で確かめる。
  // そのためにフリープレイの文が allTexts に入っていることを、ここで確かめておく
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
    for (const id of FREE_STAGE_IDS) {
      expect(FREE_DECLARES[id], id).toBeDefined();
      for (const rule of FREE_RULES) {
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
    // 小物のルールでは、見た目によらず小物の一言を使う
    const lines = createFreeLines(createRng(1));
    for (const item of FREE_ITEMS) expect(lines.heroAttack('suit', { kind: 'item', item }).text).toContain(FREE_ITEM_NAME[item]);
  });

  it('ヒーローのそのほかの一言と、言い直しは5通り以上', () => {
    for (const list of [FREE_STUBBORN, FREE_TOLD_YOU, FREE_DRY_PRESS, FREE_REDECLARE_HERO, FREE_REDECLARE_OP, FREE_GO_EARLY, FREE_GO_CIV]) {
      expect(list.length).toBeGreaterThanOrEqual(5);
    }
    // 素通りしかけた相手への行け:ヒーローの一言。行けの使い方はオペレーター
    for (const s of [...FREE_GO_EARLY, ...FREE_GO_CIV]) expect(s.who).toBe('hero');
    expect(FREE_TEACH_PASS_GO.who).toBe('operator');
    expect(FREE_TEACH_PASS_GO.text).toContain('行け');
  });

  it('言い直しは、新しい小物の名前が入る(ヒーロー)', () => {
    // 表のどの文にも新しい小物({to})が入っている
    for (const s of FREE_REDECLARE_HERO) expect(s.text.replace('\n', ''), s.text).toContain('{to}の人がワル');
    for (const s of FREE_REDECLARE_OP) expect(s.who).toBe('operator');
    // {to} には新しい小物の名前が入る(前の小物と取り違えない)
    const r = createFreeLines(createRng(3)).redeclare('balloon', 'hat');
    expect(r.hero.text).toContain(`${FREE_ITEM_NAME.hat}の人がワル`);
  });

  it('オペレーターの一言は、場面ごとに5通り以上あり、回数で言い方が変わる(どの段も2通り以上)', () => {
    for (const key of OP_KEYS) {
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
    // 待っていても押さない(idle)は、ほかより早く4回目からあきらめる。op はその段の文から選ぶ
    expect(freeOpTier('idle', 3)).toBe(1);
    expect(freeOpTier('idle', 4)).toBe(2);
    expect(freeOpTier('saved', 4)).toBe(1);
    const lines = createFreeLines(createRng(9));
    expect(FREE_OP.idle[2].map((s) => s.text)).toContain(lines.op('idle', 4).text);
  });
});

describe('createFreeLines は同じ文を続けて出さない', () => {
  it('どの種類も、直前と同じ文を選ばない(その人や小物に合った文をまぜても)', () => {
    // 直前の文は乱数によらずに除くので、続けて出るのは一覧に違う文が1つしかないときだけ。種は1つ、6回ずつで足りる
    const bad: string[] = [];
    const lines = createFreeLines(createRng(1));
    const checkRun = (name: string, f: (i: number) => string, times = 6) => {
      let prev = '';
      for (let i = 0; i < times; i++) {
        const t = f(i);
        if (t === prev) bad.push(`${name} ${t}`);
        prev = t;
      }
    };
    for (const look of ALL_LOOKS) {
      for (const rule of FREE_RULES) checkRun(`attack ${look}`, () => lines.heroAttack(look, rule).text);
      checkRun(`pass ${look}`, () => lines.heroPass(look).text);
    }
    checkRun('stubborn', () => lines.heroStubborn().text);
    checkRun('toldYou', () => lines.heroToldYou().text);
    checkRun('dryPress', () => lines.heroDryPress().text);
    checkRun('goEarly', () => lines.heroGoEarly().text);
    checkRun('goCiv', () => lines.heroGoCiv().text);
    for (const id of FREE_STAGE_IDS) for (const rule of FREE_RULES) checkRun(`declare ${id}`, () => lines.declare(id, rule).hero.text);
    checkRun('redeclare', () => lines.redeclare('balloon', 'hat').hero.text);
    for (const key of OP_KEYS) {
      for (const count of [1, 2, 3, 5, 9]) checkRun(`op ${key} ${count}`, () => lines.op(key, count).text);
    }
    // 合った文をまぜるときは、合った文とふつうの文の両方から選ぶので、回数を多めにする
    checkRun('op hitCivRule ctx', (i) => lines.op('hitCivRule', 1 + (i % 7), { look: 'granny', item: 'hat' }).text, 40);
    expect(bad).toEqual([]);
  });

  it('場面をまぜて呼んでも、直前にだれかが言った文を続けて出さない', () => {
    const lines = createFreeLines(createRng(42));
    let prev = '';
    for (let i = 0; i < 300; i++) {
      const look = ALL_LOOKS[i % ALL_LOOKS.length];
      const s = i % 3 === 0 ? lines.heroAttack(look, { kind: 'allBad' })
        : i % 3 === 1 ? lines.heroPass(look)
          : lines.op(OP_KEYS[i % OP_KEYS.length], 1 + (i % 6));
      expect(s.text).not.toBe(prev);
      prev = s.text;
    }
  });
});

describe('オペレーターの一言に、その人や小物に合った文をまぜる(op の3つ目)', () => {
  const tierTexts = (key: FreeOpKey) => new Set(FREE_OP[key].flat().map((s) => s.text));

  /** 何回も呼んで、合った文とふつうの文の数を数える */
  function tally(key: FreeOpKey, ctx: FreeOpContext) {
    const lines = createFreeLines(createRng(11));
    const special = new Set(freeOpContextLines(key, ctx).map((s) => s.text));
    const normal = tierTexts(key);
    let sp = 0;
    let no = 0;
    for (let i = 0; i < 400; i++) {
      const t = lines.op(key, 1 + (i % 7), ctx).text;
      if (special.has(t)) sp++;
      else if (normal.has(t)) no++;
      else throw new Error(`知らない文 ${t}`);
    }
    return { sp, no };
  }

  it.each([
    { key: 'hitCivRule', what: 'おばあさんなら、おばあさんの文', ctxs: [{ look: 'granny' }] },
    { key: 'hitCivRule', what: '小物のルールで当てはまった市民なら、小物の名前が入った文', ctxs: FREE_ITEMS.map((item) => ({ look: 'suit', item })) },
    { key: 'passBadRule', what: '一目で分かるワルごとの文(ナイフ、バット、触角)', ctxs: FREE_VILLAINS.map((look) => ({ look })) },
    { key: 'hitCiv', what: 'おばあさんなら、おばあさんの文', ctxs: [{ look: 'granny' }] }
  ] as { key: FreeOpKey; what: string; ctxs: FreeOpContext[] }[])('$key:$what を半分くらいまぜる', ({ key, ctxs }) => {
    for (const ctx of ctxs) {
      const { sp, no } = tally(key, ctx);
      expect(sp, JSON.stringify(ctx)).toBeGreaterThan(120);
      expect(no, JSON.stringify(ctx)).toBeGreaterThan(120);
    }
  });

  it('合った文の中身:おばあさん、小物の名前、一目で分かるワルの持ち物', () => {
    expect(FREE_OP_GRANNY_RULE.length).toBeGreaterThanOrEqual(3);
    expect(FREE_OP_GRANNY_HIT.length).toBeGreaterThanOrEqual(3);
    for (const item of FREE_ITEMS) {
      const special = freeOpContextLines('hitCivRule', { look: 'suit', item });
      expect(special.length, item).toBeGreaterThanOrEqual(3);
      for (const s of special) expect(s.text, item).toContain(FREE_ITEM_NAME[item]);
    }
    const words: Record<FreeVillainLook, string> = { fp_mohawk: 'ナイフ', fp_gang: 'バット', fp_alien: '触角' };
    for (const look of FREE_VILLAINS) {
      expect(FREE_OP_PASS_VILLAIN[look].some((s) => s.text.includes(words[look])), look).toBe(true);
    }
  });

  it('合う文がないときと、ctx を渡さないときは、今までの文だけ。同じ種なら同じ文が出る', () => {
    expect(freeOpContextLines('hitCivRule', undefined)).toEqual([]);
    expect(freeOpContextLines('hitCivRule', { look: 'suit' })).toEqual([]);
    expect(freeOpContextLines('passBadRule', { look: 'granny' })).toEqual([]);
    expect(freeOpContextLines('saved', { look: 'granny', item: 'hat' })).toEqual([]);
    // 同じ種の2つで、合う文がない ctx を渡しても、渡さないときと同じ文が同じ順に出る(乱数を余分に使わない)
    const a = createFreeLines(createRng(5));
    const b = createFreeLines(createRng(5));
    for (let i = 0; i < 50; i++) {
      const key = OP_KEYS[i % OP_KEYS.length];
      expect(a.op(key, 1 + (i % 6)).text).toBe(b.op(key, 1 + (i % 6), { look: 'suit' }).text);
    }
    for (const look of ALL_LOOKS) expect(a.heroAttack(look, { kind: 'allBad' })).toEqual(b.heroAttack(look, { kind: 'allBad' }));
  });
});
