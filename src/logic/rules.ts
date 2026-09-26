// ゲームのルールと数字の表。SPECにある数字はそのまま、SPECにない数字はここで決めて理由を書く。
// 画面の担当は、数字を自分で書かずにここから読む。
// ステージごとの違い(波の表、ボスの額など)は stages.ts の STAGES にまとめてある。ここはその部品。
// ステージ2(docs/STAGE2.md)の数字は「ステージ2」、ステージ3(docs/STAGE3.md)の数字は「ステージ3」の見出しの下。

import type { Rng } from './rng';
import type {
  AccessoryColorId, AttackKind, Encounter, GangLook, Look, MischiefKind, PropKind, SortChoice, TowerDecoy, TowerLook, Truth,
  WaveNo
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
  /** ステージ4だけ:ヴィランの数 [最小, 最大](親玉は含まない) */
  villains?: readonly [number, number];
  /** ステージ4だけ:もれが2か所とも出る練習用のヴィランを1人入れるか(波1) */
  practiceLeak?: boolean;
  /** ステージ4だけ:紛らわしい市民の人数 */
  decoys?: number;
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

/**
 * 波の表(STAGE4「波と人数」)。ステージ4は波が4つ。ヴィランは波1が1〜2人、波2と3が2〜3人、波4が2人と親玉。
 * 紛らわしい市民は波2から1人ずつ。人数は答え合わせの画面(7行まで)に入るように決めてある。
 * 時間は1人あたり4〜6秒(もれはいつも出ているので、待つ必要はない)
 */
export const TOWER_WAVES: readonly WavePlan[] = [
  { no: 1, people: 4, seconds: 26, mohawk: false, boss: false, villains: [1, 2], practiceLeak: true, decoys: 0 },
  { no: 2, people: 5, seconds: 24, mohawk: false, boss: false, villains: [2, 3], decoys: 1 },
  { no: 3, people: 6, seconds: 26, mohawk: false, boss: false, villains: [2, 3], decoys: 1 },
  { no: 4, people: 6, seconds: 30, mohawk: false, boss: true, villains: [2, 2], decoys: 1 }
];

/** 1つの波のワルの数(ボスは含まない。ステージ1) */
export const BAD_PER_WAVE = { min: 2, max: 3 } as const;

/** 残り何秒で画面の端を赤く点滅させるか */
export const HURRY_AT_SEC = 5;

/** 時間切れで仕分けていない人を、ヒーローがワルにする確率(半々) */
const TIMEOUT_BAD_CHANCE = 0.5;

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
  /** 悪さを始めたワルが、行けを押されなければ画面の右から逃げるまでの秒数 */
  escapeSec: 3
} as const;

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
  uncle: 'signal',
  // ステージ4のヴィランは悪さの代わりに、念力で物を持ち上げて通りがかりの市民の上へ運ぶ
  florist: 'psychic',
  courier: 'psychic',
  newbie: 'psychic',
  janitor: 'psychic',
  chef: 'psychic',
  waiter: 'psychic',
  lady: 'psychic',
  magician: 'psychic',
  // フリープレイのワル(docs/FREEPLAY.md「待てと行け」)。モヒカンはナイフで脅す(けがはさせない)、
  // ギャングは口笛で仲間を呼ぶ、宇宙人は空へ合図を送ってUFOを呼ぶ
  fp_mohawk: 'threaten',
  fp_gang: 'whistle',
  fp_alien: 'signal'
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
  signal: false,
  // 念力は持ち上げただけではけがをさせない。物が落ちて当たったときに hurtCiv('dropped') で数える
  psychic: false
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
 * ステージ4(STAGE4「壊れる物」の表):ソファ¥0(壊れない)、観葉植物¥5万、花のかざり¥20万、コピー機¥80万、
 * 水槽¥300万、ワインの棚¥500万、シャンパンタワー¥1,000万、ピアノ¥3,000万。
 * - chandelier(シャンデリア)¥3,000万:ボス戦の念力の選択で、行けを押さずに落ちたとき(BOSS4.chandelierCost と同じ)
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
  mothership: 100_000_000,
  sofa: 0,
  plant: 50_000,
  flowers: 200_000,
  copier: 800_000,
  tank: 3_000_000,
  wine: 5_000_000,
  champagne: 10_000_000,
  piano: 30_000_000,
  chandelier: 30_000_000
};

