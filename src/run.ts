// 1回のプレイの状態。シーンの間はこれで受け渡す(scene.registry の 'run' に入れる)。
//
// 流れ:
//   Boot → Title → StageSelect(ステージを選ぶ。ここで startRun(scene, seed, false, stageId))
//   → Intro → Sort(波1) → Street(波1) → WaveReview(波1の答え合わせ) → Sort(波2) → Street(波2) → WaveReview
//   → Sort(波3) → Street(波3) → Boss → WaveReview(波3の答え合わせ) → Result
//   → (もう一回なら同じステージで startRun して Intro、タイトルへなら Title)
// Sort は時間切れのとき fillUnsorted() で残りを決める(Street も入口で念のため呼ぶ)。
// Street は波の最後まで進んだら nextAfterStreet() を呼ぶ。波3ではボスの前まで来たら Boss へ行く。
// Boss はボスを倒したら WaveReview へ。WaveReview は次へで nextAfterReview() を呼ぶ(波を進めるのはここ)。
// 開発用に Boot から途中のシーンへ飛ぶときは startRun(scene, seed, true, stageId)(Boot.ts の debugJump)。

import type Phaser from 'phaser';
import { SCENES } from './config';
import { createRng, createStage, decideUnsorted, randomSeed, StatsTracker } from './logic';
import type { Rng } from './logic/rng';
import { tallySorts } from './logic/stats';
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
  /** 背景のスクロール位置。Street から Boss へ背景をつなぐため */
  scrollX: number;
  /** 開発用に途中のシーンから始めたとき true */
  debug: boolean;
}

const KEY = 'run';

export function startRun(scene: Phaser.Scene, seed: number = randomSeed(), debug = false, stageId: StageId = 'alley'): GameRun {
  const stage = createStage(seed, stageId);
  const run: GameRun = {
    stage,
    rng: createRng(stage.seed + 1),
    stats: new StatsTracker(stage.villainTotal, stage.id),
    waveIndex: 0,
    sorts: {},
    randomSorted: [],
    worstShot: null,
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

/** 最後の波(波3)か */
const isLastWave = (run: GameRun): boolean => run.waveIndex >= run.stage.waves.length - 1;

/** Street が波の最後まで進んだあとの行き先。波1と波2は答え合わせ、波3はボス戦(答え合わせはボス戦のあと) */
export function nextAfterStreet(run: GameRun): string {
  return isLastWave(run) ? SCENES.boss : SCENES.waveReview;
}

/** その波の仕分けの当たり外れを stats に残す(何回呼んでもよい) */
export function recordWaveSorts(run: GameRun, waveIndex = run.waveIndex): void {
  const w = run.stage.waves[waveIndex];
  if (w) run.stats.recordSorts(tallySorts(w.people, run.sorts, run.randomSorted));
}

/** 答え合わせがまだで、全員の仕分けが決まっている波を stats に残す(結果画面の前に念のため) */
export function recordAllSorts(run: GameRun): void {
  run.stage.waves.forEach((w, i) => {
    if (!run.stats.hasSorts(w.no) && w.people.every((p) => run.sorts[p.id])) recordWaveSorts(run, i);
  });
}

/** 答え合わせの次へ。波1と波2なら次の波の Sort(ここで波を進める)、波3なら Result */
export function nextAfterReview(run: GameRun): string {
  recordWaveSorts(run);
  if (isLastWave(run)) return SCENES.result;
  run.waveIndex += 1;
  return SCENES.sort;
}
