// テストだけで使う部品。ゲームの中からは読みこまない。

import { freeRoleOf, isSceneHead, type FreePlan, type FreeRole } from './freeplay';
import type { RecordStorage } from './records';
import { StatsTracker, freeWaveScene, sceneForCivHit } from './stats';
import type { Person, StageStats } from './types';

/** localStorage の代わり(記録の読み書きを確かめるときに使う) */
export class MemStorage implements RecordStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
}

/**
 * 路地裏を1回遊んだあとの数字(ワルを5人倒し、ボスも倒した。市民のけがと被害額は defaults で決める)。
 * 何も起きていない StatsTracker の snapshot を土台にし、defaults、over の順に上書きする
 */
export function makeStats(defaults: Partial<StageStats>, over: Partial<StageStats> = {}): StageStats {
  return {
    ...new StatsTracker(9, 'alley').snapshot(),
    defeated: 5, defeatedBySort: 5, bossDefeated: true, bossFightSec: 8,
    ...defaults,
    ...over
  };
}

/** フリープレイの場面で、待てか行けを押すか('press')押さないか('skip') */
export type FreeChoice = 'press' | 'skip';
/** 場面ごとに押すか決める(n はその役の何回目か。1始まり) */
export type FreePolicy = (role: FreeRole, p: Person, n: number) => FreeChoice;

/**
 * フリープレイを、画面の代わりに決めた遊び方で1回通す(場面で数える。ギャングの組は1人目だけ)。
 * - 待てのチャンス(市民):押せば待てで守る。押さなければヒーローがなぐる
 * - 殴られるワル:押せばワルへの待て。recover なら行けで取り返し、そうでなければ逃がす(モヒカンは財布を奪う)。
 *   押さなければヒーローが倒す
 * - 行けのチャンス(素通りされるワル):押せば行けで倒す(ギャングの組はまとめて、宇宙人はUFOを落とす)。押さなければ逃がす
 * - 素通りされる市民:押すことはない(ヒーローが正しい)
 * いちばんひどい場面の候補(手を振った、ギリギリセーフ、市民をなぐった)も、画面と同じように伝える
 */
export function playFree(plan: FreePlan, policy: FreePolicy, opts: { rawSec?: number; recover?: boolean } = {}): StatsTracker {
  const { rawSec = 100, recover = false } = opts;
  const stats = new StatsTracker(plan.stage.villainTotal, plan.stage.id);
  stats.startFree(plan);
  const count: Partial<Record<FreeRole, number>> = {};
  const goOn = (p: Person, recovered: boolean): void => {
    if (p.look === 'fp_gang') stats.groupWiped(2);
    else if (p.look === 'fp_alien') stats.ufoDowned(recovered);
    else stats.defeatBad('go', recovered);
  };
  const escape = (p: Person): void => {
    if (p.look === 'fp_gang') stats.groupEscaped(2);
    else if (p.look === 'fp_alien') stats.ufoEscaped();
    else {
      stats.mischief(p.look);
      stats.escaped(true);
    }
  };
  plan.stage.waves.forEach((w, i) => {
    const fw = plan.waves[i];
    stats.setFreeRule(fw.rule);
    for (const p of w.people) {
      if (fw.redeclare && p.index === fw.redeclare.after) stats.setFreeRule(fw.redeclare.rule);
      if (!isSceneHead(w, p)) continue;
      const role = freeRoleOf(fw, p);
      const n = (count[role] = (count[role] ?? 0) + 1);
      const press = policy(role, p, n) === 'press';
      if (role === 'stop') {
        if (press) {
          stats.stopped('civ');
          stats.reportFreeScene('closeCall');
        } else {
          stats.hurtCiv('hero', p.look);
          stats.reportScene(sceneForCivHit(p.look, 'punch'), 'punch');
        }
      } else if (role === 'heroBad') {
        if (!press) stats.defeatBad('sort');
        else {
          stats.stopped('bad');
          if (recover) goOn(p, true);
          else escape(p);
        }
      } else if (role === 'go') {
        stats.reportFreeScene(freeWaveScene(p.look));
        if (press) goOn(p, false);
        else escape(p);
      }
    }
  });
  stats.finishFree(rawSec);
  return stats;
}