/**
 * 「車や自販機が壊れた瞬間」に数える大きな物(柱は車より少し安いが、見た目が大きいので入れる)。
 * ステージ3は噴水とエスカレーター(「モールがこわれた!」)。落ちたUFOは店の物ではないので入れない。
 * ステージ4は水槽とピアノ(「ビルがこわれた!」。STAGE4「壊れる物」)
 */
export const BIG_PROPS: readonly PropKind[] = [
  'vending', 'car', 'van', 'bosscar', 'pillar', 'fountain', 'escalator', 'tank', 'piano'
];
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
/** ステージ4:親玉を市民に仕分けたとき、正体を現して会場の家具を念力で窓の外へ投げる被害額 */
export const TOWER_RAMPAGE_COST = 20_000_000;

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
 * ステージ4の物:
 * - ソファは攻撃でも念力でも壊れない(0)。シャンデリアはボス戦だけの仕掛けなので0
 * - 観葉植物は軽いのでガチャガチャと同じ、花のかざりは看板くらい、コピー機は自販機くらい
 * - 水槽はガラスなので車より少し壊れやすい、ワインの棚は瓶が多いのでその上、シャンパンタワーは値段が高いので
 *   グラスでも少し控えめ(壊れると¥1,000万)
 * - ピアノはいちばん丈夫。ふつうの攻撃ではめったに壊れず、必殺技でも半々(念力で落としたときはかならず壊れる。
 *   それは念力の計算で決め、ここの表は使わない)
 */
export const ATTACKS: Readonly<Record<AttackKind, AttackDef>> = {
  charge: {
    kind: 'charge', name: '光の突撃', weight: 30,
    reach: { from: -56, to: 8 },
    civHitChance: 0,
    propBreakChance: {
      trash: 1, window: 0.6, sign: 0.6, vending: 0.5, car: 0.3,
      van: 0, bosscar: 0, pillar: 0.3, barrier: 0.7, cone: 1, extinguisher: 1,
      gacha: 1, mannequin: 0.6, showcase: 0.6, fountain: 0.3, escalator: 0.2, ufo: 0, mothership: 0,
      sofa: 0, plant: 1, flowers: 0.6, copier: 0.5, tank: 0.4, wine: 0.5, champagne: 0.4, piano: 0.05, chandelier: 0
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
      gacha: 1, mannequin: 1, showcase: 1, fountain: 0.5, escalator: 0.3, ufo: 0, mothership: 0,
      sofa: 0, plant: 1, flowers: 1, copier: 0.8, tank: 0.7, wine: 0.8, champagne: 0.6, piano: 0.1, chandelier: 0
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
      gacha: 1, mannequin: 0.5, showcase: 0.7, fountain: 0.3, escalator: 0.2, ufo: 0, mothership: 0,
      sofa: 0, plant: 0.8, flowers: 0.5, copier: 0.6, tank: 0.5, wine: 0.6, champagne: 0.5, piano: 0.05, chandelier: 0
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
      gacha: 1, mannequin: 1, showcase: 1, fountain: 1, escalator: 1, ufo: 0, mothership: 0,
      sofa: 0, plant: 1, flowers: 1, copier: 1, tank: 1, wine: 1, champagne: 1, piano: 0.5, chandelier: 0
    },
    firstPropOnly: false
  }
};

export const ATTACK_KINDS: readonly AttackKind[] = ['charge', 'punch', 'stomp', 'special'];

/** 攻撃の重み。キーは ATTACK_KINDS の順(順番が変わると、同じ種でも選ばれる攻撃が変わる) */
const ATTACK_WEIGHTS = Object.fromEntries(ATTACK_KINDS.map((k) => [k, ATTACKS[k].weight])) as Readonly<Record<AttackKind, number>>;

/** 殴るたびに攻撃を選ぶ(光の突撃30%、光のパンチ35%、踏みつぶし30%、必殺技5%) */
export function pickAttack(rng: Rng): AttackKind {
  return rng.weighted(ATTACK_WEIGHTS);
}

