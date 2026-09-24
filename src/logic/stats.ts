// 1ステージの数字を数える。SPECの「数字の数え方」の通り。
// 画面の担当は、結果発表の出来事が起きるたびにここのメソッドを呼び、最後に snapshot() で数字を受け取る。
//
// ステージ2(STAGE2「数え方の追加」):
//   const stats = new StatsTracker(stage.villainTotal, stage.id);
//   stats.groupWiped(n)    // 集まった組をまとめて吹き飛ばした(n は組の人数。全員を撃破に数える)
//   stats.vanStopped(n)    // 走り出したワゴンを車ごと止めた(全員を撃破に数え、ワゴンの¥500万を足す)
//   stats.groupEscaped(n)  // 車で逃げきられた(全員を逃がしたに数える)
//   ギャングの口笛(見逃したギャング)では stats.mischief を呼ばない(呼んでも何も足さない)。
//   組が市民を襲うことはないので、市民負傷は増えない。
//   仲間が誰も来なかった(1人だけ)ときは、画面はステージ1の見逃したワルと同じ流れにする
//   (行けで defeatBad('go')、逃げたら escaped())。1人で groupWiped などを呼んでも、人数は数えるが
//   組の数(称号「一網打尽」「ギャングの運転手」の数)には入れない(GANG.groupSize.min 人以上だけ組)
//
// ステージ3(STAGE3「数え方の追加」「タイムセールラッシュ」の数え方):
//   宇宙人の空への合図(見逃した宇宙人)では stats.mischief を呼ばない(呼んでも何も足さない)。
//   stats.ufoDowned()      // 行けでUFOを殴り落とした。宇宙人を撃破に数え(「行けで倒した」にも)、UFOの¥300万を足す。
//                          // 真下の物は画面が別に stats.breakProp(kind) で壊す
//   stats.ufoEscaped()     // 行けを押さずにUFOが去った。買い物客を「市民のけが」(さらわれた)に、宇宙人を「逃がした」に数える。
//                          // いちばんひどい場面は stats.reportScene('abducted')
//   タイムセールラッシュ:stats.startRush(stage.rush) で始め、1人ごとに
//   stats.rushHit(truth)(待てを押さずに殴った)か stats.rushStopped(truth)(待てで止めた)。
//   ラッシュの数はほかの数字(悪党を倒した、市民のけが、逃がした、仕分け正解、全員倒した)に入れない。
//   ラッシュで市民を殴った場面は stats.reportScene('civHit', 'punch')(市民を殴った瞬間と同じ段)

import { GANG, isBigProp, MISCHIEF_COST, MISCHIEF_HURTS_CIV, MISCHIEF_BY_LOOK, PROP_COST } from './rules';
import { STAGES } from './stages';
import type {
  AttackKind, HurtCause, Look, Person, PropKind, RushPlan, RushTally, SortChoice, SortTally, StageId, StageStats, Truth, WorstScene
} from './types';

/** 組として数える人数か(2人以上)。1人だけのときは組の数に入れない */
export const isGroup = (size: number): boolean => size >= GANG.groupSize.min;

/**
 * いちばんひどかった場面の段階。数が小さいほどひどい(SPECの1〜5に、STAGE3の「市民がさらわれた」を
 * 「市民を殴った瞬間」のすぐあと、「車や自販機が壊れた瞬間」の前に足した)
 */
export const WORST_SCENE_RANK: Readonly<Record<WorstScene, number>> = {
  grannyHit: 1,
  specialOnCiv: 2,
  civHit: 3,
  abducted: 4,
  bigPropBroken: 5,
  bossDefeated: 6
};

/** 市民に攻撃が当たった瞬間は、どの段階の場面か */
export function sceneForCivHit(look: Look, attack?: AttackKind): WorstScene {
  if (look === 'granny') return 'grannyHit';
  if (attack === 'special') return 'specialOnCiv';
  return 'civHit';
}

/** 仕分けが当たっているか。ボスはワルに仕分けていれば当たり */
export const sortIsCorrect = (truth: Truth, choice: SortChoice | undefined): boolean =>
  choice !== undefined && (truth === 'civ' ? choice === 'civ' : choice === 'bad');

/**
 * 1つの波の仕分けの当たり外れを数える。
 * byHero は時間切れでヒーローの勘で決まった人の id(run.randomSorted)。その人は自分の仕分けには数えない
 */
