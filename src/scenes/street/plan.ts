// 結果発表の通りの並べ方。仕分けた人、通りがかりの市民、壊れる物の位置を決める(画面には頼らない)。
// ステージごとに planStreet(路地裏)、planGarage(地下駐車場)、planMall(ショッピングモール)、planTower(高層ビル)。フリープレイは planFree。
// x は通りの位置(ドット)、y は足の位置(地面は y=124〜214。歩道は 124〜150、車道は 150〜214)。

import {
  ACCESSORY_COLORS, GANG_COLOR_IDS, MALL_LOOKS, PSY, PSY_LAYOUT, planPsychic, sheetKeyFor,
  type GangLook, type Look, type Person, type PropKind, type PsyPlan, type Rng, type StageId
} from '../../logic';

export interface PersonSpot { person: Person; x: number; y: number }
/** frame:最初に出すコマ(ステージ4のソファは階ごとの色。なければ0) */
export interface PropSpot { kind: PropKind; x: number; y: number; wall: boolean; frame?: number }
/** color:ステージ2の小物の色(なければ塗らない) */
export interface PasserSpot { key: string; look: Look; x: number; y: number; color?: number }
/**
 * ステージ2:ギャングの組が集まる場所と、組が乗って逃げるワゴン。
 * 組の中で最初に見逃された人(口笛を吹く人)のすぐ先に空けておく。x, y は集まる真ん中、vanX, vanY はワゴン(下の真ん中)
 */
export interface GatherSpot { groupId: string; whistlerId: string; x: number; y: number; vanX: number; vanY: number }
/**
 * rushX:ステージ3の波2だけ。結果発表のあとタイムセールラッシュでヒーローが立つ位置(後ろにエスカレーターを置く)。
 * ほかは undefined。
 * psy:ステージ4だけ。見逃したヴィランごとの念力の場面(planTower)
 */
export interface StreetPlan {
  people: PersonSpot[]; props: PropSpot[]; passers: PasserSpot[]; endX: number; gathers: GatherSpot[]; rushX?: number; psy?: PsySpot[];
}

/** ヒーローが立つ位置(始め) */
export const HERO_START = { x: 40, y: 192 };
/** 1人目の位置と、人と人の間 */
export const FIRST_X = 200;
export const GAP = 104;
/** 人が立つ列(足の y)。奥から手前まで */
const LANES = [190, 176, 204, 184, 198, 180, 206];

/** 通りがかりの市民の絵 */
const PASSERS: readonly { key: string; look: Look }[] = [
  { key: 'suit_civ', look: 'suit' },
  { key: 'shopper_civ', look: 'shopper' },
  { key: 'hoodie_civ', look: 'hoodie' },
  { key: 'granny_civ', look: 'granny' }
];

/**
 * 並べる順は波の順。ただしボスは最後にする(ボスの前に来たらボス戦へ行くので、後ろの人が残らないように)。
 * passBadIds:見逃したワルの id。悪さの相手がいるように、その人のすぐ先に通りがかりの市民を置く。
 */
export function planStreet(people: readonly Person[], passBadIds: ReadonlySet<string>, rng: Rng): StreetPlan {
  const order = [...people.filter((p) => p.truth !== 'boss'), ...people.filter((p) => p.truth === 'boss')];
  const lane0 = rng.int(0, LANES.length - 1);
  const spots: PersonSpot[] = order.map((person, i) => ({
    person,
    x: FIRST_X + i * GAP + rng.int(-6, 6),
    y: LANES[(lane0 + i) % LANES.length] + rng.int(-2, 2)
  }));
  const lastX = spots[spots.length - 1]?.x ?? FIRST_X;
  const endX = lastX + 120;

  // 通りがかりの市民:見逃したワルの先には必ず、ほかにも少し(それだけで正体が分からないように)
  const passers: PasserSpot[] = [];
  spots.forEach((s) => {
    const need = passBadIds.has(s.person.id);
    if (!need && !rng.chance(0.35)) return;
    if (s.person.truth === 'boss') return;
    const look = rng.pick(PASSERS.filter((p) => p.look !== 'granny' || rng.chance(0.3)));
    const y = s.y < 192 ? 204 + rng.int(-2, 2) : 178 + rng.int(-2, 2);
    passers.push({ ...look, x: s.x + 72 + rng.int(-3, 3), y });
  });

  const props = alleyProps(spots, endX, passers, rng);
  return { people: spots, props, passers, endX, gathers: [] };
}