/** dx が攻撃の届く範囲に入っているか */
function inReach(kind: AttackKind, dx: number): boolean {
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
function rollPropBreak(kind: AttackKind, prop: PropKind, dx: number, rng: Rng): boolean {
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
 *   「一網打尽(2組以上)」も「ギャングの見送り係(2組以上)」も、1回のプレイで十分ねらえる
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
    // ステージ3と4にはギャングの組が出ないので使わないが、表はすべての物で埋めておく
    gacha: 1, mannequin: 0.7, showcase: 0.7, fountain: 0.4, escalator: 0.3, ufo: 0, mothership: 0,
    sofa: 0, plant: 1, flowers: 0.6, copier: 0.6, tank: 0.5, wine: 0.6, champagne: 0.5, piano: 0.05, chandelier: 0
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
  leaveSec: 1
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
 * - 次の人が来るまで:最初の2人のあとは2秒、そのあとは1.7秒。ゆっくりモードでは1.5倍
 * - 待てのマークは、人がヒーローの48ドット手前に来たときに出て、殴る瞬間に消える(約1秒)
 * - 宇宙人はセールに夢中で、0.3秒に1回くずれる(町の画面では fx_glitch を体全体に重ねる)
 * - 始めるタップは、帯を出して止めてから0.3秒は受けつけない(一時停止のメニューと同じ)
 * 全体は8人で約16秒(最後の人が出るのが12.5秒、走ってマークまで2.2秒、マーク1秒、終わるまで0.6秒で16.3秒)
 */
export const RUSH = {
  /** 走ってくる人数 */
  people: 8,
  /** 宇宙人の数(半々でどちらか) */
  aliens: [3, 4] as const,
  /** 最初の何人を「市民1人と宇宙人1人」にするか */
  openingPair: 2,
  /** 最初の2人の、次の人が来るまでの秒数 */
  firstGapSec: 2.0,
  /** 3人目からの、次の人が来るまでの秒数(マークの長さと急ブレーキのポーズを足した長さより長くする) */
  gapSec: 1.7,
  /** ゆっくりモードで間隔にかける倍率 */
  slowGapScale: 1.5,
  /** 人の走る速さ(1秒に何ドット) */
  runSpeed: 60,
  /** 人がヒーローの何ドット手前に来たら待てのマークを出すか */
  markDistance: 48,
  /** マークが出ている長さのめやす(秒)。殴る瞬間に消える */
  markSec: 1,
  /** 待てで止めたとき、急ブレーキのポーズを出しておく秒数(このあと構えを解く) */
  brakeSec: 0.6,
  /** 最後の人を殴るか通してから、ラッシュを終えるまでの秒数(のびた人が落ちきり、通した人がヒーローの後ろへ抜けるくらい) */
  settleSec: 0.6,
  /** 殴った人が、のびてから煙になって消えるまでの秒数(殴った瞬間から) */
  goneSec: 1.3,
  /** 宇宙人がくずれる間隔(秒) */
  glitchEverySec: 0.3,
  /** 1回のくずれの長さ(秒)。ここで決めた(間隔の半分。ノイズがちらつく程度) */
  glitchShowSec: 0.15,
  /** 帯を出して止めてから、始めるタップを受けつけない秒数 */
  tapLockSec: 0.3
} as const;

// ─── ステージ4:超能力のヴィラン ───────────────────

/**
 * もれ(STAGE4「もれ」)。ヴィランは2か所とも出るか、1か所だけ出るか(半々)。1か所だけのときに照明か小物かも半々
 * (照明だけの割合はSTAGE4にないので、ここで半々に決めた)。波1の練習用のヴィランは2か所とも。
 * もれは人が出た瞬間からずっと出ていて、待っても増えたり減ったりしない
 */
export const LEAK = {
  /** 2か所とも出る確率(残りは1か所だけ) */
  bothChance: 0.5,
  /** 1か所だけのとき、それが照明になる確率(残りは机の小物) */
  lightOnlyChance: 0.5,
  /** 練習用のヴィランは2か所とも出す */
  practiceBoth: true
} as const;

/**
 * 紛らわしい市民の出せる見た目(STAGE4「紛らわしい市民」の表)。
 * 切れかけの蛍光灯はどの見た目でも、手品の糸は手品師だけ、風船は花屋の店員、配達員、ウェイター
 */
export const DECOY_LOOKS: Readonly<Record<TowerDecoy, readonly TowerLook[] | 'any'>> = {
  flicker: 'any',
  thread: ['magician'],
  balloon: ['florist', 'courier', 'waiter']
};

/**
 * 念力で運ぶ(STAGE4「念力で運ぶ」)。見逃したヴィランが、すぐ前の壊れる物を持ち上げて、通りがかりの市民の上へ運ぶ。
 * 手を前に出す0.6秒 → 浮き上がる0.8秒 → 運ぶ3秒(行けのマーク)→ 行けを押さなければ市民の上に落ちる0.4秒。
 * 行けを押すと、物はその場の真下に落ちる。真下かどうかは、落ちた物の真ん中から左右20ドットの中で決める。
 * 持ち上げた物と市民の間には、かならずソファを1つ置き、7割くらいで別の壊れる物も1つ置く(順番は決めない)
 */
export const PSY = {
  /** ヴィランが手を前に出す */
  raiseSec: 0.6,
  /** 物が浮き上がる */
  liftSec: 0.8,
  /** 物が市民の上へ運ばれる(行けのマークが出ている) */
  carrySec: 3,
  /** 行けを押さなかったら、物が市民の上に落ちる */
  dropSec: 0.4,
  /** 通りがかりの市民が、ヴィランの何ドット先で止まるか */
  victimDistance: 90,
  /** 落ちた物の真ん中から左右何ドットまでを「真下」とみなすか */
  dropWindowPx: 20,
  /** 持ち上げた物と市民の間にかならず置く物 */
  cushionProp: 'sofa' as PropKind,
  /** ソファのほかに、もう1つ壊れる物を間に置く確率 */
  extraPropChance: 0.7,
  /** 共有カードの写真を撮る所(運ぶ時間がどこまで進んだか。落ちたときだけ使う) */
  photoAt: 0.95
} as const;

/**
 * エレベーターラッシュ(STAGE4「エレベーターラッシュ」)。波3の答え合わせのあと、波4の前に1回だけ。
 * - 6人のうちヴィランは2人か3人(半々)。最初の2人は市民1人とヴィラン1人(どちらが先かはランダム)
 * - 見た目は8種類から、前の人と続けて同じにはしない
 * - 1人ぶんの流れ:扉が開く0.3秒 → 乗ってきて止まる0.5秒 → マーク約1秒 → 殴るか奥へ入る0.6秒 → 扉が閉まる0.5秒。
 *   6人で約17秒。ゆっくりモードでは、扉が開いてからマークが出るまでと、マークの長さを1.5倍にする
 * - 奥に市民が4人以上いたら、着く前に「定員オーバー」のおまけ(数には関わらない)
 */
export const LIFT = {
  /** 乗ってくる人数 */
  people: 6,
  /** ヴィランの数(半々でどちらか) */
  villains: [2, 3] as const,
  /** 扉が開く */
  doorSec: 0.3,
  /** 人が乗ってきて止まる */
  stepInSec: 0.5,
  /** マークが出ている長さ(殴る瞬間に消える) */
  markSec: 1,
  /** 殴る、または待てで止めて奥へ入る */
  actSec: 0.6,
  /** 扉が閉まって次の階へ */
  closeSec: 0.5,
  /** ゆっくりモードで、乗ってくる時間とマークの長さにかける倍率 */
  slowScale: 1.5,
  /** 始まりの階と、着く階 */
  fromFloor: 35,
  toFloor: 50,
  /** 奥の市民がこの人数以上なら「定員オーバー」のおまけを出す */
  overCapacityCivs: 4,
  /** 帯を出して止めてから、始めるタップを受けつけない秒数(タイムセールラッシュと同じ) */
  tapLockSec: 0.3
} as const;

/**
 * ステージ4の親玉(STAGE4「ボス戦」)。体力、最長の秒数、手が止まったときの¥50万はステージ1と同じ。
 * 体力が半分を切ると1回だけ「念力の選択」:客とシャンデリアを浮かせ、時計を止めて3秒の間に待てと行けを1回ずつ押す。
 * 行けを押さなかったらシャンデリアが落ちて¥3,000万。倒すとシャンパンタワーに倒れこむ(STAGES.tower.bossDefeatProp)
 */
export const BOSS4 = {
  /** 体力の割合がこれを下回ると、念力の選択の場面になる */
  choiceAtHpRatio: 0.5,
  /** 念力の選択の時間(秒)。この間は時計が止まる */
  choiceSec: 3,
  /** シャンデリアが落ちたときの被害額 */
  chandelierCost: 30_000_000,
  /** 選択から連打に戻ってから、倒れるまでの最短の秒数 */
  afterChoiceMinSec: 1.5
} as const;
