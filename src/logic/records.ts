// そのスマホの中の自分の記録(localStorage)。
// ステージごとに、最多撃破、最少負傷、最高被害額、最速ボス戦、遊んだ回数、ボスを倒した回数、取った称号を残す。
// ステージ前の掛け合いを見たステージ(introSeen)も残す。見たか、1回遊んだステージは、次から掛け合いをとばす。
// タイムセールラッシュを見たステージ(rushSeen)も同じ形で残す。見たことがあれば、ラッシュの説明を1つにする。
// 称号の数は全部のステージとフリープレイを合わせて数える(同じ称号を2つのステージで取っても1つ。全体は20)。
// フリープレイの記録(free)も残す:いちばん速いクリアまでの時間(ふつうとゆっくりで別)、待てで守った数と
// 行けで決めた数のいちばん良いもの、最高被害額、遊んだ回数、取った称号。初回の掛け合いを見たか(freeIntroSeen)、
// 「ステージを進めると、出てくる人が増えるよ」を出したか(freeMoreHintShown)も残す。
// localStorage が使えないとき(プライベートモード、容量いっぱい、設定で止めている)も落ちないよう、
// 読み書きは必ず try/catch で囲み、使えなければその場かぎりのメモリに残す。
//
// 保存の形:
//   v2(今):キー 'stupidhero.records.v2'。
//     { version: 2, stages: { alley: {...,titles,clears}, garage: {...}, mall: {...} }, titles, introSeen, rushSeen }
//   introSeen と rushSeen はあとから足した。ない記録は空として読む(version は2のまま)。
//   free、freeIntroSeen、freeMoreHintShown もあとから足した(フリープレイ)。ない記録は、遊んでいない、見ていないとして読む。
//   v1(ステージ1だけの公開版):キー 'stupidhero.records.v1'。{ version: 1, stages: { alley: {...} }, titles }
//   v2 がなければ v1 を読んで v2 の形に直す(称号は路地裏で取ったものにする。ボス戦の記録があればボスを倒したことにする)。
//   v1 のデータは消さずにそのまま残す(遊んだ人の記録を消さないため)。
//
// 使い方:
//   const saved = saveResult(stage.id, stats, title.id);   // 結果画面が出たときに1回だけ
//   saved.titlesCollected / saved.titlesTotal               // 「称号5/20」
//   saved.unlockedNow                                       // 今回のプレイで開いたステージ(['garage'] なら「地下駐車場が開いた」、
//                                                           // ['mall'] なら「モールが開いた」。say('unlocked', rng, id))
//   stageSelectInfo()                                       // ステージを選ぶ画面:開いているか、いちばん良い記録、称号の数
//   isStageUnlocked('garage')                               // ステージ2が開いているか(ステージ3は地下駐車場のボスを倒すと開く)
//   needsIntro('alley')                                     // 掛け合いを見せるか(見たことも遊んだこともなければ true)
//   markIntroSeen('alley')                                  // 掛け合いを見せたときに呼ぶ
//   hasAnyRecord()                                          // どれかのステージを1回でも遊んだか(初めての人はステージ選びをとばす)
//   hasSeenRush('mall')                                     // タイムセールラッシュを見たことがあるか(説明を短くする。rushIntroFor)
//   markRushSeen('mall')                                    // ラッシュの帯を出したときに呼ぶ
//
// フリープレイ:
//   isFreeUnlocked()                                        // 開いているか(路地裏のボスを一度倒したか)
//   freeSelectInfo()                                        // ステージを選ぶ画面のボタン:開いているか、ベストの時間
//   needsFreeIntro() / markFreeIntroSeen()                  // 初回の掛け合い3枚を出すか / 出したときに呼ぶ
//   const saved = saveFreeResult(stats, title.id);          // 結果画面が出たときに1回だけ
//   saved.newRecords                                        // 新記録の項目(['bestSec'] など)
//   saved.showMoreStagesHint                                // 「ステージを進めると、出てくる人が増えるよ」を出すか(一度だけ)

import { STAGE_IDS, STAGES, isStageId } from './stages';
import { TITLES } from './titles';
import type { StageDef } from './stages';
import type { StageId, StageStats, TitleId } from './types';

export const RECORDS_KEY = 'stupidhero.records.v2';
/** 前の形の記録のキー(読むだけ。書きかえも消しもしない) */
export const LEGACY_RECORDS_KEY = 'stupidhero.records.v1';

