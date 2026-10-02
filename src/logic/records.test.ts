import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_RECORDS_KEY, RECORDS_KEY, clearRecords, hasAnyRecord, hasSeenRush, isFirstClear, isStageUnlocked, loadRecords, markEndingSeen,
  markFreeIntroSeen, markIntroSeen, markLessonSeen, markRushSeen, markSlowHintSeen, markTitleListSeen, needsEnding, needsFreeIntro,
  needsIntro, needsLesson, needsSlowHint, saveFreeResult, saveResult, stageSelectInfo, unseenTitles, type RecordStorage, type Records
} from './records';
import { MemStorage, makeStats } from './testHelpers';
import { TITLES, titlesAt } from './titles';
import type { StageStats } from './types';

const broken: RecordStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); }
};

// 市民のけがは2人、被害額は¥1,000万
const stats = (over: Partial<StageStats> = {}): StageStats =>
  makeStats({ civHurt: 2, civHurtByHero: 2, damage: 10_000_000, damageByProps: 10_000_000 }, over);

describe('records', () => {
  beforeEach(() => clearRecords(null));

  it('初めては新記録なし、2回目から良くなった項目だけ', () => {
    const st = new MemStorage();
    const a = saveResult('alley', stats(), 'soSo', st);
    expect(a.firstPlay).toBe(true);
    expect(a.newRecords).toEqual([]);
    expect(a.persisted).toBe(true);
    expect(a.titlesCollected).toBe(1);
    expect(a.stage).toEqual({
      mostDefeated: 5, fewestHurt: 2, highestDamage: 10_000_000, fastestBossSec: 8, plays: 1, clears: 1, titles: ['soSo']
    });

    const b = saveResult('alley', stats({ defeated: 7, civHurt: 3, damage: 20_000_000, bossFightSec: 6 }), 'demolition', st);
    expect(b.firstPlay).toBe(false);
    expect(b.newRecords).toEqual(['mostDefeated', 'highestDamage', 'fastestBossSec']);
    expect(b.stage.fewestHurt).toBe(2);
    expect(b.titleIsNew).toBe(true);
    expect(b.titlesCollected).toBe(2);

    const c = saveResult('alley', stats({ bossFightSec: null }), 'soSo', st);
    expect(c.titleIsNew).toBe(false);
    expect(c.titlesCollected).toBe(2);
    expect(c.stage.fastestBossSec).toBe(6);
    expect(c.stage.plays).toBe(3);
    expect(loadRecords(st).titles).toEqual(['soSo', 'demolition']);
  });

  it('最後に遊んだステージを覚える(ない記録や知らない id は null)', () => {
    const st = new MemStorage();
    expect(loadRecords(st).lastStage).toBeNull();
    saveResult('garage', stats(), 'soSo', st);
    expect(loadRecords(st).lastStage).toBe('garage');
    saveResult('alley', stats(), 'soSo', st);
    expect(loadRecords(st).lastStage).toBe('alley');
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, lastStage: 'moon' }));
    expect(loadRecords(st).lastStage).toBeNull();
  });

  it('壊れたデータや知らない称号は捨てる', () => {
    const st = new MemStorage();
    st.setItem(RECORDS_KEY, '{not json');
    // 何も残していないときと同じ空の記録になる(項目を足しても、ここは直さなくてよい)
    expect(loadRecords(st)).toEqual(loadRecords(new MemStorage()));
    st.setItem(RECORDS_KEY, JSON.stringify({ stages: { alley: { mostDefeated: 'x', plays: 2 } }, titles: ['soSo', 'hack', 'soSo'] }));
    const r = loadRecords(st);
    expect(r.titles).toEqual(['soSo']);
    expect(r.stages.alley?.mostDefeated).toBeNull();
    expect(r.stages.alley?.plays).toBe(2);
  });

  it('localStorage が使えなくても落ちず、その場では覚えている', () => {
    const a = saveResult('alley', stats(), 'soSo', broken);
    expect(a.persisted).toBe(false);
    const b = saveResult('alley', stats({ defeated: 9 }), 'realHero', broken);
    expect(b.firstPlay).toBe(false);
    expect(b.newRecords).toContain('mostDefeated');
    expect(b.titlesCollected).toBe(2);
    expect(() => saveResult('alley', stats(), 'soSo', null)).not.toThrow();
    expect(() => loadRecords()).not.toThrow();
  });

  it('記録と称号はステージごと。称号の数は全部のステージを合わせて数える', () => {
    const st = new MemStorage();
    saveResult('alley', stats(), 'soSo', st);
    saveResult('alley', stats(), 'realHero', st);
    const g = saveResult('garage', stats({ stageId: 'garage', defeated: 9, damage: 3_000_000 }), 'soSo', st);
    expect(g.firstPlay).toBe(true);
    expect(g.titleIsNew).toBe(false); // 路地裏でもう取っている
    expect(g.titlesCollected).toBe(2);
    expect(g.stageTitlesCollected).toBe(1);
    const h = saveResult('garage', stats({ stageId: 'garage' }), 'roundUp', st);
    expect(h.titleIsNew).toBe(true);
    expect(h.titlesCollected).toBe(3);
    expect(h.titlesTotal).toBe(24);
    const r = loadRecords(st);
    expect(r.stages.alley!.titles).toEqual(['soSo', 'realHero']);
    expect(r.stages.garage!.titles).toEqual(['soSo', 'roundUp']);
    expect(r.stages.alley!.plays).toBe(2);
    expect(r.stages.garage!.plays).toBe(2);
    expect(r.stages.garage!.mostDefeated).toBe(9);
    expect(r.stages.alley!.mostDefeated).toBe(5);
    expect(r.titles).toEqual(['soSo', 'realHero', 'roundUp']);
  });

  it('ステージは前のステージのボスを一度倒すと開く(路地裏、地下駐車場、モール、高層ビルの順)', () => {
    const st = new MemStorage();
    expect(isStageUnlocked('alley', loadRecords(st))).toBe(true);
    expect(isStageUnlocked('garage', loadRecords(st))).toBe(false);
    // ボスを倒していなければ開かない
    const a = saveResult('alley', stats({ bossDefeated: false, bossFightSec: null }), 'soSo', st);
    expect(a.unlockedNow).toEqual([]);
    expect(isStageUnlocked('garage', loadRecords(st))).toBe(false);
    const b = saveResult('alley', stats(), 'soSo', st);
    expect(b.unlockedNow).toEqual(['garage']);
    expect(b.stage.clears).toBe(1);
    expect(isStageUnlocked('garage', loadRecords(st))).toBe(true);
    // 路地裏だけではモールは開かない。開いたと伝えるのは1回だけ
    expect(isStageUnlocked('mall', loadRecords(st))).toBe(false);
    expect(saveResult('alley', stats(), 'soSo', st).unlockedNow).toEqual([]);
    const info = stageSelectInfo(loadRecords(st));
    expect(info.map((i) => [i.id, i.unlocked, i.titlesCollected])).toEqual([['alley', true, 1], ['garage', true, 0], ['mall', false, 0], ['tower', false, 0]]);
    expect(info[0].record?.plays).toBe(3);
    expect(info[1].record).toBeNull();
    expect(info[1].def.name).toBe('地下駐車場');

    const g = saveResult('garage', stats({ stageId: 'garage' }), 'soSo', st);
    expect(g.unlockedNow).toEqual(['mall']);
    expect(stageSelectInfo(loadRecords(st)).map((i) => i.unlocked)).toEqual([true, true, true, false]);
    const m = saveResult('mall', stats({ stageId: 'mall' }), 'ufoHunter', st);
    expect(m.unlockedNow).toEqual(['tower']);
    expect(stageSelectInfo(loadRecords(st)).map((i) => i.unlocked)).toEqual([true, true, true, true]);
    expect(m.firstPlay).toBe(true);
    expect(m.titlesCollected).toBe(2);
    expect(loadRecords(st).stages.mall!.titles).toEqual(['ufoHunter']);
  });

  it('タイムセールラッシュを見たステージを覚える(掛け合いと同じ形)。おかしな値は捨てる', () => {
    const st = new MemStorage();
    expect(hasSeenRush('mall', loadRecords(st))).toBe(false);
    markRushSeen('mall', st);
    markRushSeen('mall', st);
    expect(loadRecords(st).rushSeen).toEqual(['mall']);
    expect(hasSeenRush('mall', loadRecords(st))).toBe(true);
    // rushSeen のない前の記録も読める
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], introSeen: ['alley'] }));
    expect(loadRecords(st).rushSeen).toEqual([]);
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], introSeen: [], rushSeen: ['mall', 'moon', 1, 'mall'] }));
    expect(loadRecords(st).rushSeen).toEqual(['mall']);
  });

  it('v2 が壊れていたら v1 を読む。知らないステージは捨てる', () => {
    const st = new MemStorage();
    st.setItem(RECORDS_KEY, '{broken');
    st.setItem(LEGACY_RECORDS_KEY, JSON.stringify({ version: 1, stages: { alley: { plays: 2 } }, titles: ['soSo'] }));
    expect(loadRecords(st).stages.alley!.plays).toBe(2);
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: { moon: { plays: 1 }, garage: { plays: 1, titles: ['gangDriver', 'x'] } }, titles: [] }));
    const r = loadRecords(st);
    expect(Object.keys(r.stages)).toEqual(['garage']);
    expect(r.stages.garage!.titles).toEqual(['gangDriver']);
    expect(r.titles).toEqual(['gangDriver']);
  });

  it('掛け合いを見たステージを覚える。見たか遊んだステージは次からとばす', () => {
    const st = new MemStorage();
    const r0 = loadRecords(st);
    expect(r0.introSeen).toEqual([]);
    expect(hasAnyRecord(r0)).toBe(false);
    expect(needsIntro('alley', r0)).toBe(true);
    expect(needsIntro('garage', r0)).toBe(true);

    markIntroSeen('alley', st);
    markIntroSeen('alley', st);
    const r1 = loadRecords(st);
    expect(r1.introSeen).toEqual(['alley']);
    expect(needsIntro('alley', r1)).toBe(false);
    expect(needsIntro('garage', r1)).toBe(true);
    // 見ただけでは「遊んだ」にならない
    expect(hasAnyRecord(r1)).toBe(false);

    // 結果を保存しても、見た印は消えない
    saveResult('alley', stats(), 'soSo', st);
    expect(loadRecords(st).introSeen).toEqual(['alley']);
    expect(hasAnyRecord(loadRecords(st))).toBe(true);

    // 掛け合いを見ずに遊んだステージ(前の版で遊んだ人など)も、とばす
    saveResult('garage', stats({ stageId: 'garage' }), 'soSo', st);
    expect(needsIntro('garage', loadRecords(st))).toBe(false);
  });

  it('introSeen のない前の記録や、おかしな値でも読める', () => {
    const st = new MemStorage();
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: { alley: { plays: 0 } }, titles: [] }));
    expect(loadRecords(st).introSeen).toEqual([]);
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], introSeen: ['garage', 'moon', 3, 'garage'] }));
    expect(loadRecords(st).introSeen).toEqual(['garage']);
    st.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], introSeen: 'alley' }));
    expect(loadRecords(st).introSeen).toEqual([]);
    // v1 の記録で遊んだことがあれば、掛け合いはとばす
    const v1 = new MemStorage();
    v1.setItem(LEGACY_RECORDS_KEY, JSON.stringify({ version: 1, stages: { alley: { plays: 2 } }, titles: [] }));
    expect(needsIntro('alley', loadRecords(v1))).toBe(false);
    expect(hasAnyRecord(loadRecords(v1))).toBe(true);
  });
});