/** 路地裏の壊れる物(壁の窓と看板、歩道のゴミ箱と自販機、車道の車と手前のゴミ箱) */
function alleyProps(spots: readonly PersonSpot[], endX: number, passers: readonly PasserSpot[], rng: Rng, gap = GAP): PropSpot[] {
  const props: PropSpot[] = [];
  // 壁:窓と看板
  for (let x = 70 + rng.int(0, 30); x < endX + 160; x += rng.int(62, 96)) {
    const window = rng.chance(0.6);
    props.push(window
      ? { kind: 'window', x, y: 60 + rng.int(-6, 4), wall: true }
      : { kind: 'sign', x, y: 40 + rng.int(-4, 4), wall: true });
  }
  // 歩道:ゴミ箱と自販機。車道の奥に車を1台、手前にゴミ箱を1つ
  let vending = 0;
  for (let x = 110 + rng.int(0, 20); x < endX + 160; x += rng.int(56, 84)) {
    const kind: PropKind = vending < 2 && rng.chance(0.3) ? 'vending' : 'trash';
    if (kind === 'vending') vending++;
    props.push({ kind, x, y: kind === 'vending' ? 148 : 150, wall: false });
  }
  if (vending === 0) props.push({ kind: 'vending', x: FIRST_X + gap * rng.int(1, 2) + 40, y: 148, wall: false });
  const carGap = rng.int(0, Math.max(0, spots.length - 2));
  props.push({ kind: 'car', x: FIRST_X + carGap * gap + 50 + rng.int(-10, 10), y: 170, wall: false });
  const frontGap = rng.int(0, Math.max(0, spots.length - 2));
  const frontX = FIRST_X + frontGap * gap + 30;
  if (!passers.some((p) => Math.abs(p.x - frontX) < 24)) props.push({ kind: 'trash', x: frontX, y: 214, wall: false });

  return props;
}

// ─── ステージ2(地下駐車場)────────────────────────────

/** 口笛を吹く人のあとに空ける幅(組が集まり、ワゴンが止まっている場所) */
export const GATHER_ROOM = 96;
/** 口笛を吹く人から、集まる真ん中まで */
const GATHER_DX = 76;
/** 集まる真ん中から、ワゴンの真ん中まで */
const VAN_DX = 40;
/** ワゴンを止めておく奥の列(下の端の y) */
export const VAN_Y = 158;
const VAN_HALF = 64;

/** 通りがかりの市民の見た目(ステージ2) */
const GARAGE_PASSERS: readonly GangLook[] = ['guard', 'mechanic', 'clubber', 'officelady'];

/**
 * 地下駐車場の並べ方。人の並び方は路地裏と同じだが、ギャングの組が集まる場所を空けて、そこにワゴンを止めておく。
 * 通りがかりの市民は悪さの相手がいらないので(ギャングは口笛を吹くだけ)、ときどき置くだけ。
 * 物は柱、料金所のバー、三角コーン、消火器の箱(壁)、止めてある車。ワゴンの前後には置かない。
 */
