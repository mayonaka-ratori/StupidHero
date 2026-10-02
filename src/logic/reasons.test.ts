import { describe, expect, it } from 'vitest';
import {
  REASON_MAX, TOWER_CIV_REASONS, TOWER_DECOY_REASONS, TOWER_LEAK_REASONS, reasonFor, stripReasonMarkup
} from './reasons';
import { createStage } from './stage';
import { TELLS, tellDef } from './tells';
import type { Person, StageId } from './types';

/** 全角1、半角0.5で数えた字の幅 */
const widthOf = (s: string): number => Array.from(s).reduce((n, ch) => n + (/[ -~]/.test(ch) ? 0.5 : 1), 0);

// ラッシュのまとめの1行(rushSummary、liftSummary)は stats.test.ts の「ラッシュの数え方」で確かめる

describe('答え合わせの決め手', () => {
  it('出てくるどの見た目と正体の組み合わせにも、決め手の文がある(1行に入る長さ)。手がかりの出し分けがある人は、その出し分けの文', () => {
    const seen = new Map<string, Set<string>>();
    // 外れは集めて最後に1回だけ確かめる(人の数が多いので、1人ずつ expect を呼ぶと遅い)
    const bad: string[] = [];
    // 出し分けの文は、作ったステージに出にくいものもあるので、表から全部見る
    for (const [look, byTruth] of Object.entries(TELLS)) {
      for (const d of [...(byTruth?.civ ?? []), ...(byTruth?.bad ?? [])]) {
        if (d.reason && widthOf(d.reason) > REASON_MAX) bad.push(`${look} ${d.id}「${d.reason}」長い`);
      }
    }
    // 種50個にした。調べた値では、見た目と正体の組み合わせはどのステージも種8〜9個で出そろい、
    // 出てくる決め手の文の数も種300個のときと同じだった(地下駐車場105通り、路地裏23、モール15、高層ビル64)
    for (const stageId of ['alley', 'garage', 'mall', 'tower'] as StageId[]) {
      for (let seed = 1; seed <= 50; seed++) {
        const stage = createStage(seed, stageId);
        for (const w of stage.waves) for (const p of w.people) {
          const r = reasonFor(p, w);
          const plain = stripReasonMarkup(r);
          const key = `${stageId}:${p.look}:${p.truth}`;
          if (plain.length === 0) bad.push(`${key} ${p.id} 空`);
          if (widthOf(plain) > REASON_MAX) bad.push(`${key}「${plain}」長い`);
          if (/[ —{}]/.test(plain)) bad.push(`${key}「${plain}」使わない字`);
          const tell = tellDef(p.look, p.truth, p.tell)?.reason;
          if (tell && r !== tell) bad.push(`${key} ${p.tell}「${r}」は出し分けの文でない`);
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
    expect(reasonFor(p({ truth: 'bad', leak: { light: true, item: true } }))).toBe(TOWER_LEAK_REASONS.both);
    expect(reasonFor(p({ truth: 'bad', leak: { light: true, item: false } }))).toBe(TOWER_LEAK_REASONS.light);
    expect(reasonFor(p({ truth: 'bad', leak: { light: false, item: true } }))).toBe(TOWER_LEAK_REASONS.item);
    // もれを隠すヴィラン(照明にも小物にも出ない)
    expect(reasonFor(p({ truth: 'bad', leak: { light: false, item: false } }))).toBe(TOWER_LEAK_REASONS.hidden);
    for (const [decoy, text] of Object.entries(TOWER_DECOY_REASONS)) expect(reasonFor(p({ decoy: decoy as Person['decoy'] })), decoy).toBe(text);
    expect(reasonFor(p({}))).toBe(TOWER_CIV_REASONS.chef);
    expect(reasonFor(p({ look: 'newbie' }))).toBe(TOWER_CIV_REASONS.newbie);
    // 親玉は、化けた姿の市民の文ではなく、親玉の文
    for (const d of ['lady', 'magician', 'waiter'] as const) {
      const r = reasonFor(p({ look: d, truth: 'boss', disguise: d }));
      expect(r.length, d).toBeGreaterThan(0);
      expect(r, d).not.toBe(TOWER_CIV_REASONS[d]);
    }
    const all = [...Object.values(TOWER_CIV_REASONS), ...Object.values(TOWER_DECOY_REASONS), ...Object.values(TOWER_LEAK_REASONS)];
    for (const t of all) expect(widthOf(t), t).toBeLessThanOrEqual(REASON_MAX);
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
