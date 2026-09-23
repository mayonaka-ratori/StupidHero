// ボス戦(行けボタンの連打)の計算。時計は外から進める(update に経った時間を渡す)ので、テストしやすい。
//
// 決まり(SPEC「ボス戦」):
// - 体力は連打40回分。1秒に10回を超えた分は数えない(直前1秒の間に数えた回数で判定)
// - 手が止まっている間は、1秒ごとに被害額¥50万(止まったとみなすのは最後の連打から0.6秒後)
// - 体力は時間でも減り、どんなに遅くても15秒で倒せる。
//   時間で減る量は 体力 ×(経った秒数 ÷ 15)の2乗。始めはほとんど減らず、終わりに近づくほど速く減る。
//   こうすると、押した分がはっきり効いて見え、それでも15秒ちょうどで必ず終わる
//
// ステージ2の女ボス(STAGE2「ボス戦」):
// - 体力が半分を切ると高級車に飛び乗る(tap/update の結果の boardedCar が true になる。inCar で今の状態)
// - 車に乗ったあと、手が止まっている間は1秒ごとに¥100万(乗る前は¥50万)
// - 設定は STAGES[stageId].bossFight に入っている。new BossFight(stage.def.bossFight)
//
// 使い方:
//   const fight = new BossFight(stage.def.bossFight);
//   // 行けボタンが押されるたび
//   fight.tap();
//   // 毎フレーム
//   const r = fight.update(deltaMs);
//   if (r.damageYen > 0) stats.addBossDamage(r.damageYen);
//   if (r.boardedCar) { /* 女ボスが車に飛び乗る(boss2.jump)。tap() の結果にも boardedCar がある */ }
//   if (r.defeated) stats.defeatBoss(fight.seconds!);

import { BOSS } from './rules';

export interface BossFightOptions {
  /** 体力(連打の回数)。既定 40 */
  hpTaps?: number;
  /** 1秒に数える連打の上限。既定 10 */
  maxTapsPerSec?: number;
  /** 何秒で必ず倒せるか。既定 15。Infinity にすると時間では減らない */
  maxSec?: number;
  /** 手が止まったとみなすまでの秒数。既定 0.6 */
  idleAfterSec?: number;
  /** 手が止まっている間、1秒ごとに増える被害額。既定 ¥50万 */
  idleCostPerSec?: number;
  /** ステージ2:体力の割合がこれを下回ると車に乗る(0.5)。省略すると車には乗らない */
  carAtHpRatio?: number;
  /** ステージ2:車に乗ったあと、手が止まっている間に1秒ごとに増える被害額(¥100万)。省略すると idleCostPerSec と同じ */
  carIdleCostPerSec?: number;
}

export interface BossTapResult {
  /** 体力を減らす連打として数えたか(1秒に10回を超えた分は false) */
  counted: boolean;
  /** この連打でボスを倒したか */
  defeated: boolean;
  /** この連打で体力が半分を切り、ボスが車に乗ったか(ステージ2) */
  boardedCar: boolean;
}

export interface BossUpdateResult {
  /** この update の間に増えた被害額(手が止まっていた分)。StatsTracker.addBossDamage に渡す */
  damageYen: number;
  /** この update の間に¥50万が何回足されたか(画面に「¥50万」を飛ばす回数) */
  idleTicks: number;
  /** この update の間にボスを倒したか */
  defeated: boolean;
  /** この update の間に、体力が半分を切ってボスが車に乗ったか(ステージ2) */
  boardedCar: boolean;
}

export class BossFight {
  readonly maxHp: number;
  private readonly maxTapsPerSec: number;
  private readonly maxSec: number;
  private readonly idleAfterSec: number;
  private readonly idleCostPerSec: number;
  private readonly carAtHpRatio: number | null;
  private readonly carIdleCostPerSec: number;

  /** ボス戦の時計(秒) */
  private t = 0;
  private counted = 0;
  /** 直前1秒の間に数えた連打の時刻 */
  private recent: number[] = [];
  private lastTapAt = 0;
  /** まだ被害額にしていない、手が止まっていた秒数 */
  private idleCarry = 0;
  private damage = 0;
  private endedAt: number | null = null;
  /** 車に乗った時刻(乗っていなければ null) */
  private carAt: number | null = null;

  constructor(opts: BossFightOptions = {}) {
    this.maxHp = opts.hpTaps ?? BOSS.hpTaps;
    this.maxTapsPerSec = opts.maxTapsPerSec ?? BOSS.maxTapsPerSec;
    this.maxSec = opts.maxSec ?? BOSS.maxSec;
    this.idleAfterSec = opts.idleAfterSec ?? BOSS.idleAfterSec;
    this.idleCostPerSec = opts.idleCostPerSec ?? BOSS.idleCostPerSec;
    this.carAtHpRatio = opts.carAtHpRatio ?? null;
    this.carIdleCostPerSec = opts.carIdleCostPerSec ?? this.idleCostPerSec;
  }

  /** 時間で減った体力(連打の回数に換算) */
  private passiveAt(t: number): number {
    if (!Number.isFinite(this.maxSec)) return 0;
    const r = Math.min(1, t / this.maxSec);
    return this.maxHp * r * r;
  }

