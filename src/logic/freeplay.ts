// フリープレイ(docs/FREEPLAY.md)の人の並びと数字。仕分けはなく、ヒーローが波ごとに見た目だけでルールを決めつける。
//
// 使い方:
//   const plan = createFreePlay(seed, unlockedStages());   // 3つの波。plan.stage を run.stage に入れる
//   const fw = plan.waves[i];                              // 背景 fw.bgStage、ルール fw.rule、波3の言い直し fw.redeclare
//   const wave = plan.stage.waves[i];                      // 人の並び wave.people、ギャングの組 wave.groups
//   const rule = ruleAt(fw, person.index);                 // その人の前でのルール(言い直しのあとは新しいルール)
//   heroChoice(rule, person)                               // 'bad' なら殴りかかる、'civ' なら素通り
//   freeRoleOf(fw, person)                                 // 'stop' 待てのチャンス / 'go' 行けのチャンス / 'heroBad' 'heroCiv' ヒーローが正しい
//   const t = freeTiming(fw.no, slow);                     // 人と人の間、ため、マークのゆっくり、逃げるまでの秒数など
//   const dry = new DryPress();                            // 空押し。押すたびに dry.press(nowMs, マークがあるか)
//   clearTimeSec(rawSec, stats.escaped, stats.civHurt)     // クリアまでの時間(逃がしたワルと市民のけがの分を足す)
//
// 配り方(毎回同じ数のチャンスが来るように、山札のように配る):
// - 波1は8場面(待て6、殴られるワル2)、波2は7場面(行け5、素通りされる市民2)、
//   波3は12場面(待て3、行け3、殴られるワル3、素通りされる市民3)。合わせて27場面で、待て9、行け8、ヒーローが正しい10
// - 場面は1人ずつ。ただしギャングは2人組で1場面(行けのチャンスだけに出す。1つの波に1組まで)。
//   なので、ギャングの組がいる波は、人数が場面の数より1人多い(下の「決めたこと」)
// - ワル:モヒカン(路地裏)はいつも。ギャング(地下駐車場が開いていれば)は波2に1組、宇宙人(モールが開いていれば)は波2に1人。
//   波3の行けのチャンスには、ギャングか宇宙人のどちらか1つ(開いていれば)。殴られるワルはモヒカンと宇宙人から
// - 市民:開いているステージの市民から、偏らないように。おばあさんは波1か波3の待てのチャンスに1人
//   (「おばあちゃんに全力パンチ」が起きるように)。地下駐車場の市民の小物の色はオレンジか紫だけ
// - 背景は波ごとに、開いているステージから1つずつ(少なければ重なる)
// - 並べ方:行けのチャンスの並びで、ギャングと宇宙人が続かない(集合とUFOを同時に出さない)。
//   波3は、素通りされるワルどうしが隣に並ばない(次の人のマークと行けのマークが重なりすぎないように)
// - 波3:言い直しの前と後に分け、4通り(待て、行け、殴られるワル、素通りされる市民)をどちらにも1つか2つずつ。
//   小物は、ルールに当てはまる人が持つ。当てはまらない人は、ほかの小物か、何も持たない(どちらの半分にも、何も持たない人がいる)。
//   言い直しのあとには、前のルールの小物を持った当てはまらない人も入れる(札が変わったのを見ないと、まちがえる)。
//   買い物袋の女性と買い物客のおじさんには紙袋を付けない
//
// 決めたこと(仕様書にない、または仕様書の数字どうしが合わないところ):
// - 仕様書の表は「合計27人」と「行けのチャンスはギャングの組を1場面」の両方を言っているが、
//   ギャングの組が行けのチャンスにいると、人数は27より多くなる(場面の数は変わらない)。
//   チャンスの数を守ることを先にし、人数はギャングの組の数だけ増やす(27〜29人)。
//   「ヒーローだけなら10/27人」の数は場面で数える(ギャングの組は1つ)
// - 波3の言い直しは「前の半分の人数」のあと(ふつうは6人目のあと。ギャングの組が前の半分にいれば7人目のあと)
// - ギャングの組の小物の色(GangGroup.accessory)は使わないが、型を満たすために緑を入れておく

