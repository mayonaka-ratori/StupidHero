// 1回のプレイで当てはまった称号を全部集める(collectTitles)ことと、歩く解体工事の金額、
// フリープレイで取れる称号が本当に取れるか(決めた遊び方で出来事を起こして確かめる)。

import { describe, expect, it } from 'vitest';
import { createFreePlay } from './freeplay';
import { makeStats, playFree, type FreePolicy } from './testHelpers';
import { TITLES, TITLE_PLACES, collectTitles, decideTitle, placesOf, titlesAt, titlesFor, titlesForFree } from './titles';
import type { StageStats, TitleId } from './types';

const ids = (s: StageStats, firstClear = false): TitleId[] => collectTitles(s, { firstClear }).map((t) => t.id);

describe('1回のプレイで当てはまった称号を全部集める', () => {
  // 全員倒して、市民のけが0、被害額¥100万、ボス戦5秒、待てで3人守り、行けで3人倒した
  const great = (over: Partial<StageStats> = {}): StageStats => makeStats({
    allDefeated: true, defeated: 9, civHurt: 0, damage: 1_000_000, bossFightSec: 5, civSavedByStop: 3, defeatedByGo: 3, escaped: 0
  }, over);

  it('先頭は大きな称号(decideTitle と同じ)。うまく遊ぶと、連打の申し子や待ての達人も取られずに集まる', () => {
    const s = great();
    expect(decideTitle(s).id).toBe('flawless');
    expect(ids(s)).toEqual(['flawless', 'realHero', 'tapProdigy', 'stopMaster', 'chaseDemon']);
  });

  it('まあまあヒーローは、ほかに1つも当てはまらないときだけ', () => {
    const none = makeStats({ civHurt: 1, civHurtByHero: 1, damage: 2_000_000, escaped: 1, bossFightSec: 9 });
    expect(ids(none)).toEqual(['soSo']);
    expect(ids(great())).not.toContain('soSo');
  });

  it('ショッピングモールでうまく遊ぶと、タイムセールの守り神とUFOハンターも集まる', () => {
    const rush = { aliens: 4, aliensDefeated: 4, aliensSpared: 0, civs: 4, civsSaved: 4, civsHit: 0 };
    const s = great({ stageId: 'mall', damage: 6_000_000, rush, ufosDowned: 2 });
    expect(ids(s)).toEqual(['realHero', 'saleGuardian', 'tapProdigy', 'stopMaster', 'ufoHunter', 'chaseDemon']);
  });

  it('高層ビルのボスを初めて倒した回は、大きな称号が最上階のヒーロー。完全無欠も集まる', () => {
    const s = great({ stageId: 'tower', damage: 11_000_000, sofaSaves: 2 });
    expect(ids(s, true)[0]).toBe('topHero');
    expect(ids(s, true)).toEqual(expect.arrayContaining(['topHero', 'flawless', 'realHero', 'sofaMaster']));
    // 2回目からは最上階のヒーローは取れない
    expect(ids(s, false)[0]).toBe('flawless');
    expect(ids(s, false)).not.toContain('topHero');
  });

  it('ステージでは、そのステージで取れない称号を入れない(フリープレイだけの称号も入れない)', () => {
    const odd = great({ stageId: 'garage', groupsWiped: 2, ufosDowned: 2, grannyPunched: true });
    const got = ids(odd);
    expect(got).toContain('roundUp');
    expect(got).not.toContain('ufoHunter');
    expect(got).not.toContain('grannyFoe');
    for (const id of got) expect(titlesFor('garage').map((t) => t.id), id).toContain(id);
  });

  it('ラッシュで市民を殴ったら(いちばんひどい場面が「市民を殴った」になる)、完全無欠と街のほんものヒーローにしない', () => {
    const lift = { aliens: 3, aliensDefeated: 3, aliensSpared: 0, civs: 3, civsSaved: 2, civsHit: 1 };
    const tower = great({ stageId: 'tower', damage: 11_000_000, lift, worstScene: 'civHit' });
    expect(ids(tower)).not.toContain('flawless');
    expect(ids(tower)).not.toContain('realHero');
    expect(ids({ ...tower, lift: { ...lift, civsSaved: 3, civsHit: 0 } })).toEqual(expect.arrayContaining(['flawless', 'realHero', 'liftGuardian']));
    const rush = { aliens: 4, aliensDefeated: 4, aliensSpared: 0, civs: 4, civsSaved: 3, civsHit: 1 };
    expect(ids(great({ stageId: 'mall', rush }))).not.toContain('flawless');
  });
});

describe('歩く解体工事の金額はステージとフリープレイで分ける', () => {
  it.each([
    ['alley', 15_000_000], ['garage', 25_000_000], ['mall', 35_000_000], ['tower', 50_000_000]
  ] as const)('%s は ¥%i 以上', (stageId, line) => {
    const s = makeStats({ stageId, civHurt: 1, civHurtByHero: 1, escaped: 1, bossFightSec: 9 });
    expect(ids({ ...s, damage: line })).toContain('demolition');
    expect(ids({ ...s, damage: line - 10_000 })).not.toContain('demolition');
  });

  it('フリープレイは¥800万以上(遊び方で届くかは src/scenes/result/demolition.test.ts)', () => {
    const s = playFree(PLAN, (role) => (role === 'stop' ? 'press' : 'skip')).snapshot();
    expect(collectIds({ ...s, damage: 8_000_000 })).toContain('demolition');
    expect(collectIds({ ...s, damage: 7_990_000 })).not.toContain('demolition');
  });
});