/** 使う保存先の形(localStorage と同じ。テストでは自前のものを渡せる) */
export type RecordStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface StageRecord {
  /** 最多撃破 */
  mostDefeated: number | null;
  /** 最少負傷 */
  fewestHurt: number | null;
  /** 最高被害額 */
  highestDamage: number | null;
  /** 最速ボス戦(秒) */
  fastestBossSec: number | null;
  /** 遊んだ回数 */
  plays: number;
  /** ボスを倒した回数(1回以上なら次のステージが開く) */
  clears: number;
  /** このステージで取った称号(取った順) */
  titles: TitleId[];
}

/** フリープレイの記録 */
export interface FreeRecord {
  /** いちばん速いクリアまでの時間(秒。足した秒を含む)。ゆっくりモードでない回だけ */
  bestSec: number | null;
  /** いちばん速いクリアまでの時間(秒)。ゆっくりモードで遊んだ回だけ */
  bestSlowSec: number | null;
  /** 待てで守った数のいちばん良いもの */
  mostStopSaved: number | null;
  /** 行けで決めた数のいちばん良いもの */
  mostGoScenes: number | null;
  /** 最高被害額 */
  highestDamage: number | null;
  /** 遊んだ回数 */
  plays: number;
  /** フリープレイで取った称号(取った順) */
  titles: TitleId[];
}

export type FreeRecordField = 'bestSec' | 'bestSlowSec' | 'mostStopSaved' | 'mostGoScenes' | 'highestDamage';

export interface Records {
  version: 2;
  stages: Partial<Record<StageId, StageRecord>>;
  /** 全部のステージとフリープレイで取った称号(取った順、重なりなし)。数は「称号5/20」の5 */
  titles: TitleId[];
  /** ステージ前の掛け合いを見たステージ */
  introSeen: StageId[];
  /** タイムセールラッシュを見たステージ */
  rushSeen: StageId[];
  /** フリープレイの記録 */
  free: FreeRecord;
  /** フリープレイの初回の掛け合いを見たか */
  freeIntroSeen: boolean;
  /** 「ステージを進めると、出てくる人が増えるよ」を出したか */
  freeMoreHintShown: boolean;
}

export type RecordField = 'mostDefeated' | 'fewestHurt' | 'highestDamage' | 'fastestBossSec';

export interface SaveOutcome {
  /** 保存したあとの記録全体 */
  records: Records;
  /** 保存したあとのそのステージの記録 */
  stage: StageRecord;
  /**
   * 新記録だった項目。前の記録より良かったものだけ(初めて遊んだときは空。firstPlay を見る)。
   * 最高被害額は多いほど「新記録」
   */
  newRecords: RecordField[];
  /** そのステージを初めて遊んだか */
  firstPlay: boolean;
  /** 今回の称号が初めて取ったものか(全部のステージを合わせて) */
  titleIsNew: boolean;
  /** 集めた称号の数(全部のステージを合わせて。今回の分を含む) */
  titlesCollected: number;
  /** 称号の全体の数(20) */
  titlesTotal: number;
  /** そのステージで集めた称号の数 */
  stageTitlesCollected: number;
  /** 今回のプレイで新しく開いたステージ(なければ空) */
  unlockedNow: StageId[];
  /** localStorage に書けたか(false のときはこの画面を閉じると消える) */
  persisted: boolean;
}

export const emptyFreeRecord = (): FreeRecord => ({
  bestSec: null, bestSlowSec: null, mostStopSaved: null, mostGoScenes: null, highestDamage: null, plays: 0, titles: []
});
const emptyRecords = (): Records => ({
  version: 2, stages: {}, titles: [], introSeen: [], rushSeen: [], free: emptyFreeRecord(), freeIntroSeen: false, freeMoreHintShown: false
});
export const emptyStageRecord = (): StageRecord => ({
  mostDefeated: null, fewestHurt: null, highestDamage: null, fastestBossSec: null, plays: 0, clears: 0, titles: []
});

/** localStorage が使えないときの控え */
let memory: Records | null = null;
/** 最後の書きこみに失敗して、控えの方が新しいか */
let memoryNewer = false;

function defaultStorage(): RecordStorage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const TITLE_IDS = new Set<string>(TITLES.map((t) => t.id));

function titleList(v: unknown): TitleId[] {
  const out: TitleId[] = [];
  if (!Array.isArray(v)) return out;
  for (const t of v) if (typeof t === 'string' && TITLE_IDS.has(t) && !out.includes(t as TitleId)) out.push(t as TitleId);
  return out;
}

/** ステージの id の一覧を読む(知らない id と重なりは捨てる) */
function stageList(v: unknown): StageId[] {
  const out: StageId[] = [];
  if (!Array.isArray(v)) return out;
  for (const id of v) if (isStageId(id) && !out.includes(id)) out.push(id);
  return out;
}