describe('localStorage が使えなくても、見た印はその場で覚えている', () => {
  beforeEach(() => clearRecords(null));

  it('掛け合い、ラッシュ、終わりの場面、ゆっくりモードの案内、フリープレイの掛け合い、待ての教え、称号の一覧', () => {
    const marks: { name: string; seen: (r: Records) => boolean; mark: (s: RecordStorage) => void; before?: () => void }[] = [
      { name: '掛け合い', seen: (r) => !needsIntro('alley', r), mark: (s) => markIntroSeen('alley', s) },
      { name: 'ラッシュ', seen: (r) => hasSeenRush('mall', r), mark: (s) => markRushSeen('mall', s) },
      { name: '終わりの場面', seen: (r) => r.endingSeen, mark: (s) => markEndingSeen(s) },
      { name: 'ゆっくりモードの案内', seen: (r) => !needsSlowHint(r), mark: (s) => markSlowHintSeen(s) },
      { name: 'フリープレイの掛け合い', seen: (r) => !needsFreeIntro(r), mark: (s) => markFreeIntroSeen(s) },
      { name: '待ての教え', seen: (r) => !needsLesson('stop', r), mark: (s) => markLessonSeen('stop', s) },
      {
        name: '称号の一覧', seen: (r) => unseenTitles(r).length === 0, mark: (s) => markTitleListSeen(['flawless'], s),
        before: () => saveResult('alley', stats(), ['flawless'], broken)
      }
    ];
    for (const m of marks) {
      clearRecords(null);
      m.before?.();
      expect(m.seen(loadRecords(broken)), `${m.name}:見る前`).toBe(false);
      expect(() => m.mark(broken), m.name).not.toThrow();
      expect(m.seen(loadRecords(broken)), `${m.name}:見たあと`).toBe(true);
    }
  });
});

