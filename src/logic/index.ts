// ルールと数字と文章の部品の入り口。画面の担当は '../logic' からまとめて読みこむ。
//
// 1ステージの呼ぶ順番の例:
//   // ステージを選ぶ画面:stageSelectInfo() で開いているか、記録、称号の数。開いていなければ def.lockedText
//   const stageId: StageId = 'garage';                // 'alley'(路地裏)、'garage'(地下駐車場)、'mall'(ショッピングモール)、
//                                                    // 'tower'(高層ビル。画面ができるまで STAGE_IDS には入れない)
//   const rng = createRng(randomSeed());
//   const stage = createStage(rng.seed, stageId);    // 3つの波。路地裏16人、地下駐車場18人、ショッピングモール18人
//   const def = stage.def;                           // 背景 def.bg、曲 def.bgm、ボスの絵 def.bossSheet、置く物 def.props
//                                                    // 仕組みは def.mechanic('none' | 'gang' | 'ufo')、ラッシュは def.rush
//   const stats = new StatsTracker(stage.villainTotal, stage.id);
//   // 掛け合い:introFor(stage.id)(そのステージで1回だけ。needsIntro / markIntroSeen)。波の始まり:waveIntroFor(stage.id, wave.no)
//   // 仕分け:wave.people を順に出す。時間切れの人は decideUnsorted(rng)
//   //   地下駐車場:person.accessory.color で小物の色を塗る。組は wave.groups(つながりの文はもう入っている)
//   //   ショッピングモール:glitchShowing(person.glitch, sec) が true の間、くずれの行(行7)を出す(mall.ts)
//   // 結果発表:resolveEncounter(person.truth, choice) で何が起きるか決める
//   //   殴るとき:pickAttack(rng)、shout(kind, rng)、巻きぞえは rollCivHit / rollPropsBroken
//   //   出来事ごとに stats.defeatBad / hurtCiv / breakProp / mischief / escaped / stopped / bossRampage
//   //   セリフ:say(key, rng, stage.id)。帯と本性ちらりの文は streetTextsFor(stage.id)
//   //   地下駐車場で passBad のギャング:口笛 → gatherMembers → new GangCall(...)(gang.ts)
//   //     行け:call.go() が 'wipe' なら stats.groupWiped(n)、'vanStop' なら stats.vanStopped(n)
//   //     逃げきられたら stats.groupEscaped(n)
//   //     仲間が誰も来ない(gatherMembers が1人だけ):say('alone') と say('aloneHero') のあと、ステージ1の
//   //     見逃したワルと同じ流れ(行けで stats.defeatBad('go')、押さずに逃げたら stats.escaped())
//   //   ショッピングモールで passBad の宇宙人:空へ合図 → ufos.add(person.id)(new UfoQueue()。ufo.ts)
//   //     行けで落としたら stats.ufoDowned()、連れ去られたら stats.ufoEscaped() と stats.reportScene('abducted')
//   //   高層ビルで passBad のヴィラン:planPsychic で並べ方 → psy.add(person.id)(new PsyQueue()。psychic.ts)
//     行けで落としたら stats.psyDowned(resolvePsyDrop(plan, psyCarryX(plan, at)))、市民に落ちたら stats.psyEscaped() と
//     stats.reportScene('dropped')
//   ショッピングモールの波2の結果発表のあと:stage.rush でタイムセールラッシュ
//   //     (rushIntroFor(hasSeenRush(stage.id))、markRushSeen、stats.startRush、rushHit、rushStopped、rushEndLine)
//   //   高層ビルの波3の答え合わせのあと:stage.rush でエレベーターラッシュ(stats.startLift、liftHit、liftStopped。まとめは liftSummary)
//   ひどい場面:if (stats.reportScene(scene)) 画面を撮る
//   // ボス戦:const fight = new BossFight(def.bossFight); tap() と update(deltaMs)。boardedCar で女ボスが車に乗る
//   //   (ショッピングモールは親玉が母艦に乗りこむ)。倒したら def.bossDefeatProp があれば stats.breakProp(def.bossDefeatProp)
//   // 結果:const s = stats.snapshot(); const title = decideTitle(s, { firstClear: isFirstClear(stage.id, s) });
//   //   ひとことは titleCommentFor(title.id, stage.id)、被害額のたとえは damageAnalogy(s.damage, stage.id)
//   //   市民のけがの内わけは hurtBreakdown(s)、ラッシュのまとめは s.rush があれば rushSummary(s.rush)
//   //   const saved = saveResult(stage.id, s, title.id);   // saved.unlockedNow で「次のステージが開いた」
//   //   buildShareText({ caption: shareCaption({ worstScene: s.worstScene, caption, titleName }), url })
//   // 答え合わせ(波ごと):tallySorts(wave.people, sorts, randomSorted) を stats.recordSorts に。決め手の文は reasonFor(person, wave)
//   //   ショッピングモールの波2は、最後に rushSummary(stats.rushTally!) を1行
//
// フリープレイの呼ぶ順番の例(docs/FREEPLAY.md。画面の流れは src/run.ts の先頭):
//   // ステージを選ぶ画面:freeSelectInfo() で開いているか(路地裏のボスを倒したか)とベストの時間(formatClearTime)
//   const plan = createFreePlay(seed, unlockedStages());   // run.ts の startFreeRun が呼ぶ。plan.stage が run.stage
//   stats.startFree(plan, slow); stats.setFreeRule(plan.waves[0].rule);   // startFreeRun が呼ぶ
//   // 掛け合い:needsFreeIntro() なら文の担当の FREE_INTRO を出して markFreeIntroSeen()
//   // 波の始め:fw = plan.waves[i]。背景 STAGES[fw.bgStage].bg、ルールの札 ruleSignText(fw.rule)、
//   //   時間と間は freeTiming(fw.no, slow)。人は plan.stage.waves[i].people(ギャングの組は wave.groups)
//   // 1人ごと:rule = ruleAt(fw, person.index)、heroChoice(rule, person) が 'bad' なら殴りかかる(待てのマーク)、
//   //   'civ' なら素通り。場面の種類は freeRoleOf(fw, person)。仕組みは見た目で決める
//   //   (fp_gang はギャングの組、fp_alien はUFO、fp_mohawk はナイフで脅す)
//   //   波3の言い直し:person.index が fw.redeclare.after になる前に、ルールを変えて stats.setFreeRule(fw.redeclare.rule)
//   // 待てと行け:new DryPress() を待てと行けに1つずつ。dry.press(nowMs, マークがあるか) が false なら効かない
//   //   (マークがなければ stats.dryPress())。数え方は stats.ts の先頭の「フリープレイ」
//   // 波の終わり:nextAfterFreeStreet(run)(run.ts)。波3のあとは stats.finishFree(時計) をしてから Result
//   // 結果:const s = stats.snapshot(); const title = decideTitle(s);   // s.free があればフリープレイの順で調べる
//   //   s.free.clearSec(大きく)、s.free.stopSaved、s.free.goScenes、heroAccuracyText(s.free)
//   //   const saved = saveFreeResult(s, title.id);   // saved.showMoreStagesHint で「ステージを進めると…」
//   //   buildShareText({ caption: freeShareCaption({ worstScene: s.worstScene, caption, free: s.free, titleName }), url })

export * from './types';
export * from './rng';
export * from './rules';
export * from './content';
export * from './garageContent';
export * from './mallContent';
export * from './towerContent';
export * from './stages';
export * from './garage';
export * from './gang';
export * from './mall';
export * from './timedCall';
export * from './ufo';
export * from './psychic';
export * from './tower';
export * from './stage';
export * from './stats';
export * from './titles';
export * from './boss';
export * from './format';
export * from './share';
export * from './records';
export * from './reasons';
export * from './freeNames';
export * from './freeplay';
export * from './freeContent';
