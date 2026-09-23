// そのスマホの中の自分の記録(localStorage)。
// ステージごとに、最多撃破、最少負傷、最高被害額、最速ボス戦、遊んだ回数、ボスを倒した回数、取った称号を残す。
// 称号の数は全部のステージを合わせて数える(同じ称号を2つのステージで取っても1つ。全体は14)。
// localStorage が使えないとき(プライベートモード、容量いっぱい、設定で止めている)も落ちないよう、
// 読み書きは必ず try/catch で囲み、使えなければその場かぎりのメモリに残す。
//
// 保存の形:
//   v2(今):キー 'stupidhero.records.v2'。{ version: 2, stages: { alley: {...,titles,clears}, garage: {...} }, titles }
//   v1(ステージ1だけの公開版):キー 'stupidhero.records.v1'。{ version: 1, stages: { alley: {...} }, titles }
//   v2 がなければ v1 を読んで v2 の形に直す(称号は路地裏で取ったものにする。ボス戦の記録があればボスを倒したことにする)。
//   v1 のデータは消さずにそのまま残す(遊んだ人の記録を消さないため)。
//
// 使い方:
//   const saved = saveResult(stage.id, stats, title.id);   // 結果画面が出たときに1回だけ
//   saved.titlesCollected / saved.titlesTotal               // 「称号5/14」
//   saved.unlockedNow                                       // 今回のプレイで開いたステージ(['garage'] なら「地下駐車場が開いた」)
//   stageSelectInfo()                                       // ステージを選ぶ画面:開いているか、いちばん良い記録、称号の数
//   isStageUnlocked('garage')                               // ステージ2が開いているか

import { STAGE_IDS, STAGES, isStageId } from './stages';
import { TITLES } from './titles';
import type { StageDef } from './stages';
import type { StageId, StageStats, TitleId } from './types';

export const RECORDS_KEY = 'stupidhero.records.v2';
/** 前の形の記録のキー(読むだけ。書きかえも消しもしない) */
export const LEGACY_RECORDS_KEY = 'stupidhero.records.v1';

/** 使う保存先の形(localStorage と同じ。テストでは自前のものを渡せる) */
export type RecordStorage = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;

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

export interface Records {
  version: 2;
  stages: Partial<Record<StageId, StageRecord>>;
  /** 全部のステージで取った称号(取った順、重なりなし)。数は「称号5/14」の5 */
  titles: TitleId[];
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
  /** 称号の全体の数(14) */
  titlesTotal: number;
  /** そのステージで集めた称号の数 */
  stageTitlesCollected: number;
  /** 今回のプレイで新しく開いたステージ(なければ空) */
  unlockedNow: StageId[];
  /** localStorage に書けたか(false のときはこの画面を閉じると消える) */
  persisted: boolean;
}

const emptyRecords = (): Records => ({ version: 2, stages: {}, titles: [] });
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

const addUnique = (list: TitleId[], items: readonly TitleId[]): void => {
  for (const t of items) if (!list.includes(t)) list.push(t);
};

/** 読んだものを信用せず、形を整える。version が2でなければ v1 の形として読む */
function sanitize(raw: unknown): Records {
  const out = emptyRecords();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as { version?: unknown; stages?: unknown; titles?: unknown };
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
  addUnique(out.titles, top);
  for (const id of STAGE_IDS) addUnique(out.titles, out.stages[id]?.titles ?? []);
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

/** そのステージが開いているか(路地裏はいつも。地下駐車場は路地裏のボスを一度倒すと開く) */
export function isStageUnlocked(stageId: StageId, records: Records = loadRecords()): boolean {
  const need = STAGES[stageId].unlockAfter;
  if (!need) return true;
  return (records.stages[need]?.clears ?? 0) > 0;
}

/** 開いているステージの一覧(選ぶ画面の並び順) */
export function unlockedStages(records: Records = loadRecords()): StageId[] {
  return STAGE_IDS.filter((id) => isStageUnlocked(id, records));
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

/** 記録を消す(設定画面やテスト用)。前の形の記録(v1)には手をつけない */
export function clearRecords(storage: RecordStorage | null = defaultStorage()): void {
  memory = null;
  memoryNewer = false;
  try {
    storage?.setItem(RECORDS_KEY, JSON.stringify(emptyRecords()));
  } catch {
    // 消せなくても続ける
  }
}

/** localStorage に書けるかを確かめる(「ホーム画面に追加すると記録が消えにくい」を出すか決めるのに使える) */
export function canPersist(storage: RecordStorage | null = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    const probe = `${RECORDS_KEY}.probe`;
    storage.setItem(probe, '1');
    const ok = storage.getItem(probe) === '1';
    storage.removeItem?.(probe);
    return ok;
  } catch {
    return false;
  }
}
