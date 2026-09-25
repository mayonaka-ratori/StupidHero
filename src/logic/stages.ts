// ステージごとの定義。画面の担当はここを見て、ステージごとの違い(背景、曲、ボスの絵、置く物)を出す。
// 背景と置く物は波ごとに変わることがある(ステージ4)ので、bgForWave と propsForWave で読む。
//
// 使い方:
//   const def = STAGES[stage.id];          // または stage.def(同じもの)
//   const bg = bgForWave(def, wave.no);     // 背景は bg.far / wall / ground(波ごとに変わることがある)
//   audio.playBgm(def.bgm.street);          // 結果発表の曲。ボス戦は def.bgm.boss
//   const boss = this.add.sprite(x, y, def.bossSheet);
//   const fight = new BossFight(def.bossFight);
//   for (const id of STAGE_IDS) ...         // ステージを選ぶ画面の並び(records.ts の stageSelectInfo も使える)

import type { BgmName } from '../audio';
import type { BossFightOptions } from './boss';
import { BOSS2_AGES } from './garageContent';
import {
  BOSS2, BOSS2_RAMPAGE_COST, BOSS3, BOSS3_RAMPAGE_COST, BOSS_RAMPAGE_COST, GARAGE_WAVES, MALL_WAVES, WAVES, type WavePlan
} from './rules';
import type { DisguiseLook, FreeVillainLook, Look, PropKind, StageId, Truth, WaveNo } from './types';

/**
 * ステージの仕組み(結果発表で見逃したワルが何をするか)。
 * - none:ステージ1。悪さを始める(行けで追い打ち)
 * - gang:ステージ2。口笛で仲間を呼んで集まり、車で逃げる(gang.ts)
 * - ufo:ステージ3。空へ合図を送り、UFOが通りがかりの買い物客を連れ去る(ufo.ts)
 */
export type StageMechanic = 'none' | 'gang' | 'ufo';

/**
 * 途中のイベント(ラッシュ)。afterWave の波のあとに1回だけ起きる。
 * - sale:ステージ3のタイムセールラッシュ(波2の結果発表のあと、答え合わせの前)
 * - elevator:ステージ4のエレベーターラッシュ(STAGE4「エレベーターラッシュ」。まだ作っていない)
 */
export interface StageRush {
  kind: 'sale' | 'elevator';
  afterWave: WaveNo;
}

/** 背景の画像のキー(src/art/sheets.ts の IMAGES) */
export interface StageBg { far: string; wall: string; ground: string }

/** 波ごとに変わる舞台(ステージ4の階)。背景と、通りに置く壊れる物 */
export interface StageFloor {
  bg: StageBg;
  props: readonly PropKind[];
}