export function tallySorts(
  people: readonly Pick<Person, 'id' | 'wave' | 'truth'>[], sorts: Readonly<Record<string, SortChoice>>, byHero: readonly string[]
): SortTally {
  const t: SortTally = { wave: people[0]?.wave ?? 1, correct: 0, total: 0, byHero: 0, byHeroCorrect: 0 };
  for (const p of people) {
    const ok = sortIsCorrect(p.truth, sorts[p.id]);
    if (byHero.includes(p.id)) {
      t.byHero++;
      if (ok) t.byHeroCorrect++;
    } else {
      t.total++;
      if (ok) t.correct++;
    }
  }
  return t;
}

export class StatsTracker {
  private defeatedBySort = 0;
  private defeatedByGo = 0;
  private defeatedByUfo = 0;
  private ufosDowned = 0;
  private escapedByUfo = 0;
  private defeatedByWipe = 0;
  private defeatedByVan = 0;
  private groupsWiped = 0;
  private groupsEscaped = 0;
  private escapedByVan = 0;
  private vansStopped = 0;
  private bossDefeated = false;
  private hurt: Record<HurtCause, number> = { hero: 0, collateral: 0, villain: 0, abducted: 0 };
  private damageByProps = 0;
  private damageByMischief = 0;
  private damageByBoss = 0;
  private propsBroken = Object.fromEntries(Object.keys(PROP_COST).map((k) => [k, 0])) as Record<PropKind, number>;
  private escapedCount = 0;
  private civSavedByStop = 0;
  private badSparedByStop = 0;
  private grannyHit = false;
  private bossSortedCiv = false;
  private bossFightSec: number | null = null;
  private worst: WorstScene | null = null;
  private worstAttack: AttackKind | null = null;
  private sortWaves = new Map<number, SortTally>();
  private rush: RushTally | null = null;

  /**
   * @param villainTotal 倒すべき相手の総数(ワル全員とボス)。stage.villainTotal を渡す
   * @param stageId どのステージか。stage.id を渡す(ボスが暴れたときの額が変わる)。省略すると路地裏
   */
  constructor(readonly villainTotal: number, readonly stageId: StageId = 'alley') {}

  // ─── 撃破 ───

  /** ワルを倒した。how:'sort' は仕分けで殴った、'go' は行けで追い打ちした */
  defeatBad(how: 'sort' | 'go'): void {
    if (how === 'go') this.defeatedByGo++;
    else this.defeatedBySort++;
  }

  // ─── ステージ2:ギャングの組 ───

  /**
   * 集まった組を、行けでまとめて吹き飛ばした。size は吹き飛ばした人数(組のうち集まった人)。
   * 全員を撃破に数える。巻きぞえは組の中だけなので、市民負傷は増えない
   */
  groupWiped(size: number): void {
    if (size <= 0) return;
    this.defeatedByWipe += size;
    if (isGroup(size)) this.groupsWiped++;
  }

  /**
   * 走り出したワゴン(または乗りこむところ)を、行けで車ごと止めた。size は乗っていた人数。
   * 全員を撃破に数え、ワゴンの被害額(¥500万)を足す。足した額を返す(画面に飛び出す数字に使う)。
   * いちばんひどかった場面は、画面が stats.reportScene(sceneForProp('van')!) で伝える
   */
  vanStopped(size: number): number {
    this.defeatedByVan += Math.max(0, size);
    this.vansStopped++;
    return this.breakProp('van');
  }

  /** 組が車で逃げきった。size は乗っていた人数。全員を「逃がした」に数える */
  groupEscaped(size: number): void {
    if (size <= 0) return;
    this.escapedByVan += size;
    this.escapedCount += size;
    if (isGroup(size)) this.groupsEscaped++;
  }

  // ─── ステージ3:UFO ───

  /**
   * 吸い上げている間に行けを押して、UFOを殴り落とした。乗せようとしていた宇宙人も一緒に倒れる
   * (撃破に数え、「行けで倒した」にも数える)。UFOの被害額(¥300万)を足し、足した額を返す。
   * 真下の物は画面が別に breakProp で壊す。落ちたUFOは市民を巻きこまない
   */
  ufoDowned(): number {
    this.defeatedByGo++;
    this.defeatedByUfo++;
    this.ufosDowned++;
    return this.breakProp('ufo');
  }

  /**
   * 行けを押さないまま、UFOが買い物客と宇宙人を乗せて去った。
   * 買い物客を「市民のけが」(さらわれた)に、宇宙人を「逃がした」に数える
   */
  ufoEscaped(): void {
    this.hurtCiv('abducted');
    this.escapedCount++;
    this.escapedByUfo++;
  }