import { accessoryFor, GANG_LOOKS } from './garage';
import { FREE_ITEMS, FREE_NAME } from './freeNames';
import { MALL_LOOKS } from './mall';
import { makePerson, type PersonDraft, type UsedTexts } from './people';
import { leastUsed } from './pick';
import { createRng, randomSeed, type Rng } from './rng';
import { ACCESSORY_COLORS, GANG, MARK, UFO } from './rules';
import { STAGE_IDS, STAGES } from './stages';
import type {
  AccessoryColorId, FreeItem, FreeRule, FreeVillainLook, GangGroup, GangLook, Look, Person, SortChoice, Stage, StageId,
  Wave, WaveNo
} from './types';

/**
 * その人の場面が、プレイヤーにとって何か。
 * stop:殴りかかられる市民(待てのチャンス)/ go:素通りされるワル(行けのチャンス)/
 * heroBad:殴られるワル(ヒーローが正しい)/ heroCiv:素通りされる市民(ヒーローが正しい)
 */
export type FreeRole = 'stop' | 'go' | 'heroBad' | 'heroCiv';

/** 1つの波の場面の数(docs/FREEPLAY.md「人」の表) */
export interface FreeWavePlan {
  no: WaveNo;
  /** 場面の数(ギャングの組は1つ) */
  scenes: number;
  stop: number;
  go: number;
  heroBad: number;
  heroCiv: number;
}

/** フリープレイの数字。仕様書の数字はそのまま、ないものはここで決めて理由を書く */
export const FREE = {
  /** 波ごとの場面の数(8、7、12) */
  waves: [
    { no: 1, scenes: 8, stop: 6, go: 0, heroBad: 2, heroCiv: 0 },
    { no: 2, scenes: 7, stop: 0, go: 5, heroBad: 0, heroCiv: 2 },
    { no: 3, scenes: 12, stop: 3, go: 3, heroBad: 3, heroCiv: 3 }
  ] as readonly FreeWavePlan[],
  /** 合わせた数(27場面、待て9、行け8、ヒーローが正しい10) */
  total: { scenes: 27, stop: 9, go: 8, heroRight: 10 },
  /** 人と人の間(ドット)。波3は悪さの相手(72ドット先)と重ならないように狭くする */
  gapPx: { 1: 104, 2: 104, 3: 96 } as Readonly<Record<WaveNo, number>>,
  /** ため(殴りかかる前に構える秒数)。波1と波2は今のステージと同じ1.08秒、波3は0.8秒 */
  windupSec: { 1: 1.08, 2: 1.08, 3: 0.8 } as Readonly<Record<WaveNo, number>>,
  /** マークが出ている間の動きの速さ。波1と波2は今と同じゆっくり(0.6倍)、波3はゆっくりにしない */
  markSlowmo: { 1: MARK.slowmo, 2: MARK.slowmo, 3: 1 } as Readonly<Record<WaveNo, number>>,
  /** 波3で、何場面目のあとにルールを言い直すか(前の半分の場面の数) */
  redeclareAfterScenes: 6,
  /** 言い直す瞬間に時計を止める秒数(ゆっくりモードは3秒) */
  redeclarePauseSec: 1.5,
  redeclarePauseSlowSec: 3,
  /** 逃がしたワル1人、市民のけが1人につき、クリアまでの時間に足す秒数 */
  penaltySec: 3,
  /** 空押しのあと、待てや行けが効かない秒数(押し直すと数え直す) */
  dryPressLockSec: 1.0,
  /** ゆっくりモードの倍率(人と人の間、マークの長さ、逃げるまで、車、UFOの吸い上げ) */
  slowScale: 1.5,
  /** ギャングの組の人数(フリープレイは2人組だけ) */
  gangSize: 2,
  /** 地下駐車場の市民の小物の色(風船の黄色、ヒーローの光の赤と水色、塗り替えの赤紫とまぎれないように) */
  garageCivColors: ['orange', 'purple'] as readonly AccessoryColorId[],
  /** ギャングの組の小物の色(フリープレイでは使わない。型を満たすため) */
  gangGroupColor: 'green' as AccessoryColorId
} as const;

/** 1つの波の決めつけ */
export interface FreeWave {
  no: WaveNo;
  /** 背景に使うステージ(STAGES[bgStage].bg) */
  bgStage: StageId;
  /** 波の始めのルール */
  rule: FreeRule;
  /** 波3だけ:言い直しのあとのルールと、何人目のあとに言い直すか(ふつうは6) */
  redeclare: { after: number; rule: FreeRule } | null;
}

