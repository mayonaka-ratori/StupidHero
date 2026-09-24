// ゲームのルールと数字の表。SPECにある数字はそのまま、SPECにない数字はここで決めて理由を書く。
// 画面の担当は、数字を自分で書かずにここから読む。
// ステージごとの違い(波の表、ボスの額など)は stages.ts の STAGES にまとめてある。ここはその部品。
// ステージ2(docs/STAGE2.md)の数字は「ステージ2」、ステージ3(docs/STAGE3.md)の数字は「ステージ3」の見出しの下。

import type { Rng } from './rng';
import type {
  AccessoryColorId, AttackKind, Encounter, GangLook, Look, MischiefKind, PropKind, SortChoice, Truth, WaveNo
} from './types';

/** 物の大きさ(ドット)。絵の担当と画面の担当が、置く場所と当たりを決めるのに使う */
export interface PropSize {
  w: number;
  h: number;
}

// ─── 仕分け ───────────────────────────────────────

/** 1回の波の作り方(ステージごとの表は STAGES[id].waves) */
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
  /** ステージ2だけ:ギャングの組の数 [最小, 最大]。組の人数は GANG.groupSize */
  gangGroups?: readonly [number, number];
  /** ステージ2だけ:組が1つのときの人数を2人に決めるか(波1の練習) */
  gangPairOnly?: boolean;
  /** ステージ3だけ:宇宙人の数 [最小, 最大] */
  aliens?: readonly [number, number];
  /** ステージ3だけ:くずれが早く出る練習用の宇宙人を1人入れるか(波1) */
  practiceAlien?: boolean;
}

/**
 * 波の表(SPEC「仕分け」)。ステージ1。
 * 時間は、プロフィールと一言を読み、「持ち物」の窓も見て決められるように、はじめの版(20、15、18秒)より長くした。
 * 文字送りの間は時計が止まる(Sort.ts)。ゆっくりモードではさらに1.5倍(settings.timeScale)
 */
export const WAVES: readonly WavePlan[] = [
  { no: 1, people: 5, seconds: 30, mohawk: true, boss: false },
  { no: 2, people: 5, seconds: 22, mohawk: false, boss: false },
  { no: 3, people: 5, seconds: 24, mohawk: false, boss: true }
];

/**
 * 波の表(STAGE2「波と人数」)。ステージ2。ワルは全員ギャングの組。
 * 時間はステージ1と同じ理由で、はじめの版(20、18、20秒)より長くした
 */
export const GARAGE_WAVES: readonly WavePlan[] = [
  { no: 1, people: 5, seconds: 30, mohawk: false, boss: false, gangGroups: [1, 1], gangPairOnly: true },
  { no: 2, people: 6, seconds: 26, mohawk: false, boss: false, gangGroups: [1, 2] },
  { no: 3, people: 6, seconds: 28, mohawk: false, boss: true, gangGroups: [1, 2] }
];

/**
 * 波の表(STAGE3「波と人数」)。ステージ3。1つの波の宇宙人は2〜3人。
 * 全員のくずれを待つと時間が足りない長さにしてある(STAGE3「時間の見積もり」。波1だけは全員待てる)
 */
export const MALL_WAVES: readonly WavePlan[] = [
  { no: 1, people: 5, seconds: 30, mohawk: false, boss: false, aliens: [2, 3], practiceAlien: true },
  { no: 2, people: 6, seconds: 28, mohawk: false, boss: false, aliens: [2, 3] },
  { no: 3, people: 6, seconds: 30, mohawk: false, boss: true, aliens: [2, 3] }
];

/** 1つの波のワルの数(ボスは含まない。ステージ1) */
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

/** 待て/行けのマークの決まり(SPEC「待てと行け」) */
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
  mohawk: 'threaten',
  // ステージ2のギャングは悪さの代わりに口笛で仲間を呼ぶ
  guard: 'whistle',
  mechanic: 'whistle',
  clubber: 'whistle',
  officelady: 'whistle',
  // ステージ3の宇宙人は悪さの代わりに空へ合図を送ってUFOを呼ぶ
  mascot: 'signal',
  clerk: 'signal',
  dancer: 'signal',
  uncle: 'signal'
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
  threaten: false,
  whistle: false,
  signal: false
};

