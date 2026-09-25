// ステージ4の念力の決まり(STAGE4「念力で運ぶ」「行けを押したとき」「押さなかったとき」「順番と数」)。
// 時計は外から進める(update に経った時間を渡す)ので、テストしやすい。段階を進める仕組みと順番待ちは
// timedCall.ts(ステージ3のUFOと共通)。
//
// 流れ:
//   見逃したヴィラン(passBad)がヒーローに素通りされる → ヒーローを追い抜いて少し前へ出る
//   → 手を前に出す(PSY.raiseSec。シートの念力の行)。右から通りがかりの市民が歩いてきて、90ドット先で止まる
//   → すぐ前の物が浮き上がる(PSY.liftSec)
//   → 物が市民の上へ運ばれる(PSY.carrySec)。物の上に行けのマーク。行けで、物はその場の真下に落ちる
//   → 行けを押さなかったら、物が市民の上に落ちる(PSY.dropSec)
//   念力は1回ずつ来る。前の物が落ちるまで、次のヴィランは待つ(PsyQueue)
//
// 使い方:
//   const plan = planPsychic(villainX, propsForWave(def, wave.no), rng);   // 持ち上げる物、間の物、市民の場所
//   const psy = new PsyQueue();
//   if (encounter === 'passBad' && stage.def.mechanic === 'psychic') psy.add(person.id);   // 素通りしたあと
//   // 毎フレーム
//   for (const e of psy.update(deltaMs)) {
//     if (e.phase === 'raise') { /* e.villainId が手を前に出す。市民を歩かせる */ }
//     if (e.phase === 'lift') { /* 物が浮き上がる(紫のふち)。say('psyLift', rng, 'tower') */ }
//     if (e.phase === 'carry') { /* 行けのマーク。その回で初めてなら say('teachPsy')、ほかは say('psyCarry') */ }
//     if (e.phase === 'fall') { /* 行けを押さなかった。物が市民の上に落ちる */ }
//     if (e.phase === 'hit') { stats.psyEscaped(); stats.reportScene('dropped'); say('psyHit') }
//   }
//   // 運ばれている物の x:psyCarryX(plan, psy.current.progress)(carry の間)。
//   // 写真は psy.current.photoDue になったら先に撮っておき、'hit' のときだけ使う
//   // 行けが押されたら(マークが出ているのは psy.current?.markOn のときだけ)
//   const hit = psy.go();
//   if (hit) {
//     const drop = resolvePsyDrop(plan, psyCarryX(plan, hit.at));
//     stats.psyDowned(drop);   // ヴィランを倒し、壊れた物を足す。ソファならソファで受けた数に、市民なら市民のけがに
//     say('psyGo'); そのあと drop.on が 'sofa' なら say('psySofa')、'prop' か 'floor' なら say('psyBroke')、'citizen' なら say('psyHit')
//     壊れた物ごとに sceneForProp(kind) があれば stats.reportScene(...)
//   }
//
// 決まり:
// - 行けで落とすと、ヴィランは倒れる(撃破。行けで倒したにも数える)
// - 落ちた所で何が壊れるかは resolvePsyDrop。真下かどうかは、落ちた物の真ん中から左右 PSY.dropWindowPx の中で決める
// - 押さなかったら、物は市民の上ではずんで床に落ちるが、壊れない。市民はけが(物が落ちた)、ヴィランは逃げる
// - 待てと行けは押しても回数は減らないが、UFOと同じく、ここも行けを押すと被害額が増えることがある(迷わせるための例外)

import { PSY, PROP_COST } from './rules';
import { CallQueue, TimedCall } from './timedCall';
import type { PropKind } from './types';
import type { Rng } from './rng';

/**
 * 念力の今の段階。
 * raise:ヴィランが手を前に出している / lift:物が浮き上がっている / carry:物が市民の上へ運ばれている(行けで落とせる)/
 * fall:押さなかったので、物が市民の上に落ちている途中 / downed:行けでヴィランを倒した(物はその場の真下に落ちる)/
 * hit:物が市民に落ちた
 */
export type PsyPhase = 'raise' | 'lift' | 'carry' | 'fall' | 'downed' | 'hit';

/** 時間を変えるとき(ゆっくりモードなど)。省いた段階は PSY の秒数 */
export interface PsyCallOptions {
  raiseSec?: number;
  liftSec?: number;
  carrySec?: number;
  dropSec?: number;
}