/** フリープレイ1回ぶんの並び */
export interface FreePlan {
  waves: FreeWave[];
  /** run.stage に入れる。id と def は波1の背景のステージ、name は「フリープレイ」 */
  stage: Stage;
  /** 開いているステージ(出てくる人と背景はここから) */
  unlocked: StageId[];
  /** チャンスの数(場面で数える。ギャングの組は1つ)。いつも待て9、行け8、ヒーローが正しい10、場面27 */
  chances: { stop: number; go: number; heroRight: number; scenes: number };
}

// ─── ルール ───────────────────────────────────────

/** その人に、ヒーローが殴りかかるか('bad')素通りするか('civ') */
export function heroChoice(rule: FreeRule, person: Pick<Person, 'item'>): SortChoice {
  if (rule.kind === 'allBad') return 'bad';
  if (rule.kind === 'allCiv') return 'civ';
  return person.item === rule.item ? 'bad' : 'civ';
}

/** その人の前でのルール(波3の言い直しのあとは新しいルール)。personIndex は波の中の何人目か(0始まり) */
export function ruleAt(wave: FreeWave, personIndex: number): FreeRule {
  return wave.redeclare && personIndex >= wave.redeclare.after ? wave.redeclare.rule : wave.rule;
}

/** その人の場面が、プレイヤーにとって何か(待てのチャンス、行けのチャンス、ヒーローが正しい) */
export function freeRoleOf(wave: FreeWave, person: Pick<Person, 'index' | 'truth' | 'item'>): FreeRole {
  const attack = heroChoice(ruleAt(wave, person.index), person) === 'bad';
  if (person.truth === 'civ') return attack ? 'stop' : 'heroCiv';
  return attack ? 'heroBad' : 'go';
}

/** 場面の頭の人か(ギャングの組の2人目は、1人目と同じ場面なので false) */
export function isSceneHead(wave: Pick<Wave, 'groups'>, person: Pick<Person, 'id' | 'group'>): boolean {
  if (!person.group) return true;
  const g = wave.groups.find((x) => x.id === person.group);
  return !g || g.memberIds[0] === person.id;
}

/** プランのチャンスの数を数える(場面で数える) */
export function countChances(waves: readonly FreeWave[], stageWaves: readonly Wave[]): FreePlan['chances'] {
  const c = { stop: 0, go: 0, heroRight: 0, scenes: 0 };
  stageWaves.forEach((w, i) => {
    for (const p of w.people) {
      if (!isSceneHead(w, p)) continue;
      c.scenes++;
      const role = freeRoleOf(waves[i], p);
      if (role === 'stop') c.stop++;
      else if (role === 'go') c.go++;
      else c.heroRight++;
    }
  });
  return c;
}

// ─── 時間 ─────────────────────────────────────────

/** 波ごとの時間と間(ゆっくりモードなら1.5倍にしたもの)。画面はここから読む */
export interface FreeTiming {
  /** 人と人の間(ドット) */
  gapPx: number;
  /** ため(秒) */
  windupSec: number;
  /** マークが出ている間の動きの速さ(1より小さいほどゆっくり)。ゆっくりモードはさらに 1/1.5 */
  markSlowmo: number;
  /** 悪さを始めたモヒカンが、行けを押されなければ財布を奪って逃げるまで(秒) */
  escapeSec: number;
  /** ギャングが集まってから車に乗りこむまで(秒) */
  gangEscapeSec: number;
  /** ギャングの車が走り出してから消えるまで(秒) */
  gangDriveSec: number;
  /** UFOが市民を吸い上げる長さ(秒) */
  ufoBeamSec: number;
  /** 言い直しで時計を止める秒数(波3だけ使う) */
  redeclarePauseSec: number;
}

export function freeTiming(no: WaveNo, slow = false): FreeTiming {
  const k = slow ? FREE.slowScale : 1;
  return {
    gapPx: Math.round(FREE.gapPx[no] * k),
    windupSec: FREE.windupSec[no] * k,
    markSlowmo: FREE.markSlowmo[no] / k,
    escapeSec: MARK.escapeSec * k,
    gangEscapeSec: GANG.escapeSec * k,
    gangDriveSec: GANG.driveSec * k,
    ufoBeamSec: UFO.beamSec * k,
    redeclarePauseSec: slow ? FREE.redeclarePauseSlowSec : FREE.redeclarePauseSec
  };
}

