// 結果発表の通りの並べ方。仕分けた人、通りがかりの市民、壊れる物の位置を決める(画面には頼らない)。
// x は通りの位置(ドット)、y は足の位置(地面は y=124〜214。歩道は 124〜150、車道は 150〜214)。

import type { Look, Person, PropKind, Rng } from '../../logic';

export interface PersonSpot { person: Person; x: number; y: number }
export interface PropSpot { kind: PropKind; x: number; y: number; wall: boolean }
export interface PasserSpot { key: string; look: Look; x: number; y: number }
export interface StreetPlan { people: PersonSpot[]; props: PropSpot[]; passers: PasserSpot[]; endX: number }

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

  // 壊れる物
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
  if (vending === 0) props.push({ kind: 'vending', x: FIRST_X + GAP * rng.int(1, 2) + 40, y: 148, wall: false });
  const carGap = rng.int(0, Math.max(0, spots.length - 2));
  props.push({ kind: 'car', x: FIRST_X + carGap * GAP + 50 + rng.int(-10, 10), y: 170, wall: false });
  const frontGap = rng.int(0, Math.max(0, spots.length - 2));
  const frontX = FIRST_X + frontGap * GAP + 30;
  if (!passers.some((p) => Math.abs(p.x - frontX) < 24)) props.push({ kind: 'trash', x: frontX, y: 214, wall: false });

  return { people: spots, props, passers, endX };
}
