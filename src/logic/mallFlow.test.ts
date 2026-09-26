// ステージ3(ショッピングモール)を、仕分けから結果(称号、記録、共有文)まで通しで数える。
// 画面(Street.ts)と同じ順番で部品を呼ぶ:出てくる順にヒーローが前に来て、
// 宇宙人に仕分けた人は殴って撃破、見逃した宇宙人は空へ合図を送ってUFOを呼び、行けで殴り落とすか連れ去られる。
// 波2の結果発表のあとにタイムセールラッシュ、波3のあとにボス戦(途中で母艦に乗りこむ)。

import { beforeEach, describe, expect, it } from 'vitest';
import { BossFight } from './boss';
import { rushEndLine } from './content';
import { damageAnalogy } from './format';
import { MALL_REACTIONS } from './mallContent';
import { rushSummary } from './reasons';
import { clearRecords, saveResult } from './records';
import { PROP_COST, resolveEncounter } from './rules';
import { ABDUCTED_CAPTION, buildShareText, shareCaption } from './share';
import { createStage, saleRushOf } from './stage';
import { STAGES } from './stages';
import { StatsTracker } from './stats';
import { MemStorage } from './testHelpers';
import { decideTitle } from './titles';
import { UfoQueue } from './ufo';
import type { SortChoice, Stage, StageStats } from './types';

interface PlayOptions {
  /** 宇宙人をどちらに仕分けるか */
  sortAlien: SortChoice;
  /** UFOが来たら行けを押すか */
  goUfo: boolean;
  /** ラッシュで待てを押す相手。'civ' なら市民だけ(まちがいなし)、'none' なら誰にも押さない */
  rushStop: 'civ' | 'none';
}

/** 1ステージを遊ぶ。市民は市民に、親玉は宇宙人に仕分ける */
function play(stage: Stage, o: PlayOptions): StageStats {
  const stats = new StatsTracker(stage.villainTotal, stage.id);
  const ufos = new UfoQueue();
  let boarded = false;
  for (const w of stage.waves) {
    for (const p of w.people) {
      const choice: SortChoice = p.truth === 'civ' ? 'civ' : p.truth === 'boss' ? 'bad' : o.sortAlien;
      const e = resolveEncounter(p.truth, choice);
      if (e === 'hitBad') stats.defeatBad('sort');
      else if (e === 'passBad') {
        expect(stats.mischief(p.look)).toBe(0); // 空への合図は悪さに数えない
        ufos.add(p.id);
        // UFOが来るのを待つ(1機ずつ)
        for (let guard = 0; guard < 100 && !ufos.idle; guard++) {
          for (const ev of ufos.update(100)) {
            if (ev.phase === 'beam' && o.goUfo) {
              expect(ufos.go()).toBe(ev.alienId);
              stats.ufoDowned();
            }
            if (ev.phase === 'abducted') {
              stats.ufoEscaped();
              stats.reportScene('abducted');
            }
          }
        }
      } else if (e === 'bossFight') {
        const f = new BossFight(STAGES[stage.id].bossFight);
        while (!f.isOver) {
          if (f.tap().boardedCar) boarded = true;
          const r = f.update(100);
          if (r.boardedCar) boarded = true;
          stats.addBossDamage(r.damageYen);
        }
        stats.defeatBoss(f.seconds!);
        const prop = STAGES[stage.id].bossDefeatProp;
        if (prop) stats.breakProp(prop);
      } else {
        expect(e).toBe('passCiv');
      }
    }
    // 波2の結果発表のあと:タイムセールラッシュ
    const sale = saleRushOf(stage);
    if (w.no === 2 && sale) {
      stats.startRush(sale);
      for (const r of sale.runners) {
        if (o.rushStop === 'civ' && r.truth === 'civ') stats.rushStopped(r.truth);
        else {
          stats.rushHit(r.truth);
          if (r.truth === 'civ') stats.reportScene('civHit', 'punch');
        }
      }
    }
  }
  expect(boarded, '親玉が母艦に乗りこむ').toBe(true);
  return stats.snapshot();
}

const aliensOf = (stage: Stage): number => stage.waves.reduce((n, w) => n + w.badCount, 0);

