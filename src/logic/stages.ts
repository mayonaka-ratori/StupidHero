// ステージごとの定義。画面の担当はここを見て、ステージごとの違い(背景、曲、ボスの絵、置く物)を出す。
//
// 使い方:
//   const def = STAGES[stage.id];          // または stage.def(同じもの)
//   this.add.image(0, 0, def.bg.far);       // 背景は def.bg.far / wall / ground
//   audio.playBgm(def.bgm.street);          // 結果発表の曲。ボス戦は def.bgm.boss
//   const boss = this.add.sprite(x, y, def.bossSheet);
//   const fight = new BossFight(def.bossFight);
//   for (const id of STAGE_IDS) ...         // ステージを選ぶ画面の並び(records.ts の stageSelectInfo も使える)

import type { BossFightOptions } from './boss';
import {
  BOSS2, BOSS2_RAMPAGE_COST, BOSS_RAMPAGE_COST, GARAGE_WAVES, WAVES, type WavePlan
} from './rules';
import type { DisguiseLook, Look, PropKind, StageId, TitleId, Truth } from './types';

export interface StageDef {
  id: StageId;
  /** ステージの番号(1、2) */
  no: 1 | 2;
  /** 表示用の名前。共有文は「◯◯ステージ」になる */
  name: string;
  /** 背景の画像のキー(src/art/sheets.ts の IMAGES) */
  bg: { far: string; wall: string; ground: string };
  /** 曲の名前(src/audio の BgmName)。street は結果発表、boss はボス戦 */
  bgm: { street: 'street' | 'street2'; boss: 'boss' | 'boss2' };
  /** ボスの正体の絵のキー */
  bossSheet: 'boss' | 'boss2';
  /** ボスの化けた姿(この中から1つ選ばれる) */
  disguises: readonly DisguiseLook[];
  /** 化けた姿の絵のキー */
  disguiseSheets: Readonly<Partial<Record<DisguiseLook, string>>>;
  /** 出てくる人の見た目 */
  looks: readonly Look[];
  /**
   * 通りに置く壊れる物の種類。地下駐車場の 'van' はギャングのワゴン(組が逃げるときに乗る車。
   * ふつうの攻撃では壊れない)。高級車 'bosscar' はボス戦だけに出すので、ここには入れない
   */
  props: readonly PropKind[];
  /** ボス戦だけに出す物(女ボスの高級車)。なければ null */
  bossProp: PropKind | null;
  /** 波の表 */
  waves: readonly WavePlan[];
  /** ギャングの組があるか(仲間を呼ぶ、まとめて吹き飛ばす、車で逃げる) */
  hasGangs: boolean;
  /** ボスを市民に仕分けていたとき、正体を現したあとに足す被害額 */
  bossRampageCost: number;
  /** ボス戦の設定。new BossFight(def.bossFight) */
  bossFight: BossFightOptions;
  /** このステージのボスを一度倒すと開くステージ(なければ null) */
  unlocks: StageId | null;
  /** 開くのに必要なステージ(最初から選べるなら null) */
  unlockAfter: StageId | null;
  /** 開いていないときに出す文(最初から選べるなら null)。セリフではないので12文字の決まりの外 */
  lockedText: string | null;
  /** このステージだけで取れる称号 */
  onlyTitles: readonly TitleId[];
}

export const STAGES: Readonly<Record<StageId, StageDef>> = {
  alley: {
    id: 'alley',
    no: 1,
    name: '路地裏',
    bg: { far: 'bg_alley_far', wall: 'bg_alley_wall', ground: 'bg_alley_ground' },
    bgm: { street: 'street', boss: 'boss' },
    bossSheet: 'boss',
    disguises: ['suit', 'granny', 'shopper'],
    disguiseSheets: {
      suit: 'boss_disguise_suit', granny: 'boss_disguise_granny', shopper: 'boss_disguise_shopper'
    },
    looks: ['hoodie', 'suit', 'shopper', 'mohawk', 'granny'],
    props: ['trash', 'window', 'sign', 'vending', 'car'],
    bossProp: null,
    waves: WAVES,
    hasGangs: false,
    bossRampageCost: BOSS_RAMPAGE_COST,
    bossFight: {},
    unlocks: 'garage',
    unlockAfter: null,
    lockedText: null,
    onlyTitles: ['grannyFoe']
  },
  garage: {
    id: 'garage',
    no: 2,
    name: '地下駐車場',
    bg: { far: 'bg_garage_far', wall: 'bg_garage_wall', ground: 'bg_garage_ground' },
    bgm: { street: 'street2', boss: 'boss2' },
    bossSheet: 'boss2',
    disguises: ['guard', 'mechanic', 'officelady'],
    disguiseSheets: {
      guard: 'boss2_disguise_guard', mechanic: 'boss2_disguise_mechanic', officelady: 'boss2_disguise_officelady'
    },
    looks: ['guard', 'mechanic', 'clubber', 'officelady'],
    props: ['cone', 'extinguisher', 'barrier', 'pillar', 'car', 'van'],
    bossProp: 'bosscar',
    waves: GARAGE_WAVES,
    hasGangs: true,
    bossRampageCost: BOSS2_RAMPAGE_COST,
    bossFight: {
      carAtHpRatio: BOSS2.carAtHpRatio, carIdleCostPerSec: BOSS2.carIdleCostPerSec,
      carHoldSec: BOSS2.carHoldSec, carMinSec: BOSS2.carMinSec
    },
    unlocks: null,
    unlockAfter: 'alley',
    lockedText: '路地裏をクリアすると遊べる',
    onlyTitles: ['roundUp', 'gangDriver']
  }
};

/** ステージを選ぶ画面の並び */
export const STAGE_IDS: readonly StageId[] = ['alley', 'garage'];

export const stageDef = (id: StageId): StageDef => STAGES[id];

/** 文字列がステージの id か(URL の ?stage= などを読むとき) */
export const isStageId = (v: unknown): v is StageId => typeof v === 'string' && v in STAGES;

/**
 * 見た目と正体から絵のキーを決める(src/art/sheets.ts のキー)。
 * ボスは化けた姿の絵(路地裏は 'boss_disguise_*'、地下駐車場は 'boss2_disguise_*')
 */
export function sheetKeyFor(look: Look, truth: Truth, stageId: StageId = 'alley'): string {
  if (truth === 'boss') {
    return STAGES[stageId].disguiseSheets[look as DisguiseLook] ?? `boss_disguise_${look}`;
  }
  if (look === 'mohawk') return 'villain_mohawk';
  if (look === 'granny') return 'granny_civ';
  return `${look}_${truth}`;
}

/** ステージの画面に出る、セリフ以外の文(名前、開いていないときの文)。フォントを読みこむときに足す */
export function stageTexts(): string[] {
  const out: string[] = [];
  for (const id of STAGE_IDS) {
    const d = STAGES[id];
    out.push(d.name, `ステージ${d.no}`);
    if (d.lockedText) out.push(d.lockedText);
  }
  return out;
}
