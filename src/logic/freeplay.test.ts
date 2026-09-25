import { describe, expect, it } from 'vitest';
import { GANG_LOOKS } from './garage';
import { gatherMembers } from './gang';
import { MALL_LOOKS } from './mall';
import {
  DryPress, FREE, canCarry, clearTimeSec, createFreePlay, formatClearTime, freeRoleOf, freeTiming, heroChoice, isSceneHead, ruleAt,
  type FreeRole, type FreeWave
} from './freeplay';
import { MARK } from './rules';
import { STAGES, sheetKeyFor } from './stages';
import type { Look, Person, StageId, Wave } from './types';

const UNLOCKS: readonly (readonly StageId[])[] = [['alley'], ['alley', 'garage'], ['alley', 'garage', 'mall']];

describe('高層ビルはフリープレイに入れない', () => {
  it('高層ビルが開いていても、背景にも人にも出ない', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const plan = createFreePlay(seed, ['alley', 'garage', 'mall', 'tower']);
      expect(plan.unlocked).toEqual(['alley', 'garage', 'mall']);
      for (const w of plan.waves) expect(w.bgStage).not.toBe('tower');
      for (const w of plan.stage.waves) for (const p of w.people) expect(STAGES.tower.looks).not.toContain(p.look);
    }
  });
});
const SEEDS = Array.from({ length: 150 }, (_, i) => i * 7919 + 3);

/** 開き方と種をすべて回す */
function eachPlan(fn: (plan: ReturnType<typeof createFreePlay>, unlocked: readonly StageId[]) => void): void {
  for (const unlocked of UNLOCKS) for (const seed of SEEDS) fn(createFreePlay(seed, unlocked), unlocked);
}

/** 場面の頭の人だけ(ギャングの組の2人目を除く) */
const heads = (w: Wave): Person[] => w.people.filter((p) => isSceneHead(w, p));

const roleCount = (fw: FreeWave, w: Wave): Record<FreeRole, number> => {
  const c: Record<FreeRole, number> = { stop: 0, go: 0, heroBad: 0, heroCiv: 0 };
  for (const p of heads(w)) c[freeRoleOf(fw, p)]++;
  return c;
};

describe('ヒーローの決めつけ', () => {
  const p = (item?: Person['item']): Pick<Person, 'item'> => ({ item });

  it('みんなワルは全員に殴りかかり、みんないい人は全員素通り、小物のルールは小物の人だけ殴りかかる', () => {
    expect(heroChoice({ kind: 'allBad' }, p())).toBe('bad');
    expect(heroChoice({ kind: 'allCiv' }, p('balloon'))).toBe('civ');
    expect(heroChoice({ kind: 'item', item: 'balloon' }, p('balloon'))).toBe('bad');
    expect(heroChoice({ kind: 'item', item: 'balloon' }, p('hat'))).toBe('civ');
    expect(heroChoice({ kind: 'item', item: 'balloon' }, p())).toBe('civ');
  });

  it('言い直しのあとは新しいルール', () => {
    const fw: FreeWave = {
      no: 3, bgStage: 'alley', rule: { kind: 'item', item: 'hat' }, redeclare: { after: 6, rule: { kind: 'item', item: 'bag' } }
    };
    expect(ruleAt(fw, 0)).toEqual({ kind: 'item', item: 'hat' });
    expect(ruleAt(fw, 5)).toEqual({ kind: 'item', item: 'hat' });
    expect(ruleAt(fw, 6)).toEqual({ kind: 'item', item: 'bag' });
    expect(ruleAt({ ...fw, redeclare: null }, 9)).toEqual({ kind: 'item', item: 'hat' });
    const civ = { index: 7, truth: 'civ' as const, item: 'bag' as const };
    expect(freeRoleOf(fw, civ)).toBe('stop');
    expect(freeRoleOf(fw, { ...civ, index: 2 })).toBe('heroCiv');
    expect(freeRoleOf(fw, { ...civ, truth: 'bad' })).toBe('heroBad');
    expect(freeRoleOf(fw, { ...civ, truth: 'bad', item: undefined })).toBe('go');
  });
});