/** 念力1回ぶん(見逃したヴィラン1人ぶん) */
export class PsyCall extends TimedCall<PsyPhase> {
  constructor(villainId: string, opts: PsyCallOptions = {}) {
    super(villainId, {
      steps: [
        { phase: 'raise', sec: opts.raiseSec ?? PSY.raiseSec },
        { phase: 'lift', sec: opts.liftSec ?? PSY.liftSec },
        { phase: 'carry', sec: opts.carrySec ?? PSY.carrySec },
        { phase: 'fall', sec: opts.dropSec ?? PSY.dropSec }
      ],
      goPhase: 'carry',
      goEnd: 'downed',
      timeoutEnd: 'hit'
    });
  }

  /** 念力を使っているヴィランの id */
  get villainId(): string {
    return this.id;
  }

  /** 共有カードの写真を先に撮っておく所か(運ぶ時間が PSY.photoAt まで進んだ。落ちたときだけ使う) */
  get photoDue(): boolean {
    return this.phase === 'fall' || (this.phase === 'carry' && this.progress >= PSY.photoAt);
  }
}

/** PsyQueue.update が返す出来事(そのヴィランの念力が、その段階に入った) */
export interface PsyEvent {
  villainId: string;
  phase: PsyPhase;
}

/**
 * 念力を1回ずつ順に来させるための順番待ち(UfoQueue と同じ形)。見逃したヴィランを add で並べると、
 * 前の物が落ちてから次のヴィランが手を前に出す。手を前に出し始めた瞬間も、update の出来事に { phase: 'raise' } として入る
 */
export class PsyQueue {
  private readonly q: CallQueue<PsyPhase, PsyCall>;

  constructor(opts: PsyCallOptions = {}) {
    this.q = new CallQueue((id) => new PsyCall(id, opts));
  }

  /** 見逃したヴィランを並べる(ヒーローが素通りしたとき)。同じ人は1回だけ */
  add(villainId: string): void {
    this.q.add(villainId);
  }

  /** 今の念力(なければ null)。markOn、phase、progress、photoDue を画面に使う */
  get current(): PsyCall | null {
    return this.q.current;
  }

  /** まだ始まっていないヴィランの id(並んだ順) */
  get queued(): readonly string[] {
    return this.q.queued;
  }

  /** 今の念力も、待っているヴィランもいないか(波の結果発表を終えてよいか) */
  get idle(): boolean {
    return this.q.idle;
  }

  /**
   * 行けが押された。運ばれている間なら、そのヴィランを倒したことにして、id と、押したときの運ぶ進み具合(at、0〜1)を返す。
   * at を psyCarryX に渡すと、物が落ちる x が分かる。それ以外は null
   */
  go(): { villainId: string; at: number } | null {
    const c = this.q.go();
    if (!c) return null;
    return { villainId: c.villainId, at: c.goProgress ?? 1 };
  }

  /** 時計を進める。この間に起きた出来事を順に返す */
  update(deltaMs: number): PsyEvent[] {
    return this.q.update(deltaMs).map((e) => ({ villainId: e.id, phase: e.phase }));
  }
}

// ─── 並べ方 ─────────────────────────────────────

/**
 * 念力の場面の並べ方の数字(ヴィランの位置から右へのドット)。STAGE4 で決まっているのは市民の90ドットだけで、
 * ほかはここで決めた(遊んで直す)。ソファともう1つの物は、下の2つの場所のどちらかに置く。
 * 行けの落ちる所は近いものが勝つので、分かれ目はとなりどうしの真ん中になる
 * (持ち上げた所から: 床 8〜16、1つ目 16〜49、2つ目 49〜76、市民 76〜90。物がない場所は床)
 */
export const PSY_LAYOUT = {
  /** 持ち上げる物(ヴィランのすぐ前) */
  liftDx: 8,
  /** 持ち上げた物と市民の間の2つの場所 */
  slotDx: [36, 62] as const
} as const;

/** 床に置いてある物1つ(x は真ん中) */
export interface PsyFloorProp {
  kind: PropKind;
  x: number;
}

/** 念力の場面の並べ方(planPsychic の答え) */
export interface PsyPlan {
  /** 念力を使うヴィランの位置 */
  villainX: number;
  /** 持ち上げる物と、運び始める位置 */
  lift: PsyFloorProp;
  /** 持ち上げた物と市民の間に置く物(左から順)。ソファはかならず、7割でもう1つ */
  floor: PsyFloorProp[];
  /** 通りがかりの市民が止まる位置(ヴィランの PSY.victimDistance 先)。物はここまで運ばれる */
  victimX: number;
}

/** 念力で持ち上げたり、間に置いたりできる物か(ソファと、値段のない物は入れない) */
const liftable = (k: PropKind): boolean => k !== PSY.cushionProp && PROP_COST[k] > 0;

