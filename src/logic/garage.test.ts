import { describe, expect, it } from 'vitest';
import { sheetByKey } from '../art/sheets';
import { AGES, NAMES } from './content';
import { BOSS2_AGES, ordinalName } from './garageContent';
import { GANG, GANG_COLOR_IDS } from './rules';
import { createStage, findBoss } from './stage';
import { STAGES } from './stages';
import type { Person, Stage } from './types';

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 1);
const stages: Stage[] = SEEDS.map((s) => createStage(s, 'garage'));
const everyone = (s: Stage): Person[] => s.waves.flatMap((w) => w.people);

describe('createStage(seed, "garage")', () => {
  it('同じ種なら同じステージ。定義と名前は地下駐車場', () => {
    expect(createStage(55, 'garage')).toEqual(createStage(55, 'garage'));
    const s = stages[0];
    expect(s.id).toBe('garage');
    expect(s.def).toBe(STAGES.garage);
    expect(s.name).toBe('地下駐車場');
  });

  it('波の人数と時間がSTAGE2の表の通り(5人30秒、6人26秒、6人と女ボス28秒。時間ははじめの表より長くした)', () => {
    for (const s of stages) {
      expect(s.waves.map((w) => w.no)).toEqual([1, 2, 3]);
      expect(s.waves.map((w) => w.seconds)).toEqual([30, 26, 28]);
      expect(s.waves.map((w) => w.people.length)).toEqual([5, 6, 7]);
      expect(s.peopleTotal).toBe(18);
      expect(s.waves.map((w) => w.hasBoss)).toEqual([false, false, true]);
    }
  });

  it('ワルは全員どこかの組。組は2〜3人、波1は2人の組が1つ、波2と波3は1〜2組', () => {
    const counts = { w2: new Set<number>(), w3: new Set<number>(), sizes: new Set<number>() };
    for (const s of stages) {
      for (const w of s.waves) {
        const bads = w.people.filter((p) => p.truth === 'bad');
        expect(bads.length).toBe(w.badCount);
        expect(bads.length).toBeLessThanOrEqual(GANG.maxPerWave);
        for (const b of bads) {
          expect(b.group).toBeDefined();
          expect(b.mischief).toBe('whistle');
        }
        for (const p of w.people) if (p.truth !== 'bad') expect(p.group).toBeUndefined();
        const memberTotal = w.groups.reduce((n, g) => n + g.memberIds.length, 0);
        expect(memberTotal).toBe(bads.length);
        for (const g of w.groups) {
          expect(g.memberIds.length).toBeGreaterThanOrEqual(2);
          expect(g.memberIds.length).toBeLessThanOrEqual(3);
          counts.sizes.add(g.memberIds.length);
          // 組の人は出てくる順で、全員その組
          const members = g.memberIds.map((id) => w.people.find((p) => p.id === id)!);
          expect(members.map((m) => m.index)).toEqual([...members.map((m) => m.index)].sort((a, b) => a - b));
          for (const m of members) expect(m.group).toBe(g.id);
        }
        // 市民は2人以上
        expect(w.people.filter((p) => p.truth === 'civ').length).toBeGreaterThanOrEqual(2);
      }
      expect(s.waves[0].groups.map((g) => g.memberIds.length)).toEqual([2]);
      counts.w2.add(s.waves[1].groups.length);
      counts.w3.add(s.waves[2].groups.length);
    }
    expect([...counts.w2].sort()).toEqual([1, 2]);
    expect([...counts.w3].sort()).toEqual([1, 2]);
    expect([...counts.sizes].sort()).toEqual([2, 3]);
  });

  it('組の仲間は同じ色、組ごとに違う色(ステージの中で重ならない)。色は6色から', () => {
    for (const s of stages) {
      const colors: string[] = [];
      for (const w of s.waves) {
        for (const g of w.groups) {
          expect(GANG_COLOR_IDS).toContain(g.accessory.id);
          colors.push(g.accessory.id);
          for (const id of g.memberIds) {
            const p = w.people.find((q) => q.id === id)!;
            expect(p.accessory!.id).toBe(g.accessory.id);
            expect(p.accessory!.color).toBe(g.accessory.color);
          }
        }
      }
      expect(new Set(colors).size).toBe(colors.length);
    }
  });

  it('市民の小物はばらばらの色で、3割くらいはその波のギャングの組と同じ色。金色は女ボスだけ', () => {
    let civs = 0;
    let same = 0;
    for (const s of stages) {
      for (const w of s.waves) {
        const groupColors = w.groups.map((g) => g.accessory.id);
        const civList = w.people.filter((p) => p.truth === 'civ');
        const others = civList.filter((p) => !groupColors.includes(p.accessory!.id)).map((p) => p.accessory!.id);
        expect(new Set(others).size).toBe(others.length); // 組と違う色の市民どうしは重ならない
        for (const p of civList) {
          expect(p.accessory!.id).not.toBe('gold');
          civs++;
          if (groupColors.includes(p.accessory!.id)) same++;
        }
      }
    }
    expect(same / civs).toBeGreaterThan(0.24);
    expect(same / civs).toBeLessThan(0.36);
  });

  it('小物の名前は見た目と正体で決まる(整備士は市民がタオル、ギャングがバンダナ)', () => {
    for (const p of everyone(stages[1])) {
      if (p.look === 'mechanic') expect(p.accessory!.item).toBe(p.truth === 'bad' ? 'バンダナ' : 'タオル');
      if (p.look === 'guard') expect(p.accessory!.item).toBe('腕章');
    }
  });

  it('女ボスは波3にちょうど1人。化けた姿は警備員、整備士、会社員の女性。小物は金色', () => {
    const disguises = new Set<string>();
    for (const s of stages) {
      const bosses = s.waves.map((w) => w.people.filter((p) => p.truth === 'boss').length);
      expect(bosses).toEqual([0, 0, 1]);
      const boss = findBoss(s)!;
      expect(['guard', 'mechanic', 'officelady']).toContain(boss.disguise);
      expect(boss.look).toBe(boss.disguise);
      expect(boss.sheetKey).toBe(`boss2_disguise_${boss.disguise}`);
      expect(boss.accessory!.id).toBe('gold');
      expect(boss.group).toBeUndefined();
      expect(boss.link).toBeUndefined();
      disguises.add(boss.disguise!);
      expect(s.villainTotal).toBe(s.waves.reduce((n, w) => n + w.badCount, 0) + 1);
    }
    expect(disguises.size).toBe(3);
  });

  it('女ボスの名前は、化けた姿の市民と同じ名前の一覧から(偽名)。年齢も化けた姿の幅に入る', () => {
    for (const s of stages) {
      const boss = findBoss(s)!;
      const look = boss.disguise!;
      expect(NAMES[look]).toContain(boss.profile.name);
      expect(boss.profile.age).toBeGreaterThanOrEqual(Math.max(AGES[look][0], BOSS2_AGES[0]));
      expect(boss.profile.age).toBeLessThanOrEqual(Math.min(AGES[look][1], BOSS2_AGES[1]));
    }
  });

  it('プロフィールとつながりの文は、市民にもギャングにも出る', () => {
    const civLines = new Set<string>();
    const badLines = new Set<string>();
    for (const s of stages) {
      for (const p of everyone(s)) {
        const text = p.link?.where === 'profile' ? p.profile.line.replace(/^\d人目/, '{n}') : p.profile.line;
        if (p.truth === 'civ') civLines.add(text);
        if (p.truth === 'bad') badLines.add(text);
      }
    }
    const both = [...civLines].filter((t) => badLines.has(t));
    expect(both.length).toBeGreaterThanOrEqual(10);
  });

  it('見た目は4種類。絵のキーは全部 sheets.ts にある', () => {
    const looks = new Set<string>();
    for (const s of stages.slice(0, 80)) {
      for (const p of everyone(s)) {
        looks.add(p.look);
        expect(() => sheetByKey(p.sheetKey)).not.toThrow();
        if (p.truth !== 'boss') expect(p.sheetKey).toBe(`${p.look}_${p.truth}`);
        expect(p.profile.age).toBeGreaterThan(0);
      }
    }
    expect([...looks].sort()).toEqual(['clubber', 'guard', 'mechanic', 'officelady']);
  });

  it('ギャングと同じ見た目の市民がなるべく同じ波に出る', () => {
    let ok = 0;
    let total = 0;
    for (const s of stages) {
      for (const w of s.waves) {
        const civLooks = new Set(w.people.filter((p) => p.truth === 'civ').map((p) => p.look));
        for (const b of w.people.filter((p) => p.truth === 'bad')) {
          total++;
          if (civLooks.has(b.look)) ok++;
        }
      }
    }
    expect(ok / total).toBeGreaterThan(0.6);
  });

  it('名前は同じものが2回出ない。文と一言もほとんど重ならない', () => {
    let dup = 0;
    for (const s of stages) {
      const people = everyone(s);
      expect(new Set(people.map((p) => p.profile.name)).size).toBe(people.length);
      expect(new Set(people.map((p) => p.id)).size).toBe(people.length);
      dup += people.length - new Set(people.map((p) => p.profile.line)).size;
      dup += people.length - new Set(people.map((p) => p.hint.text)).size;
    }
    expect(dup / stages.length).toBeLessThan(0.5);
  });
});