export function planGarage(people: readonly Person[], passBadIds: ReadonlySet<string>, props: readonly PropKind[], rng: Rng): StreetPlan {
  const order = [...people.filter((p) => p.truth !== 'boss'), ...people.filter((p) => p.truth === 'boss')];
  const lane0 = rng.int(0, LANES.length - 1);
  const spots: PersonSpot[] = [];
  const gathers: GatherSpot[] = [];
  const called = new Set<string>();
  let x = FIRST_X;
  order.forEach((person, i) => {
    const s = { person, x: x + rng.int(-6, 6), y: LANES[(lane0 + i) % LANES.length] + rng.int(-2, 2) };
    spots.push(s);
    x += GAP;
    const g = person.group;
    if (g && passBadIds.has(person.id) && !called.has(g)) {
      called.add(g);
      const gx = s.x + GATHER_DX;
      gathers.push({ groupId: g, whistlerId: person.id, x: gx, y: 192, vanX: gx + VAN_DX, vanY: VAN_Y });
      x += GATHER_ROOM;
    }
  });
  const lastX = spots[spots.length - 1]?.x ?? FIRST_X;
  const endX = lastX + 120;
  // ワゴンのまわり(物や通りがかりの市民を置かない)
  const nearVan = (px: number, pad = 0): boolean => nearGather(gathers, px, pad);

  // 通りがかりの市民:見逃したギャングの先には置かない(組が集まる場所なので)
  const passers: PasserSpot[] = [];
  spots.forEach((s) => {
    if (s.person.truth === 'boss' || passBadIds.has(s.person.id) || !rng.chance(0.3)) return;
    const px = s.x + 56 + rng.int(-3, 3);
    if (nearVan(px, 8)) return;
    const look = rng.pick(GARAGE_PASSERS);
    const color = ACCESSORY_COLORS[rng.pick(GANG_COLOR_IDS)].color;
    const y = s.y < 192 ? 204 + rng.int(-2, 2) : 178 + rng.int(-2, 2);
    passers.push({ key: `${look}_civ`, look, x: px, y, color });
  });

  const out = garageProps(spots, endX, passers, gathers, props, rng);
  return { people: spots, props: out, passers, endX, gathers };
}

/** ワゴンのまわりか(組が集まる所からワゴンの右の端まで。物や通りがかりの市民を置かない) */
const nearGather = (gathers: readonly GatherSpot[], px: number, pad = 0): boolean =>
  gathers.some((g) => px > g.x - 60 - pad && px < g.vanX + VAN_HALF + 12 + pad);

/**
 * 地下駐車場の壊れる物(消火器の箱、柱、料金所のバー、三角コーン、止めてある車、ワゴン)。
 * withVan が false なら、ワゴンは置かない(フリープレイ)
 */
function garageProps(
  spots: readonly PersonSpot[], endX: number, passers: readonly PasserSpot[], gathers: readonly GatherSpot[],
  props: readonly PropKind[], rng: Rng, withVan = true, gap = GAP
): PropSpot[] {
  const nearVan = (px: number, pad = 0): boolean => nearGather(gathers, px, pad);
  const out: PropSpot[] = [];
  const has = (k: PropKind): boolean => props.includes(k);
  // 壁:消火器の箱
  if (has('extinguisher')) {
    for (let px = 90 + rng.int(0, 30); px < endX + 160; px += rng.int(110, 170)) {
      out.push({ kind: 'extinguisher', x: px, y: 74 + rng.int(-2, 2), wall: true });
    }
  }
  // 奥の列:柱、料金所のバー、三角コーン(ワゴンのまわりはあける)
  let barrier = 0;
  for (let px = 120 + rng.int(0, 20); px < endX + 160; px += rng.int(60, 92)) {
    if (nearVan(px, 20)) continue;
    const r = rng.next();
    if (has('pillar') && r < 0.3) out.push({ kind: 'pillar', x: px, y: 146, wall: false });
    else if (has('barrier') && barrier < 2 && r < 0.5) { barrier++; out.push({ kind: 'barrier', x: px, y: 150, wall: false }); }
    else if (has('cone')) out.push({ kind: 'cone', x: px, y: 152, wall: false });
  }
  if (has('barrier') && barrier === 0) {
    const bx = FIRST_X + gap * rng.int(0, 1) + 50;
    if (!nearVan(bx, 20)) out.push({ kind: 'barrier', x: bx, y: 150, wall: false });
  }
  // 止めてある車:人と人の間に1台(ワゴンと重ならないところ)
  if (has('car')) {
    for (let tries = 0; tries < 6; tries++) {
      const k = rng.int(0, Math.max(0, spots.length - 2));
      const cx = (spots[k]?.x ?? FIRST_X) + 50 + rng.int(-10, 10);
      // ワゴンが走って逃げる道(右へ)にもかからないように
      if (nearVan(cx, 70) || gathers.some((g) => cx > g.vanX && cx < g.vanX + 300)) continue;
      out.push({ kind: 'car', x: cx, y: 170, wall: false });
      break;
    }
  }
  // 手前に三角コーンを1つ
  if (has('cone')) {
    const k = rng.int(0, Math.max(0, spots.length - 2));
    const fx = (spots[k]?.x ?? FIRST_X) + 30;
    if (!nearVan(fx) && !passers.some((p) => Math.abs(p.x - fx) < 24)) out.push({ kind: 'cone', x: fx, y: 214, wall: false });
  }
  // ワゴン(フリープレイでは止めておかず、画面の右から走ってくる)
  if (has('van') && withVan) for (const g of gathers) out.push({ kind: 'van', x: g.vanX, y: g.vanY, wall: false });

  return out;
}