  // ─── ステージ3:タイムセールラッシュ ───

  /** ラッシュを始める(stage.rush を渡す)。宇宙人と市民の数を覚える。2回呼んだら数え直す */
  startRush(plan: Pick<RushPlan, 'alienCount' | 'civCount'>): void {
    this.rush = { aliens: plan.alienCount, aliensDefeated: 0, aliensSpared: 0, civs: plan.civCount, civsSaved: 0, civsHit: 0 };
  }

  /** ラッシュで待てを押さず、ヒーローが殴った(宇宙人なら「セールで倒した」、市民なら「セールで殴った」) */
  rushHit(truth: 'bad' | 'civ'): void {
    const r = this.ensureRush();
    if (truth === 'bad') r.aliensDefeated++;
    else r.civsHit++;
  }

  /** ラッシュで待てを押して止めた(宇宙人なら「セールで逃がした」、市民なら「セールで守った」)。「待ての達人」には入れない */
  rushStopped(truth: 'bad' | 'civ'): void {
    const r = this.ensureRush();
    if (truth === 'bad') r.aliensSpared++;
    else r.civsSaved++;
  }

  /** ラッシュの今の数(始めていなければ null) */
  get rushTally(): RushTally | null {
    return this.rush ? { ...this.rush } : null;
  }

  private ensureRush(): RushTally {
    if (!this.rush) this.rush = { aliens: 0, aliensDefeated: 0, aliensSpared: 0, civs: 0, civsSaved: 0, civsHit: 0 };
    return this.rush;
  }

  /** ボスを倒した。seconds はボス戦にかかった秒数(BossFight.seconds) */
  defeatBoss(seconds: number): void {
    this.bossDefeated = true;
    this.bossFightSec = seconds;
  }

  // ─── 市民負傷 ───

  /**
   * 市民がけがをした。
   * cause:'hero' はヒーローが殴った、'collateral' は巻きぞえ、'villain' はワルに襲われた、
   * 'abducted' はUFOにさらわれた(ふつうは ufoEscaped から呼ぶ)。
   * look はけがをした市民の見た目(おばあさんかどうかを見る)。ヒーローの攻撃(殴った、巻きぞえ)で
   * おばあさんに当たったら「おばあさんを殴った」になる。
   */
  hurtCiv(cause: HurtCause, look?: Look): void {
    this.hurt[cause]++;
    if (look === 'granny' && (cause === 'hero' || cause === 'collateral')) this.grannyHit = true;
  }

  /** そのステージでヒーローの攻撃が市民に当たった回数(ツッコミを短い版にするかを決めるのに使う) */
  get heroMistakes(): number {
    return this.hurt.hero + this.hurt.collateral;
  }

  // ─── 被害額 ───

  /** 物が壊れた。足した額を返す(画面に飛び出す数字に使う) */
  breakProp(kind: PropKind): number {
    const cost = PROP_COST[kind];
    this.propsBroken[kind]++;
    this.damageByProps += cost;
    return cost;
  }

  /**
   * ワルが悪さをした(悪さの動きの当たりのコマで呼ぶ)。¥20万を足し、突き飛ばしとひったくりなら
   * ワルに襲われた市民を1人数える。足した額を返す。
   */
  mischief(look: Look): number {
    const kind = MISCHIEF_BY_LOOK[look];
    // ギャングの口笛と宇宙人の空への合図は悪さではない(被害額も市民負傷も増えない)
    if (kind === 'whistle' || kind === 'signal') return 0;
    this.damageByMischief += MISCHIEF_COST;
    if (kind && MISCHIEF_HURTS_CIV[kind]) this.hurtCiv('villain');
    return MISCHIEF_COST;
  }

  /**
   * ボスを市民に仕分けて、素通りのあとボスが暴れた。足した額を返す。
   * 額はステージごと(路地裏¥1,000万、地下駐車場は手下の車をけしかけて¥1,500万、
   * ショッピングモールは母艦の光線でモールを焼いて¥2,000万)
   */
  bossRampage(): number {
    const cost = STAGES[this.stageId].bossRampageCost;
    this.bossSortedCiv = true;
    this.damageByBoss += cost;
    return cost;
  }

  /** ボス戦で手が止まっている間の被害額を足す(BossFight.update が返す damageYen を渡す) */
  addBossDamage(yen: number): void {
    if (yen > 0) this.damageByBoss += yen;
  }

  get damage(): number {
    return this.damageByProps + this.damageByMischief + this.damageByBoss;
  }

  // ─── 待てと行け、逃がした数 ───

