// ゲームのルールと数字の表。SPECにある数字はそのまま、SPECにない数字はここで決めて理由を書く。
// 画面の担当は、数字を自分で書かずにここから読む。

import type { Rng } from './rng';
import type {
  AttackKind, Encounter, Look, MischiefKind, PropKind, SortChoice, Truth, WaveNo
} from './types';

// ─── 仕分け ───────────────────────────────────────

export interface WavePlan {
  no: WaveNo;
  /** 出てくる人数(ボスは含まない) */
  people: number;
  /** 制限時間(秒) */
  seconds: number;
  /** 一目でワルと分かるモヒカンを必ず1人入れるか */
  mohawk: boolean;
  /** ボスが紛れているか */
  boss: boolean;
}

/** 波の表(SPEC「仕分け」) */
export const WAVES: readonly WavePlan[] = [
  { no: 1, people: 5, seconds: 20, mohawk: true, boss: false },
  { no: 2, people: 5, seconds: 15, mohawk: false, boss: false },
  { no: 3, people: 5, seconds: 16, mohawk: false, boss: true }
];

/** 1つの波のワルの数(ボスは含まない) */
export const BAD_PER_WAVE = { min: 2, max: 3 } as const;

/** 残り何秒で画面の端を赤く点滅させるか */
export const HURRY_AT_SEC = 5;

/** 時間切れで仕分けていない人を、ヒーローがワルにする確率(半々) */
export const TIMEOUT_BAD_CHANCE = 0.5;

/** 時間切れの人の仕分けを、ヒーローが気まぐれで決める */
export function decideUnsorted(rng: Rng): SortChoice {
  return rng.chance(TIMEOUT_BAD_CHANCE) ? 'bad' : 'civ';
}

// ─── 結果発表 ─────────────────────────────────────

/** 仕分けと正体から、ヒーローがその人の前で何をするかを決める */
export function resolveEncounter(truth: Truth, choice: SortChoice): Encounter {
  if (truth === 'boss') return choice === 'bad' ? 'bossFight' : 'bossRampage';
  if (truth === 'bad') return choice === 'bad' ? 'hitBad' : 'passBad';
  return choice === 'bad' ? 'hitCiv' : 'passCiv';
}

/** ヒーローが殴りに行く相手か(マークを出す相手)。マークからは正体が分からないよう、ボスにも出す */
export function isAttacked(e: Encounter): boolean {
  return e === 'hitBad' || e === 'hitCiv' || e === 'bossFight';
}

/** 待てで止められるか。ボスには待ては効かない */
export function canStop(e: Encounter): boolean {
  return e === 'hitBad' || e === 'hitCiv';
}

/** 待て/行けのマークの決まり(SPEC「待て と 行け」) */
export const MARK = {
  /** ヒーローが相手の何ドット手前に来たらマークを出すか */
  showDistance: 48,
  /** マークが出ている間の動きの速さ(ゆっくりにする) */
  slowmo: 0.6,
  /** マークが出てから殴るまでのおおよその秒数(ゆっくりの時間を含む)。画面の歩く速さはこれに合わせる */
  windowSec: 1.5,
  /** 悪さを始めたワルが、行けを押されなければ画面の右から逃げるまでの秒数 */
  escapeSec: 3
} as const;

/**
 * マークが2人に出ているときの対象を決める。ヒーローに近い方(x が小さい方ではなく、距離が近い方)。
 * 候補がなければ null(押しても何も起きない)。
 */
export function pickMarkTarget<T extends { x: number }>(candidates: readonly T[], heroX: number): T | null {
  let best: T | null = null;
  for (const c of candidates) {
    if (!best || Math.abs(c.x - heroX) < Math.abs(best.x - heroX)) best = c;
  }
  return best;
}

// ─── ワルの悪さ ───────────────────────────────────

/** 見た目ごとの悪さ(docs/ART_SPEC.md の表) */
export const MISCHIEF_BY_LOOK: Readonly<Partial<Record<Look, MischiefKind>>> = {
  hoodie: 'shove',
  suit: 'snatch',
  shopper: 'pickpocket',
  mohawk: 'threaten'
};

