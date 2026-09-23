// ステージ2(地下駐車場)を、仕分けから結果(称号、記録、共有文)まで通しで数える。
// 画面(Street.ts)と同じ順番で部品を呼ぶ:出てくる順にヒーローが前に来て、
// ワルに仕分けたギャングは殴って撃破、見逃したギャングは口笛で組を呼び、行けでまとめて吹き飛ばすか車ごと止める。

import { beforeEach, describe, expect, it } from 'vitest';
import { BossFight } from './boss';
import { GangCall, gatherMembers } from './gang';
import { clearRecords, isStageUnlocked, loadRecords, saveResult, type RecordStorage } from './records';
import { createRng, type Rng } from './rng';
import { GANG, resolveEncounter } from './rules';
import { buildShareText } from './share';
import { createStage } from './stage';
import { STAGES } from './stages';
import { StatsTracker } from './stats';
import { decideTitle, titleById } from './titles';
import type { SortChoice, Stage, StageStats } from './types';

type GoMode = 'wipe' | 'vanStop';

/**
 * 1ステージを遊ぶ。ボスはワルに仕分け、市民は市民に仕分ける。
 * ギャングをどちらに仕分けるかは sortGang で、組を呼んだときに行けを押す時は goMode で決める
 */
function play(stage: Stage, sortGang: (rng: Rng) => SortChoice, goMode: (n: number) => GoMode, rng: Rng): StageStats {
  const stats = new StatsTracker(stage.villainTotal, stage.id);
  for (const w of stage.waves) {
    const done = new Set<string>(); // もう倒した(組で集まって片づいた人を含む)
    let calls = 0;
    for (const p of w.people) {
      if (done.has(p.id)) continue; // 組で集まって、もういない
      const choice: SortChoice = p.truth === 'civ' ? 'civ' : p.truth === 'boss' ? 'bad' : sortGang(rng);
      const e = resolveEncounter(p.truth, choice);
      if (e === 'hitBad') {
        stats.defeatBad('sort');
        done.add(p.id);
      } else if (e === 'passBad') {
        const group = w.groups.find((g) => g.id === p.group)!;
        expect(group, p.id).toBeDefined();
        expect(stats.mischief(p.look)).toBe(0); // 口笛は悪さに数えない
        const comers = gatherMembers(group.memberIds, (id) => done.has(id));
        expect(comers).toContain(p.id);
        for (const id of comers) done.add(id);
        const call = new GangCall(comers);
        if (call.alone) {
          stats.defeatBad('go'); // 仲間が誰も来ない:ステージ1と同じ行けの追い打ち
          continue;
        }
        call.update(GANG.gatherSec * 1000);
        expect(call.phase).toBe('wait');
        if (goMode(calls++) === 'wipe') {
          expect(call.go()).toBe('wipe');
          stats.groupWiped(call.size);
        } else {
          call.update(GANG.escapeSec * 1000 + 100); // ワゴンに乗りこむところ
          expect(call.go()).toBe('vanStop');
          stats.vanStopped(call.size);
        }
      } else if (e === 'bossFight') {
        const f = new BossFight(STAGES[stage.id].bossFight);
        while (!f.isOver) {
          f.tap();
          f.update(100);
        }
        stats.defeatBoss(f.seconds!);
      } else {
        expect(e).toBe('passCiv');
      }
    }
  }
  return stats.snapshot();
}

class MemStorage implements RecordStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
}