// ─── お金 ─────────────────────────────────────────

/**
 * 壊れる物ごとの被害額(円)。上の5つはSPECの表。下の6つ(ステージ2)の決め方:
 * - van(ギャングのワゴン)¥500万:STAGE2の通り。止めてある車(¥300万)より大きい
 * - bosscar(女ボスの高級車)¥2,000万:高級車なのでワゴンの4倍。ただしボス戦で倒したときの爆発は数えない
 *   (毎回かならず壊れるので、数えるとステージ2で「完全無欠(¥500万未満)」が取れなくなる)。
 *   ボス戦で車が暴れた分は BossFight の「1秒¥100万」で数える
 * - pillar(柱)¥200万:建物を支える柱は直すのが大がかり。車よりは安く、自販機より高い
 * - barrier(料金所のバー)¥30万:機械ごと壊れる。看板(¥15万)の倍
 * - cone(三角コーン)¥1万:いちばん安い。数が多く、よく壊れるので小さい額が何度も飛ぶ
 * - extinguisher(消火器の箱)¥5万:ゴミ箱と窓の間
 * ステージ3(STAGE3「店が壊れる」の表):ガチャガチャ¥5万、マネキン¥10万、ショーケース¥30万、噴水¥150万、エスカレーター¥800万。
 * - ufo(UFO)¥300万:STAGE3の通り。行けで殴り落としたとき(stats.ufoDowned)に足す
 * - mothership(母艦)¥1億:ボス戦だけに出る。倒したときの爆発は数えない(高級車と同じ理由)。
 *   倒したときは噴水に落ちるので、噴水の¥150万を足す(STAGES.mall.bossDefeatProp)
 */
export const PROP_COST: Readonly<Record<PropKind, number>> = {
  trash: 30_000,
  window: 80_000,
  sign: 150_000,
  vending: 800_000,
  car: 3_000_000,
  van: 5_000_000,
  bosscar: 20_000_000,
  pillar: 2_000_000,
  barrier: 300_000,
  cone: 10_000,
  extinguisher: 50_000,
  gacha: 50_000,
  mannequin: 100_000,
  showcase: 300_000,
  fountain: 1_500_000,
  escalator: 8_000_000,
  ufo: 3_000_000,
  mothership: 100_000_000
};

/**
 * 「車や自販機が壊れた瞬間」に数える大きな物(柱は車より少し安いが、見た目が大きいので入れる)。
 * ステージ3は噴水とエスカレーター(「モールがこわれた!」)。落ちたUFOは店の物ではないので入れない
 */
export const BIG_PROPS: readonly PropKind[] = ['vending', 'car', 'van', 'bosscar', 'pillar', 'fountain', 'escalator'];
export const isBigProp = (p: PropKind): boolean => BIG_PROPS.includes(p);

/** ワルの悪さ1回の被害額 */
export const MISCHIEF_COST = 200_000;
/**
 * ボスを市民に仕分けたときの暴れの被害額(暴れている間に壊れた物もこれに含む。別に足さない)。
 * ステージ1の額。ステージごとの額は STAGES[id].bossRampageCost(ステージ2は¥1,500万)
 */
