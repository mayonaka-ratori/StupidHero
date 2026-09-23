// ルールと数字と文章の部品の入り口。画面の担当は '../logic' からまとめて読みこむ。
//
// 1ステージの呼ぶ順番の例:
//   const rng = createRng(randomSeed());
//   const stage = createStage(rng.seed);             // 3つの波と16人
//   const stats = new StatsTracker(stage.villainTotal);
//   // 仕分け:wave.people を順に出す。時間切れの人は decideUnsorted(rng)
//   // 結果発表:resolveEncounter(person.truth, choice) で何が起きるか決める
//   //   殴るとき:pickAttack(rng)、shout(kind, rng)、巻きぞえは rollCivHit / rollPropsBroken
//   //   出来事ごとに stats.defeatBad / hurtCiv / breakProp / mischief / escaped / stopped / bossRampage
//   //   ひどい場面:if (stats.reportScene(scene)) 画面を撮る
//   // ボス戦:const fight = new BossFight(); tap() と update(deltaMs)
//   // 結果:const s = stats.snapshot(); const title = decideTitle(s);
//   //   const saved = saveResult(stage.id, s, title.id);
//   //   buildShareText({ ..., titlesCollected: saved.titlesCollected, titlesTotal: saved.titlesTotal, url })

export * from './types';
export * from './rng';
export * from './rules';
export * from './content';
export * from './stage';
export * from './stats';
export * from './titles';
export * from './boss';
export * from './format';
export * from './share';
export * from './records';