/** クリアまでの時間(秒)。rawSec(止めている時間を除いた時計)に、逃がしたワルと市民のけが1人につき3秒を足す */
export function clearTimeSec(rawSec: number, escaped: number, hurt: number): number {
  return rawSec + (Math.max(0, escaped) + Math.max(0, hurt)) * FREE.penaltySec;
}

/** クリアまでの時間の書き方(「1:38」。秒は切り捨て) */
export function formatClearTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec + 1e-9));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 空押しの判定(待てと行けで1つずつ持つ)。時刻は外から渡す(テストしやすいように)。
 * マークがないときに押すと、1.0秒だけ効かない。効かない間に押し直すと、そこから1.0秒を数え直す
 * (連打すると一度も効かない。見て押す人は困らない)。
 */
export class DryPress {
  private lockUntil = Number.NEGATIVE_INFINITY;
  private dry = 0;

  constructor(private readonly lockMs = FREE.dryPressLockSec * 1000) {}

  /**
   * ボタンが押された。hasMark はそのボタンのマークが出ているか。
   * 効いたら true。マークがない(空押し)か、効かない間なら false で、そこから効かない時間を数え直す
   */
  press(nowMs: number, hasMark = true): boolean {
    const locked = nowMs < this.lockUntil;
    if (!hasMark) this.dry++;
    if (locked || !hasMark) {
      this.lockUntil = nowMs + this.lockMs;
      return false;
    }
    return true;
  }

  /** 今、効かない間か */
  locked(nowMs: number): boolean {
    return nowMs < this.lockUntil;
  }

  /** 効くようになるまでの残り(ミリ秒。効くなら0) */
  remainingMs(nowMs: number): number {
    return Math.max(0, this.lockUntil - nowMs);
  }

  /** 空押しの回数(マークがないときに押した回数) */
  get dryCount(): number {
    return this.dry;
  }

  /** 効かない間を解く(波が変わったとき) */
  reset(): void {
    this.lockUntil = Number.NEGATIVE_INFINITY;
  }
}

// ─── 並びを作る ───────────────────────────────────

/** 買い物袋の女性と買い物客のおじさんには紙袋を付けない(もともと袋を持っているので、まぎれる) */
export const canCarry = (look: Look, item: FreeItem): boolean => !(item === 'bag' && (look === 'shopper' || look === 'uncle'));

/** 見た目がどのステージの人か(フリープレイのワルは、そのワルが出るステージ) */
const FREE_VILLAIN_STAGE: Readonly<Record<FreeVillainLook, StageId>> = {
  fp_mohawk: 'alley', fp_gang: 'garage', fp_alien: 'mall'
};

/** ステージごとの市民の見た目(おばあさんは別に1人だけ入れる) */
const CIV_LOOKS: Readonly<Record<StageId, readonly Look[]>> = {
  alley: ['hoodie', 'suit', 'shopper'],
  garage: GANG_LOOKS,
  mall: MALL_LOOKS
};

function stageOfLook(look: Look): StageId {
  if (look in FREE_VILLAIN_STAGE) return FREE_VILLAIN_STAGE[look as FreeVillainLook];
  return STAGE_IDS.find((id) => STAGES[id].looks.includes(look)) ?? 'alley';
}

/** 山札の1場面(並べる前) */
interface Slot {
  role: FreeRole;
  /** ワルの見た目(ワルの場面だけ) */
  villain?: FreeVillainLook;
  /** おばあさんにするか */
  granny?: boolean;
}

/** 場面を人にしたもの(ギャングの組は2つになる) */
interface Draft {
  slot: Slot;
  draft: PersonDraft;
  /** ギャングの組の何人目か(0か1)。組でなければ undefined */
  member?: number;
}

/** 配るときの道具(乱数、使った名前と文、見た目を使った回数) */
interface Dealer {
  rng: Rng;
  used: UsedTexts;
  unlocked: StageId[];
  civCount: Record<string, number>;
  soloCount: Record<string, number>;
}