describe('createFreePlay:山札の数', () => {
  it('どの開き方でも毎回、待て9、行け8、ヒーローが正しい10、場面27', () => {
    eachPlan((plan) => {
      expect(plan.chances).toEqual({ stop: 9, go: 8, heroRight: 10, scenes: 27 });
    });
  });

  it('波ごとの場面の数と4通りの数が仕様の表の通り(ギャングの組は1場面)', () => {
    eachPlan((plan) => {
      plan.stage.waves.forEach((w, i) => {
        const want = FREE.waves[i];
        expect(heads(w)).toHaveLength(want.scenes);
        expect(roleCount(plan.waves[i], w)).toEqual({ stop: want.stop, go: want.go, heroBad: want.heroBad, heroCiv: want.heroCiv });
        // 人数は、ギャングの組があれば1人多い
        expect(w.people.length).toBe(want.scenes + w.groups.length);
      });
    });
  });

  it('ルールは波1がみんなワル、波2がみんないい人、波3が小物で、言い直しは違う小物', () => {
    eachPlan((plan) => {
      const [w1, w2, w3] = plan.waves;
      expect(w1.rule).toEqual({ kind: 'allBad' });
      expect(w2.rule).toEqual({ kind: 'allCiv' });
      expect(w1.redeclare).toBeNull();
      expect(w2.redeclare).toBeNull();
      expect(w3.rule.kind).toBe('item');
      expect(w3.redeclare!.rule.kind).toBe('item');
      if (w3.rule.kind === 'item' && w3.redeclare!.rule.kind === 'item') expect(w3.redeclare!.rule.item).not.toBe(w3.rule.item);
    });
  });

  it('同じ種と同じ開き方なら同じ並び', () => {
    expect(createFreePlay(42, ['alley', 'garage'])).toEqual(createFreePlay(42, ['alley', 'garage']));
    expect(createFreePlay('abc', ['alley'])).toEqual(createFreePlay('abc', ['alley']));
  });

  it('run.stage に入れる形:id と def は波1の背景、名前はフリープレイ、人数とワルの数', () => {
    eachPlan((plan) => {
      const s = plan.stage;
      expect(s.id).toBe(plan.waves[0].bgStage);
      expect(s.def).toBe(STAGES[s.id]);
      expect(s.name).toBe('フリープレイ');
      expect(s.rush).toBeNull();
      expect(s.peopleTotal).toBe(s.waves.reduce((n, w) => n + w.people.length, 0));
      expect(s.villainTotal).toBe(s.waves.flatMap((w) => w.people).filter((p) => p.truth === 'bad').length);
      for (const w of s.waves) {
        expect(w.hasBoss).toBe(false);
        expect(w.badCount).toBe(w.people.filter((p) => p.truth === 'bad').length);
        w.people.forEach((p, i) => {
          expect(p.index).toBe(i);
          expect(p.wave).toBe(w.no);
          expect(p.truth).not.toBe('boss');
        });
      }
      const ids = s.waves.flatMap((w) => w.people.map((p) => p.id));
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});

describe('createFreePlay:人と背景', () => {
  it('開いているステージの人だけ出す。路地裏だけならワルはモヒカンだけ、市民は路地裏の市民だけ', () => {
    const alleyCiv: Look[] = ['hoodie', 'suit', 'shopper', 'granny'];
    eachPlan((plan, unlocked) => {
      for (const p of plan.stage.waves.flatMap((w) => w.people)) {
        if (p.truth === 'bad') {
          expect(['fp_mohawk', 'fp_gang', 'fp_alien']).toContain(p.look);
          if (!unlocked.includes('garage')) expect(p.look).not.toBe('fp_gang');
          if (!unlocked.includes('mall')) expect(p.look).not.toBe('fp_alien');
        } else {
          const ok = [...alleyCiv, ...(unlocked.includes('garage') ? GANG_LOOKS : []), ...(unlocked.includes('mall') ? MALL_LOOKS : [])];
          expect(ok).toContain(p.look);
        }
      }
    });
    // 路地裏だけ:ワルは全員モヒカン
    const plan = createFreePlay(1, ['alley']);
    expect(new Set(plan.stage.waves.flatMap((w) => w.people).filter((p) => p.truth === 'bad').map((p) => p.look))).toEqual(new Set(['fp_mohawk']));
  });

  it('開いているステージが増えると、ギャングと宇宙人が出る', () => {
    const looks = (u: readonly StageId[]): Set<Look> =>
      new Set(SEEDS.flatMap((s) => createFreePlay(s, u).stage.waves.flatMap((w) => w.people.map((p) => p.look))));
    const all = looks(['alley', 'garage', 'mall']);
    for (const l of ['fp_mohawk', 'fp_gang', 'fp_alien', 'granny', 'guard', 'mascot'] as Look[]) expect(all.has(l), l).toBe(true);
    expect(looks(['alley', 'garage']).has('fp_gang')).toBe(true);
  });

  it('背景は開いているステージから波ごとに1つずつ。3つ開いていれば全部違う', () => {
    eachPlan((plan, unlocked) => {
      const bgs = plan.waves.map((w) => w.bgStage);
      for (const b of bgs) expect(unlocked).toContain(b);
      if (unlocked.length === 3) expect(new Set(bgs).size).toBe(3);
      if (unlocked.length === 2) expect(new Set(bgs).size).toBe(2);
    });
  });

  it('路地裏はいつも開いているものとして扱う。知らない id は捨てる', () => {
    const plan = createFreePlay(5, ['garage']);
    expect(plan.unlocked).toEqual(['alley', 'garage']);
  });

  it('フリープレイのワルの絵のキーは見た目の名前そのまま。悪さはナイフで脅す、口笛、合図', () => {
    expect(sheetKeyFor('fp_mohawk', 'bad')).toBe('fp_mohawk');
    expect(sheetKeyFor('fp_gang', 'bad', 'garage')).toBe('fp_gang');
    expect(sheetKeyFor('fp_alien', 'bad', 'mall')).toBe('fp_alien');
    eachPlan((plan) => {
      for (const p of plan.stage.waves.flatMap((w) => w.people)) {
        if (p.look === 'fp_mohawk') expect(p.mischief).toBe('threaten');
        if (p.look === 'fp_gang') expect(p.mischief).toBe('whistle');
        if (p.look === 'fp_alien') expect(p.mischief).toBe('signal');
        if (p.truth === 'bad') expect(p.sheetKey).toBe(p.look);
        else expect(p.sheetKey).toBe(sheetKeyFor(p.look, 'civ'));
      }
    });
  });

  it('おばあさんは毎回1人、波1か波3の待てのチャンスに入る(どちらの波にも出ることがある)', () => {
    const waves = new Set<number>();
    eachPlan((plan) => {
      const grannies = plan.stage.waves.flatMap((w, i) => w.people.filter((p) => p.look === 'granny').map((p) => ({ p, i })));
      expect(grannies).toHaveLength(1);
      const { p, i } = grannies[0];
      expect([1, 3]).toContain(p.wave);
      expect(freeRoleOf(plan.waves[i], p)).toBe('stop');
      waves.add(p.wave);
    });
    expect(waves).toEqual(new Set([1, 3]));
  });

  it('地下駐車場の市民の小物の色はオレンジか紫だけ。ほかの人には小物の色をつけない', () => {
    eachPlan((plan) => {
      for (const p of plan.stage.waves.flatMap((w) => w.people)) {
        if (p.truth === 'civ' && (GANG_LOOKS as readonly Look[]).includes(p.look)) expect(['orange', 'purple']).toContain(p.accessory?.id);
        else expect(p.accessory).toBeUndefined();
      }
    });
  });
});

describe('createFreePlay:ギャングとUFO', () => {
  it('ギャングは2人組だけ、1つの波に1組まで。行けのチャンスにだけ出て、gatherMembers で2人とも集まれる', () => {
    let pairs = 0;
    eachPlan((plan) => {
      plan.stage.waves.forEach((w, i) => {
        expect(w.groups.length).toBeLessThanOrEqual(1);
        const gangs = w.people.filter((p) => p.look === 'fp_gang');
        expect(gangs.length).toBe(w.groups.length * 2);
        for (const g of w.groups) {
          pairs++;
          expect(g.wave).toBe(w.no);
          expect(g.memberIds).toEqual(gangs.map((p) => p.id));
          for (const p of gangs) {
            expect(p.group).toBe(g.id);
            expect(freeRoleOf(plan.waves[i], p)).toBe('go');
          }
          expect(gatherMembers(g.memberIds, () => false)).toHaveLength(2);
        }
      });
    });
    expect(pairs).toBeGreaterThan(0);
  });

  it('行けのチャンスの並びで、ギャングと宇宙人が続かない(集合とUFOを同時に出さない)', () => {
    eachPlan((plan) => {
      plan.stage.waves.forEach((w, i) => {
        const seq = heads(w).filter((p) => freeRoleOf(plan.waves[i], p) === 'go').map((p) => p.look);
        for (let k = 1; k < seq.length; k++) {
          const pair = [seq[k - 1], seq[k]];
          expect(pair.includes('fp_gang') && pair.includes('fp_alien'), `${seq}`).toBe(false);
        }
      });
    });
  });
});

describe('createFreePlay:波3', () => {
  it('素通りされるワルどうしが隣に並ばない', () => {
    eachPlan((plan) => {
      const fw = plan.waves[2];
      const roles = plan.stage.waves[2].people.map((p) => freeRoleOf(fw, p));
      for (let k = 1; k < roles.length; k++) expect(roles[k - 1] === 'go' && roles[k] === 'go').toBe(false);
    });
  });

  it('言い直しの前と後に分け、4通りをどちらにも1つか2つずつ(合わせて3つずつ)。言い直しは前の半分の人数のあと', () => {
    eachPlan((plan) => {
      const fw = plan.waves[2];
      const w = plan.stage.waves[2];
      const after = fw.redeclare!.after;
      const before = w.people.filter((p) => p.index < after);
      const later = w.people.filter((p) => p.index >= after);
      const scenesOf = (list: Person[]): Person[] => list.filter((p) => isSceneHead(w, p));
      expect(scenesOf(before)).toHaveLength(6);
      expect(scenesOf(later)).toHaveLength(6);
      // ギャングの組は同じ半分にいる
      for (const g of w.groups) {
        const idx = w.people.filter((p) => g.memberIds.includes(p.id)).map((p) => p.index < after);
        expect(new Set(idx).size).toBe(1);
      }
      for (const half of [before, later]) {
        const c: Record<FreeRole, number> = { stop: 0, go: 0, heroBad: 0, heroCiv: 0 };
        for (const p of scenesOf(half)) c[freeRoleOf(fw, p)]++;
        for (const r of Object.keys(c) as FreeRole[]) {
          expect(c[r], r).toBeGreaterThanOrEqual(1);
          expect(c[r], r).toBeLessThanOrEqual(2);
        }
      }
    });
  });

  it('小物:当てはまる人は小物を持ち、どちらの半分にも何も持たない人がいる。袋の人には紙袋を付けない。波1と波2には小物なし', () => {
    let oldItemAfter = 0;
    eachPlan((plan) => {
      for (const w of plan.stage.waves.slice(0, 2)) for (const p of w.people) expect(p.item).toBeUndefined();
      const fw = plan.waves[2];
      const w = plan.stage.waves[2];
      const after = fw.redeclare!.after;
      for (const half of [w.people.filter((p) => p.index < after), w.people.filter((p) => p.index >= after)]) {
        expect(half.some((p) => p.item === undefined)).toBe(true);
      }
      for (const p of w.people) {
        if (p.item) expect(canCarry(p.look, p.item), `${p.look} ${p.item}`).toBe(true);
        if (p.look === 'shopper' || p.look === 'uncle') expect(p.item).not.toBe('bag');
      }
      // 言い直しのあとに、前のルールの小物を持った当てはまらない人がいることが多い
      const first = fw.rule.kind === 'item' ? fw.rule.item : null;
      if (w.people.some((p) => p.index >= after && p.item === first)) oldItemAfter++;
    });
    expect(oldItemAfter).toBeGreaterThan(UNLOCKS.length * SEEDS.length * 0.8);
  });
});

describe('時間と空押し', () => {
  it('FREE の数字', () => {
    expect(FREE.waves.map((w) => w.scenes)).toEqual([8, 7, 12]);
    expect(FREE.total).toEqual({ scenes: 27, stop: 9, go: 8, heroRight: 10 });
    expect(FREE.gapPx).toEqual({ 1: 104, 2: 104, 3: 96 });
    expect(FREE.windupSec[3]).toBe(0.9);
    expect(FREE.markSlowmo[3]).toBe(1);
    expect(FREE.markSlowmo[1]).toBe(MARK.slowmo);
    expect([FREE.penaltySec, FREE.dryPressLockSec, FREE.redeclarePauseSec, FREE.slowScale, FREE.lateGraceSec]).toEqual([3, 1, 1.5, 1.5, 0.15]);
  });

  it('ゆっくりモードは間、ため、マーク、逃げるまで、車、UFOを1.5倍。言い直しで止める時間は3秒', () => {
    const n = freeTiming(3);
    const s = freeTiming(3, true);
    expect(n).toMatchObject({ gapPx: 96, windupSec: 0.9, markSlowmo: 1, escapeSec: 3, redeclarePauseSec: 1.5 });
    expect(s.gapPx).toBe(144);
    expect(s.windupSec).toBeCloseTo(1.35);
    expect(s.markSlowmo).toBeCloseTo(1 / 1.5);
    expect(s.escapeSec).toBeCloseTo(4.5);
    expect(s.gangEscapeSec).toBeCloseTo(n.gangEscapeSec * 1.5);
    expect(s.gangDriveSec).toBeCloseTo(n.gangDriveSec * 1.5);
    expect(s.ufoBeamSec).toBeCloseTo(n.ufoBeamSec * 1.5);
    expect(s.redeclarePauseSec).toBe(3);
    expect(freeTiming(1).gapPx).toBe(104);
  });

  it('クリアまでの時間は、逃がしたワル、市民のけが、ワルへの待て1つにつき3秒を足す', () => {
    expect(clearTimeSec(95.5, 0, 0)).toBe(95.5);
    expect(clearTimeSec(95.5, 2, 1)).toBe(104.5);
    expect(clearTimeSec(95.5, 2, 1, 2)).toBe(110.5);
    expect(formatClearTime(98.9)).toBe('1:38');
    expect(formatClearTime(59)).toBe('0:59');
    expect(formatClearTime(600)).toBe('10:00');
  });

  it('空押し:マークがないと1.0秒効かず、効かない間に押し直すと数え直す。見て押せば効く', () => {
    const d = new DryPress();
    expect(d.press(0, true)).toBe(true);
    expect(d.press(100, false)).toBe(false);
    expect(d.dryCount).toBe(1);
    expect(d.locked(1000)).toBe(true);
    expect(d.remainingMs(600)).toBe(500);
    // 効かない間は、マークがあっても効かず、そこから数え直す
    expect(d.press(900, true)).toBe(false);
    expect(d.dryCount).toBe(1);
    expect(d.press(1500, true)).toBe(false);
    expect(d.press(2500, true)).toBe(true);
    // 連打すると一度も効かない
    const m = new DryPress();
    let hit = 0;
    for (let t = 0; t < 5000; t += 300) if (m.press(t, t > 2000)) hit++;
    expect(hit).toBe(0);
    expect(m.dryCount).toBe(7);
    m.reset();
    expect(m.press(5000, true)).toBe(true);
  });

  it('マークが消えた直後(0.15秒まで)の押しは、空押しに数えず、効かない時間も始めない', () => {
    const d = new DryPress();
    d.markGone(1000);
    expect(d.press(1150, false)).toBe(false);
    expect(d.dryCount).toBe(0);
    expect(d.locked(1200)).toBe(false);
    expect(d.press(1200, true)).toBe(true);
    // 0.15秒をすぎたら、ふつうの空押し
    expect(d.press(1151 + 200, false)).toBe(false);
    expect(d.dryCount).toBe(1);
    expect(d.locked(1400)).toBe(true);
  });
});
