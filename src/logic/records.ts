// そのスマホの中の自分の記録(localStorage)。
// ステージごとの最多撃破、最少負傷、最高被害額、最速ボス戦と、取った称号の一覧を残す。
// localStorage が使えないとき(プライベートモード、容量いっぱい、設定で止めている)も落ちないよう、
// 読み書きは必ず try/catch で囲み、使えなければその場かぎりのメモリに残す。

import { TITLES } from './titles';
import type { StageId, StageStats, TitleId } from './types';

export const RECORDS_KEY = 'stupidhero.records.v1';

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
}

export interface Records {
  version: 1;
  stages: Partial<Record<StageId, StageRecord>>;
  /** 取った称号(取った順) */
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
  /** 今回の称号が初めて取ったものか */
  titleIsNew: boolean;
  /** 集めた称号の数(今回の分を含む) */
  titlesCollected: number;
  /** 称号の全体の数 */
  titlesTotal: number;
  /** localStorage に書けたか(false のときはこの画面を閉じると消える) */
  persisted: boolean;
}

const emptyRecords = (): Records => ({ version: 1, stages: {}, titles: [] });
const emptyStage = (): StageRecord => ({
  mostDefeated: null, fewestHurt: null, highestDamage: null, fastestBossSec: null, plays: 0
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

/** 読んだものを信用せず、形を整える */
function sanitize(raw: unknown): Records {
  const out = emptyRecords();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as { stages?: unknown; titles?: unknown };
  if (r.stages && typeof r.stages === 'object') {
    for (const [id, v] of Object.entries(r.stages as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const s = v as Record<string, unknown>;
      out.stages[id as StageId] = {
        mostDefeated: numOrNull(s.mostDefeated),
        fewestHurt: numOrNull(s.fewestHurt),
        highestDamage: numOrNull(s.highestDamage),
        fastestBossSec: numOrNull(s.fastestBossSec),
        plays: numOrNull(s.plays) ?? 0
      };
    }
  }
  if (Array.isArray(r.titles)) {
    for (const t of r.titles) if (typeof t === 'string' && TITLE_IDS.has(t) && !out.titles.includes(t as TitleId)) out.titles.push(t as TitleId);
  }
  return out;
}

/** 記録を読む。読めなければ空の記録(またはこの画面の中で保存した分)を返す */
export function loadRecords(storage: RecordStorage | null = defaultStorage()): Records {
  if (memoryNewer && memory) return sanitize(JSON.parse(JSON.stringify(memory)));
  try {
    const text = storage?.getItem(RECORDS_KEY);
    if (text) return sanitize(JSON.parse(text));
  } catch {
    // 読めなくても続ける
  }
  return memory ? sanitize(JSON.parse(JSON.stringify(memory))) : emptyRecords();
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
 * 1回遊んだ結果を記録する。結果画面が出たときに1回だけ呼ぶ。
 * @param stageId stage.id
 * @param stats StatsTracker.snapshot()
 * @param titleId decideTitle(stats).id
 */
export function saveResult(
  stageId: StageId, stats: StageStats, titleId: TitleId, storage: RecordStorage | null = defaultStorage()
): SaveOutcome {
  const records = loadRecords(storage);
  const prev = records.stages[stageId] ?? emptyStage();
  const firstPlay = prev.plays === 0;
  const next: StageRecord = { ...prev, plays: prev.plays + 1 };
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

  records.stages[stageId] = next;
  const titleIsNew = !records.titles.includes(titleId);
  if (titleIsNew) records.titles.push(titleId);

  const persisted = writeRecords(records, storage);
  return {
    records,
    stage: next,
    newRecords,
    firstPlay,
    titleIsNew,
    titlesCollected: records.titles.length,
    titlesTotal: TITLES.length,
    persisted
  };
}

/** 記録を消す(設定画面やテスト用) */
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