// ─── ステージ3(ショッピングモール)────────────────────

/** 見逃した宇宙人から、UFOが下りてくる所(連れ去られる買い物客が立つ所)まで。画面(Street.ts)も同じ数字を使う */
export const UFO_DX = 70;
/** UFOの横の半分の幅(64×32)。物の真ん中がUFOの真ん中からこれより近ければ、UFOの真下 */
export const UFO_HALF = 32;
/**
 * 落ちたUFOが壊す物(真下にあれば1つ)。エスカレーターと噴水は大きな据え付けの物なので入れない
 * (ラッシュの波ではヒーローの後ろのエスカレーターがUFOの真下に来ることがあるが、壊れない)
 */
export const UFO_UNDER_KINDS: readonly PropKind[] = ['gacha', 'mannequin', 'showcase'];
/** タイムセールラッシュで、最後の人からヒーローが立つ所まで(ステージ1の「WAVE CLEAR」で止まる所と同じ) */
export const RUSH_DX = 70;
/** 店の物を置く奥の列(下の端の y) */
const MALL_BACK_Y = 148;
/** 物の横の半分の幅(重ならないように並べるため) */
const MALL_HALF: Partial<Record<PropKind, number>> = { gacha: 12, mannequin: 12, showcase: 16, fountain: 32, escalator: 48 };

/**
 * ショッピングモールの並べ方。人の並び方は路地裏と同じ。
 * - 通りがかりの市民はときどき置くだけ(UFOに連れ去られる買い物客は、UFOが来たときに画面が歩かせる)。
 *   見逃した宇宙人の先(UFOが下りてくる所)には置かない
 * - 物は奥の列にガチャガチャ、マネキン、ショーケース。噴水とエスカレーターを1つずつ。手前にガチャガチャを1つ。
 *   見逃した宇宙人の先には、UFOが落ちる真下になるように小さな物(UFO_UNDER_KINDS)を置くことが多い。
 *   エスカレーターと噴水は、UFOの落ちる所から離す
 * - rush:タイムセールラッシュのある波。ヒーローが立つ所(rushX)の後ろにエスカレーターを置き、まわりはあける
 */
export function planMall(people: readonly Person[], passBadIds: ReadonlySet<string>, props: readonly PropKind[], rng: Rng, rush = false): StreetPlan {
  const order = [...people.filter((p) => p.truth !== 'boss'), ...people.filter((p) => p.truth === 'boss')];
  const lane0 = rng.int(0, LANES.length - 1);
  const spots: PersonSpot[] = order.map((person, i) => ({
    person,
    x: FIRST_X + i * GAP + rng.int(-6, 6),
    y: LANES[(lane0 + i) % LANES.length] + rng.int(-2, 2)
  }));
  const lastX = spots[spots.length - 1]?.x ?? FIRST_X;
  const endX = lastX + 120;
  const rushX = rush ? lastX + RUSH_DX : undefined;
  const ufoXs = spots.filter((s) => passBadIds.has(s.person.id)).map((s) => s.x + UFO_DX);

  // 通りがかりの市民
  const passers: PasserSpot[] = [];
  spots.forEach((s) => {
    if (s.person.truth === 'boss' || passBadIds.has(s.person.id) || !rng.chance(0.3)) return;
    const look = rng.pick(MALL_LOOKS);
    const y = s.y < 192 ? 204 + rng.int(-2, 2) : 178 + rng.int(-2, 2);
    const x = s.x + 56 + rng.int(-3, 3);
    // ラッシュでヒーローが立つ所のまわりはあける(走ってくる人とまぎれないように)
    if (rushX !== undefined && Math.abs(x - rushX) < 60) return;
    passers.push({ key: `${look}_civ`, look, x, y });
  });

  const out = mallProps(spots, endX, passers, ufoXs, props, rng, rushX);
  return { people: spots, props: out, passers, endX, gathers: [], rushX };
}

