// 1ステージの数字を数える。SPECの「数字の数え方」の通り。
// 画面の担当は、結果発表の出来事が起きるたびにここのメソッドを呼び、最後に snapshot() で数字を受け取る。

import { BOSS_RAMPAGE_COST, isBigProp, MISCHIEF_COST, MISCHIEF_HURTS_CIV, MISCHIEF_BY_LOOK, PROP_COST } from './rules';
import type { AttackKind, HurtCause, Look, PropKind, StageStats, Truth, WorstScene } from './types';

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
  private bossDefeated = false;
  private hurt: Record<HurtCause, number> = { hero: 0, collateral: 0, villain: 0 };
  private damageByProps = 0;
  private damageByMischief = 0;
  private damageByBoss = 0;
  private propsBroken: Record<PropKind, number> = { trash: 0, window: 0, sign: 0, vending: 0, car: 0 };
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
   */
  constructor(readonly villainTotal: number) {}

  // ─── 撃破 ───

  /** ワルを倒した。how:'sort' は仕分けで殴った、'go' は行けで追い打ちした */
  defeatBad(how: 'sort' | 'go'): void {
    if (how === 'go') this.defeatedByGo++;
    else this.defeatedBySort++;
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
    this.damageByMischief += MISCHIEF_COST;
    const kind = MISCHIEF_BY_LOOK[look];
    if (kind && MISCHIEF_HURTS_CIV[kind]) this.hurtCiv('villain');
    return MISCHIEF_COST;
  }

  /** ボスを市民に仕分けて、素通りのあとボスが暴れた。¥1,000万を足す。足した額を返す */
  bossRampage(): number {
    this.bossSortedCiv = true;
    this.damageByBoss += BOSS_RAMPAGE_COST;
    return BOSS_RAMPAGE_COST;
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
    return this.defeatedBySort + this.defeatedByGo + (this.bossDefeated ? 1 : 0);
  }

  get civHurt(): number {
    return this.hurt.hero + this.hurt.collateral + this.hurt.villain;
  }

  /** 今の数字をまとめて返す(あとで変えても、返したものは変わらない) */
  snapshot(): StageStats {
    const defeated = this.defeated;
    return {
      defeated,
      defeatedBySort: this.defeatedBySort,
      defeatedByGo: this.defeatedByGo,
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

/** 物が壊れた瞬間がひどい場面になるか(車や自販機なら 'bigPropBroken') */
export function sceneForProp(kind: PropKind): WorstScene | null {
  return isBigProp(kind) ? 'bigPropBroken' : null;
}