/** 開いているステージの市民から、使った回数の少ない見た目を選ぶ */
function pickCiv(d: Dealer, ok: (l: Look) => boolean = () => true): Look {
  const pool = d.unlocked.flatMap((id) => CIV_LOOKS[id]).filter(ok);
  const list = pool.length > 0 ? pool : ['hoodie' as Look];
  const l = leastUsed(d.rng, list, d.civCount as Record<Look, number>)[0];
  d.civCount[l] = (d.civCount[l] ?? 0) + 1;
  return l;
}

/** 1人で出るワル(殴られるワル)。モヒカンと、モールが開いていれば宇宙人から、偏らないように */
function pickSolo(d: Dealer): FreeVillainLook {
  const pool: FreeVillainLook[] = d.unlocked.includes('mall') ? ['fp_mohawk', 'fp_alien'] : ['fp_mohawk'];
  const l = leastUsed(d.rng, pool, d.soloCount as Record<FreeVillainLook, number>)[0];
  d.soloCount[l] = (d.soloCount[l] ?? 0) + 1;
  return l;
}

/** 行けのチャンスのワルの見た目(波2はギャング1組と宇宙人1人を開いていれば入れ、残りはモヒカン) */
function goVillains(d: Dealer, no: WaveNo, count: number): FreeVillainLook[] {
  const special: FreeVillainLook[] = [];
  if (d.unlocked.includes('garage')) special.push('fp_gang');
  if (d.unlocked.includes('mall')) special.push('fp_alien');
  // 波3は、ギャングか宇宙人のどちらか1つだけ(モヒカンの「歩き続ける」場面を残すため)
  const picked = no === 3 && special.length > 1 ? [d.rng.pick(special)] : special;
  const out = picked.slice(0, count);
  while (out.length < count) out.push('fp_mohawk');
  return d.rng.shuffle(out);
}

/** 1人ぶんの下書きを作る */
function person(d: Dealer, no: WaveNo, look: Look, truth: 'bad' | 'civ'): PersonDraft {
  const p = makePerson(d.rng, d.used, stageOfLook(look), no, look, truth);
  // 地下駐車場の市民は小物をつけている。色はオレンジか紫だけ
  if (truth === 'civ' && (GANG_LOOKS as readonly Look[]).includes(look)) {
    p.accessory = accessoryFor(d.rng.pick(FREE.garageCivColors), look as GangLook, false);
  }
  return p;
}

/** 場面を人にする(ギャングの組は2人) */
function expand(d: Dealer, no: WaveNo, slots: readonly Slot[]): Draft[][] {
  return slots.map((slot) => {
    if (slot.villain === 'fp_gang') {
      return Array.from({ length: FREE.gangSize }, (_, member) => ({ slot, member, draft: person(d, no, 'fp_gang', 'bad') }));
    }
    if (slot.villain) return [{ slot, draft: person(d, no, slot.villain, 'bad') }];
    const look: Look = slot.granny ? 'granny' : pickCiv(d);
    return [{ slot, draft: person(d, no, look, 'civ') }];
  });
}

/** 並べた下書きから波を作る(id、何人目か、ギャングの組) */
function toWave(no: WaveNo, line: readonly Draft[]): Wave {
  const groupId = `w${no}-g1`;
  const people: Person[] = line.map((x, index) => {
    const p: Person = { id: `w${no}-${index + 1}`, index, ...x.draft };
    if (x.member !== undefined) p.group = groupId;
    return p;
  });
  const members = people.filter((p) => p.group === groupId).map((p) => p.id);
  const c = ACCESSORY_COLORS[FREE.gangGroupColor];
  const groups: GangGroup[] = members.length > 0
    ? [{ id: groupId, wave: no, memberIds: members, accessory: { id: FREE.gangGroupColor, name: c.name, color: c.color } }]
    : [];
  const badCount = people.filter((p) => p.truth === 'bad').length;
  // 時計で切らないので、制限時間は0
  return { no, seconds: 0, people, badCount, hasBoss: false, groups };
}

/**
 * 行けのチャンスの並び(ギャングの組は1人目だけ。2人目は1人目の口笛で集まりに行く)で、
 * ギャングと宇宙人が続いていないか
 */
function gangUfoApart(line: readonly Draft[]): boolean {
  const seq = line.filter((x) => x.slot.role === 'go' && (x.member ?? 0) === 0).map((x) => x.slot.villain);
  for (let i = 1; i < seq.length; i++) {
    const pair = [seq[i - 1], seq[i]];
    if (pair.includes('fp_gang') && pair.includes('fp_alien')) return false;
  }
  return true;
}

