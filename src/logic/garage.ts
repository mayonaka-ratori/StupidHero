// 地下駐車場(ステージ2)の3つの波を作る(createStage(seed, 'garage') から呼ぶ)。決まりは docs/STAGE2.md。
//
// - 波の人数と時間は GARAGE_WAVES(5人30秒、6人26秒、6人と女ボス28秒)
// - ワルは全員ギャングの組。組は2〜3人で、波1は2人の組が1つ、波2と波3は1〜2組(1つの波に4人まで)
// - 見た目は4種類(警備員、整備士、派手な若者、会社員の女性)。ギャングと同じ見た目の市民をなるべく同じ波に出す
// - 小物の色:組の仲間は同じ色、組ごとに違う色(ステージの中で重ならない)。
//   市民はばらばらの色で、3割くらいはたまたまその波のギャングの組と同じ色。女ボスは金色
// - 女ボスは波3に1人。化けた姿は警備員、整備士、会社員の女性から
// - 並び順を決めてから、前の人とのつながりの文を決める(ギャングは同じ組の前の仲間、市民はどちらとも取れるつながり)

import { LINK_HINTS, LINK_PROFILES, linkText, type LinkTemplate } from './garageContent';
import { makePerson, type PersonDraft, type UsedTexts } from './people';
import { leastUsed, pickFresh } from './pick';
import type { Rng } from './rng';
import { ACCESSORY_COLORS, ACCESSORY_ITEM, BOSS2_COLOR_ID, GANG, GANG_COLOR_IDS } from './rules';
import { STAGES } from './stages';
import type {
  Accessory, AccessoryColorId, GangGroup, GangLook, GarageDisguise, Person, Wave
} from './types';

export const GANG_LOOKS: readonly GangLook[] = ['guard', 'mechanic', 'clubber', 'officelady'];
/** 女ボスの化けた姿 */
export const BOSS2_DISGUISES: readonly GarageDisguise[] = ['guard', 'mechanic', 'officelady'];

/** 小物を作る(色と、見た目と正体で決まる小物の名前) */
export function accessoryFor(colorId: AccessoryColorId, look: GangLook, isGang: boolean): Accessory {
  const c = ACCESSORY_COLORS[colorId];
  return { id: colorId, name: c.name, color: c.color, item: ACCESSORY_ITEM[look][isGang ? 'bad' : 'civ'] };
}

/** 組ごとの人数を決める。どの組も最低人数から始め、上限までの間で少し足す */
function groupSizes(rng: Rng, count: number, pairOnly: boolean): number[] {
  const { min, max } = GANG.groupSize;
  const sizes = Array.from({ length: count }, () => min);
  if (pairOnly) return sizes;
  let total = sizes.reduce((a, b) => a + b, 0);
  // 組が1つなら半々で2人か3人。2つ以上なら上限(4人)までしか足せない
  for (let i = 0; i < count && total < GANG.maxPerWave; i++) {
    if (sizes[i] < max && rng.chance(0.5)) {
      sizes[i]++;
      total++;
    }
  }
  return sizes;
}