export interface StageDef {
  id: StageId;
  /** ステージの番号(1〜4) */
  no: 1 | 2 | 3 | 4;
  /** 表示用の名前(ステージを選ぶ画面、仕分けの画面など) */
  name: string;
  /** 共有カードの「いちばんひどい場面」の右上に出す短い名前(幅が足りないときのため) */
  shortName: string;
  /** 背景の画像のキー(src/art/sheets.ts の IMAGES) */
  bg: StageBg;
  /** 曲の名前(src/audio の BgmName)。street は結果発表、boss はボス戦、rush はタイムセールラッシュ(なければ null) */
  bgm: { street: BgmName; boss: BgmName; rush: BgmName | null };
  /** ボスの正体の絵のキー */
  bossSheet: 'boss' | 'boss2' | 'boss3';
  /** ボスの化けた姿(この中から1つ選ばれる) */
  disguises: readonly DisguiseLook[];
  /** 化けた姿の絵のキー */
  disguiseSheets: Readonly<Partial<Record<DisguiseLook, string>>>;
  /**
   * ボスの年齢の幅。化けた姿の幅との重なりから選ぶ(地下駐車場の女ボス)。
   * null なら化けた姿の市民と同じ幅から選ぶ
   */
  bossAges: readonly [number, number] | null;
  /** 出てくる人の見た目 */
  looks: readonly Look[];
  /**
   * 通りに置く壊れる物の種類。地下駐車場の 'van' はギャングのワゴン(組が逃げるときに乗る車。
   * ふつうの攻撃では壊れない)。高級車 'bosscar' と母艦 'mothership' はボス戦だけに出すので、ここには入れない。
   * ショッピングモールのUFO 'ufo' も、宇宙人が呼んだときだけ出すので入れない
   */
  props: readonly PropKind[];
  /** ボス戦だけに出す物(女ボスの高級車、親玉の母艦)。なければ null */
  bossProp: PropKind | null;
  /**
   * ボスを倒したときに壊れる物(被害額に足す)。なければ null。
   * ショッピングモールは母艦が噴水に落ちるので 'fountain'。画面は倒したときに stats.breakProp(def.bossDefeatProp) を呼ぶ
   */
  bossDefeatProp: PropKind | null;
  /** 波の表 */
  waves: readonly WavePlan[];
  /** 仕組み(none、gang、ufo)。画面は `def.mechanic === 'gang'` のように見て分ける */
  mechanic: StageMechanic;
  /** 途中のイベント(ラッシュ)。なければ null */
  rush: StageRush | null;
  /**
   * 波ごとに変わる舞台(波1から順に。ステージ4の階)。null なら、どの波も bg と props を使う。
   * 画面は def.bg と def.props を直接見ずに、bgForWave と propsForWave を使う
   */
  floors: readonly StageFloor[] | null;
  /** ボスを市民に仕分けていたとき、正体を現したあとに足す被害額 */
  bossRampageCost: number;
  /** ボス戦の設定。new BossFight(def.bossFight) */
  bossFight: BossFightOptions;
  /** 開くのに必要なステージ(最初から選べるなら null) */
  unlockAfter: StageId | null;
  /** 開いていないときに出す文(最初から選べるなら null)。セリフではないので12文字の決まりの外 */
  lockedText: string | null;
}

export const STAGES: Readonly<Record<StageId, StageDef>> = {
  alley: {
    id: 'alley',
    no: 1,
    name: '路地裏',
    shortName: '路地裏',
    bg: { far: 'bg_alley_far', wall: 'bg_alley_wall', ground: 'bg_alley_ground' },
    bgm: { street: 'street', boss: 'boss', rush: null },
    bossSheet: 'boss',
    disguises: ['suit', 'granny', 'shopper'],
    disguiseSheets: {
      suit: 'boss_disguise_suit', granny: 'boss_disguise_granny', shopper: 'boss_disguise_shopper'
    },
    bossAges: null,
    looks: ['hoodie', 'suit', 'shopper', 'mohawk', 'granny'],
    props: ['trash', 'window', 'sign', 'vending', 'car'],
    bossProp: null,
    bossDefeatProp: null,
    waves: WAVES,
    mechanic: 'none',
    rush: null,
    floors: null,
    bossRampageCost: BOSS_RAMPAGE_COST,
    bossFight: {},
    unlockAfter: null,
    lockedText: null
  },
  garage: {
    id: 'garage',
    no: 2,
    name: '地下駐車場',
    shortName: '地下駐車場',
    bg: { far: 'bg_garage_far', wall: 'bg_garage_wall', ground: 'bg_garage_ground' },
    bgm: { street: 'street2', boss: 'boss2', rush: null },
    bossSheet: 'boss2',
    disguises: ['guard', 'mechanic', 'officelady'],
    disguiseSheets: {
      guard: 'boss2_disguise_guard', mechanic: 'boss2_disguise_mechanic', officelady: 'boss2_disguise_officelady'
    },
    bossAges: BOSS2_AGES,
    looks: ['guard', 'mechanic', 'clubber', 'officelady'],
    props: ['cone', 'extinguisher', 'barrier', 'pillar', 'car', 'van'],
    bossProp: 'bosscar',
    bossDefeatProp: null,
    waves: GARAGE_WAVES,
    mechanic: 'gang',
    rush: null,
    floors: null,
    bossRampageCost: BOSS2_RAMPAGE_COST,
    bossFight: BOSS2,
    unlockAfter: 'alley',
    lockedText: '路地裏をクリアすると遊べる'
  },
  mall: {
    id: 'mall',
    no: 3,
    name: 'ショッピングモール',
    shortName: 'モール',
    bg: { far: 'bg_mall_far', wall: 'bg_mall_wall', ground: 'bg_mall_ground' },
    bgm: { street: 'street3', boss: 'boss3', rush: 'sale3' },
    bossSheet: 'boss3',
    disguises: ['clerk', 'uncle', 'mascot'],
    disguiseSheets: {
      clerk: 'boss3_disguise_clerk', uncle: 'boss3_disguise_uncle', mascot: 'boss3_disguise_mascot'
    },
    bossAges: null,
    looks: ['mascot', 'clerk', 'dancer', 'uncle'],
    props: ['gacha', 'mannequin', 'showcase', 'fountain', 'escalator'],
    bossProp: 'mothership',
    bossDefeatProp: 'fountain',
    waves: MALL_WAVES,
    mechanic: 'ufo',
    rush: { kind: 'sale', afterWave: 2 },
    floors: null,
    bossRampageCost: BOSS3_RAMPAGE_COST,
    bossFight: BOSS3,
    unlockAfter: 'garage',
    lockedText: '地下駐車場をクリアすると遊べる'
  }
};

