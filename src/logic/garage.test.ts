import { describe, expect, it } from 'vitest';
import { AGES, NAMES } from './content';
import { BOSS2_AGES, ordinalName } from './garageContent';
import { ACCESSORY_ITEM, GANG_COLOR_IDS } from './rules';
import { createStage, findBoss } from './stage';
import { tellDef } from './tells';
import type { GangLook, Person, Stage } from './types';

// 外れは配列に集めて最後に1回だけ確かめる(1人ずつ expect を呼ぶと遅い)

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 1);
const stages: Stage[] = SEEDS.map((s) => createStage(s, 'garage'));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);

describe('createStage(seed, "garage")', () => {
  // id と名前、波の人数と時間、波ごとのギャングの数と悪さ、ボスの共通の決まり、同じ見た目の市民の割合は stage.test.ts でまとめて確かめる
  // 絵のキーは stages.test.ts、tells.test.ts、src/art/tellSheets.test.ts で確かめる

  it('ワルは全員どこかの組。組は2〜3人、波1は2人の組が1つ、波2と波3は1〜2組', () => {
    const counts = { w2: new Set<number>(), w3: new Set<number>(), sizes: new Set<number>() };
    const bad: string[] = [];
    for (const s of stages) {
      for (const w of s.waves) {
        const at = `seed ${s.seed} 波${w.no}`;
        const bads = w.people.filter((p) => p.truth === 'bad');
        for (const b of bads) {
          if (b.group === undefined) bad.push(`${at} ${b.id} 組がない`);
        }
        for (const p of w.people) if (p.truth !== 'bad' && p.group !== undefined) bad.push(`${at} ${p.id} ギャングでないのに組`);
        const memberTotal = w.groups.reduce((n, g) => n + g.memberIds.length, 0);
        if (memberTotal !== bads.length) bad.push(`${at} 組の人数の合計`);
        for (const g of w.groups) {
          if (g.memberIds.length < 2 || g.memberIds.length > 3) bad.push(`${at} ${g.id} 人数 ${g.memberIds.length}`);
          counts.sizes.add(g.memberIds.length);
          // 組の人は出てくる順で、全員その組
          const members = g.memberIds.map((id) => w.people.find((p) => p.id === id)!);
          const idx = members.map((m) => m.index);
          if (idx.join() !== [...idx].sort((a, b) => a - b).join()) bad.push(`${at} ${g.id} 順番`);
          for (const m of members) if (m.group !== g.id) bad.push(`${at} ${m.id} ほかの組`);
        }
        // 市民は2人以上
        if (w.people.filter((p) => p.truth === 'civ').length < 2) bad.push(`${at} 市民が少ない`);
      }
      if (s.waves[0].groups.map((g) => g.memberIds.length).join() !== '2') bad.push(`seed ${s.seed} 波1の組`);
      counts.w2.add(s.waves[1].groups.length);
      counts.w3.add(s.waves[2].groups.length);
    }
    expect(bad).toEqual([]);
    expect([...counts.w2].sort()).toEqual([1, 2]);
    expect([...counts.w3].sort()).toEqual([1, 2]);
    expect([...counts.sizes].sort()).toEqual([2, 3]);
  });

  it('組の仲間は同じ色、組ごとに違う色(ステージの中で重ならない)。色は6色から', () => {
    const bad: string[] = [];
    for (const s of stages) {
      const colors: string[] = [];
      for (const w of s.waves) {
        for (const g of w.groups) {
          if (!(GANG_COLOR_IDS as readonly string[]).includes(g.accessory.id)) bad.push(`${s.seed} ${g.id} 色 ${g.accessory.id}`);
          colors.push(g.accessory.id);
          for (const id of g.memberIds) {
            const p = w.people.find((q) => q.id === id)!;
            if (p.accessory?.id !== g.accessory.id || p.accessory.color !== g.accessory.color) bad.push(`${s.seed} ${p.id} 組と違う色`);
          }
        }
      }
      if (new Set(colors).size !== colors.length) bad.push(`${s.seed} 組の色が重なる ${colors}`);
    }
    expect(bad).toEqual([]);
  });

  it('市民の小物はばらばらの色で、3割くらいはその波のギャングの組と同じ色。金色は女ボスだけ', () => {
    let civs = 0;
    let same = 0;
    const bad: string[] = [];
    for (const s of stages) {
      for (const w of s.waves) {
        const groupColors = w.groups.map((g) => g.accessory.id);
        const civList = w.people.filter((p) => p.truth === 'civ');
        // 組と違う色の市民どうしは重ならない
        const others = civList.filter((p) => !groupColors.includes(p.accessory!.id)).map((p) => p.accessory!.id);
        if (new Set(others).size !== others.length) bad.push(`${s.seed} 波${w.no} 市民の色が重なる ${others}`);
        for (const p of civList) {
          if (p.accessory!.id === 'gold') bad.push(`${s.seed} ${p.id} 金色`);
          civs++;
          if (groupColors.includes(p.accessory!.id)) same++;
        }
      }
    }
    expect(bad).toEqual([]);
    expect(same / civs).toBeGreaterThan(0.24);
    expect(same / civs).toBeLessThan(0.36);
  });

  it('小物の名前は小物の形(tell)で決まる(整備士の首の布は、市民がタオル、ギャングがバンダナ)。女ボスはいつもの小物', () => {
    const bad: string[] = [];
    for (const s of stages.slice(0, 40)) {
      for (const p of everyone(s)) {
        if (p.truth === 'boss') {
          if (p.tell !== undefined || p.accessory!.item !== ACCESSORY_ITEM[p.look as GangLook].civ) bad.push(`${p.id} 女ボス ${p.tell} ${p.accessory!.item}`);
          continue;
        }
        const def = tellDef(p.look, p.truth, p.tell);
        if (!def?.item) { bad.push(`${p.id} ${p.look} の tell ${p.tell} がない`); continue; }
        if (p.accessory!.item !== def.item[p.truth === 'bad' ? 'bad' : 'civ']) bad.push(`${p.id} ${p.look} ${p.tell} ${p.truth} ${p.accessory!.item}`);
        if (p.look === 'mechanic' && p.tell === 'neck' && p.accessory!.item !== (p.truth === 'bad' ? 'バンダナ' : 'タオル')) bad.push(`${p.id} ${p.truth} ${p.accessory!.item}`);
        if (p.look === 'guard' && p.tell === 'armband' && p.accessory!.item !== '腕章') bad.push(`${p.id} ${p.accessory!.item}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('女ボスの小物は金色。組には入らず、つながりもない。名前は化けた姿の市民と同じ一覧から(偽名)で、年齢も化けた姿の幅に入る', () => {
    const bad: string[] = [];
    for (const s of stages) {
      const boss = findBoss(s)!;
      if (boss.accessory?.id !== 'gold') bad.push(`${s.seed} 小物 ${boss.accessory?.id}`);
      if (boss.group !== undefined || boss.link !== undefined) bad.push(`${s.seed} 組かつながりがある`);
      const look = boss.disguise!;
      if (!NAMES[look].includes(boss.profile.name)) bad.push(`${s.seed} 名前 ${boss.profile.name}`);
      const lo = Math.max(AGES[look][0], BOSS2_AGES[0]);
      const hi = Math.min(AGES[look][1], BOSS2_AGES[1]);
      if (boss.profile.age < lo || boss.profile.age > hi) bad.push(`${s.seed} 年齢 ${boss.profile.age}`);
    }
    expect(bad).toEqual([]);
  });

  it('見た目は4種類', () => {
    const looks = new Set(stages.slice(0, 80).flatMap(everyone).map((p) => p.look));
    expect([...looks].sort()).toEqual(['clubber', 'guard', 'mechanic', 'officelady']);
  });

  it('名前は同じものが2回出ない。文と一言もほとんど重ならない', () => {
    let dup = 0;
    const bad: string[] = [];
    for (const s of stages) {
      const people = everyone(s);
      if (new Set(people.map((p) => p.profile.name)).size !== people.length) bad.push(`seed ${s.seed} 名前が重なる`);
      dup += people.length - new Set(people.map((p) => p.profile.line)).size;
      dup += people.length - new Set(people.map((p) => p.hint.text)).size;
    }
    expect(bad).toEqual([]);
    expect(dup / stages.length).toBeLessThan(0.5);
  });
});

describe('前の人とのつながり', () => {
  it('つながる相手は同じ波の前の人。文は profile か hint に入っていて、相手の番号で始まる。「同じ色の小物」の文は、本当に色が同じときだけ', () => {
    let sameColor = 0;
    const bad: string[] = [];
    for (const s of stages) {
      for (const w of s.waves) {
        for (const p of w.people) {
          if (!p.link) continue;
          const to = w.people.find((q) => q.id === p.link!.toId);
          if (!to || to.index >= p.index) { bad.push(`${s.seed} ${p.id} 相手 ${p.link.toId}`); continue; }
          const text = p.link.where === 'profile' ? p.profile.line : p.hint.text;
          if (!text.startsWith(ordinalName(to.index))) bad.push(`${s.seed} ${p.id} 文 ${text}`);
          if (text.includes('同じ色の')) {
            sameColor++;
            if (p.accessory!.id !== to.accessory!.id) bad.push(`${s.seed} ${p.id} 色が違うのに同じ色の文`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
    expect(sameColor).toBeGreaterThan(0);
  });

  it('ギャングは同じ組の前の仲間とつながる。組の最初の人にはつながりがない', () => {
    let linked = 0;
    let could = 0;
    const bad: string[] = [];
    for (const s of stages) {
      for (const w of s.waves) {
        for (const g of w.groups) {
          g.memberIds.forEach((id, i) => {
            const p = w.people.find((q) => q.id === id)!;
            if (i === 0) {
              if (p.link) bad.push(`${s.seed} ${p.id} 組の最初なのにつながりがある`);
              return;
            }
            could++;
            if (p.link) {
              linked++;
              // いちばん近い前の仲間
              if (p.link.toId !== g.memberIds[i - 1]) bad.push(`${s.seed} ${p.id} 相手 ${p.link.toId}`);
            }
          });
        }
      }
    }
    expect(bad).toEqual([]);
    expect(linked / could).toBeGreaterThan(0.7);
    expect(linked / could).toBeLessThan(0.9);
  });

  it('市民にも、どちらとも取れるつながりがある(相手はギャングのことも市民のこともある)。つながりはプロフィールにも一言にも出る', () => {
    let civLinks = 0;
    let toGang = 0;
    let toCiv = 0;
    let gangLinks = 0;
    const where = new Set<string>();
    for (const s of stages) {
      for (const w of s.waves) {
        for (const p of w.people) {
          if (!p.link) continue;
          where.add(p.link.where);
          if (p.truth === 'bad') gangLinks++;
          if (p.truth !== 'civ') continue;
          civLinks++;
          const to = w.people.find((q) => q.id === p.link!.toId)!;
          if (to.truth === 'bad') toGang++;
          else toCiv++;
        }
      }
    }
    expect(toGang).toBeGreaterThan(0);
    expect(toCiv).toBeGreaterThan(0);
    // ギャングのつながりと同じくらいの数(つながりがあるだけでは決められない)
    expect(civLinks / gangLinks).toBeGreaterThan(0.6);
    expect(civLinks / gangLinks).toBeLessThan(1.6);
    expect([...where].sort()).toEqual(['hint', 'profile']);
  });
});