export function buildGarageWaves(rng: Rng, used: UsedTexts): Wave[] {
  const def = STAGES.garage;
  const badCount: Record<GangLook, number> = { guard: 0, mechanic: 0, clubber: 0, officelady: 0 };
  const civCount: Record<GangLook, number> = { guard: 0, mechanic: 0, clubber: 0, officelady: 0 };
  // 組の色はこの順に使う(ステージの中で組ごとに違う色。組は多くても5つで、色は6つ)
  const colorOrder = rng.shuffle(GANG_COLOR_IDS);
  let colorNext = 0;
  const bossDisguise = rng.pick(BOSS2_DISGUISES);

  return def.waves.map((plan) => {
    // 組の数と人数
    const [gMin, gMax] = plan.gangGroups ?? [1, 1];
    const groupCount = gMax > gMin && rng.chance(GANG.twoGroupChance) ? gMax : gMin;
    const sizes = groupSizes(rng, groupCount, plan.gangPairOnly ?? false);
    const gangTotal = sizes.reduce((a, b) => a + b, 0);
    const civSlots = plan.people - gangTotal;

    // ギャングの見た目:使った回数の少ない順(1つの波の中では重ならない)
    const gangLooks: GangLook[] = [];
    while (gangLooks.length < gangTotal) {
      const order = leastUsed(rng, GANG_LOOKS, badCount).filter((l) => !gangLooks.includes(l));
      const l = order[0] ?? rng.pick(GANG_LOOKS);
      gangLooks.push(l);
      badCount[l]++;
    }

    // 市民の見た目:ギャングと同じ見た目 → (波3)女ボスの化けた姿と同じ見た目 → 残りは偏らないように
    const civLooks: GangLook[] = [];
    for (const l of rng.shuffle(gangLooks)) if (civLooks.length < civSlots && !civLooks.includes(l)) civLooks.push(l);
    if (plan.boss && civLooks.length < civSlots && !civLooks.includes(bossDisguise)) {
      // 女ボスと同じ見た目の市民がいないなら、最後の1人を入れかえる
      civLooks.push(bossDisguise);
    } else if (plan.boss && !civLooks.includes(bossDisguise) && civLooks.length > 0) {
      civLooks[civLooks.length - 1] = bossDisguise;
    }
    while (civLooks.length < civSlots) {
      const fresh = leastUsed(rng, GANG_LOOKS, civCount).filter((l) => !civLooks.includes(l));
      civLooks.push(fresh[0] ?? rng.pick(GANG_LOOKS));
    }
    for (const l of civLooks) civCount[l]++;

    // 組:見た目を組に分け、色を決める
    const groups: GangGroup[] = [];
    const drafts: PersonDraft[] = [];
    let k = 0;
    sizes.forEach((size, gi) => {
      const colorId = colorOrder[colorNext++ % colorOrder.length];
      const c = ACCESSORY_COLORS[colorId];
      const group: GangGroup = {
        id: `w${plan.no}-g${gi + 1}`, wave: plan.no, memberIds: [], accessory: { id: colorId, name: c.name, color: c.color }
      };
      groups.push(group);
      for (let i = 0; i < size; i++) {
        const look = gangLooks[k++];
        const p = makePerson(rng, used, 'garage', plan.no, look, 'bad');
        p.group = group.id;
        p.accessory = accessoryFor(colorId, look, true);
        drafts.push(p);
      }
    });

    // 市民の色:3割くらいはたまたま組と同じ色、残りは組と違う色をばらばらに
    const groupColors = groups.map((g) => g.accessory.id);
    const otherColors = rng.shuffle(GANG_COLOR_IDS.filter((id) => !groupColors.includes(id)));
    const sameCount = Math.min(civSlots, Math.floor(civSlots * GANG.civSameColorRate + rng.next()));
    const sameIdx = new Set(rng.shuffle(civLooks.map((_, i) => i)).slice(0, sameCount));
    let o = 0;
    civLooks.forEach((look, i) => {
      const colorId = sameIdx.has(i) ? rng.pick(groupColors) : otherColors[o++ % otherColors.length];
      const p = makePerson(rng, used, 'garage', plan.no, look, 'civ');
      p.accessory = accessoryFor(colorId, look, false);
      drafts.push(p);
    });

    // 女ボス:化けた姿の市民の小物を、金色でつけている
    if (plan.boss) {
      const p = makePerson(rng, used, 'garage', plan.no, bossDisguise, 'boss', bossDisguise);
      p.accessory = accessoryFor(BOSS2_COLOR_ID, bossDisguise, false);
      drafts.push(p);
    }

    const people: Person[] = rng.shuffle(drafts).map((p, index) => ({
      id: `w${plan.no}-${index + 1}`, index, ...p
    }));
    for (const g of groups) g.memberIds = people.filter((p) => p.group === g.id).map((p) => p.id);
    addLinks(rng, used, people);
    return { no: plan.no, seconds: plan.seconds, people, badCount: gangTotal, hasBoss: plan.boss, groups };
  });
}

/**
 * 前の人とのつながりの文を決める(並び順が決まってから)。
 * ギャング:同じ組の前の仲間がいれば、GANG.gangLinkRate でその人(いちばん近い仲間)とのつながり。
 * 市民:波の2人目から、GANG.civLinkRate で前の誰か(ギャングのこともある)とのどちらとも取れるつながり。
 * 相手は波の何人目かで呼ぶ(「1人目と…」)。「同じ色の小物」の文は、本当に色が同じときだけ使う。女ボスにはつけない(女ボスの一言はおかしいところを指す)
 */
function addLinks(rng: Rng, used: UsedTexts, people: Person[]): void {
  people.forEach((p, i) => {
    if (p.truth === 'boss') return;
    let target: Person | undefined;
    if (p.truth === 'bad') {
      const mates = people.slice(0, i).filter((q) => q.group === p.group);
      if (mates.length > 0 && rng.chance(GANG.gangLinkRate)) target = mates[mates.length - 1];
    } else if (i > 0 && rng.chance(GANG.civLinkRate)) {
      target = rng.pick(people.slice(0, i));
    }
    if (!target) return;
    const to = target;
    const where = rng.chance(GANG.linkInProfileRate) ? 'profile' : 'hint';
    const sameColor = p.accessory?.id === to.accessory?.id;
    const want = p.truth === 'bad' ? 'bad' : 'civ';
    const list = (where === 'profile' ? LINK_PROFILES : LINK_HINTS).filter(
      (t: LinkTemplate) => (t.for === want || t.for === 'both') && (!t.sameColor || sameColor)
    );
    const look = p.look as GangLook;
    const tpl = pickFresh(rng, list, used.texts, (t) => linkText(t.text, to.index, look));
    const text = linkText(tpl.text, to.index, look);
    if (where === 'profile') p.profile = { ...p.profile, line: text };
    else p.hint = { face: tpl.face, text };
    p.link = { toId: to.id, where };
  });
}
