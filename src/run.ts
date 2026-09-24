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
//
// フリープレイ(docs/FREEPLAY.md。run.mode === 'free'):
//   StageSelect の「フリープレイ▶」→ startFreeRun(scene, seed, { slow: settings.slowMode })
//   → Intro(初回だけ掛け合い3枚。needsFreeIntro / markFreeIntroSeen)→ Street(波1)→ Street(波2)→ Street(波3)→ Result
//   → (もう一回なら startFreeRun して Intro、タイトルへなら Title)
// Sort、WaveReview、Boss は通らない。run.stage はフリープレイの並び(plan.stage)で、stage.id と stage.def は波1の背景のステージ。
// 波ごとの背景、ルール、言い直しは currentFreeWave(run)(bgStage、rule、redeclare)。
// Street は時計が進むたびに run.free.clockMs に足し(波の始めの決めつけと言い直しで止めている間は足さない)、
// 波の最後の人が通ったら nextAfterFreeStreet(run) で行き先を決める(波を進めるのはここ)。

import type Phaser from 'phaser';
import { SCENES } from './config';
import { createFreePlay, createRng, createStage, decideUnsorted, randomSeed, StatsTracker, unlockedStages } from './logic';
import type { FreePlan, FreeWave } from './logic/freeplay';
import type { Rng } from './logic/rng';
import { tallySorts } from './logic/stats';
import type { Person, SortChoice, Stage, StageId, Wave } from './logic/types';

/** フリープレイで、画面が波をまたいで持つもの(いまの波は run.waveIndex) */
export interface FreeRun {
  /** 並びと、波ごとの背景とルール(createFreePlay の答え)。plan.stage は run.stage と同じ */
  plan: FreePlan;
  /** クリアまでの時計の積み上げ(ミリ秒)。決めつけと言い直しで止めている間は足さない */
  clockMs: number;
  /** ゆっくりモードで遊んでいるか(途中でオンにしたら true にして、stats.setFreeSlow(true) も呼ぶ) */
  slow: boolean;
  /** オペレーターの一言を、場面ごとに何回言ったか(回数で言い方を変えるため。キーは文の担当の FreeOpKey) */
  opCounts: Record<string, number>;
}

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
  /** 'stage' はステージ1〜3、'free' はフリープレイ */
  mode: 'stage' | 'free';
  /** フリープレイのときだけ。ステージのときは null */
  free: FreeRun | null;
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
    debug,
    mode: 'stage',
    free: null
  };
  scene.registry.set(KEY, run);
  return run;
}

export interface FreeRunOptions {
  /** 開いているステージ。省略すると記録から読む(unlockedStages()) */
  unlocked?: readonly StageId[];
  /** ゆっくりモードで始めるか(settings.slowMode) */
  slow?: boolean;
  /** 開発用に途中のシーンから始めたとき true */
  debug?: boolean;
}

/** フリープレイを始める(「フリープレイ▶」と、結果画面の「もう一回」) */
export function startFreeRun(scene: Phaser.Scene, seed: number = randomSeed(), opts: FreeRunOptions = {}): GameRun {
  const prev = scene.registry.get(KEY) as GameRun | undefined;
  const plan = createFreePlay(seed, opts.unlocked ?? unlockedStages());
  const stage = plan.stage;
  const slow = opts.slow ?? false;
  const stats = new StatsTracker(stage.villainTotal, stage.id);
  stats.startFree(plan, slow);
  stats.setFreeRule(plan.waves[0].rule);
  const run: GameRun = {
    stage,
    rng: createRng(stage.seed + 1),
    stats,
    waveIndex: 0,
    sorts: {},
    randomSorted: [],
    worstShot: null,
    playCount: (prev?.playCount ?? 0) + 1,
    scrollX: 0,
    debug: opts.debug ?? false,
    mode: 'free',
    free: { plan, clockMs: 0, slow, opCounts: {} }
  };
  scene.registry.set(KEY, run);
  return run;
}

/** フリープレイのいまの波の決めつけ(背景、ルール、言い直し)。フリープレイでなければ投げる */
export function currentFreeWave(run: GameRun): FreeWave {
  if (!run.free) throw new Error('フリープレイではない');
  return run.free.plan.waves[run.waveIndex];
}

/**
 * フリープレイの Street が波の最後まで進んだあとの行き先。
 * 波1と波2は次の波の Street(ここで波を進め、stats のルールも次の波にする)、
 * 波3は Result(ここでクリアまでの時計を stats に渡す)
 */
export function nextAfterFreeStreet(run: GameRun): string {
  if (!isLastWave(run)) {
    run.waveIndex += 1;
    if (run.free) run.stats.setFreeRule(currentFreeWave(run).rule);
    return SCENES.street;
  }
  if (run.free) run.stats.finishFree(run.free.clockMs / 1000);
  return SCENES.result;
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
export const isLastWave = (run: GameRun): boolean => run.waveIndex >= run.stage.waves.length - 1;

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