/** 素通りされるワル(行けのチャンス)どうしが隣に並んでいないか */
function goApart(line: readonly Draft[]): boolean {
  for (let i = 1; i < line.length; i++) if (line[i - 1].slot.role === 'go' && line[i].slot.role === 'go') return false;
  return true;
}

/** 決まりを満たすまで並べかえる(どの波も満たせる並びがたくさんあるので、すぐ見つかる) */
function arrange(build: () => Draft[], ok: (line: Draft[]) => boolean): Draft[] {
  for (let i = 0; i < 10_000; i++) {
    const line = build();
    if (ok(line)) return line;
  }
  throw new Error('createFreePlay: 並べられない');
}

/** ギャングの組の番号(何人目か)を、並びの順に付け直す(1人目が口笛を吹く人) */
function renumber(line: Draft[]): Draft[] {
  let k = 0;
  return line.map((x) => (x.member !== undefined ? { ...x, member: k++ } : x));
}

/** 場面を人にしたものを混ぜて並べる(ギャングの組の2人もばらばらに置く) */
function flatten(rng: Rng, groups: readonly Draft[][]): Draft[] {
  return renumber(rng.shuffle(groups.flat()));
}

/** 波1:待て6(市民)、殴られるワル2。おばあさんが波1なら、待ての市民の1人をおばあさんに */
function buildWave1(d: Dealer, plan: FreeWavePlan, granny: boolean): Draft[] {
  const slots: Slot[] = [
    ...Array.from({ length: plan.stop }, (_, i): Slot => ({ role: 'stop', granny: granny && i === 0 })),
    ...Array.from({ length: plan.heroBad }, (): Slot => ({ role: 'heroBad', villain: pickSolo(d) }))
  ];
  const groups = expand(d, plan.no, slots);
  return flatten(d.rng, groups);
}

/** 波2:行け5(ワル)、素通りされる市民2 */
function buildWave2(d: Dealer, plan: FreeWavePlan): Draft[] {
  const slots: Slot[] = [
    ...goVillains(d, plan.no, plan.go).map((villain): Slot => ({ role: 'go', villain })),
    ...Array.from({ length: plan.heroCiv }, (): Slot => ({ role: 'heroCiv' }))
  ];
  const groups = expand(d, plan.no, slots);
  return arrange(() => flatten(d.rng, groups), gangUfoApart);
}

/**
 * 波3:待て3、行け3、殴られるワル3、素通りされる市民3を、言い直しの前と後に1つか2つずつ分ける。
 * 小物はルールに当てはまる人に付け、当てはまらない人はほかの小物か何も持たない
 */
function buildWave3(d: Dealer, plan: FreeWavePlan, rules: readonly [FreeItem, FreeItem], granny: boolean): [Draft[], Draft[]] {
  const { rng } = d;
  const roles: FreeRole[] = ['stop', 'go', 'heroBad', 'heroCiv'];
  const total: Record<FreeRole, number> = { stop: plan.stop, go: plan.go, heroBad: plan.heroBad, heroCiv: plan.heroCiv };
  // 前の半分は、選んだ2つを多め(3つなら2つ)、残りを少なめ(3つなら1つ)にする。後ろの半分はその逆
  const doubled = rng.shuffle(roles).slice(0, 2);
  const countIn = (half: 0 | 1, r: FreeRole): number => {
    const first = doubled.includes(r) ? Math.ceil(total[r] / 2) : Math.floor(total[r] / 2);
    return half === 0 ? first : total[r] - first;
  };
  const goLooks = goVillains(d, plan.no, plan.go);
  const grannyHalf: 0 | 1 = rng.chance(0.5) ? 0 : 1;

  const build = (half: 0 | 1): Draft[] => {
    const slots: Slot[] = [];
    for (const r of roles) {
      for (let i = 0; i < countIn(half, r); i++) {
        if (r === 'go') slots.push({ role: r, villain: goLooks.shift() ?? 'fp_mohawk' });
        else if (r === 'heroBad') slots.push({ role: r, villain: pickSolo(d) });
        else slots.push({ role: r, granny: granny && r === 'stop' && half === grannyHalf && !slots.some((s) => s.granny) });
      }
    }
    const rule = rules[half];
    const other = rules[1 - half];
    // 当てはまらない人のうち、1人は何も持たない。後ろの半分では、もう1人に前のルールの小物を持たせる
    const loose = slots.filter((s) => s.role === 'go' || s.role === 'heroCiv');
    const bare = rng.pick(loose);
    const oldItemSlot = half === 1 ? rng.pick(loose.filter((s) => s !== bare)) : null;
    return slots.flatMap((slot) => {
      const match = slot.role === 'stop' || slot.role === 'heroBad';
      // 紙袋のルールに当てはまる市民は、紙袋を持てる見た目から
      const group = slot.role === 'stop' && !slot.granny
        ? [{ slot, draft: person(d, plan.no, pickCiv(d, (l) => canCarry(l, rule)), 'civ') }]
        : expand(d, plan.no, [slot])[0];
      for (const x of group) {
        const look = x.draft.look;
        if (match) x.draft.item = rule;
        else if (slot === bare) delete x.draft.item;
        else if (slot === oldItemSlot && canCarry(look, other)) x.draft.item = other;
        else {
          const options: (FreeItem | null)[] = [...FREE_ITEMS.filter((i) => i !== rule && canCarry(look, i)), null];
          const item = rng.pick(options);
          if (item) x.draft.item = item;
        }
      }
      return group;
    });
  };
  return [build(0), build(1)];
}