const addUnique = (list: TitleId[], items: readonly TitleId[]): void => {
  for (const t of items) if (!list.includes(t)) list.push(t);
};

/** 読んだものを信用せず、形を整える。version が2でなければ v1 の形として読む */
function sanitize(raw: unknown): Records {
  const out = emptyRecords();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as {
    version?: unknown; stages?: unknown; titles?: unknown; introSeen?: unknown; rushSeen?: unknown;
    free?: unknown; freeIntroSeen?: unknown; freeMoreHintShown?: unknown;
  };
  const legacy = r.version !== 2;
  if (r.stages && typeof r.stages === 'object') {
    for (const [id, v] of Object.entries(r.stages as Record<string, unknown>)) {
      if (!isStageId(id) || !v || typeof v !== 'object') continue;
      const s = v as Record<string, unknown>;
      const fastestBossSec = numOrNull(s.fastestBossSec);
      out.stages[id] = {
        mostDefeated: numOrNull(s.mostDefeated),
        fewestHurt: numOrNull(s.fewestHurt),
        highestDamage: numOrNull(s.highestDamage),
        fastestBossSec,
        plays: numOrNull(s.plays) ?? 0,
        // v1 には倒した回数がない。ボス戦の記録があれば、ボスを倒したことがある(ボス戦に負けはない)
        clears: numOrNull(s.clears) ?? (fastestBossSec !== null ? 1 : 0),
        titles: titleList(s.titles)
      };
    }
  }
  const top = titleList(r.titles);
  if (legacy && top.length > 0) {
    // v1 の称号は全部、路地裏で取ったもの
    const alley = out.stages.alley ?? emptyStageRecord();
    addUnique(alley.titles, top);
    out.stages.alley = alley;
  }
  if (r.free && typeof r.free === 'object') {
    const f = r.free as Record<string, unknown>;
    out.free = {
      bestSec: numOrNull(f.bestSec),
      bestSlowSec: numOrNull(f.bestSlowSec),
      mostStopSaved: numOrNull(f.mostStopSaved),
      mostGoScenes: numOrNull(f.mostGoScenes),
      highestDamage: numOrNull(f.highestDamage),
      plays: numOrNull(f.plays) ?? 0,
      titles: titleList(f.titles)
    };
  }
  addUnique(out.titles, top);
  for (const id of STAGE_IDS) addUnique(out.titles, out.stages[id]?.titles ?? []);
  addUnique(out.titles, out.free.titles);
  out.introSeen = stageList(r.introSeen);
  out.rushSeen = stageList(r.rushSeen);
  out.freeIntroSeen = r.freeIntroSeen === true;
  out.freeMoreHintShown = r.freeMoreHintShown === true;
  return out;
}

const copy = (r: Records): Records => sanitize(JSON.parse(JSON.stringify(r)));

function readKey(storage: RecordStorage | null, key: string): Records | null {
  try {
    const text = storage?.getItem(key);
    if (text) return sanitize(JSON.parse(text));
  } catch {
    // 読めなくても続ける
  }
  return null;
}

/** 記録を読む。読めなければ前の形の記録、それもなければ空の記録(またはこの画面の中で保存した分)を返す */
export function loadRecords(storage: RecordStorage | null = defaultStorage()): Records {
  if (memoryNewer && memory) return copy(memory);
  const now = readKey(storage, RECORDS_KEY) ?? readKey(storage, LEGACY_RECORDS_KEY);
  if (now) return now;
  return memory ? copy(memory) : emptyRecords();
}

function writeRecords(records: Records, storage: RecordStorage | null): boolean {
  memory = records;
  memoryNewer = true;
  try {
    if (!storage) return false;
    storage.setItem(RECORDS_KEY, JSON.stringify(records));
    memoryNewer = false;
    return true;
  } catch {
    return false;
  }
}

/**
 * そのステージが開いているか(路地裏はいつも。地下駐車場は路地裏のボスを、
 * ショッピングモールは地下駐車場のボスを一度倒すと開く)
 */
export function isStageUnlocked(stageId: StageId, records: Records = loadRecords()): boolean {
  const need = STAGES[stageId].unlockAfter;
  if (!need) return true;
  return (records.stages[need]?.clears ?? 0) > 0;
}

/** 開いているステージの一覧(選ぶ画面の並び順) */
export function unlockedStages(records: Records = loadRecords()): StageId[] {
  return STAGE_IDS.filter((id) => isStageUnlocked(id, records));
}