describe('ステージ2を通しで数える', () => {
  beforeEach(() => clearRecords(null));

  it('仕分け、行け、まとめて吹き飛ばす、車ごと止める、ボスを合わせると、villainTotal の全員撃破になる', () => {
    const used = { sort: 0, go: 0, wipe: 0, van: 0 };
    for (let i = 0; i < 200; i++) {
      const stage = createStage(i * 31 + 7, 'garage');
      const rng = createRng(`play-${i}`);
      const s = play(stage, (r) => (r.chance(0.5) ? 'bad' : 'civ'), (n) => ((n + i) % 2 === 0 ? 'wipe' : 'vanStop'), rng);
      expect(s.stageId).toBe('garage');
      expect(s.defeatedBySort + s.defeatedByGo + s.defeatedByWipe + s.defeatedByVan + 1).toBe(stage.villainTotal);
      expect(s.defeated, `seed ${stage.seed}`).toBe(stage.villainTotal);
      expect(s.allDefeated).toBe(true);
      expect(s.bossDefeated).toBe(true);
      expect(s.escaped).toBe(0);
      expect(s.civHurt).toBe(0);
      expect(s.damage).toBe(s.vansStopped * 5_000_000);
      used.sort += s.defeatedBySort;
      used.go += s.defeatedByGo;
      used.wipe += s.defeatedByWipe;
      used.van += s.defeatedByVan;
    }
    // 4つの倒し方がどれも出ている
    expect(Object.values(used).every((n) => n > 0), JSON.stringify(used)).toBe(true);
  });

  it('ステージ2の結果から、称号、記録、共有文まで', () => {
    const st = new MemStorage();
    // 路地裏のボスを倒して、地下駐車場を開ける
    const alley = new StatsTracker(9, 'alley');
    alley.defeatBoss(7);
    expect(saveResult('alley', alley.snapshot(), 'soSo', st).unlockedNow).toEqual(['garage']);
    expect(isStageUnlocked('garage', loadRecords(st))).toBe(true);

    // ギャングは全員見逃し、組はまとめて吹き飛ばす(ワゴンは壊さない)
    const stage = createStage(2024, 'garage');
    const s = play(stage, () => 'civ', () => 'wipe', createRng(1));
    expect(s.defeated).toBe(stage.villainTotal);
    expect(s.defeatedBySort).toBe(0);
    expect(s.groupsWiped).toBeGreaterThanOrEqual(2);
    expect(s.damage).toBe(0);
    expect(s.bossFightSec!).toBeLessThanOrEqual(5);
    // 全員撃破、負傷0、被害¥500万未満は、一網打尽より先に 完全無欠
    const title = decideTitle(s);
    expect(title.id).toBe('flawless');
    // 行けを待ってワゴンを止めると、¥500万で完全無欠ではなくなる(ほんものヒーロー)
    const vanRun = play(stage, () => 'civ', () => 'vanStop', createRng(1));
    expect(vanRun.damage).toBe(vanRun.vansStopped * 5_000_000);
    expect(decideTitle(vanRun).id).toBe('realHero');

    const saved = saveResult('garage', s, title.id, st);
    expect(saved.firstPlay).toBe(true);
    expect(saved.stage).toMatchObject({ mostDefeated: stage.villainTotal, fewestHurt: 0, highestDamage: 0, plays: 1, clears: 1 });
    expect(saved.stage.titles).toEqual(['flawless']);
    expect(saved.titleIsNew).toBe(true);
    expect(saved.titlesCollected).toBe(2);
    expect(saved.stageTitlesCollected).toBe(1);

    const again = saveResult('garage', vanRun, 'realHero', st);
    expect(again.newRecords).toEqual(['highestDamage']);
    expect(again.titlesCollected).toBe(3);

    const text = buildShareText({
      stageId: stage.id, defeated: vanRun.defeated, civHurt: vanRun.civHurt, damage: vanRun.damage,
      titleName: titleById('realHero').name, titlesCollected: again.titlesCollected, titlesTotal: again.titlesTotal, url: 'u'
    });
    const lines = text.split('\n');
    expect(lines[0]).toBe('【Stupid Hero】地下駐車場ステージ');
    expect(lines[1]).toBe(`悪党${stage.villainTotal}人撃破/市民0人負傷`);
    // ワゴンを止めた数だけ¥500万。たとえは地下駐車場の物(ワゴン)
    expect(vanRun.vansStopped).toBe(4);
    expect(lines[2]).toBe('被害額¥2,000万(ワゴン4台分)');
    expect(lines[3]).toBe('称号「街のほんものヒーロー」(3/14)');
  });
});