/**
 * 念力の場面の並べ方を決める。villainX は念力を使うヴィランが立つ位置、props はその階の物(propsForWave)。
 * 持ち上げる物はその階の壊れる物から選ぶ。持ち上げた物と市民の間に、ソファを1つかならず置き、
 * PSY.extraPropChance でもう1つ壊れる物を置く(持ち上げた物となるべく違う物)。ソファともう1つの順番はランダム。
 * もう1つがないときは、ソファを2つの場所のどちらかにランダムに置く。同じ rng なら同じ答え
 */
export function planPsychic(villainX: number, props: readonly PropKind[], rng: Rng): PsyPlan {
  const kinds = props.filter(liftable);
  const pool: readonly PropKind[] = kinds.length > 0 ? kinds : ['plant'];
  const liftKind = rng.pick(pool);
  const others = pool.filter((k) => k !== liftKind);
  const extra = rng.chance(PSY.extraPropChance) ? rng.pick(others.length > 0 ? others : pool) : null;
  const sofaFirst = rng.chance(0.5);
  const [a, b] = PSY_LAYOUT.slotDx;
  const sofa = PSY.cushionProp;
  const floor: PsyFloorProp[] = [];
  if (extra) {
    floor.push({ kind: sofaFirst ? sofa : extra, x: villainX + a }, { kind: sofaFirst ? extra : sofa, x: villainX + b });
  } else {
    floor.push({ kind: sofa, x: villainX + (sofaFirst ? a : b) });
  }
  return {
    villainX,
    lift: { kind: liftKind, x: villainX + PSY_LAYOUT.liftDx },
    floor,
    victimX: villainX + PSY.victimDistance
  };
}

/** 運ばれている物の x(at は運ぶ段階の進み具合 0〜1。持ち上げた所から市民の上までまっすぐ) */
export function psyCarryX(plan: Pick<PsyPlan, 'lift' | 'victimX'>, at: number): number {
  const t = Math.max(0, Math.min(1, at));
  return plan.lift.x + (plan.victimX - plan.lift.x) * t;
}

// ─── 落ちた所 ───────────────────────────────────

/**
 * 物が落ちた先。
 * sofa:ソファの上(何も壊れない)/ prop:ほかの物の上(その物と落ちた物の両方が壊れる)/
 * floor:床(落ちた物だけが壊れる)/ citizen:市民の上(市民がけが。物は壊れない)
 */
export type PsyLanding = 'sofa' | 'prop' | 'floor' | 'citizen';

/** resolvePsyDrop の答え */
export interface PsyDrop {
  on: PsyLanding;
  /** 落ちた先の物(sofa と prop のとき)。床と市民なら null */
  target: PsyFloorProp | null;
  /** 壊れる物(被害額に足す順。prop は落ちた物、落ちた先の物の順)。sofa と citizen は空 */
  broken: PropKind[];
}

/**
 * 運ばれた物が x で落ちたとき、どこに落ちるかを決める(行けを押したときも、押さなかったときも)。
 * 真下かどうかは、落ちた物の真ん中から左右 windowPx(PSY.dropWindowPx)の中で決める。
 * その中に床の物や市民が2つ以上あれば、真ん中がいちばん近いものに落ちる(同じ近さなら、床の物が先、床の物どうしは左が先)。
 * 押さなかったとき(物は市民の上まで運ばれる)は x に plan.victimX を渡すと、かならず 'citizen' になる
 */
export function resolvePsyDrop(
  plan: Pick<PsyPlan, 'lift' | 'floor' | 'victimX'>, x: number, windowPx: number = PSY.dropWindowPx
): PsyDrop {
  const carried = plan.lift.kind;
  let best: { d: number; target: PsyFloorProp | null } | null = null;
  const consider = (d: number, target: PsyFloorProp | null): void => {
    if (d > windowPx) return;
    if (!best || d < best.d) best = { d, target };
  };
  for (const p of plan.floor) consider(Math.abs(p.x - x), p);
  consider(Math.abs(plan.victimX - x), null);
  const hit = best as { d: number; target: PsyFloorProp | null } | null;
  const breaks = (kinds: PropKind[]): PropKind[] => kinds.filter(liftable);
  if (!hit) return { on: 'floor', target: null, broken: breaks([carried]) };
  if (!hit.target) return { on: 'citizen', target: null, broken: [] };
  if (hit.target.kind === PSY.cushionProp) return { on: 'sofa', target: hit.target, broken: [] };
  return { on: 'prop', target: hit.target, broken: breaks([carried, hit.target.kind]) };
}