/**
 * 悪さで市民がけがをするか(市民負傷に数えるか)。
 * 突き飛ばしとひったくりは体に手を出すので数える。財布を抜くのと、ナイフで脅すだけのものは数えない
 * (被害額の¥20万だけ)。こうしておくと、見逃しが多いだけで「市民の天敵」になりにくい。
 */
export const MISCHIEF_HURTS_CIV: Readonly<Record<MischiefKind, boolean>> = {
  shove: true,
  snatch: true,
  pickpocket: false,
  threaten: false
};

// ─── お金 ─────────────────────────────────────────

/** 壊れる物ごとの被害額(円) */
export const PROP_COST: Readonly<Record<PropKind, number>> = {
  trash: 30_000,
  window: 80_000,
  sign: 150_000,
  vending: 800_000,
  car: 3_000_000
};

/** 「車や自販機が壊れた瞬間」に数える大きな物 */
export const BIG_PROPS: readonly PropKind[] = ['vending', 'car'];
export const isBigProp = (p: PropKind): boolean => BIG_PROPS.includes(p);

/** ワルの悪さ1回の被害額 */
export const MISCHIEF_COST = 200_000;
/** ボスを市民に仕分けたときの暴れの被害額(暴れている間に壊れた物もこれに含む。別に足さない) */
export const BOSS_RAMPAGE_COST = 10_000_000;

// ─── 攻撃 ─────────────────────────────────────────

/**
 * 攻撃ごとの数字。
 * 距離 dx は「ヒーローが殴る相手の x から、ヒーローの進む向き(右)に何ドット先か」。
 * 相手より手前(ヒーロー側)は負の数。
 */
export interface AttackDef {
  kind: AttackKind;
  /** 画面に出す名前 */
  name: string;
  /** 選ばれる重み(合計100) */
  weight: number;
  /** 巻きぞえが届く範囲(dx の下限と上限、両端を含む)。相手自身(dx=0)の市民は巻きぞえに数えない */
  reach: { from: number; to: number };
  /** 範囲にいる市民1人に当たる確率 */
  civHitChance: number;
  /** 範囲にある物が壊れる確率 */
  propBreakChance: Readonly<Record<PropKind, number>>;
  /** 物は範囲の中の「いちばん近い1つ」だけに当たるか(光のパンチの拳は物に当たると止まる) */
  firstPropOnly: boolean;
}

/*
 * 数字の決め方:
 * - 画面の横幅は216ドット。人はだいたい60〜80ドットおきに立つ前提
 * - 光の突撃:SPECでは市民への巻きぞえはない。通り道(マークが出る48ドット手前 + 助走8ドット = 56ドット手前から、
 *   相手の少し先まで)の物を壊す。体当たりなので軽い物ほど壊れやすい
 * - 光のパンチ:拳は相手を突き抜けて画面の端まで飛ぶ。人は通り抜けるが、35%で当たる(3回に1回くらい
 *   「あっ」となる程度)。物には必ず当たって止まるので、いちばん近い1つだけ。車は丈夫なので60%
 * - 踏みつぶし:衝撃波は左右40ドット(隣の人に届くか届かないか)。近いぶん当たりやすく50%
 * - 必殺技:5%しか出ないので、出たらはっきり大惨事にする。画面の端まで、物は全部壊れ、市民には80%
 */
export const ATTACKS: Readonly<Record<AttackKind, AttackDef>> = {
  charge: {
    kind: 'charge', name: '光の突撃', weight: 30,
    reach: { from: -56, to: 8 },
    civHitChance: 0,
    propBreakChance: { trash: 1, window: 0.6, sign: 0.6, vending: 0.5, car: 0.3 },
    firstPropOnly: false
  },
  punch: {
    kind: 'punch', name: '光のパンチ', weight: 35,
    reach: { from: 1, to: 216 },
    civHitChance: 0.35,
    propBreakChance: { trash: 1, window: 1, sign: 1, vending: 0.8, car: 0.6 },
    firstPropOnly: true
  },
  stomp: {
    kind: 'stomp', name: '踏みつぶし', weight: 30,
    reach: { from: -40, to: 40 },
    civHitChance: 0.5,
    propBreakChance: { trash: 1, window: 0.7, sign: 0.5, vending: 0.6, car: 0.4 },
    firstPropOnly: false
  },
  special: {
    kind: 'special', name: '必殺技', weight: 5,
    reach: { from: 1, to: 216 },
    civHitChance: 0.8,
    propBreakChance: { trash: 1, window: 1, sign: 1, vending: 1, car: 1 },
    firstPropOnly: false
  }
};

