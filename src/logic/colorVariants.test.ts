// 服の色ちがい(colorVariants.ts)の決まり方を確かめる。
// 同じ種なら同じステージ(色も)、ワルか市民かボスかで色が決まらない(色が手がかりにならない)こと。
import { describe, expect, it } from 'vitest';
import { COLOR_VARIANT_COUNT, colorVariantCount, rollColorVariants } from './colorVariants';
import { createFreePlay } from './freeplay';
import { createStage } from './stage';
import { STAGE_IDS } from './stages';
import type { Look, Stage, StageId } from './types';

/** ステージの全員の色ちがい(波の順、出てくる順)と、ラッシュの人の色ちがい */
const variantsOf = (s: Stage): number[] => [
  ...s.waves.flatMap((w) => w.people.map((p) => p.colorVariant!)),
  ...(s.rush?.kind === 'sale' ? s.rush.runners.map((r) => r.colorVariant!) : []),
  ...(s.rush?.kind === 'elevator' ? s.rush.riders.map((r) => r.colorVariant!) : [])
];

describe('服の色ちがい', () => {
  // 同じ種なら同じ結果になることは、このテストで確かめる(人の並び、名前、文、ラッシュ、色ちがいまで全部)
  it.each(STAGE_IDS)('%s:同じ種なら、色ちがいまで入れて同じステージ。全員とラッシュの人に 0〜3 が入り、種がちがえば色ちがいもちがう', (id: StageId) => {
    for (const seed of [1, 42, 12345, 'abc']) {
      const a = createStage(seed, id), b = createStage(seed, id);
      expect(b, `${seed}`).toEqual(a);
      for (const v of variantsOf(a)) expect(v >= 0 && v < COLOR_VARIANT_COUNT && Number.isInteger(v)).toBe(true);
      expect(variantsOf(a).length).toBe(a.peopleTotal + (a.rush?.kind === 'sale' ? a.rush.runners.length : a.rush?.kind === 'elevator' ? a.rush.riders.length : 0));
    }
    // 何回か遊ぶと、同じ見た目がちがう色で出る
    const lists = new Set([1, 2, 3, 4, 5].map((seed) => variantsOf(createStage(seed, id)).join(',')));
    expect(lists.size).toBe(5);
  });

  it('色ちがいは正体を見ずに決まる(見た目と出てくる順だけの人で決め直しても同じ色ちがい。色が手がかりにならない)', () => {
    // rollColorVariants が使ってよいのは、ステージの種、人の見た目(一目で分かるワルを分けるため)と並び順、ラッシュの種類だけ。
    // 正体、絵のキー(hoodie_bad など)、悪さ、出し分けなど、ほかの項目を読むと、ない項目を読んで落ちるか色がずれる
    for (const id of STAGE_IDS) for (const seed of [1, 42, 'abc']) {
      const s = createStage(seed, id);
      const lookOnly = <T extends { look: Look }>(list: readonly T[]) => list.map((p) => ({ look: p.look }));
      const bare = {
        seed: s.seed,
        waves: s.waves.map((w) => ({ people: lookOnly(w.people) })),
        rush: s.rush?.kind === 'sale' ? { kind: 'sale', runners: lookOnly(s.rush.runners) }
          : s.rush?.kind === 'elevator' ? { kind: 'elevator', riders: lookOnly(s.rush.riders) } : null
      } as unknown as Stage;
      rollColorVariants(bare);
      expect(variantsOf(bare), `${id} ${seed}`).toEqual(variantsOf(s));
    }
  });

  it('フリープレイ:同じ種と同じ開き方なら、色ちがいまで入れて全部同じ。市民は色ちがいがあり、一目で分かるワルはいつも0', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      const plan = createFreePlay(seed, ['alley', 'garage', 'mall']);
      expect(createFreePlay(seed, ['alley', 'garage', 'mall']), `${seed}`).toEqual(plan);
      const a = plan.stage;
      for (const w of a.waves) for (const p of w.people) {
        if (p.look.startsWith('fp_')) expect(p.colorVariant).toBe(0);
        else seen.add(p.colorVariant!);
      }
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(colorVariantCount('fp_gang')).toBe(1);
    expect(colorVariantCount('hoodie')).toBe(COLOR_VARIANT_COUNT);
  });
});