/**
 * フリープレイを1回ぶん作る。
 * @param seed 種。同じ種と同じ開いているステージなら、毎回同じ並び
 * @param unlocked 開いているステージ(records.ts の unlockedStages())。路地裏はいつも入れる
 */
export function createFreePlay(seed: number | string = randomSeed(), unlocked: readonly StageId[] = ['alley']): FreePlan {
  const rng = createRng(seed);
  const open = STAGE_IDS.filter((id) => id === 'alley' || unlocked.includes(id));
  const d: Dealer = { rng, used: { names: new Set(), texts: new Set() }, unlocked: open, civCount: {}, soloCount: {} };

  // 背景:開いているステージを混ぜて1つずつ。足りなければ、前の波と違うものからもう一度
  const bgs: StageId[] = rng.shuffle(open);
  while (bgs.length < 3) {
    const prev = bgs[bgs.length - 1];
    const others = open.filter((id) => id !== prev);
    bgs.push(others.length > 0 ? rng.pick(others) : prev);
  }

  // ルール:波3は小物を1つ選び、言い直しでは違う小物にする
  const first = rng.pick(FREE_ITEMS);
  const second = rng.pick(FREE_ITEMS.filter((i) => i !== first));
  const grannyWave: WaveNo = rng.chance(0.5) ? 1 : 3;

  const [p1, p2, p3] = FREE.waves;
  const line1 = buildWave1(d, p1, grannyWave === 1);
  const line2 = buildWave2(d, p2);
  // 波3:半分ずつ並べかえ、つなげたときに、素通りされるワルどうしが隣に並ばず、ギャングと宇宙人が続かないように
  const [ha, hb] = buildWave3(d, p3, [first, second], grannyWave === 3);
  const line3 = arrange(() => {
    const a = rng.shuffle(ha);
    const b = rng.shuffle(hb);
    return renumber([...a, ...b]);
  }, (line) => goApart(line) && gangUfoApart(line));

  const stageWaves = [toWave(1, line1), toWave(2, line2), toWave(3, line3)];
  const waves: FreeWave[] = [
    { no: 1, bgStage: bgs[0], rule: { kind: 'allBad' }, redeclare: null },
    { no: 2, bgStage: bgs[1], rule: { kind: 'allCiv' }, redeclare: null },
    { no: 3, bgStage: bgs[2], rule: { kind: 'item', item: first }, redeclare: { after: ha.length, rule: { kind: 'item', item: second } } }
  ];
  const def = STAGES[bgs[0]];
  const stage: Stage = {
    id: def.id,
    def,
    name: FREE_NAME,
    seed: rng.seed,
    waves: stageWaves,
    villainTotal: stageWaves.reduce((n, w) => n + w.badCount, 0),
    peopleTotal: stageWaves.reduce((n, w) => n + w.people.length, 0),
    rush: null
  };
  return { waves, stage, unlocked: open, chances: countChances(waves, stageWaves) };
}