// ─── フリープレイを決めた遊び方(testHelpers.ts の playFree)で通す ───────────────────────

const collectIds = (s: StageStats): TitleId[] => collectTitles(s).map((t) => t.id);
const PLAN = createFreePlay(2024, ['alley', 'garage', 'mall']);
const ALLEY = createFreePlay(2024, ['alley']);
const perfect: FreePolicy = (role) => (role === 'stop' || role === 'go' ? 'press' : 'skip');

describe('フリープレイで取れる称号は、どれも本当に取れる', () => {
  it('フリープレイで取れるのは11個(フリープレイだけの3つと、ステージの8つ)', () => {
    expect(titlesForFree().map((t) => t.id)).toEqual([
      'heroSitter', 'heroInterpreter', 'letItBe', 'civNemesis', 'demolition', 'grannyFoe', 'runawayTrain', 'stopMaster', 'chaseDemon', 'tooKind', 'soSo'
    ]);
  });

  it('全部決めると、お守り役とヒーローの通訳がいっしょに取れる(通訳のために1回まちがえなくてよい)', () => {
    for (const plan of [PLAN, ALLEY]) {
      const got = collectIds(playFree(plan, perfect).snapshot());
      expect(got[0]).toBe('heroSitter');
      expect(got).toEqual(expect.arrayContaining(['heroSitter', 'heroInterpreter', 'stopMaster', 'chaseDemon']));
    }
  });

  it('やさしすぎるヒーロー:市民への待ては全部押し、素通りのワルを3人見のがす(待ての達人に取られない)', () => {
    for (const plan of [PLAN, ALLEY]) {
      // 素通りのモヒカンには行けを押さない(走って逃げる)。ギャングとUFOは行けで倒す
      const s = playFree(plan, (role, p) => (role === 'stop' ? 'press' : role === 'go' && p.look !== 'fp_mohawk' ? 'press' : 'skip')).snapshot();
      expect(s.civHurtByHero).toBe(0);
      expect(collectIds(s)).toEqual(expect.arrayContaining(['stopMaster', 'tooKind']));
    }
    // ヒントの通り、待てでワルを3人見のがしても取れる(素通りのワルは全部行けで倒す)
    const byStop = playFree(ALLEY, (role, _p, n) => (role === 'stop' || role === 'go' || (role === 'heroBad' && n <= 3) ? 'press' : 'skip')).snapshot();
    expect(byStop.badSparedByStop).toBe(3);
    expect(collectIds(byStop)).toContain('tooKind');
  });

  it('なすがまま、市民の天敵、おばあちゃんの敵:何も押さない', () => {
    const got = collectIds(playFree(ALLEY, () => 'skip').snapshot());
    expect(got[0]).toBe('letItBe');
    expect(got).toEqual(expect.arrayContaining(['letItBe', 'civNemesis', 'grannyFoe']));
  });

  it('正義の暴走機関車:ワルは全部倒し、市民への待てを3回押さない', () => {
    const s = playFree(PLAN, (role, _p, n) => (role === 'go' || (role === 'stop' && n > 3) ? 'press' : 'skip')).snapshot();
    expect(s.allDefeated).toBe(true);
    expect(collectIds(s)).toContain('runawayTrain');
  });

  it('まあまあヒーロー:待ては2回、行けはギャングの組と2回まで(ギャングが出るとき)', () => {
    let stops = 0;
    let gos = 0;
    const s = playFree(PLAN, (role, p) => {
      // おばあさんには待てを押す(おばあちゃんの敵にしない)。待ては2回まで
      if (role === 'stop') return p.look === 'granny' || ++stops <= 1 ? 'press' : 'skip';
      // ギャングの組は倒す(行けで決めた数には入るが、行けで倒したワルの数には入らない)。モヒカンとUFOは合わせて2回まで
      if (role === 'go') return p.look === 'fp_gang' || ++gos <= 2 ? 'press' : 'skip';
      return 'skip';
    }).snapshot();
    expect(collectIds(s)).toEqual(['soSo']);
  });

});

describe('称号を取れる場所', () => {
  it('場所ごとの数は路地裏12、地下駐車場13、ショッピングモール14、高層ビル15、フリープレイ11。どの称号もどこかで取れ、1つの場所だけで取れる称号(「〜だけ」の札)は、ステージだけの9つとフリープレイだけの3つ', () => {
    expect(TITLE_PLACES.map((p) => titlesAt(p).length)).toEqual([12, 13, 14, 15, 11]);
    for (const t of TITLES) expect(placesOf(t.id).length, t.id).toBeGreaterThan(0);
    const only = TITLES.filter((t) => placesOf(t.id).length === 1).map((t) => `${t.id}:${placesOf(t.id)[0]}`);
    expect(only).toEqual([
      'topHero:tower', 'gangDriver:garage', 'ufoGuide:mall', 'furnitureGuide:tower', 'saleGuardian:mall', 'liftGuardian:tower',
      'ufoHunter:mall', 'sofaMaster:tower', 'roundUp:garage', 'heroSitter:free', 'heroInterpreter:free', 'letItBe:free'
    ]);
    expect(placesOf('grannyFoe')).toEqual(['alley', 'free']);
    expect(placesOf('demolition')).toEqual(['alley', 'garage', 'mall', 'tower', 'free']);
  });
});