/** ステージ前の掛け合いを見せるか。見たことがあるか、そのステージを1回でも遊んでいれば false */
export function needsIntro(stageId: StageId, records: Records = loadRecords()): boolean {
  if (records.introSeen.includes(stageId)) return false;
  return (records.stages[stageId]?.plays ?? 0) === 0;
}

/** 掛け合いを見たことを残す。書けなくても、その場では覚えている */
export function markIntroSeen(stageId: StageId, storage: RecordStorage | null = defaultStorage()): void {
  const records = loadRecords(storage);
  if (records.introSeen.includes(stageId)) return;
  records.introSeen.push(stageId);
  writeRecords(records, storage);
}

/** タイムセールラッシュを見たことがあるか(見たことがあれば、始まりの説明を1つにする) */
export function hasSeenRush(stageId: StageId, records: Records = loadRecords()): boolean {
  return records.rushSeen.includes(stageId);
}

/** タイムセールラッシュを見たことを残す(帯を出したときに呼ぶ)。書けなくても、その場では覚えている */
export function markRushSeen(stageId: StageId, storage: RecordStorage | null = defaultStorage()): void {
  const records = loadRecords(storage);
  if (records.rushSeen.includes(stageId)) return;
  records.rushSeen.push(stageId);
  writeRecords(records, storage);
}

/** どれかのステージを1回でも遊んだか(結果画面まで行ったか) */
export function hasAnyRecord(records: Records = loadRecords()): boolean {
  return STAGE_IDS.some((id) => (records.stages[id]?.plays ?? 0) > 0);
}

/** ステージを選ぶ画面に出す1つぶん */
export interface StageSelectEntry {
  id: StageId;
  def: StageDef;
  /** 選べるか。false なら鍵のマークと def.lockedText */
  unlocked: boolean;
  /** いちばん良い記録(まだ遊んでいなければ null) */
  record: StageRecord | null;
  /** そのステージで取った称号の数 */
  titlesCollected: number;
}

/** ステージを選ぶ画面の中身(並び順は STAGE_IDS) */
export function stageSelectInfo(records: Records = loadRecords()): StageSelectEntry[] {
  return STAGE_IDS.map((id) => {
    const rec = records.stages[id] ?? null;
    return {
      id,
      def: STAGES[id],
      unlocked: isStageUnlocked(id, records),
      record: rec && rec.plays > 0 ? rec : null,
      titlesCollected: rec?.titles.length ?? 0
    };
  });
}

/**
 * 1回遊んだ結果を記録する。結果画面が出たときに1回だけ呼ぶ。
 * @param stageId stage.id
 * @param stats StatsTracker.snapshot()
 * @param titleId decideTitle(stats).id
 */
export function saveResult(
  stageId: StageId, stats: StageStats, titleId: TitleId, storage: RecordStorage | null = defaultStorage()
): SaveOutcome {
  const records = loadRecords(storage);
  const unlockedBefore = unlockedStages(records);
  const prev = records.stages[stageId] ?? emptyStageRecord();
  const firstPlay = prev.plays === 0;
  const next: StageRecord = {
    ...prev,
    plays: prev.plays + 1,
    clears: prev.clears + (stats.bossDefeated ? 1 : 0),
    titles: [...prev.titles]
  };
  const newRecords: RecordField[] = [];

  const better = (field: RecordField, value: number | null, wantLarger: boolean): void => {
    if (value === null) return;
    const old = prev[field];
    if (old === null || (wantLarger ? value > old : value < old)) {
      next[field] = value;
      if (old !== null) newRecords.push(field);
    }
  };
  better('mostDefeated', stats.defeated, true);
  better('fewestHurt', stats.civHurt, false);
  better('highestDamage', stats.damage, true);
  better('fastestBossSec', stats.bossFightSec, false);

  addUnique(next.titles, [titleId]);
  records.stages[stageId] = next;
  const titleIsNew = !records.titles.includes(titleId);
  addUnique(records.titles, [titleId]);

  const unlockedNow = unlockedStages(records).filter((id) => !unlockedBefore.includes(id));
  const persisted = writeRecords(records, storage);
  return {
    records,
    stage: next,
    newRecords,
    firstPlay,
    titleIsNew,
    titlesCollected: records.titles.length,
    titlesTotal: TITLES.length,
    stageTitlesCollected: next.titles.length,
    unlockedNow,
    persisted
  };
}

// ─── フリープレイ ─────────────────────────────────

/** フリープレイが開いているか(路地裏のボスを一度倒すと開く) */
export function isFreeUnlocked(records: Records = loadRecords()): boolean {
  return (records.stages.alley?.clears ?? 0) > 0;
}