/** その波の背景(波ごとに変わるステージは floors から) */
export function bgForWave(def: StageDef, no: WaveNo): StageBg {
  return def.floors?.[no - 1]?.bg ?? def.bg;
}

/** その波の通りに置く壊れる物(波ごとに変わるステージは floors から) */
export function propsForWave(def: StageDef, no: WaveNo): readonly PropKind[] {
  return def.floors?.[no - 1]?.props ?? def.props;
}

/** この波のあとにラッシュがあるか(kind を渡すと、その種類のときだけ) */
export function rushAfter(def: StageDef, no: WaveNo, kind?: StageRush['kind']): boolean {
  return def.rush !== null && def.rush.afterWave === no && (kind === undefined || def.rush.kind === kind);
}

/** ステージを選ぶ画面の並び */
export const STAGE_IDS: readonly StageId[] = ['alley', 'garage', 'mall'];

/**
 * ショッピングモールの仕組み(UFO、母艦、くずれ)で使う絵のキー(src/art/sheets.ts に足す)。
 * 人と化けた姿と置く物のキーは STAGES.mall の looks、disguiseSheets、props から決まる
 * (sheetKeyFor と 'prop_' + 物の種類)
 */
export const MALL_SHEETS = {
  /** UFO 64×32。飛ぶ2コマ、吸い上げる、落ちた */
  ufo: 'prop_ufo',
  /** 母艦 160×64。浮かぶ2コマ、光線、落ちた */
  mothership: 'prop_mothership',
  /** UFOの吸い上げる光 32×64 */
  beam: 'fx_ufobeam',
  /** くずれのノイズ 64×64(タイムセールラッシュで体全体に重ねる) */
  glitch: 'fx_glitch'
} as const;

/** フリープレイのワルの見た目か('fp_mohawk'、'fp_gang'、'fp_alien') */
export const isFreeVillainLook = (look: Look): look is FreeVillainLook => look.startsWith('fp_');

/** 文字列がステージの id か(URL の ?stage= などを読むとき) */
export const isStageId = (v: unknown): v is StageId => typeof v === 'string' && v in STAGES;

/**
 * 見た目と正体から絵のキーを決める(src/art/sheets.ts のキー)。
 * ボスは化けた姿の絵(路地裏は 'boss_disguise_*'、地下駐車場は 'boss2_disguise_*')。
 * フリープレイのワル('fp_mohawk' など)は見た目の名前そのまま
 */
export function sheetKeyFor(look: Look, truth: Truth, stageId: StageId = 'alley'): string {
  if (truth === 'boss') {
    return STAGES[stageId].disguiseSheets[look as DisguiseLook] ?? `boss_disguise_${look}`;
  }
  // フリープレイのワルは見た目の名前がそのまま絵のキー('fp_mohawk' など)
  if (isFreeVillainLook(look)) return look;
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