/**
 * ショッピングモールの壊れる物(奥の列のガチャガチャ、マネキン、ショーケース、噴水、エスカレーター、手前のガチャガチャ)。
 * ufoXs はUFOが下りてくる所。rushX はラッシュでヒーローが立つ所(なければ undefined)
 */
function mallProps(
  spots: readonly PersonSpot[], endX: number, passers: readonly PasserSpot[], ufoXs: readonly number[],
  props: readonly PropKind[], rng: Rng, rushX?: number, gap = GAP
): PropSpot[] {
  const has = (k: PropKind): boolean => props.includes(k);
  // 物(奥の列は重ならないように、使った幅を覚えておく)
  const out: PropSpot[] = [];
  const used: [number, number][] = [];
  const free = (x: number, half: number): boolean => used.every(([l, r]) => x + half + 4 < l || x - half - 4 > r);
  const put = (kind: PropKind, x: number, y = MALL_BACK_Y): boolean => {
    const half = MALL_HALF[kind] ?? 12;
    if (!has(kind) || !free(x, half)) return false;
    used.push([x - half, x + half]);
    out.push({ kind, x, y, wall: false });
    return true;
  };
  // ラッシュのエスカレーター(まわりは広めにあける)
  if (rushX !== undefined && put('escalator', rushX + 8, 146)) used.push([rushX - 70, rushX + 90]);
  // エスカレーターと噴水は、UFOの落ちる所にかからないようにする(見た目で重ならないように、少しあける)
  const nearUfo = (x: number, kind: PropKind): boolean => ufoXs.some((u) => Math.abs(u - x) < UFO_HALF + (MALL_HALF[kind] ?? 12) + 4);
  const putBig = (kind: 'escalator' | 'fountain', x: number, y: number): boolean => !nearUfo(x, kind) && put(kind, x, y);
  // (ラッシュのない波は)エスカレーターを人と人の間に1つ。空いていなければ最後の人の先
  const between = (): number => FIRST_X + rng.int(0, Math.max(0, spots.length - 2)) * gap + 52 + rng.int(-6, 6);
  if (rushX === undefined) {
    let ok = false;
    for (let t = 0; t < 4 && !ok; t++) ok = putBig('escalator', between(), 146);
    if (!ok) put('escalator', endX + 40, 146);
  }
  // UFOの落ちる真下
  for (const ux of ufoXs) if (rng.chance(0.7)) put(rng.pick(UFO_UNDER_KINDS), ux + rng.int(-6, 6));
  // 噴水を人と人の間に1つ
  for (let t = 0; t < 4 && !putBig('fountain', between(), 152); t++);
  // 残りの奥の列:ガチャガチャ、マネキン、ショーケース
  for (let x = 110 + rng.int(0, 20); x < endX + 160; x += rng.int(52, 80)) {
    const r = rng.next();
    put(r < 0.35 ? 'gacha' : r < 0.65 ? 'mannequin' : 'showcase', x);
  }
  // 手前にガチャガチャを1つ(通りがかりの市民とUFOの所は避ける)
  const k = rng.int(0, Math.max(0, spots.length - 2));
  const fx = (spots[k]?.x ?? FIRST_X) + 30;
  const clear = !passers.some((p) => Math.abs(p.x - fx) < 24) && !ufoXs.some((u) => Math.abs(u - fx) < 40) && (rushX === undefined || fx < rushX - 80);
  if (has('gacha') && clear) out.push({ kind: 'gacha', x: fx, y: 214, wall: false });

  return out;
}

