// フリープレイを通しで数える(並び → 数え方 → 称号 → 記録 → 共有の文)。画面の代わりに、決めた遊び方で出来事を起こす。

import { beforeEach, describe, expect, it } from 'vitest';
import { createFreePlay, freeRoleOf, isSceneHead, type FreePlan } from './freeplay';
import { clearRecords, emptyFreeRecord, freeSelectInfo, isFreeUnlocked, loadRecords, markFreeIntroSeen, needsFreeIntro, saveFreeResult, saveResult, RECORDS_KEY, type RecordStorage } from './records';
import { FREE_WORST_CAPTION, freeShareCaption, freeShareTexts, heroAccuracyText, ruleQuote } from './share';
import { FREE_WORST_SCENE_RANK, StatsTracker, freeWaveScene, sceneForCivHit } from './stats';
import { TITLES, decideTitle, titleById, titlesFor, titlesForFree } from './titles';
import type { Person, StageStats } from './types';

class MemStorage implements RecordStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
}

type Style = 'perfect' | 'handsOff' | 'stopAll';

/**
 * 決めた遊び方で1回通す。
 * perfect:市民だけに待て、行けのチャンスは全部行け / handsOff:何も押さない / stopAll:殴りかかる相手全員に待て(ワルは取り返す)
 */
function play(plan: FreePlan, style: Style, rawSec = 100): StatsTracker {
  const stats = new StatsTracker(plan.stage.villainTotal, plan.stage.id);
  stats.startFree(plan);
  plan.stage.waves.forEach((w, i) => {
    const fw = plan.waves[i];
    stats.setFreeRule(fw.rule);
    for (const p of w.people) {
      if (fw.redeclare && p.index === fw.redeclare.after) stats.setFreeRule(fw.redeclare.rule);
      if (!isSceneHead(w, p)) continue;
      const role = freeRoleOf(fw, p);
      if (role === 'stop') {
        if (style === 'handsOff') {
          stats.hurtCiv('hero', p.look);
          stats.reportScene(sceneForCivHit(p.look, 'punch'), 'punch');
        } else {
          stats.stopped('civ');
          stats.reportFreeScene('closeCall');
        }
      } else if (role === 'heroBad') {
        if (style === 'stopAll') {
          stats.stopped('bad');
          goOn(stats, p, true);
        } else stats.defeatBad('sort');
      } else if (role === 'go') {
        stats.reportFreeScene(freeWaveScene(p.look));
        if (style === 'handsOff') escape(stats, p);
        else goOn(stats, p, false);
      }
    }
  });
  stats.finishFree(rawSec);
  return stats;
}

function goOn(stats: StatsTracker, p: Person, recovered: boolean): void {
  if (p.look === 'fp_gang') stats.groupWiped(2);
  else if (p.look === 'fp_alien') stats.ufoDowned(recovered);
  else stats.defeatBad('go', recovered);
}

function escape(stats: StatsTracker, p: Person): void {
  if (p.look === 'fp_gang') stats.groupEscaped(2);
  else if (p.look === 'fp_alien') stats.ufoEscaped();
  else {
    stats.mischief(p.look);
    stats.escaped(true);
  }
}

const PLAN = createFreePlay(2024, ['alley', 'garage', 'mall']);
const ALLEY = createFreePlay(2024, ['alley']);