describe('ボスを初めて倒したか(最上階のヒーロー)', () => {
  beforeEach(() => clearRecords(null));

  it('記録を残す前に、倒した回数が0でボスを倒していれば初めて。残したあとは初めてではない', () => {
    const st = new MemStorage();
    const lost = stats({ stageId: 'tower', bossDefeated: false, bossFightSec: null });
    const won = stats({ stageId: 'tower' });
    expect(isFirstClear('tower', lost, loadRecords(st))).toBe(false);
    expect(saveResult('tower', lost, 'soSo', st).firstClear).toBe(false);
    expect(isFirstClear('tower', won, loadRecords(st))).toBe(true);
    const a = saveResult('tower', won, 'topHero', st);
    expect(a.firstClear).toBe(true);
    expect(loadRecords(st).stages.tower!.titles).toEqual(['soSo', 'topHero']);
    expect(isFirstClear('tower', won, loadRecords(st))).toBe(false);
    expect(saveResult('tower', won, 'soSo', st).firstClear).toBe(false);
    // ステージごとに数える
    expect(isFirstClear('alley', stats(), loadRecords(st))).toBe(true);
  });
});

describe('高層ビルの終わりの場面(needsEnding、markEndingSeen)', () => {
  beforeEach(() => clearRecords(null));

  it('高層ビルのボスを初めて倒したときだけ出す。見たあとと、見る前にボスを倒した記録があるとき(2回目のクリア)は出さない', () => {
    const st = new MemStorage();
    const won = stats({ stageId: 'tower' });
    const lost = stats({ stageId: 'tower', bossDefeated: false, bossFightSec: null });
    expect(loadRecords(st).endingSeen).toBe(false);
    expect(needsEnding('tower', won, loadRecords(st))).toBe(true);
    expect(needsEnding('tower', lost, loadRecords(st))).toBe(false);
    // ほかのステージにはない
    expect(needsEnding('mall', stats({ stageId: 'mall' }), loadRecords(st))).toBe(false);
    markEndingSeen(st);
    expect(loadRecords(st).endingSeen).toBe(true);
    expect(needsEnding('tower', won, loadRecords(st))).toBe(false);

    // 空の保存先を読むと、さっき書いた控え(メモリ)が返るので、先に消す
    clearRecords(null);
    const again = new MemStorage();
    saveResult('tower', won, 'soSo', again);
    expect(needsEnding('tower', won, loadRecords(again))).toBe(false);
    // 前の記録(endingSeen がない)は、見ていないとして読む
    const old = new MemStorage();
    old.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [] }));
    expect(loadRecords(old).endingSeen).toBe(false);
  });
});