export const ATTACK_KINDS: readonly AttackKind[] = ['charge', 'punch', 'stomp', 'special'];

/** 殴るたびに攻撃を選ぶ(光の突撃30%、光のパンチ35%、踏みつぶし30%、必殺技5%) */
export function pickAttack(rng: Rng): AttackKind {
  return rng.weighted({
    charge: ATTACKS.charge.weight,
    punch: ATTACKS.punch.weight,
    stomp: ATTACKS.stomp.weight,
    special: ATTACKS.special.weight
  });
}

/** dx が攻撃の届く範囲に入っているか */
export function inReach(kind: AttackKind, dx: number): boolean {
  const { from, to } = ATTACKS[kind].reach;
  return dx >= from && dx <= to;
}

/** dx ドット先にいる市民に、この攻撃が当たる確率(0〜1)。殴る相手自身(dx=0)は0 */
export function civHitChanceAt(kind: AttackKind, dx: number): number {
  if (dx === 0 || !inReach(kind, dx)) return 0;
  return ATTACKS[kind].civHitChance;
}

/** dx ドット先にある物が、この攻撃で壊れる確率(0〜1)。光のパンチは「いちばん近い物」だけに聞くこと */
export function propBreakChanceAt(kind: AttackKind, prop: PropKind, dx: number): number {
  if (!inReach(kind, dx)) return 0;
  return ATTACKS[kind].propBreakChance[prop];
}

/** 巻きぞえの判定(当たれば true) */
export function rollCivHit(kind: AttackKind, dx: number, rng: Rng): boolean {
  const p = civHitChanceAt(kind, dx);
  return p > 0 && rng.chance(p);
}

/** 物が壊れるかの判定(壊れれば true) */
export function rollPropBreak(kind: AttackKind, prop: PropKind, dx: number, rng: Rng): boolean {
  const p = propBreakChanceAt(kind, prop, dx);
  return p > 0 && rng.chance(p);
}

/**
 * ある攻撃で壊れる物をまとめて決める。props は物の一覧(x は画面の座標)、targetX は殴る相手の x。
 * 光のパンチは範囲の中でいちばん近い物1つだけを調べる。返すのは壊れた物の一覧。
 */
export function rollPropsBroken<T extends { kind: PropKind; x: number }>(
  kind: AttackKind, props: readonly T[], targetX: number, rng: Rng
): T[] {
  const inside = props
    .map((p) => ({ p, dx: p.x - targetX }))
    .filter(({ dx }) => inReach(kind, dx))
    .sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx));
  const checked = ATTACKS[kind].firstPropOnly ? inside.slice(0, 1) : inside;
  return checked.filter(({ p, dx }) => rollPropBreak(kind, p.kind, dx, rng)).map(({ p }) => p);
}

// ─── ボス戦 ───────────────────────────────────────

/** ボス戦の数字(SPEC「ボス戦」。止まったとみなすまでの時間だけここで決めた) */
export const BOSS = {
  /** 体力(連打の回数) */
  hpTaps: 40,
  /** 1秒に数える連打の上限 */
  maxTapsPerSec: 10,
  /** 手が止まっている間、1秒ごとに増える被害額 */
  idleCostPerSec: 500_000,
  /** どんなに遅くてもこの秒数で倒せる */
  maxSec: 15,
  /**
   * 最後の連打(またはボス戦の始まり)から何秒たったら「手が止まった」とみなすか。
   * 0.6秒 = 1秒に2回より少し遅いくらい。のんびり押していても暴れないが、指を離すとすぐ暴れる
   */
  idleAfterSec: 0.6
} as const;