describe('フリープレイの数え方', () => {
  it('何も押さなければ、ヒーローだけの当たりと直したあとの当たりが同じ(10/27)。称号はなすがまま', () => {
    for (const plan of [PLAN, ALLEY]) {
      const s = play(plan, 'handsOff').snapshot();
      const f = s.free!;
      expect(f).toMatchObject({ heroRight: 10, fixedRight: 10, units: 27, stopSaved: 0, goScenes: 0, effectiveStops: 0, effectiveGos: 0 });
      expect(heroAccuracyText(f)).toBe('ヒーローだけなら10/27人、あなたが直して10/27人');
      // 行けのチャンスは全部逃げた。ギャングの組は2人を逃がしたに数える
      const goPeople = plan.stage.waves.flatMap((w, i) => w.people.filter((p) => freeRoleOf(plan.waves[i], p) === 'go')).length;
      expect(s.escaped).toBe(goPeople);
      expect(f.clearSec).toBe(100 + (s.escaped + s.civHurt) * 3);
      expect(decideTitle(s).id).toBe('letItBe');
    }
  });

  it('全部決めれば27/27。だれも傷つけず、だれも逃がさないのでお守り役', () => {
    const s = play(PLAN, 'perfect').snapshot();
    const f = s.free!;
    expect(f).toMatchObject({ fixedRight: 27, stopSaved: 9, goScenes: 8, recovered: 0, dryPresses: 0, clearSec: 100, rawSec: 100 });
    expect(s.escaped).toBe(0);
    expect(s.allDefeated).toBe(true);
    expect(heroAccuracyText(f)).toBe('ヒーローだけなら10/27人、あなたが直して27/27人');
    expect(decideTitle(s).id).toBe('heroSitter');
    // 完全無欠と街のほんものヒーローは、フリープレイでは出ない
    expect(decideTitle({ ...s, escaped: 1 }).id).toBe('heroInterpreter');
    expect(decideTitle({ ...s, escaped: 1, free: { ...f, dryPresses: 4 } }).id).not.toBe('heroInterpreter');
  });

  it('ワルに待てを押しても、すぐには逃がしたに数えない。行けで取り返せば逃がしたにならず、行けで決めたにも入らない', () => {
    const s = play(PLAN, 'stopAll').snapshot();
    const f = s.free!;
    expect(s.badSparedByStop).toBe(5); // 殴られるワル(波1の2人、波3の3人)
    expect(f.recovered).toBe(5);
    expect(f.goScenes).toBe(8);
    expect(f.effectiveStops).toBe(14);
    expect(f.effectiveGos).toBe(13);
    expect(s.escaped).toBe(0);
    expect(f.fixedRight).toBe(27);
  });

  it('待てで止めたワルが最後に逃げたら、そのときに逃がしたに数える', () => {
    const stats = new StatsTracker(3, 'alley');
    stats.startFree(PLAN);
    stats.stopped('bad');
    expect(stats.snapshot().escaped).toBe(0);
    stats.escaped(true);
    const s = stats.snapshot();
    expect(s.escaped).toBe(1);
    expect(s.civHurtByVillain).toBe(1);
    expect(s.free!.fixedRight).toBe(26);
    // ステージでは今まで通り、止めた瞬間に逃がしたに数える
    const st = new StatsTracker(3, 'alley');
    st.stopped('bad');
    expect(st.snapshot().escaped).toBe(1);
    expect(st.snapshot().free).toBeNull();
  });

  it('空押しとゆっくり。ゆっくりは一度オンにしたら戻らない', () => {
    const stats = new StatsTracker(3, 'alley');
    stats.startFree(PLAN);
    stats.dryPress();
    stats.dryPress();
    stats.setFreeSlow(true);
    stats.setFreeSlow(false);
    const f = stats.snapshot().free!;
    expect(f.dryPresses).toBe(2);
    expect(f.slow).toBe(true);
    expect(f.rawSec).toBeNull();
    expect(f.clearSec).toBeNull();
  });

  it('いちばんひどい場面:フリープレイの候補はステージの場面より弱い。ルールを覚える', () => {
    const stats = new StatsTracker(3, 'alley');
    stats.startFree(PLAN);
    stats.setFreeRule({ kind: 'allBad' });
    expect(stats.reportFreeScene('closeCall')).toBe(true);
    stats.setFreeRule({ kind: 'allCiv' });
    expect(stats.reportFreeScene('waveKnife')).toBe(true);
    expect(stats.reportFreeScene('waveUfo')).toBe(false);
    expect(stats.reportFreeScene('closeCall')).toBe(false);
    expect(stats.reportFreeScene(null)).toBe(false);
    let f = stats.snapshot().free!;
    expect([f.worst, f.worstRule]).toEqual(['waveKnife', { kind: 'allCiv' }]);
    stats.setFreeRule({ kind: 'item', item: 'balloon' });
    expect(stats.reportScene('grannyHit', 'punch')).toBe(true);
    expect(stats.reportFreeScene('waveGang')).toBe(false);
    const s = stats.snapshot();
    f = s.free!;
    expect(s.worstScene).toBe('grannyHit');
    expect(f.worstRule).toEqual({ kind: 'item', item: 'balloon' });
    expect(freeShareCaption({ worstScene: s.worstScene, caption: 'おばあちゃんに全力パンチ!', free: f, titleName: 'x' }))
      .toBe('『風船の人はワル!』でおばあちゃんに全力パンチ!');
    // 段:手を振った3つは同じ段、ギリギリセーフはその次
    expect(FREE_WORST_SCENE_RANK.waveGang).toBe(FREE_WORST_SCENE_RANK.waveKnife);
    expect(FREE_WORST_SCENE_RANK.closeCall).toBeGreaterThan(FREE_WORST_SCENE_RANK.waveUfo);
    expect([freeWaveScene('fp_mohawk'), freeWaveScene('fp_gang'), freeWaveScene('fp_alien'), freeWaveScene('suit')])
      .toEqual(['waveKnife', 'waveGang', 'waveUfo', null]);
    // フリープレイでないときは、フリープレイの場面は伝えても何も起きない
    expect(new StatsTracker(3).reportFreeScene('waveKnife')).toBe(false);
  });
});