// ─── ステージ4(高層ビル)──────────────────────────────

/** 見逃したヴィランが、ヒーローを追い抜いて出る所(並んでいた所から右へ)。念力はここから使う */
export const PSY_AHEAD = 40;
/** 見逃したヴィランのあとに空ける幅(念力の場面の物と、歩いてくる市民の所) */
export const PSY_ROOM = 96;
/**
 * 念力の場面の列(足や物の下の端の y)。PSY_LAYOUT の x の並びで、となりどうしの物が重ならないように、
 * 奥と手前に交互に置く(持ち上げる物は奥、1つ目の場所は手前、2つ目の場所は奥)。
 * 市民は2つ目の奥の物と、1つ目の手前の物の間の高さに立つ(頭が高めに来るので、共有カードの写真に物と頭が入る)。
 * ヴィランはその少し奥。floor は床に落ちたときに物が止まる所。
 * hover は運ばれている物の下の端(奥の列のいちばん高い物の上の端とそろう高さ)
 */
export const PSY_ROWS = { back: 146, front: 208, villain: 182, victim: 186, floor: 152, hover: 96 } as const;
/** ステージ4の奥の列(物の下の端の y) */
const TOWER_BACK_Y = 146;
/** ステージ4の手前の物(下の端の y) */
const TOWER_FRONT_Y = 214;
/** ステージ4の物の横の半分の幅 */
export const TOWER_HALF: Partial<Record<PropKind, number>> = {
  sofa: 24, plant: 12, flowers: 13, copier: 16, tank: 20, wine: 16, champagne: 20, piano: 31
};

/** 念力の場面1つ(見逃したヴィラン1人ぶん)。x は PsyPlan、y は PSY_ROWS から */
export interface PsySpot {
  villainId: string;
  /** 念力の並べ方(ヴィランが出る所、持ち上げる物、間の物、市民が止まる所) */
  plan: PsyPlan;
  /** 間の物それぞれの y(plan.floor と同じ順) */
  floorY: number[];
}

/**
 * 高層ビルの並べ方。人の並び方は路地裏と同じだが、見逃したヴィランのあとに念力の場面の幅(PSY_ROOM)を空ける。
 * - 念力の場面:ヴィランは PSY_AHEAD 先に出て、planPsychic の並べ方で物を置く(持ち上げる物と、ソファともう1つ)。
 *   通りがかりの市民は念力が始まってから画面が歩かせるので、ここでは置かない
 * - ほかの物は奥の列に、その階の物(ソファも)を重ならないように並べ、手前に1つだけ置く。念力の場面にはかからない
 * - 通りがかりの市民はときどき置くだけ(見た目はその階の市民)。念力の場面には置かない
 * floorIndex は階(0〜3)。ソファのコマ(階ごとの色)に使う
 */
