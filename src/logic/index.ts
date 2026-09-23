// ルールと数字と文章の部品の入り口。画面の担当は '../logic' からまとめて読みこむ。
//
// 1ステージの呼ぶ順番の例:
//   // ステージを選ぶ画面:stageSelectInfo() で開いているか、記録、称号の数。開いていなければ def.lockedText
//   const stageId: StageId = 'garage';                // 'alley'(路地裏)か 'garage'(地下駐車場)
//   const rng = createRng(randomSeed());
//   const stage = createStage(rng.seed, stageId);    // 3つの波。路地裏16人、地下駐車場18人
//   const def = stage.def;                           // 背景 def.bg、曲 def.bgm、ボスの絵 def.bossSheet、置く物 def.props
//   const stats = new StatsTracker(stage.villainTotal, stage.id);
//   // 掛け合い:introFor(stage.id, replay)。波の始まり:waveIntroFor(stage.id, wave.no)
//   // 仕分け:wave.people を順に出す。時間切れの人は decideUnsorted(rng)
//   //   地下駐車場:person.accessory.color で小物の色を塗る。組は wave.groups(つながりの文はもう入っている)
//   // 結果発表:resolveEncounter(person.truth, choice) で何が起きるか決める
//   //   殴るとき:pickAttack(rng)、shout(kind, rng)、巻きぞえは rollCivHit / rollPropsBroken
//   //   出来事ごとに stats.defeatBad / hurtCiv / breakProp / mischief / escaped / stopped / bossRampage
//   //   セリフ:say(key, rng, stage.id)
//   //   地下駐車場で passBad のギャング:口笛 → gatherMembers → new GangCall(...)(gang.ts)
//   //     行け:call.go() が 'wipe' なら stats.groupWiped(n)、'vanStop' なら stats.vanStopped(n)
//   //     逃げきられたら stats.groupEscaped(n)
//   //   ひどい場面:if (stats.reportScene(scene)) 画面を撮る
//   // ボス戦:const fight = new BossFight(def.bossFight); tap() と update(deltaMs)。boardedCar で女ボスが車に乗る
//   // 結果:const s = stats.snapshot(); const title = decideTitle(s);
//   //   const saved = saveResult(stage.id, s, title.id);   // saved.unlockedNow で「次のステージが開いた」
//   //   buildShareText({ stageId: stage.id, ..., titlesCollected: saved.titlesCollected, titlesTotal: saved.titlesTotal, url })

export * from './types';
export * from './rng';
export * from './rules';
export * from './content';
export * from './garageContent';
export * from './stages';
export * from './garage';
export * from './gang';
export * from './stage';
export * from './stats';
export * from './titles';
export * from './boss';
export * from './format';
export * from './share';
export * from './records';