describe('1回のプレイの称号', () => {
  beforeEach(() => clearRecords(null));

  it('1回のプレイの称号を全部残す。初めて取った称号と、このステージで初めての称号を返す', () => {
    const st = new MemStorage();
    const a = saveResult('alley', stats(), ['flawless', 'realHero', 'tapProdigy'], st);
    expect(a.titles).toEqual(['flawless', 'realHero', 'tapProdigy']);
    expect(a.titleIsNew).toBe(true);
    expect(a.newTitles).toEqual(['flawless', 'realHero', 'tapProdigy']);
    expect(a.newHere).toEqual(['flawless', 'realHero', 'tapProdigy']);
    expect(a.stage.titles).toEqual(['flawless', 'realHero', 'tapProdigy']);
    expect(a.titlesCollected).toBe(3);
    expect(a.stageTitlesCollected).toBe(3);
    // 地下駐車場で同じ称号を取ると、全体では新しくないが、このステージでは初めて
    const b = saveResult('garage', stats(), ['realHero', 'roundUp', 'realHero'], st);
    expect(b.titles).toEqual(['realHero', 'roundUp']);
    expect(b.titleIsNew).toBe(false);
    expect(b.newTitles).toEqual(['roundUp']);
    expect(b.newHere).toEqual(['realHero', 'roundUp']);
    expect(b.titlesCollected).toBe(4);
    expect(b.stageTitlesCollected).toBe(2);
    expect(stageSelectInfo(loadRecords(st)).map((e) => e.titlesCollected)).toEqual([3, 2, 0, 0]);
    // 1つだけ渡す前からの書き方も使える
    const c = saveResult('alley', stats(), 'soSo', st);
    expect(c.titles).toEqual(['soSo']);
    expect(c.newHere).toEqual(['soSo']);
  });

  it('フリープレイも1回の称号を全部残す(ステージの称号の数には入れない)', () => {
    const st = new MemStorage();
    saveResult('alley', stats(), ['stopMaster'], st);
    const free = makeStats({ civHurt: 0, civHurtByHero: 0 });
    const f = saveFreeResult(free, ['heroSitter', 'heroInterpreter', 'stopMaster'], st);
    expect(f.titles).toEqual(['heroSitter', 'heroInterpreter', 'stopMaster']);
    expect(f.newTitles).toEqual(['heroSitter', 'heroInterpreter']);
    expect(f.newHere).toEqual(['heroSitter', 'heroInterpreter', 'stopMaster']);
    expect(f.free.titles).toEqual(['heroSitter', 'heroInterpreter', 'stopMaster']);
    expect(f.titlesCollected).toBe(3);
    expect(loadRecords(st).stages.alley?.titles).toEqual(['stopMaster']);
  });
});

