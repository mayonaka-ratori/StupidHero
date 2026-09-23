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

import { isBigProp, MISCHIEF_COST, MISCHIEF_HURTS_CIV, MISCHIEF_BY_LOOK, PROP_COST } from './rules';
import { STAGES } from './stages';
import type { AttackKind, HurtCause, Look, PropKind, StageId, StageStats, Truth, WorstScene } from './types';

/** いちばんひどかった場面の段階。数が小さいほどひどい(SPECの1〜5) */
export const WORST_SCENE_RANK: Readonly<Record<WorstScene, number>> = {
  grannyHit: 1,
  specialOnCiv: 2,
  civHit: 3,
  bigPropBroken: 4,
  bossDefeated: 5
};

/** 市民に攻撃が当たった瞬間は、どの段階の場面か */
export function sceneForCivHit(look: Look, attack?: AttackKind): WorstScene {
  if (look === 'granny') return 'grannyHit';
  if (attack === 'special') return 'specialOnCiv';
  return 'civHit';
}

export class StatsTracker {
  private defeatedBySort = 0;
  private defeatedByGo = 0;
  private defeatedByWipe = 0;
  private defeatedByVan = 0;
  private groupsWiped = 0;
  private groupsEscaped = 0;
  private escapedByVan = 0;
  private vansStopped = 0;
  private bossDefeated = false;
  private hurt: Record<HurtCause, number> = { hero: 0, collateral: 0, villain: 0 };
  private damageByProps = 0;
  private damageByMischief = 0;
  private damageByBoss = 0;
  private propsBroken: Record<PropKind, number> = {
    trash: 0, window: 0, sign: 0, vending: 0, car: 0,
    van: 0, bosscar: 0, pillar: 0, barrier: 0, cone: 0, extinguisher: 0
  };
  private escapedCount = 0;
  private civSavedByStop = 0;
  private badSparedByStop = 0;
  private grannyHit = false;
  private bossSortedCiv = false;
  private bossFightSec: number | null = null;
  private worst: WorstScene | null = null;
  private worstAttack: AttackKind | null = null;

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
    this.groupsWiped++;
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
    this.groupsEscaped++;
  }

  /** ボスを倒した。seconds はボス戦にかかった秒数(BossFight.seconds) */
  defeatBoss(seconds: number): void {
    this.bossDefeated = true;
    this.bossFightSec = seconds;
  }

  // ─── 市民負傷 ───

  /**
   * 市民がけがをした。
   * cause:'hero' はヒーローが殴った、'collateral' は巻きぞえ、'villain' はワルに襲われた。
   * look はけがをした市民の見た目(おばあさんかどうかを見る)。ヒーローの攻撃(殴った、巻きぞえ)で
   * おばあさんに当たったら「おばあさんを殴った」になる。
   */
  hurtCiv(cause: HurtCause, look?: Look): void {
    this.hurt[cause]++;
    if (look === 'granny' && cause !== 'villain') this.grannyHit = true;
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
    // ギャングの口笛は悪さではない(被害額も市民負傷も増えない)
    if (kind === 'whistle') return 0;
    this.damageByMischief += MISCHIEF_COST;
    if (kind && MISCHIEF_HURTS_CIV[kind]) this.hurtCiv('villain');
    return MISCHIEF_COST;
  }

  /**
   * ボスを市民に仕分けて、素通りのあとボスが暴れた。足した額を返す。
   * 額はステージごと(路地裏¥1,000万、地下駐車場は手下の車をけしかけて¥1,500万)
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
    return this.hurt.hero + this.hurt.collateral + this.hurt.villain;
  }

  /** 今の数字をまとめて返す(あとで変えても、返したものは変わらない) */
  snapshot(): StageStats {
    const defeated = this.defeated;
    return {
      stageId: this.stageId,
      defeated,
      defeatedBySort: this.defeatedBySort,
      defeatedByGo: this.defeatedByGo,
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
      worstAttack: this.worstAttack
    };
  }
}

/** 物が壊れた瞬間がひどい場面になるか(車や自販機、ワゴン、柱なら 'bigPropBroken') */
export function sceneForProp(kind: PropKind): WorstScene | null {
  return isBigProp(kind) ? 'bigPropBroken' : null;
}