describe('前の人とのつながり', () => {
  it('つながる相手は同じ波の前の人。文は profile か hint に入っていて、相手の見た目を指す', () => {
    for (const s of stages) {
      for (const w of s.waves) {
        for (const p of w.people) {
          if (!p.link) continue;
          const to = w.people.find((q) => q.id === p.link!.toId)!;
          expect(to).toBeDefined();
          expect(to.index).toBeLessThan(p.index);
          const text = p.link.where === 'profile' ? p.profile.line : p.hint.text;
          expect(text.startsWith(ordinalName(to.index))).toBe(true);
          expect(text).not.toContain('さっき');
        }
      }
    }
  });

  it('ギャングは同じ組の前の仲間とつながる。組の最初の人にはつながりがない', () => {
    let linked = 0;
    let could = 0;
    for (const s of stages) {
      for (const w of s.waves) {
        for (const g of w.groups) {
          g.memberIds.forEach((id, i) => {
            const p = w.people.find((q) => q.id === id)!;
            if (i === 0) {
              expect(p.link).toBeUndefined();
              return;
            }
            could++;
            if (p.link) {
              linked++;
              expect(g.memberIds.slice(0, i)).toContain(p.link.toId);
              expect(p.link.toId).toBe(g.memberIds[i - 1]); // いちばん近い前の仲間
            }
          });
        }
      }
    }
    expect(linked / could).toBeGreaterThan(0.7);
    expect(linked / could).toBeLessThan(0.9);
  });

  it('市民にも、どちらとも取れるつながりがある(相手はギャングのことも市民のこともある)', () => {
    let civLinks = 0;
    let toGang = 0;
    let toCiv = 0;
    let gangLinks = 0;
    for (const s of stages) {
      for (const w of s.waves) {
        for (const p of w.people) {
          if (!p.link) continue;
          if (p.truth === 'bad') gangLinks++;
          if (p.truth !== 'civ') continue;
          civLinks++;
          const to = w.people.find((q) => q.id === p.link!.toId)!;
          if (to.truth === 'bad') toGang++;
          else toCiv++;
        }
        expect(w.people[0].link).toBeUndefined();
      }
    }
    expect(toGang).toBeGreaterThan(0);
    expect(toCiv).toBeGreaterThan(0);
    // ギャングのつながりと同じくらいの数(つながりがあるだけでは決められない)
    expect(civLinks / gangLinks).toBeGreaterThan(0.6);
    expect(civLinks / gangLinks).toBeLessThan(1.6);
  });

  it('「同じ色の小物」の文は、本当に色が同じときだけ', () => {
    let seen = 0;
    for (const s of stages) {
      for (const w of s.waves) {
        for (const p of w.people) {
          if (!p.link) continue;
          const text = p.link.where === 'profile' ? p.profile.line : p.hint.text;
          if (!text.includes('同じ色の')) continue;
          seen++;
          const to = w.people.find((q) => q.id === p.link!.toId)!;
          expect(p.accessory!.id).toBe(to.accessory!.id);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('プロフィールにも一言にもつながりが出る', () => {
    const where = new Set(stages.flatMap(everyone).filter((p) => p.link).map((p) => p.link!.where));
    expect([...where].sort()).toEqual(['hint', 'profile']);
  });
});