export const BOSS_RAMPAGE_COST = 10_000_000;
/** ステージ2:女ボスを市民に仕分けたとき、手下の車をけしかける被害額 */
export const BOSS2_RAMPAGE_COST = 15_000_000;
/** ステージ3:親玉を市民に仕分けたとき、正体を現したあと母艦の光線でモールを焼く被害額 */
export const BOSS3_RAMPAGE_COST = 20_000_000;

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
 * ステージ2の物:
 * - ワゴンと高級車は仕掛け(逃げる車、ボス戦の車)に使うので、ふつうの攻撃では壊れない(0)。
 *   ワゴンは行けで止めたときだけ、高級車はボス戦の中だけで壊れる
 * - 柱は丈夫なので低め、コーンと消火器の箱は軽いのでほぼ壊れる、料金所のバーはその間
 * ステージ3の物:
 * - ガチャガチャは軽いのでゴミ箱と同じ、マネキンは看板くらい、ショーケースはガラスなので窓と同じ
 * - 噴水は石なので柱くらい、エスカレーターはいちばん丈夫で低め(壊れると¥800万なので、めったに壊れない)
 * - UFOと母艦は仕掛け(行けで落とす、ボス戦)に使うので、ふつうの攻撃では壊れない(0)
 */
export const ATTACKS: Readonly<Record<AttackKind, AttackDef>> = {
  charge: {
    kind: 'charge', name: '光の突撃', weight: 30,
    reach: { from: -56, to: 8 },
    civHitChance: 0,
    propBreakChance: {
      trash: 1, window: 0.6, sign: 0.6, vending: 0.5, car: 0.3,
      van: 0, bosscar: 0, pillar: 0.3, barrier: 0.7, cone: 1, extinguisher: 1,
      gacha: 1, mannequin: 0.6, showcase: 0.6, fountain: 0.3, escalator: 0.2, ufo: 0, mothership: 0
    },
    firstPropOnly: false
  },
  punch: {
    kind: 'punch', name: '光のパンチ', weight: 35,
    reach: { from: 1, to: 216 },
    civHitChance: 0.35,
    propBreakChance: {
      trash: 1, window: 1, sign: 1, vending: 0.8, car: 0.6,
      van: 0, bosscar: 0, pillar: 0.5, barrier: 1, cone: 1, extinguisher: 1,
      gacha: 1, mannequin: 1, showcase: 1, fountain: 0.5, escalator: 0.3, ufo: 0, mothership: 0
    },
    firstPropOnly: true
  },
  stomp: {
    kind: 'stomp', name: '踏みつぶし', weight: 30,
    reach: { from: -40, to: 40 },
    civHitChance: 0.5,
    propBreakChance: {
      trash: 1, window: 0.7, sign: 0.5, vending: 0.6, car: 0.4,
      van: 0, bosscar: 0, pillar: 0.3, barrier: 0.6, cone: 1, extinguisher: 0.8,
      gacha: 1, mannequin: 0.5, showcase: 0.7, fountain: 0.3, escalator: 0.2, ufo: 0, mothership: 0
    },
    firstPropOnly: false
  },
  special: {
    kind: 'special', name: '必殺技', weight: 5,
    reach: { from: 1, to: 216 },
    civHitChance: 0.8,
    propBreakChance: {
      trash: 1, window: 1, sign: 1, vending: 1, car: 1,
      van: 0, bosscar: 0, pillar: 1, barrier: 1, cone: 1, extinguisher: 1,
      gacha: 1, mannequin: 1, showcase: 1, fountain: 1, escalator: 1, ufo: 0, mothership: 0
    },
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

/**
 * ステージ2の女ボス(STAGE2「ボス戦」)。体力、最長の秒数、止まったとみなす時間はステージ1と同じ。
 * 体力が半分を切ると高級車に飛び乗り、そのあと手が止まっている間は1秒ごとに¥100万(ステージ1の倍)。
 * 車に乗る前に手が止まっていた分は、ステージ1と同じ¥50万にした(「車に乗ってから倍」が分かるように)
 */
export const BOSS2 = {
  /** 体力の割合がこれを下回ると車に乗る */
  carAtHpRatio: 0.5,
  /** 車に乗ったあと、手が止まっている間に1秒ごとに増える被害額 */
  carIdleCostPerSec: 1_000_000,
  /**
   * 車に乗ってから体力を減らさない秒数。画面(Boss.ts)の飛び乗る0.52秒、エンジンをふかす0.42秒、
   * 手前に出てくる0.36秒を合わせた1.3秒(全力で連打しても、車が手前に来る前に倒れないように)
   */
  carHoldSec: 1.3,
  /**
   * 車が手前に来てから倒れるまでの最短の秒数。全力の連打(1秒に10回)だと、半分を切るのが約1.9秒、
   * そこに1.3秒と1.5秒を足して約4.7秒で倒れる(「連打の申し子」の5秒以内に入る)
   */
  carMinSec: 1.5
} as const;

/**
 * ステージ3の宇宙人の親玉(STAGE3「ボス戦」)。体力、最長の秒数、止まったとみなす時間はステージ1と同じ。
 * 仕組みはステージ2の女ボスの車と同じ形(BossFight の car の設定)で、車の代わりに母艦を呼んで乗りこむ。
 * 体力が半分を切ると母艦に乗りこみ、そのあと手が止まっている間は1秒ごとに¥150万(母艦の光線が床を焼く)。
 * 乗りこむ前はステージ1と同じ¥50万。carHoldSec と carMinSec はステージ2と同じにした
 * (母艦が天井を破って下りてきて、親玉が乗りこむまでの画面の動きを1.3秒に収める)
 */
export const BOSS3 = {
  /** 体力の割合がこれを下回ると母艦を呼んで乗りこむ */
  carAtHpRatio: 0.5,
  /** 母艦に乗ったあと、手が止まっている間に1秒ごとに増える被害額 */
  carIdleCostPerSec: 1_500_000,
  /** 母艦に乗ってから体力を減らさない秒数(母艦が下りてきて乗りこむ間) */
  carHoldSec: 1.3,
  /** そのあと倒れるまでの最短の秒数 */
  carMinSec: 1.5
} as const;

// ─── ステージ2:ギャング ───────────────────────────

/**
 * ギャングの数字(STAGE2)。SPECにない数字の決め方:
 * - maxPerWave 4:波2と波3は6人なので、ギャングが5人以上だと市民が1人になってしまう。
 *   市民を2人以上残す(組の色とまぎれる市民を出せるように)。組が2つのときは2人ずつになる
 * - twoGroupChance 0.5:波2と波3で組が2つになる確率。ステージ全体で組は3〜5組。
 *   「一網打尽(2組以上)」も「ギャングの運転手(2組以上)」も、1回のプレイで十分ねらえる
 * - civSameColorRate 0.3:たまたまギャングの組と同じ色の小物をつけている市民の割合(STAGE2の「3割くらい」)
 * - gangLinkRate 0.8:組の2人目、3人目に「前の仲間とのつながり」の文を出す確率(毎回だと文だけで分かってしまう)
 * - civLinkRate 0.35:市民(波の2人目から)に、どちらとも取れるつながりの文を出す確率。
 *   ギャングのつながりと同じくらいの数になるようにした
 * - linkInProfileRate 0.3:つながりの文をプロフィールに出す確率(残りはオペレーターの一言)
 * - 時間:口笛0.5秒(bad のシートの mischief 4コマ×8fps)、集まるまで最長1.5秒、
 *   集まってから車に乗りこむまで3秒(STAGE2)、乗りこむ動き0.5秒、走り出してから画面の右に消えるまで2秒(STAGE2の約2秒)
 */
export const GANG = {
  /** 組の人数 */
  groupSize: { min: 2, max: 3 },
  /** 1つの波のギャングの上限 */
  maxPerWave: 4,
  twoGroupChance: 0.5,
  civSameColorRate: 0.3,
  gangLinkRate: 0.8,
  civLinkRate: 0.35,
  linkInProfileRate: 0.3,
  /** 口笛を吹く時間(秒) */
  whistleSec: 0.5,
  /** 仲間が走ってきて集まるまでの最長(秒)。画面はこの時間で着くように走らせる */
  gatherSec: 1.5,
  /** 集まってから、行けを押さないと車に乗りこむまで(秒) */
  escapeSec: 3,
  /** 車に乗りこむ動き(秒)。この間の行けは「車ごと止める」になる */
  boardSec: 0.5,
  /** 車が走り出してから画面の右に消えるまで(秒)。この間の行けで車ごと止める */
  driveSec: 2
} as const;

/** 小物の色(STAGE2「小物の色は、赤、緑、黄、水色、紫、オレンジから選ぶ」)。メガドライブの色の段階に合わせた */
export const ACCESSORY_COLORS: Readonly<Record<AccessoryColorId, { name: string; color: number }>> = {
  red: { name: '赤', color: 0xdb2424 },       // md(6,1,1)
  green: { name: '緑', color: 0x24b624 },     // md(1,5,1)
  yellow: { name: '黄', color: 0xffff24 },    // md(7,7,1)
  aqua: { name: '水色', color: 0x49dbff },    // md(2,6,7)
  purple: { name: '紫', color: 0x9224db },    // md(4,1,6)
  orange: { name: 'オレンジ', color: 0xff9200 }, // md(7,4,0)
  gold: { name: '金', color: 0xdbb624 }       // md(6,5,1)。女ボスだけ
};
/** 市民とギャングが使う6色(金は女ボスだけ) */
export const GANG_COLOR_IDS: readonly AccessoryColorId[] = ['red', 'green', 'yellow', 'aqua', 'purple', 'orange'];
export const BOSS2_COLOR_ID: AccessoryColorId = 'gold';

/** 小物の名前(STAGE2「見た目」の表)。整備士だけ市民とギャングで違う */
export const ACCESSORY_ITEM: Readonly<Record<GangLook, { civ: string; bad: string }>> = {
  guard: { civ: '腕章', bad: '腕章' },
  mechanic: { civ: 'タオル', bad: 'バンダナ' },
  clubber: { civ: 'ヘアバンド', bad: 'ヘアバンド' },
  officelady: { civ: 'スカーフ', bad: 'スカーフ' }
};

/**
 * まとめて吹き飛ばす技(STAGE2)。巻きぞえは組の中だけで、まわりの市民には当たらない(市民への確率はない)。
 * 物は壊れてよい。範囲は集まった組の真ん中から左右40ドット(踏みつぶしと同じ)
 */
export const GROUP_WIPE = {
  reach: { from: -40, to: 40 },
  propBreakChance: {
    trash: 1, window: 0.7, sign: 0.6, vending: 0.6, car: 0.5,
    van: 0, bosscar: 0, pillar: 0.4, barrier: 0.8, cone: 1, extinguisher: 1,
    // ステージ3にはギャングの組が出ないので使わないが、表はすべての物で埋めておく
    gacha: 1, mannequin: 0.7, showcase: 0.7, fountain: 0.4, escalator: 0.3, ufo: 0, mothership: 0
  } as Readonly<Record<PropKind, number>>
} as const;

/** まとめて吹き飛ばしたときに壊れる物を決める。centerX は集まった組の真ん中の x */
export function rollGroupWipeProps<T extends { kind: PropKind; x: number }>(
  props: readonly T[], centerX: number, rng: Rng
): T[] {
  return props.filter((p) => {
    const dx = p.x - centerX;
    if (dx < GROUP_WIPE.reach.from || dx > GROUP_WIPE.reach.to) return false;
    const chance = GROUP_WIPE.propBreakChance[p.kind];
    return chance > 0 && rng.chance(chance);
  });
}

// ─── ステージ3:宇宙人 ─────────────────────────────

/**
 * 宇宙人の動きのくずれ(STAGE3「動きのくずれ」)。数えるのは仕分けの時計だけ。
 * 初めてくずれるまでは firstSec の min〜max を step きざみで人ごとに選ぶ。そのあとは everySec ごとに showSec の間。
 * 波1の練習用の宇宙人は practice の数字(早く、長く出る)。親玉はくずれない
 */
export const GLITCH = {
  firstSec: { min: 3, max: 6, step: 0.5 },
  everySec: 3,
  showSec: 0.2,
  practice: { firstSec: 1.5, everySec: 2, showSec: 0.3 }
} as const;

/** ステージ3の宇宙人の数(1つの波)。STAGE3「1つの波の宇宙人は2〜3人」 */
export const ALIENS_PER_WAVE = { min: 2, max: 3 } as const;

/**
 * UFOの時間と被害額(STAGE3「UFOで連れ去る」の表)。
 * 合図0.8秒 → 下りてくる1秒 → 吸い上げる3秒(行けのマークが出る。この間の行けで殴り落とす)→ 去る1秒
 */
export const UFO = {
  /** 宇宙人が空へ合図を送る(bad のシートの 'mischief' の動き) */
  signalSec: 0.8,
  /** UFOが下りてくる */
  descendSec: 1,
  /** 買い物客を光で吸い上げる。UFOの上に行けのマーク */
  beamSec: 3,
  /** 行けを押さなかったら、買い物客と宇宙人を乗せて去る */
  leaveSec: 1,
  /** 落ちたUFOの被害額(PROP_COST.ufo と同じ) */
  cost: PROP_COST.ufo
} as const;

/** ステージ3の店の物の大きさ(STAGE3「店が壊れる」の表)と、UFOと母艦の絵の大きさ */
export const MALL_PROP_SIZE: Readonly<Record<'gacha' | 'mannequin' | 'showcase' | 'fountain' | 'escalator' | 'ufo' | 'mothership', PropSize>> = {
  gacha: { w: 24, h: 32 },
  mannequin: { w: 24, h: 56 },
  showcase: { w: 32, h: 32 },
  fountain: { w: 64, h: 40 },
  escalator: { w: 96, h: 64 },
  ufo: { w: 64, h: 32 },
  mothership: { w: 160, h: 64 }
};

/**
 * タイムセールラッシュ(STAGE3「タイムセールラッシュ」)。波2の結果発表のあと、答え合わせの前に1回だけ。
 * - 8人のうち宇宙人は3人か4人(半々)。最初の2人は市民1人と宇宙人1人(どちらが先かはランダム)
 * - 次の人が来るまで:最初の2人のあとは2.4秒、そのあとは1.8秒。ゆっくりモードでは1.5倍
 * - 待てのマークは、人がヒーローの48ドット手前に来たときに出て、殴る瞬間に消える(約1秒)
 * - 宇宙人はセールに夢中で、0.3秒に1回くずれる(町の画面では fx_glitch を体全体に重ねる)
 * - 始めるタップは、帯を出して止めてから0.3秒は受けつけない(一時停止のメニューと同じ)
 * 全体は8人で約16秒(最後の人が出るのが13.8秒、そこから走ってヒーローに着くまで)
 */
export const RUSH = {
  /** どの波の結果発表のあとに起きるか(波2の答え合わせの前) */
  afterWave: 2,
  /** 走ってくる人数 */
  people: 8,
  /** 宇宙人の数(半々でどちらか) */
  aliens: [3, 4] as const,
  /** 最初の何人を「市民1人と宇宙人1人」にするか */
  openingPair: 2,
  /** 最初の2人の、次の人が来るまでの秒数 */
  firstGapSec: 2.4,
  /** 3人目からの、次の人が来るまでの秒数 */
  gapSec: 1.8,
  /** ゆっくりモードで間隔にかける倍率 */
  slowGapScale: 1.5,
  /** 人の走る速さ(1秒に何ドット) */
  runSpeed: 60,
  /** 人がヒーローの何ドット手前に来たら待てのマークを出すか */
  markDistance: 48,
  /** マークが出ている長さのめやす(秒)。殴る瞬間に消える */
  markSec: 1,
  /** 宇宙人がくずれる間隔(秒) */
  glitchEverySec: 0.3,
  /** 1回のくずれの長さ(秒)。ここで決めた(間隔の半分。ノイズがちらつく程度) */
  glitchShowSec: 0.15,
  /** 帯を出して止めてから、始めるタップを受けつけない秒数 */
  tapLockSec: 0.3
} as const;
