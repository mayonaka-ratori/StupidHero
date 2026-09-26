// 結果発表(Street)とその部品(gang.ts、ufo.ts、rush.ts)、フリープレイの通り(free.ts)で共通の数と形。煙の色はボス戦(Boss.ts)でも使う。

import type Phaser from 'phaser';
import type { Look, PropKind, StageId } from '../../logic';
import { SMOKE_DARK, SMOKE_LIGHT } from '../../ui';

/** ヒーローの走る速さ(ドット/秒) */
export const RUN = 84;
/** 殴りかかる距離(相手の何ドット手前で技を出すか) */
export const ATTACK_GAP = 34;
/** ヒーローの決めつけの吹き出しを上げるドット数(相手の札と合図の間に入れる) */
export const JUDGE_RISE = 8;

export interface PropObj { kind: PropKind; x: number; y: number; wall: boolean; sprite: Phaser.GameObjects.Sprite; broken: boolean }
export interface Walker { toX: number; fromX: number; fromY: number; toY: number; speed: number; resolve: () => void }
export interface CivHit { look: Look; collateral: boolean }
/** recover はフリープレイだけ:待てで止めたワルを、行けで倒して取り返した */
export type HitMode = 'bad' | 'civ' | 'go' | 'recover' | 'reveal';

/** 煙の色。モールは背景が明るいので黒い煙、ほかは背景が暗いので灰色の煙(結果発表とボス戦で使う) */
export function smokeColors(stage: StageId): readonly number[] {
  return stage === 'mall' ? SMOKE_DARK : SMOKE_LIGHT;
}