  /** 悪さを始めたワルが画面の右から逃げた */
  escaped(): void {
    this.escapedCount++;
  }

  /**
   * 待てで攻撃を止めた。相手が本当は市民なら「待てで守った市民」に数える。
   * 本物のワルなら、倒さずに見のがしたので「逃がした」にも数える
   */
  stopped(truth: Truth): void {
    if (truth === 'civ') this.civSavedByStop++;
    else if (truth === 'bad') {
      this.badSparedByStop++;
      this.escapedCount++;
    }
  }

  // ─── 仕分けの答え合わせ ───

  /** 波の仕分けの当たり外れを残す(tallySorts の答え)。同じ波をもう一度渡したら置きかえる */
  recordSorts(tally: SortTally): void {
    this.sortWaves.set(tally.wave, { ...tally });
  }

  /** その波の答え合わせが済んでいるか */
  hasSorts(wave: number): boolean {
    return this.sortWaves.has(wave);
  }

  // ─── いちばんひどかった場面 ───

  /**
   * 今の瞬間がどの段階の場面かを伝える。今までよりひどければ true を返すので、そのとき画面を撮る。
   * 同じ段階なら最初の1枚を残す(false)。attack はその場面を起こした技(説明の文を変えるのに使う)。
   */
  reportScene(scene: WorstScene, attack: AttackKind | null = null): boolean {
    if (this.worst !== null && WORST_SCENE_RANK[scene] >= WORST_SCENE_RANK[this.worst]) return false;
    this.worst = scene;
    this.worstAttack = attack;
    return true;
  }

  get worstScene(): WorstScene | null {
    return this.worst;
  }

  // ─── まとめ ───

  get defeated(): number {
    return this.defeatedBySort + this.defeatedByGo + this.defeatedByWipe + this.defeatedByVan + (this.bossDefeated ? 1 : 0);
  }

  get civHurt(): number {
    return this.hurt.hero + this.hurt.collateral + this.hurt.villain + this.hurt.abducted;
  }

  /** 今の数字をまとめて返す(あとで変えても、返したものは変わらない) */
  snapshot(): StageStats {
    const defeated = this.defeated;
    const waves = [...this.sortWaves.values()].sort((a, b) => a.wave - b.wave).map((t) => ({ ...t }));
    const sum = (k: 'correct' | 'total' | 'byHero' | 'byHeroCorrect'): number => waves.reduce((n, t) => n + t[k], 0);
    return {
      stageId: this.stageId,
      defeated,
      defeatedBySort: this.defeatedBySort,
      defeatedByGo: this.defeatedByGo,
      defeatedByUfo: this.defeatedByUfo,
      ufosDowned: this.ufosDowned,
      escapedByUfo: this.escapedByUfo,
      defeatedByWipe: this.defeatedByWipe,
      defeatedByVan: this.defeatedByVan,
      groupsWiped: this.groupsWiped,
      groupsEscaped: this.groupsEscaped,
      escapedByVan: this.escapedByVan,
      vansStopped: this.vansStopped,
      bossDefeated: this.bossDefeated,
      civHurt: this.civHurt,
      civHurtByHero: this.hurt.hero,
      civHurtByCollateral: this.hurt.collateral,
      civHurtByVillain: this.hurt.villain,
      civHurtByAbduction: this.hurt.abducted,
      damage: this.damage,
      damageByProps: this.damageByProps,
      damageByMischief: this.damageByMischief,
      damageByBoss: this.damageByBoss,
      propsBroken: { ...this.propsBroken },
      escaped: this.escapedCount,
      civSavedByStop: this.civSavedByStop,
      badSparedByStop: this.badSparedByStop,
      grannyHit: this.grannyHit,
      bossSortedCiv: this.bossSortedCiv,
      bossFightSec: this.bossFightSec,
      villainTotal: this.villainTotal,
      allDefeated: this.villainTotal > 0 && defeated >= this.villainTotal,
      worstScene: this.worst,
      worstAttack: this.worstAttack,
      sortCorrect: sum('correct'),
      sortTotal: sum('total'),
      sortByHero: sum('byHero'),
      sortByHeroCorrect: sum('byHeroCorrect'),
      sortWaves: waves,
      rush: this.rushTally
    };
  }
}

/** 物が壊れた瞬間がひどい場面になるか(車や自販機、ワゴン、柱、噴水、エスカレーターなら 'bigPropBroken') */
export function sceneForProp(kind: PropKind): WorstScene | null {
  return isBigProp(kind) ? 'bigPropBroken' : null;
}