describe('ステージ3を通しで数える', () => {
  beforeEach(() => clearRecords(null));

  it('全員正しく仕分けると全員撃破。ラッシュの数はほかの数字に入らない。倒したとき噴水の¥150万', () => {
    for (let i = 0; i < 50; i++) {
      const stage = createStage(i * 13 + 5, 'mall');
      const s = play(stage, { sortAlien: 'bad', goUfo: true, rushStop: 'none' });
      expect(s.stageId).toBe('mall');
      expect(s.defeated).toBe(stage.villainTotal);
      expect(s.allDefeated).toBe(true);
      expect(s.defeatedBySort).toBe(aliensOf(stage));
      expect(s.civHurt).toBe(0);
      expect(s.escaped).toBe(0);
      expect(s.damage).toBe(1_500_000);
      expect(s.propsBroken.fountain).toBe(1);
      // ラッシュで全員殴った:宇宙人は全員倒し、市民も全員殴ったが、ほかの数字は変わらない
      expect(s.rush).toEqual({
        aliens: saleRushOf(stage)!.alienCount, aliensDefeated: saleRushOf(stage)!.alienCount, aliensSpared: 0,
        civs: saleRushOf(stage)!.civCount, civsSaved: 0, civsHit: saleRushOf(stage)!.civCount
      });
      expect(s.civSavedByStop).toBe(0);
      expect(s.worstScene).toBe('civHit');
      // 市民をなぐったのはラッシュだけなので、完全無欠のまま
      expect(decideTitle(s).id).toBe('flawless');
    }
  });

  it('見逃した宇宙人のUFOを全部行けで落とす:撃破と「行けで倒した」に数え、UFO1機¥300万', () => {
    const stage = createStage(77, 'mall');
    const n = aliensOf(stage);
    const s = play(stage, { sortAlien: 'civ', goUfo: true, rushStop: 'civ' });
    expect(s.defeated).toBe(stage.villainTotal);
    expect(s.defeatedByGo).toBe(n);
    expect(s.defeatedByUfo).toBe(n);
    expect(s.ufosDowned).toBe(n);
    expect(s.civHurt).toBe(0);
    expect(s.damage).toBe(n * PROP_COST.ufo + 1_500_000);
    expect(damageAnalogy(s.damage, 'mall').text).toContain('噴水');
    // ラッシュは市民を全員守り、宇宙人を全員倒した
    expect(rushSummary(s.rush!)).toBe(`セール：撃破${s.rush!.aliens}/${s.rush!.aliens}・守った${s.rush!.civs}/${s.rush!.civs}`);
    expect(MALL_REACTIONS.rushEndGood).toContain(rushEndLine(s.rush!));
    // 全員倒して市民のけが0(被害額¥500万以上)は、ほんものヒーローが先。
    expect(decideTitle(s).id).toBe('realHero');
    // 全員は倒していないことにすると、タイムセールの守り神。市民を1人殴っていれば取れない
    // (ボス戦は連打したので速い。連打の申し子より先に UFOハンターが出ないよう、ボス戦を遅くする)
    const partial = { ...s, allDefeated: false, bossFightSec: 9 };
    expect(decideTitle(partial).id).toBe('saleGuardian');
    expect(decideTitle({ ...partial, rush: { ...s.rush!, civsSaved: s.rush!.civs - 1, civsHit: 1 } }).id).toBe('ufoHunter');
  });

  it('行けを押さないと、買い物客がさらわれ(市民のけが)、宇宙人は逃げる。いちばんひどい場面は「市民がさらわれた!」', () => {
    const stage = createStage(99, 'mall');
    const n = aliensOf(stage);
    const s = play(stage, { sortAlien: 'civ', goUfo: false, rushStop: 'civ' });
    expect(s.civHurtByAbduction).toBe(n);
    expect(s.civHurt).toBe(n);
    expect(s.escaped).toBe(n);
    expect(s.escapedByUfo).toBe(n);
    expect(s.defeated).toBe(1); // 親玉だけ
    expect(s.damage).toBe(1_500_000);
    expect(s.worstScene).toBe('abducted');
    expect(decideTitle(s).id).toBe('ufoGuide');
    const caption = shareCaption({ worstScene: s.worstScene, caption: ABDUCTED_CAPTION, titleName: '宇宙人の案内係' });
    expect(buildShareText({ caption, url: 'u' }).split('\n')).toEqual(['市民がさらわれた!', '#StupidHero', 'u']);
  });

  it('記録:通しで遊んだ結果を保存すると、いちばん多く倒した数などがそのまま残る', () => {
    const st = new MemStorage();
    const stage = createStage(77, 'mall');
    const s = play(stage, { sortAlien: 'civ', goUfo: true, rushStop: 'civ' });
    const saved = saveResult('mall', s, decideTitle(s).id, st);
    expect(saved.firstPlay).toBe(true);
    expect(saved.stage).toMatchObject({ mostDefeated: stage.villainTotal, fewestHurt: 0, plays: 1, clears: 1 });
  });
});
