// 1回のプレイの状態。シーンの間はこれで受け渡す(scene.registry の 'run' に入れる)。
//
// 流れ:
//   Boot → Title → StageSelect(ステージを選ぶ。ここで startRun(scene, seed, false, stageId))
//   → Intro → Sort(波1) → Street(波1) → Sort(波2) → Street(波2) → Sort(波3) → Street(波3)
//   → Boss → Result → (もう一回なら同じステージで startRun して Intro、タイトルへなら Title)
// Sort は時間切れのとき fillUnsorted() で残りを決める(Street も入口で念のため呼ぶ)。
// Street は波の最後まで進んだら nextAfterStreet() を呼ぶ。波3ではボスの前まで来たら Boss へ行く。
// 開発用に Boot から途中のシーンへ飛ぶときは startRun(scene, seed, true, stageId)(Boot.ts の debugJump)。

import type Phaser from 'phaser';
import { SCENES } from './config';
import { createRng, createStage, decideUnsorted, randomSeed, StatsTracker } from './logic';
import type { Rng } from './logic/rng';
import type { Person, SortChoice, Stage, StageId, Wave } from './logic/types';

export interface GameRun {
  stage: Stage;
  rng: Rng;
  stats: StatsTracker;
  /** いまの波(0〜2) */
  waveIndex: number;
  /** 仕分けの結果。person.id → 'bad' | 'civ'(時間切れの人もヒーローが決めた結果を入れる) */
  sorts: Record<string, SortChoice>;
  /** 時間切れでヒーローが気まぐれで決めた人の id */
  randomSorted: string[];
  /** いちばんひどかった場面の画面(アクション部分 216×214)。Street と Boss が撮り、Result と共有カードが使う */
  worstShot: HTMLImageElement | null;
  /** このページを開いてから何回目のプレイか(1始まり)。2回目からは短い掛け合いにする */
  playCount: number;
  /** 背景のスクロール位置。Street から Boss へ背景をつなぐため */
  scrollX: number;
  /** 開発用に途中のシーンから始めたとき true */
  debug: boolean;
}

const KEY = 'run';

export function startRun(scene: Phaser.Scene, seed: number = randomSeed(), debug = false, stageId: StageId = 'alley'): GameRun {
  const prev = scene.registry.get(KEY) as GameRun | undefined;
  const stage = createStage(seed, stageId);
  const run: GameRun = {
    stage,
    rng: createRng(stage.seed + 1),
    stats: new StatsTracker(stage.villainTotal, stage.id),
    waveIndex: 0,
    sorts: {},
    randomSorted: [],
    worstShot: null,
    playCount: (prev?.playCount ?? 0) + 1,
    scrollX: 0,
    debug
  };
  scene.registry.set(KEY, run);
  return run;
}

export function getRun(scene: Phaser.Scene): GameRun {
  const run = scene.registry.get(KEY) as GameRun | undefined;
  if (!run) throw new Error('run がない。startRun を先に呼ぶ');
  return run;
}

export const currentWave = (run: GameRun): Wave => run.stage.waves[run.waveIndex];

/** 仕分けを記録する */
export function setSort(run: GameRun, person: Person, choice: SortChoice, random = false): void {
  run.sorts[person.id] = choice;
  if (random && !run.randomSorted.includes(person.id)) run.randomSorted.push(person.id);
}

/** 波の中で仕分けていない人を、ヒーローの気まぐれ(半々)で決める */
export function fillUnsorted(run: GameRun): Person[] {
  const filled: Person[] = [];
  for (const p of currentWave(run).people) {
    if (run.sorts[p.id]) continue;
    setSort(run, p, decideUnsorted(run.rng), true);
    filled.push(p);
  }
  return filled;
}

/** Street が波の最後まで進んだあとの行き先 */
export function nextAfterStreet(run: GameRun): string {
  if (run.waveIndex < run.stage.waves.length - 1) {
    run.waveIndex += 1;
    return SCENES.sort;
  }
  return SCENES.boss;
}