describe('称号の一覧の NEW(unseenTitles、markTitleListSeen)', () => {
  beforeEach(() => clearRecords(null));

  it('称号の一覧で見た称号:前からの記録(listSeen がない)は全部見たことにする。開いたあとに取った称号だけ NEW', () => {
    const old = new MemStorage();
    old.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: { alley: { plays: 2, clears: 1, titles: ['soSo', 'stopMaster'] } }, titles: ['soSo', 'stopMaster'] }));
    const r = loadRecords(old);
    expect(r.titles).toEqual(['soSo', 'stopMaster']);
    expect(r.listSeen).toEqual(['soSo', 'stopMaster']);
    expect(unseenTitles(r)).toEqual([]);
    // 新しく取った称号は NEW。一覧を開いたら見たことにする
    saveResult('alley', stats(), ['tapProdigy', 'stopMaster'], old);
    expect(unseenTitles(loadRecords(old))).toEqual(['tapProdigy']);
    markTitleListSeen(TITLES.map((t) => t.id), old);
    expect(unseenTitles(loadRecords(old))).toEqual([]);
    expect(loadRecords(old).listSeen).toEqual(['soSo', 'stopMaster', 'tapProdigy']);
    // ステージ1だけの公開版(v1)の記録も、全部見たことにして読む
    const v1 = new MemStorage();
    v1.setItem(LEGACY_RECORDS_KEY, JSON.stringify({ version: 1, stages: { alley: { plays: 1 } }, titles: ['grannyFoe'] }));
    expect(unseenTitles(loadRecords(v1))).toEqual([]);
    // 知らない称号は捨てる
    const bad = new MemStorage();
    bad.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: ['soSo'], listSeen: ['hack', 'soSo', 3] }));
    expect(loadRecords(bad).listSeen).toEqual(['soSo']);
  });

  it('称号の一覧で見たことにするのは、一覧に並べた称号だけ(ステージのカードから開いた一覧で、ほかの場所の NEW を消さない)', () => {
    const st = new MemStorage();
    saveResult('alley', stats(), ['stopMaster'], st);
    saveFreeResult(makeStats({ civHurt: 0, civHurtByHero: 0 }), ['heroSitter'], st);
    expect(unseenTitles(loadRecords(st))).toEqual(['stopMaster', 'heroSitter']);
    // 路地裏の称号だけを並べた一覧を開いた:フリープレイだけの称号の NEW は残る
    markTitleListSeen(titlesAt('alley').map((t) => t.id), st);
    expect(unseenTitles(loadRecords(st))).toEqual(['heroSitter']);
    // まだ取っていない称号を並べても、見たことにはしない(あとで取ったときに NEW がつく)
    expect(loadRecords(st).listSeen).not.toContain('flawless');
    saveResult('alley', stats(), ['flawless'], st);
    expect(unseenTitles(loadRecords(st))).toEqual(['heroSitter', 'flawless']);
    // 全部を並べた一覧を開くと、全部見たことになる。もう一度開いても同じ(NEW はまた出ない)
    markTitleListSeen(TITLES.map((t) => t.id), st);
    expect(unseenTitles(loadRecords(st))).toEqual([]);
    markTitleListSeen(TITLES.map((t) => t.id), st);
    expect(unseenTitles(loadRecords(st))).toEqual([]);
  });
});