describe('フリープレイの称号', () => {
  const s = (): StageStats => play(PLAN, 'perfect').snapshot();

  it('フリープレイだけの3つを先に上から調べ、そのあとステージの称号。調べない称号は出ない', () => {
    const ids = titlesForFree().map((t) => t.id);
    expect(ids.slice(0, 3)).toEqual(['heroSitter', 'heroInterpreter', 'letItBe']);
    for (const id of ['flawless', 'realHero', 'bossBuddy', 'tapProdigy', 'roundUp', 'gangDriver', 'ufoGuide', 'saleGuardian', 'ufoHunter']) {
      expect(ids, id).not.toContain(id);
    }
    expect(ids.slice(3)).toEqual(['civNemesis', 'demolition', 'grannyFoe', 'runawayTrain', 'stopMaster', 'chaseDemon', 'tooKind', 'soSo']);
    // ステージではフリープレイだけの称号は取れない
    for (const id of ['alley', 'garage', 'mall'] as const) {
      expect(titlesFor(id).map((t) => t.id)).not.toContain('heroSitter');
    }
    expect(titleById('heroSitter')).toMatchObject({ name: 'ヒーローのお守り役', pose: 'win_pose' });
    expect(titleById('heroInterpreter')).toMatchObject({ name: 'ヒーローの通訳', pose: 'win_arms' });
    expect(titleById('letItBe')).toMatchObject({ name: 'なすがまま', pose: 'win_shy' });
    expect(titleById('heroInterpreter').comment.who).toBe('hero');
    expect(titleById('heroSitter').comment.text).toBe('おバカ、全部止めたね！');
    expect(titleById('letItBe').comment.text).toBe('…もう知らない');
  });

  it('お守り役:なぐった市民とワルにやられた市民が0で逃がしたワルが0。まきぞえは数えない', () => {
    const base = s();
    expect(decideTitle({ ...base, civHurt: 2, civHurtByCollateral: 2 }).id).toBe('heroSitter');
    expect(decideTitle({ ...base, civHurt: 1, civHurtByAbduction: 1 }).id).toBe('heroInterpreter');
    expect(decideTitle({ ...base, civHurt: 1, civHurtByVillain: 1 }).id).toBe('heroInterpreter');
  });

  it('通訳:待て8人以上、行け7回以上、空押し3回まで', () => {
    const base = { ...s(), escaped: 1 };
    const f = base.free!;
    expect(decideTitle({ ...base, free: { ...f, stopSaved: 8, goScenes: 7, dryPresses: 3 } }).id).toBe('heroInterpreter');
    expect(decideTitle({ ...base, free: { ...f, stopSaved: 7, goScenes: 8 } }).id).not.toBe('heroInterpreter');
    expect(decideTitle({ ...base, free: { ...f, stopSaved: 9, goScenes: 6 } }).id).not.toBe('heroInterpreter');
  });

  it('なすがまま:効いた待てと行けが0なら、空押しがあっても取れる。おばあさんを殴っていても先に出る', () => {
    const hands = play(PLAN, 'handsOff').snapshot();
    expect(decideTitle({ ...hands, free: { ...hands.free!, dryPresses: 20 } }).id).toBe('letItBe');
    expect(decideTitle({ ...hands, free: { ...hands.free!, effectiveGos: 1 } }).id).not.toBe('letItBe');
    // なすがままでなければ、ステージの称号(市民の天敵など)
    expect(decideTitle({ ...hands, free: { ...hands.free!, effectiveStops: 1 } }).id).toBe('civNemesis');
  });

  it('ステージの称号の決め方は変わらない(stats.free がなければ、フリープレイだけの称号は出ない)', () => {
    const noFree: StageStats = { ...play(PLAN, 'handsOff').snapshot(), free: null, civHurt: 0, civHurtByHero: 0, damage: 0 };
    expect(['heroSitter', 'heroInterpreter', 'letItBe']).not.toContain(decideTitle(noFree).id);
    expect(TITLES).toHaveLength(20);
  });
});