  /** 連打の回数 counted のまま、体力が maxHp × ratio まで減る時刻 */
  private timeWhenHp(counted: number, ratio: number): number {
    if (!Number.isFinite(this.maxSec)) return Infinity;
    const left = Math.max(0, this.maxHp * (1 - ratio) - counted);
    return this.maxSec * Math.sqrt(left / this.maxHp);
  }

  /** 連打の回数 counted のまま、体力が0になる時刻 */
  private defeatTimeFor(counted: number): number {
    return this.timeWhenHp(counted, 0);
  }

  /** 体力が車に乗る境目を切っていれば、車に乗せる。乗せたら true */
  private checkCar(at: number): boolean {
    if (this.carAtHpRatio === null || this.carAt !== null) return false;
    if (this.hp >= this.maxHp * this.carAtHpRatio) return false;
    this.carAt = at;
    return true;
  }

  /** 行けボタンが押された(指が触れた瞬間に呼ぶ)。時刻はボス戦の時計を使う */
  tap(): BossTapResult {
    if (this.isOver) return { counted: false, defeated: false, boardedCar: false };
    // 数えなかった連打でも「手は動いている」ので暴れは止まる
    this.lastTapAt = this.t;
    this.recent = this.recent.filter((at) => at > this.t - 1);
    if (this.recent.length >= this.maxTapsPerSec) return { counted: false, defeated: false, boardedCar: false };
    this.recent.push(this.t);
    this.counted++;
    const boardedCar = this.checkCar(this.t);
    if (this.hp <= 0) {
      this.endedAt = this.t;
      return { counted: true, defeated: true, boardedCar };
    }
    return { counted: true, defeated: false, boardedCar };
  }

  /** 時計を進める。deltaMs はミリ秒(Phaser の update の delta をそのまま渡せる) */
  update(deltaMs: number): BossUpdateResult {
    if (this.isOver || deltaMs <= 0) return { damageYen: 0, idleTicks: 0, defeated: false, boardedCar: false };
    const from = this.t;
    let to = from + deltaMs / 1000;
    const tDefeat = this.defeatTimeFor(this.counted);
    let defeated = false;
    if (tDefeat <= to) {
      to = Math.max(from, tDefeat);
      defeated = true;
    }
    // 車に乗る時刻(ステージ2)。この update の中で乗るなら、その前と後で被害額の速さを変える
    let boardedCar = false;
    let carAt = this.carAt;
    if (this.carAtHpRatio !== null && carAt === null) {
      const tCar = Math.max(from, this.timeWhenHp(this.counted, this.carAtHpRatio));
      if (tCar <= to) {
        carAt = tCar;
        boardedCar = true;
      }
    }
    // 手が止まっていた時間(最後の連打から idleAfterSec たってから)。1秒たまるごとに1回、その時点の額を足す
    const idleStart = Math.max(from, this.lastTapAt + this.idleAfterSec);
    let idleTicks = 0;
    let damageYen = 0;
    if (to > idleStart) {
      let at = idleStart;
      let carry = this.idleCarry + (to - idleStart);
      // 次に1秒たまる時刻を順に進める
      while (carry >= 1 - 1e-9) {
        const need = 1 - this.idleCarry;
        at += need;
        this.idleCarry = 0;
        carry -= 1;
        idleTicks++;
        const inCarNow = carAt !== null && at >= carAt - 1e-9;
        damageYen += inCarNow ? this.carIdleCostPerSec : this.idleCostPerSec;
      }
      this.idleCarry = carry;
    }
    this.damage += damageYen;
    this.t = to;
    if (boardedCar) this.carAt = carAt;
    if (defeated) this.endedAt = to;
    return { damageYen, idleTicks, defeated, boardedCar };
  }

  /** 残りの体力(0〜maxHp。小数になる) */
  get hp(): number {
    return Math.max(0, this.maxHp - this.counted - this.passiveAt(this.t));
  }

  /** 残りの体力の割合(1〜0)。体力のバーに使う */
  get hpRatio(): number {
    return this.hp / this.maxHp;
  }

  /** ボス戦が始まってからの秒数 */
  get elapsedSec(): number {
    return this.t;
  }

  /** 倒したか */
  get isOver(): boolean {
    return this.endedAt !== null;
  }

  /** ボス戦にかかった秒数。まだ終わっていなければ null */
  get seconds(): number | null {
    return this.endedAt;
  }

  /** 今、手が止まっているとみなしているか(ボスが暴れる動きを出す) */
  get isIdle(): boolean {
    return !this.isOver && this.t - this.lastTapAt >= this.idleAfterSec;
  }

  /** ボス戦で増えた被害額の合計 */
  get damageYen(): number {
    return this.damage;
  }

  /** 女ボスが車に乗っているか(ステージ2。車に乗らないボスはいつも false) */
  get inCar(): boolean {
    return this.carAt !== null;
  }

  /** 車に乗った時刻(ボス戦の時計の秒)。乗っていなければ null */
  get carBoardedAt(): number | null {
    return this.carAt;
  }

  /** 数えた連打の回数 */
  get tapsCounted(): number {
    return this.counted;
  }

  /** 直前1秒に数えた連打の回数(0〜10)。ヒーローのラッシュの速さに使う */
  get tapsPerSec(): number {
    return this.recent.filter((at) => at > this.t - 1).length;
  }
}