export function planTower(
  people: readonly Person[], passBadIds: ReadonlySet<string>, props: readonly PropKind[], looks: readonly Look[], floorIndex: number, rng: Rng
): StreetPlan {
  const order = [...people.filter((p) => p.truth !== 'boss'), ...people.filter((p) => p.truth === 'boss')];
  const lane0 = rng.int(0, LANES.length - 1);
  const spots: PersonSpot[] = [];
  const psy: PsySpot[] = [];
  const out: PropSpot[] = [];
  const used: [number, number, 'back' | 'front'][] = [];
  const half = (k: PropKind): number => TOWER_HALF[k] ?? 12;
  const sofaFrame = Math.max(0, Math.min(3, floorIndex));
  const add = (kind: PropKind, x: number, y: number, row: 'back' | 'front'): void => {
    used.push([x - half(kind), x + half(kind), row]);
    out.push({ kind, x, y, wall: false, ...(kind === PSY.cushionProp ? { frame: sofaFrame } : {}) });
  };
  let x = FIRST_X;
  order.forEach((person, i) => {
    const s = { person, x: x + rng.int(-6, 6), y: LANES[(lane0 + i) % LANES.length] + rng.int(-2, 2) };
    spots.push(s);
    x += GAP;
    if (person.truth === 'bad' && passBadIds.has(person.id)) {
      const plan = planPsychic(s.x + PSY_AHEAD, props, rng);
      add(plan.lift.kind, plan.lift.x, PSY_ROWS.back, 'back');
      const floorY = plan.floor.map((f) => {
        const front = f.x - plan.villainX === PSY_LAYOUT.slotDx[0];
        add(f.kind, f.x, front ? PSY_ROWS.front : PSY_ROWS.back, front ? 'front' : 'back');
        return front ? PSY_ROWS.front : PSY_ROWS.back;
      });
      psy.push({ villainId: person.id, plan, floorY });
      x += PSY_ROOM;
    }
  });
  const lastX = spots[spots.length - 1]?.x ?? FIRST_X;
  const endX = lastX + 120;
  // 念力の場面(ヴィランの少し手前から、市民の少し先まで)
  const zones = psy.map((p) => [p.plan.villainX - 24, p.plan.victimX + 20] as const);
  const inZone = (px: number, pad: number): boolean => zones.some(([l, r]) => px + pad > l && px - pad < r);

  // 通りがかりの市民(念力の場面には置かない)
  const passers: PasserSpot[] = [];
  const passerLooks = looks.length > 0 ? looks : (['florist'] as const);
  spots.forEach((s) => {
    if (s.person.truth === 'boss' || passBadIds.has(s.person.id) || !rng.chance(0.3)) return;
    const px = s.x + 56 + rng.int(-3, 3);
    if (inZone(px, 14)) return;
    const look = rng.pick(passerLooks);
    const y = s.y < 192 ? 204 + rng.int(-2, 2) : 178 + rng.int(-2, 2);
    passers.push({ key: sheetKeyFor(look, 'civ', 'tower'), look, x: px, y });
  });

  // 奥の列:その階の物を重ならないように。ソファは2割くらい(念力の場面のソファが目立つように)
  const free = (px: number, h: number, row: 'back' | 'front'): boolean =>
    used.every(([l, r, rw]) => rw !== row || px + h + 4 < l || px - h - 4 > r);
  const kinds = props.length > 0 ? props : [PSY.cushionProp];
  const breakable = kinds.filter((k) => k !== PSY.cushionProp);
  for (let px = 110 + rng.int(0, 20); px < endX + 160; px += rng.int(56, 84)) {
    const kind = breakable.length === 0 || (rng.chance(0.2) && kinds.includes(PSY.cushionProp)) ? PSY.cushionProp : rng.pick(breakable);
    if (inZone(px, half(kind)) || !free(px, half(kind), 'back')) continue;
    add(kind, px, TOWER_BACK_Y, 'back');
  }
  // 手前に1つ(通りがかりの市民と念力の場面は避ける。ソファは置かない)
  const small = kinds.filter((k) => k !== PSY.cushionProp && half(k) <= 20);
  const k = rng.int(0, Math.max(0, spots.length - 2));
  const fx = (spots[k]?.x ?? FIRST_X) + 30;
  if (small.length > 0 && !passers.some((p) => Math.abs(p.x - fx) < 24) && !inZone(fx, 20)) {
    out.push({ kind: rng.pick(small), x: fx, y: TOWER_FRONT_Y, wall: false });
  }
  return { people: spots, props: out, passers, endX, gathers: [], psy };
}

// ─── フリープレイ ─────────────────────────────────

/** 悪さの相手(通りがかりの市民)の絵。color は地下駐車場の市民の小物の色(なければ塗らない) */
export interface PasserLook { key: string; look: Look; color?: number }

/** フリープレイの並べ方に渡すもの */
export interface FreePlanInput {
  /** 人と人の間(freeTiming の gapPx。波3とゆっくりモードで変わる) */
  gap: number;
  /** 背景のステージ(置く物の決め方) */
  bg: StageId;
  /** 背景のステージの壊れる物(STAGES[bg].props) */
  props: readonly PropKind[];
  /** 悪さの相手を置く人:'threat' はナイフで脅すモヒカン(THREAT_DX 先)、'ufo' はUFOを呼ぶ宇宙人(UFO_DX 先) */
  victims: ReadonlyMap<string, 'threat' | 'ufo'>;
  /** 悪さの相手の絵(開いているステージの市民)。この中から偏らないように選ぶ */
  passerLooks: readonly PasserLook[];
}

