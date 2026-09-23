import { describe, expect, it } from 'vitest';
import { REASON_MAX, reasonFor, stripReasonMarkup } from './reasons';
import { createStage } from './stage';
import type { Person, StageId } from './types';

/** 全角1、半角0.5で数えた字の幅 */
const widthOf = (s: string): number => Array.from(s).reduce((n, ch) => n + (/[ -~]/.test(ch) ? 0.5 : 1), 0);

describe('答え合わせの決め手', () => {
  it('出てくるどの見た目と正体の組み合わせにも、決め手の文がある(1行に入る長さ)', () => {
    const seen = new Map<string, Set<string>>();
    for (const stageId of ['alley', 'garage'] as StageId[]) {
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
