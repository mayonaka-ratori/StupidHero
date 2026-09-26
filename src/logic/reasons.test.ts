import { describe, expect, it } from 'vitest';
import {
  MALL_REASONS, REASON_MAX, TOWER_CIV_REASONS, TOWER_DECOY_REASONS, TOWER_LEAK_REASONS, liftSummary, reasonFor, rushSummary,
  stripReasonMarkup
} from './reasons';
import { createStage } from './stage';
import type { Person, StageId } from './types';

/** 全角1、半角0.5で数えた字の幅 */
const widthOf = (s: string): number => Array.from(s).reduce((n, ch) => n + (/[ -~]/.test(ch) ? 0.5 : 1), 0);

describe('答え合わせの決め手', () => {
  it('出てくるどの見た目と正体の組み合わせにも、決め手の文がある(1行に入る長さ)', () => {
    const seen = new Map<string, Set<string>>();
    // 外れは集めて最後に1回だけ確かめる(人の数が多いので、1人ずつ expect を呼ぶと遅い)
    const bad: string[] = [];
    for (const stageId of ['alley', 'garage', 'mall', 'tower'] as StageId[]) {
      for (let seed = 1; seed <= 300; seed++) {
        const stage = createStage(seed, stageId);
        for (const w of stage.waves) for (const p of w.people) {
          const r = reasonFor(p, w);
          const plain = stripReasonMarkup(r);
          const key = `${stageId}:${p.look}:${p.truth}`;
          if (plain.length === 0) bad.push(`${key} ${p.id} 空`);
          if (widthOf(plain) > REASON_MAX) bad.push(`${key}「${plain}」長い`);
          if (/[ —{}]/.test(plain)) bad.push(`${key}「${plain}」使わない字`);
          if (!seen.has(key)) seen.set(key, new Set());
          seen.get(key)!.add(plain);
        }
      }
    }
    expect(bad).toEqual([]);
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
    // 高層ビル:8つの見た目で市民とヴィラン、親玉は化けた3つ
    for (const k of Object.keys(TOWER_CIV_REASONS)) {
      expect(seen.has(`tower:${k}:bad`), k).toBe(true);
      expect(seen.has(`tower:${k}:civ`), k).toBe(true);
    }
    for (const k of ['lady', 'magician', 'waiter']) expect(seen.has(`tower:${k}:boss`), k).toBe(true);
  });

  it('高層ビル:ヴィランはもれの出方、紛らわしい市民はその理由、ほかの市民は見た目ごと、親玉は化けた姿のおかしい所', () => {
    const p = (over: Partial<Person>): Person =>
      ({ id: 'x', wave: 1, index: 0, look: 'chef', truth: 'civ', sheetKey: '', profile: { name: '', age: 0, line: '' }, hint: { text: '', face: 'normal' }, ...over });
    expect(reasonFor(p({ truth: 'bad', leak: { light: true, item: true } }))).toBe('照明も小物も変だった');
    expect(reasonFor(p({ truth: 'bad', leak: { light: true, item: false } }))).toBe('照明が紫に光っていた');
    expect(reasonFor(p({ truth: 'bad', leak: { light: false, item: true } }))).toBe('机の小物が浮いていた');
    expect(reasonFor(p({ decoy: 'flicker' }))).toBe('蛍光灯が切れかけだった');
    expect(reasonFor(p({ look: 'magician', decoy: 'thread' }))).toBe('手品の糸で吊っていた');
    expect(reasonFor(p({ look: 'florist', decoy: 'balloon' }))).toBe('風船がのっていただけ');
    expect(reasonFor(p({}))).toBe('味見をしていただけ');
    expect(reasonFor(p({ look: 'newbie' }))).toBe('新人でそわそわしていた');
    expect(reasonFor(p({ look: 'lady', truth: 'boss', disguise: 'lady' }))).toBe('羽の飾りが金色だった');
    expect(reasonFor(p({ look: 'magician', truth: 'boss', disguise: 'magician' }))).toBe('つえの先がビルの形');
    expect(reasonFor(p({ look: 'waiter', truth: 'boss', disguise: 'waiter' }))).toBe('蝶ネクタイが金色だった');
    const all = [...Object.values(TOWER_CIV_REASONS), ...Object.values(TOWER_DECOY_REASONS), ...Object.values(TOWER_LEAK_REASONS)];
    for (const t of all) expect(widthOf(t), t).toBeLessThanOrEqual(REASON_MAX);
  });

  it('エレベーターラッシュのまとめの1行', () => {
    expect(liftSummary({ aliens: 3, aliensDefeated: 2, civs: 3, civsSaved: 3 })).toBe('エレベーター：撃破2/3・守った3/3');
    expect(liftSummary({ aliens: 2, aliensDefeated: 0, civs: 4, civsSaved: 1 })).not.toMatch(/[ —]/);
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
    expect(reasonFor(p('uncle', 'boss', 'uncle'))).toBe('おじさんの耳がとがっていた');
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