/** ナイフで脅すモヒカンの相手が立つ所(モヒカンから) */
export const THREAT_DX = 72;

/**
 * フリープレイの並べ方(docs/FREEPLAY.md)。人の並び方はステージと同じで、人と人の間は input.gap。
 * - ギャングの組(fp_gang)は、組の最初の人(口笛を吹く人)のすぐ先に集まる場所を空ける。
 *   ワゴンは止めておかず、画面が右から走らせてくる(どの背景でも)。集まる場所のまわりには床の物を置かない
 * - 悪さの相手:素通りされるモヒカンの72ドット先と、素通りされる宇宙人のUFOが下りてくる所に、通りがかりの市民を1人ずつ
 * - ほかの通りがかりの市民は置かない(巻きぞえで、記録が並び方の運で決まらないように)
 * - 物は背景のステージの決め方で置く
 */
export function planFree(people: readonly Person[], input: FreePlanInput, rng: Rng): StreetPlan {
  const { gap } = input;
  const lane0 = rng.int(0, LANES.length - 1);
  const spots: PersonSpot[] = [];
  const gathers: GatherSpot[] = [];
  const called = new Set<string>();
  let x = FIRST_X;
  people.forEach((person, i) => {
    const s = { person, x: x + rng.int(-6, 6), y: LANES[(lane0 + i) % LANES.length] + rng.int(-2, 2) };
    spots.push(s);
    x += gap;
    const g = person.group;
    if (g && person.look === 'fp_gang' && !called.has(g)) {
      called.add(g);
      const gx = s.x + GATHER_DX;
      gathers.push({ groupId: g, whistlerId: person.id, x: gx, y: 192, vanX: gx + VAN_DX, vanY: VAN_Y });
      x += GATHER_ROOM;
    }
  });
  const lastX = spots[spots.length - 1]?.x ?? FIRST_X;
  const endX = lastX + 120;

  // 悪さの相手。見た目は使った回数の少ないものから
  const passers: PasserSpot[] = [];
  const used = new Map<string, number>();
  const pickLook = (): PasserLook => {
    const pool: readonly PasserLook[] = input.passerLooks.length > 0 ? input.passerLooks : [{ key: 'suit_civ', look: 'suit' }];
    const least = Math.min(...pool.map((p) => used.get(p.key) ?? 0));
    const l = rng.pick(pool.filter((p) => (used.get(p.key) ?? 0) === least));
    used.set(l.key, least + 1);
    return l;
  };
  const ufoXs: number[] = [];
  for (const s of spots) {
    const kind = input.victims.get(s.person.id);
    if (!kind) continue;
    const l = pickLook();
    if (kind === 'threat') {
      const y = s.y < 192 ? 204 + rng.int(-2, 2) : 178 + rng.int(-2, 2);
      passers.push({ ...l, x: s.x + THREAT_DX, y });
    } else {
      // UFOの真下に立つ(画面の ufoDescend と同じ列)
      const ux = s.x + UFO_DX;
      ufoXs.push(ux);
      passers.push({ ...l, x: ux, y: s.y < 192 ? 204 : 182 });
    }
  }

  let props: PropSpot[];
  if (input.bg === 'garage') props = garageProps(spots, endX, passers, gathers, input.props, rng, false, gap);
  else if (input.bg === 'mall') props = mallProps(spots, endX, passers, ufoXs, input.props, rng, undefined, gap);
  else props = alleyProps(spots, endX, passers, rng, gap);
  // 組が集まる所とワゴンが走ってきて止まる所には、床の物を置かない(どの背景でも)
  props = props.filter((p) => p.wall || !nearGather(gathers, p.x, 20));
  return { people: spots, props, passers, endX, gathers };
}