describe('ゆっくりモードの案内(needsSlowHint、markSlowHintSeen)', () => {
  beforeEach(() => clearRecords(null));

  it('教えるのは1回だけ。前の記録(slowHintSeen がない)は、まだ教えていないとして読む', () => {
    const old = new MemStorage();
    old.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: { alley: { plays: 3, clears: 1, titles: ['soSo'] } }, titles: ['soSo'] }));
    const r = loadRecords(old);
    expect(r.slowHintSeen).toBe(false);
    expect(needsSlowHint(r)).toBe(true);
    expect(r.stages.alley?.plays).toBe(3);
    // 教えたら残り、ほかの記録は変わらない。2回呼んでも同じ
    markSlowHintSeen(old);
    expect(loadRecords(old).slowHintSeen).toBe(true);
    expect(loadRecords(old).stages.alley?.plays).toBe(3);
    markSlowHintSeen(old);
    expect(needsSlowHint(loadRecords(old))).toBe(false);
    // ステージ1だけの公開版(v1)の記録も、まだ教えていないとして読む
    const v1 = new MemStorage();
    v1.setItem(LEGACY_RECORDS_KEY, JSON.stringify({ version: 1, stages: { alley: { plays: 1 } }, titles: ['grannyFoe'] }));
    expect(needsSlowHint(loadRecords(v1))).toBe(true);
    // true のほかの値は、教えていないとして読む
    const bad = new MemStorage();
    bad.setItem(RECORDS_KEY, JSON.stringify({ version: 2, stages: {}, titles: [], slowHintSeen: 'yes' }));
    expect(needsSlowHint(loadRecords(bad))).toBe(true);
  });
});