/** フリープレイの初回の掛け合いを見せるか(見たことがあるか、1回でも遊んでいれば false) */
export function needsFreeIntro(records: Records = loadRecords()): boolean {
  return !records.freeIntroSeen && records.free.plays === 0;
}

/** フリープレイの掛け合いを見たことを残す */
export function markFreeIntroSeen(storage: RecordStorage | null = defaultStorage()): void {
  const records = loadRecords(storage);
  if (records.freeIntroSeen) return;
  records.freeIntroSeen = true;
  writeRecords(records, storage);
}

/** ステージを選ぶ画面の「フリープレイ▶」のボタンに出すもの */
export interface FreeSelectInfo {
  /** 押せるか。false なら暗くして鍵のマーク(押すと STAGES.garage.lockedText と同じ「路地裏をクリアすると遊べる」) */
  unlocked: boolean;
  /** いちばん速い時間(ふつう)。まだなければ null。ボタンの「ベスト 1:38」は formatClearTime(bestSec) */
  bestSec: number | null;
  /** いちばん速い時間(ゆっくり) */
  bestSlowSec: number | null;
  /** フリープレイの記録(遊んでいなければ null) */
  record: FreeRecord | null;
}

export function freeSelectInfo(records: Records = loadRecords()): FreeSelectInfo {
  const rec = records.free.plays > 0 ? records.free : null;
  return { unlocked: isFreeUnlocked(records), bestSec: rec?.bestSec ?? null, bestSlowSec: rec?.bestSlowSec ?? null, record: rec };
}

export interface FreeSaveOutcome {
  records: Records;
  /** 保存したあとのフリープレイの記録 */
  free: FreeRecord;
  /** 新記録だった項目(前の記録より良かったものだけ。初めて遊んだときは空) */
  newRecords: FreeRecordField[];
  firstPlay: boolean;
  titleIsNew: boolean;
  titlesCollected: number;
  titlesTotal: number;
  /** 「ステージを進めると、出てくる人が増えるよ」を出すか(路地裏しか開いていない人に、一度だけ) */
  showMoreStagesHint: boolean;
  persisted: boolean;
}

/**
 * フリープレイを1回遊んだ結果を記録する。結果画面が出たときに1回だけ呼ぶ。
 * @param stats StatsTracker.snapshot()(stats.free がある)
 * @param titleId decideTitle(stats).id
 */
export function saveFreeResult(stats: StageStats, titleId: TitleId, storage: RecordStorage | null = defaultStorage()): FreeSaveOutcome {
  const records = loadRecords(storage);
  const prev = records.free;
  const firstPlay = prev.plays === 0;
  const next: FreeRecord = { ...prev, plays: prev.plays + 1, titles: [...prev.titles] };
  const newRecords: FreeRecordField[] = [];
  const better = (field: FreeRecordField, value: number | null | undefined, wantLarger: boolean): void => {
    if (value === null || value === undefined) return;
    const old = prev[field];
    if (old === null || (wantLarger ? value > old : value < old)) {
      next[field] = value;
      if (old !== null) newRecords.push(field);
    }
  };
  const f = stats.free;
  if (f) {
    better(f.slow ? 'bestSlowSec' : 'bestSec', f.clearSec, false);
    better('mostStopSaved', f.stopSaved, true);
    better('mostGoScenes', f.goScenes, true);
  }
  better('highestDamage', stats.damage, true);

  addUnique(next.titles, [titleId]);
  records.free = next;
  const titleIsNew = !records.titles.includes(titleId);
  addUnique(records.titles, [titleId]);
  // 「路地裏しか開いていない」は、路地裏しかクリアしていない(まだ開いていないステージがある)こと。
  // フリープレイは路地裏のボスを倒すと開き、そのとき地下駐車場も開くので、開いているステージの数では数えない
  const showMoreStagesHint = !records.freeMoreHintShown && unlockedStages(records).length < STAGE_IDS.length;
  if (showMoreStagesHint) records.freeMoreHintShown = true;
  const persisted = writeRecords(records, storage);
  return {
    records, free: next, newRecords, firstPlay, titleIsNew,
    titlesCollected: records.titles.length, titlesTotal: TITLES.length, showMoreStagesHint, persisted
  };
}

/** 記録を消す(テスト用)。前の形の記録(v1)には手をつけない */
export function clearRecords(storage: RecordStorage | null = defaultStorage()): void {
  memory = null;
  memoryNewer = false;
  try {
    storage?.setItem(RECORDS_KEY, JSON.stringify(emptyRecords()));
  } catch {
    // 消せなくても続ける
  }
}