describe('フリープレイの記録', () => {
  beforeEach(() => clearRecords(null));

  it('路地裏のボスを倒すと開く。初回だけ掛け合いを出す', () => {
    const st = new MemStorage();
    expect(isFreeUnlocked(loadRecords(st))).toBe(false);
    expect(freeSelectInfo(loadRecords(st))).toEqual({ unlocked: false, bestSec: null, bestSlowSec: null, record: null });
    const alley = play(ALLEY, 'perfect').snapshot();
    saveResult('alley', { ...alley, free: null, bossDefeated: true }, 'soSo', st);
    expect(isFreeUnlocked(loadRecords(st))).toBe(true);
    expect(needsFreeIntro(loadRecords(st))).toBe(true);
    markFreeIntroSeen(st);
    expect(needsFreeIntro(loadRecords(st))).toBe(false);
  });

  it('いちばん速い時間はふつうとゆっくりで別。待て、行け、被害額のいちばん良いもの。称号は全体に数える', () => {
    const st = new MemStorage();
    const a = play(PLAN, 'perfect', 110).snapshot();
    const r1 = saveFreeResult(a, decideTitle(a).id, st);
    expect(r1.firstPlay).toBe(true);
    expect(r1.newRecords).toEqual([]);
    expect(r1.free).toMatchObject({ bestSec: 110, bestSlowSec: null, mostStopSaved: 9, mostGoScenes: 8, plays: 1, titles: ['heroSitter'] });
    expect(r1.titlesTotal).toBe(20);
    expect(r1.titleIsNew).toBe(true);

    const b = play(PLAN, 'perfect', 90).snapshot();
    const r2 = saveFreeResult(b, 'heroSitter', st);
    expect(r2.newRecords).toEqual(['bestSec']);
    expect(r2.titleIsNew).toBe(false);

    const slow = play(PLAN, 'perfect', 150).snapshot();
    const r3 = saveFreeResult({ ...slow, free: { ...slow.free!, slow: true } }, 'heroSitter', st);
    expect(r3.free.bestSec).toBe(90);
    expect(r3.free.bestSlowSec).toBe(150);
    expect(r3.newRecords).toEqual([]);
    expect(freeSelectInfo(loadRecords(st))).toMatchObject({ bestSec: 90, bestSlowSec: 150 });
    expect(loadRecords(st).titles).toContain('heroSitter');
  });

  it('「ステージを進めると、出てくる人が増えるよ」は路地裏しか開いていない人に一度だけ', () => {
    const st = new MemStorage();
    const s = play(ALLEY, 'handsOff').snapshot();
    expect(saveFreeResult(s, 'letItBe', st).showMoreStagesHint).toBe(true);
    expect(saveFreeResult(s, 'letItBe', st).showMoreStagesHint).toBe(false);
  });

  it('前の形の記録(フリープレイの欄がない)も読める。壊れた欄は捨てる', () => {
    const st = new MemStorage();
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: { alley: { plays: 2, clears: 1, titles: ['soSo'] } }, titles: ['soSo'], introSeen: ['alley'], rushSeen: [] }));
    const r = loadRecords(st);
    expect(r.free).toEqual(emptyFreeRecord());
    expect([r.freeIntroSeen, r.freeMoreHintShown]).toEqual([false, false]);
    expect(r.stages.alley!.plays).toBe(2);
    expect(isFreeUnlocked(r)).toBe(true);
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], free: { bestSec: 'x', plays: 3, titles: ['letItBe', 'nope'] }, freeIntroSeen: 1 }));
    const b = loadRecords(st);
    expect(b.free).toEqual({ ...emptyFreeRecord(), plays: 3, titles: ['letItBe'] });
    expect(b.titles).toEqual(['letItBe']);
    expect(b.freeIntroSeen).toBe(false);
  });
});

describe('フリープレイの共有の文', () => {
  it('ルールの言い方と、場面の見出し。場面がなければ称号', () => {
    expect(ruleQuote({ kind: 'allBad' })).toBe('みんなワル!');
    expect(ruleQuote({ kind: 'allCiv' })).toBe('みんないい人!');
    expect(ruleQuote({ kind: 'item', item: 'hat' })).toBe('帽子の人はワル!');
    const f = { worst: 'waveGang' as const, worstRule: { kind: 'allCiv' as const } };
    expect(freeShareCaption({ worstScene: null, caption: '', free: f, titleName: 'なすがまま' })).toBe('『みんないい人!』でギャングの車に手を振って見送った!');
    expect(freeShareCaption({ worstScene: 'bossDefeated', caption: 'ボスを倒した!', free: f, titleName: 'x' }))
      .toBe(`『みんないい人!』で${FREE_WORST_CAPTION.waveGang}`);
    expect(freeShareCaption({ worstScene: 'civHit', caption: '市民をなぐった!', free: { worst: null, worstRule: { kind: 'allBad' } }, titleName: 'x' }))
      .toBe('『みんなワル!』で市民をなぐった!');
    expect(freeShareCaption({ worstScene: null, caption: '', free: { worst: null, worstRule: null }, titleName: 'ヒーローの通訳' }))
      .toBe('称号「ヒーローの通訳」');
  });

  it('文に半角スペースとエムダッシュを使わない', () => {
    for (const t of [...freeShareTexts(), heroAccuracyText({ heroRight: 10, fixedRight: 25, units: 27 })]) {
      expect(t, t).not.toMatch(/[ —―]/);
    }
    expect(heroAccuracyText({ heroRight: 10, fixedRight: 25, units: 27 })).toBe('ヒーローだけなら10/27人、あなたが直して25/27人');
  });
});
