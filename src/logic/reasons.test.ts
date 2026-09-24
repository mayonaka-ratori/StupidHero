import { describe, expect, it } from 'vitest';
import { MALL_REASONS, REASON_MAX, reasonFor, rushSummary, stripReasonMarkup } from './reasons';
import { createStage } from './stage';
import type { Person, StageId } from './types';

/** 全角1、半角0.5で数えた字の幅 */
const widthOf = (s: string): number => Array.from(s).reduce((n, ch) => n + (/[ -~]/.test(ch) ? 0.5 : 1), 0);

describe('答え合わせの決め手', () => {
  it('出てくるどの見た目と正体の組み合わせにも、決め手の文がある(1行に入る長さ)', () => {
    const seen = new Map<string, Set<string>>();
    for (const stageId of ['alley', 'garage', 'mall'] as StageId[]) {
      for (let seed = 1; seed <= 300; seed++) {
        const stage = createStage(seed, stageId);
        for (const w of stage.waves) for (const p of w.people) {
          const r = reasonFor(p, w);
          const plain = stripReasonMarkup(r);
          const key = `${stageId}:${p.look}:${p.truth}`;
          expect(plain.length, `${key} ${p.id}`).toBeGreaterThan(0);
          expect(widthOf(plain), `${key}「${plain}」`).toBeLessThanOrEqual(REASON_MAX);
          expect(plain, key).not.toMatch(/[ —]/);
          expect(plain, key).not.toMatch(/[{}]/);
          if (!seen.has(key)) seen.set(key, new Set());
          seen.get(key)!.add(plain);
        }
      }
    }
    // 路地裏:組の3つは市民とワルの両方、モヒカンはワル、おばあさんは市民、ボスは化けた3つ
    for (const k of ['hoodie', 'suit', 'shopper']) {
      expect(seen.has(`alley:${k}:bad`), k).toBe(true);
      expect(seen.has(`alley:${k}:civ`), k).toBe(true);
    }
    expect(seen.has('alley:mohawk:bad')).toBe(true);
    expect(seen.has('alley:granny:civ')).toBe(true);
    for (const k of ['suit', 'granny', 'shopper']) expect(seen.has(`alley:${k}:boss`), k).toBe(true);
    // 地下駐車場:4つの見た目で市民とギャング、女ボスは化けた3つ
    for (const k of ['guard', 'mechanic', 'clubber', 'officelady']) {
      expect(seen.has(`garage:${k}:bad`), k).toBe(true);
      expect(seen.has(`garage:${k}:civ`), k).toBe(true);
    }
    for (const k of ['guard', 'mechanic', 'officelady']) expect(seen.has(`garage:${k}:boss`), k).toBe(true);
    // ショッピングモール:4つの見た目で市民と宇宙人、親玉は化けた3つ
    for (const k of ['mascot', 'clerk', 'dancer', 'uncle']) {
      expect(seen.has(`mall:${k}:bad`), k).toBe(true);
      expect(seen.has(`mall:${k}:civ`), k).toBe(true);
    }
    for (const k of ['clerk', 'uncle', 'mascot']) expect(seen.has(`mall:${k}:boss`), k).toBe(true);
  });

  it('ショッピングモール:宇宙人はくずれ、市民はぎこちない動きの理由、親玉は化けた姿のおかしい所', () => {
    const p = (look: Person['look'], truth: Person['truth'], disguise?: Person['disguise']): Person =>
      ({ id: 'x', wave: 1, index: 0, look, truth, disguise, sheetKey: '', profile: { name: '', age: 0, line: '' }, hint: { text: '', face: 'normal' } });
    expect(reasonFor(p('mascot', 'bad'))).toBe('着ぐるみの首が一回転');
    expect(reasonFor(p('clerk', 'bad'))).toBe('まばたきが横に閉じた');
    expect(reasonFor(p('dancer', 'bad'))).toBe('腕がのびて戻った');
    expect(reasonFor(p('uncle', 'bad'))).toBe('体の色がちらついた');
    expect(reasonFor(p('mascot', 'civ'))).toBe('前が見えずにふらついた');
    expect(reasonFor(p('clerk', 'civ'))).toBe('寝不足でかくっとなった');
    expect(reasonFor(p('dancer', 'civ'))).toBe('ダンスの練習でカクカク');
    expect(reasonFor(p('uncle', 'civ'))).toBe('腰をさすっていただけ');
    expect(reasonFor(p('clerk', 'boss', 'clerk'))).toBe('店員なのに名札が逆さ');
    expect(reasonFor(p('uncle', 'boss', 'uncle'))).toBe('おじさんの耳がとがる');
    expect(reasonFor(p('mascot', 'boss', 'mascot'))).toBe('着ぐるみから触角');
    for (const r of Object.values(MALL_REASONS)) for (const t of Object.values(r)) expect(widthOf(t)).toBeLessThanOrEqual(REASON_MAX);
  });

  it('タイムセールラッシュのまとめの1行', () => {
    expect(rushSummary({ aliens: 4, aliensDefeated: 3, civs: 4, civsSaved: 2 })).toBe('セール：撃破3/4・守った2/4');
    expect(rushSummary({ aliens: 3, aliensDefeated: 3, civs: 5, civsSaved: 5 })).toBe('セール：撃破3/3・守った5/5');
    expect(rushSummary({ aliens: 3, aliensDefeated: 0, civs: 5, civsSaved: 0 })).not.toMatch(/[ —]/);
  });

  it('路地裏は絵の小物どおり', () => {
    const p = (look: Person['look'], truth: Person['truth'], disguise?: Person['disguise']): Person =>
      ({ id: 'x', wave: 1, index: 0, look, truth, disguise, sheetKey: '', profile: { name: '', age: 0, line: '' }, hint: { text: '', face: 'normal' } });
    expect(reasonFor(p('hoodie', 'bad'))).toContain('ナイフ');
    expect(reasonFor(p('hoodie', 'civ'))).toContain('財布');
    expect(reasonFor(p('shopper', 'bad'))).toContain('金色の財布');
    expect(reasonFor(p('shopper', 'civ'))).toContain('米袋');
    expect(reasonFor(p('suit', 'bad'))).toContain('バッグ');
    expect(reasonFor(p('suit', 'civ'))).toContain('腕時計');
    expect(reasonFor(p('granny', 'boss', 'granny'))).toContain('入れ墨');
    expect(reasonFor(p('guard', 'boss', 'guard'))).toContain('サングラス');
    expect(reasonFor(p('mechanic', 'boss', 'mechanic'))).toContain('ヒール');
    expect(reasonFor(p('officelady', 'boss', 'officelady'))).toContain('腕輪');
  });

  it('地下駐車場:ギャングは仲間とおそろいの色、市民は組と同じ色なら「偶然」', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const stage = createStage(seed, 'garage');
      for (const w of stage.waves) for (const p of w.people) {
        const r = stripReasonMarkup(reasonFor(p, w));
        if (p.truth === 'bad') expect([`仲間と同じ${p.accessory!.name}の${p.accessory!.item}`, `${p.accessory!.item}が仲間と同じ色`]).toContain(r);
        if (p.truth === 'civ') {
          const same = w.groups.some((g) => g.accessory.id === p.accessory!.id);
          expect(r.includes('偶然'), `${p.id} ${r}`).toBe(same);
        }
      }
    }
  });
});
