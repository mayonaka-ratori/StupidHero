// 結果発表(Street)とその部品(gang.ts、ufo.ts、rush.ts)、フリープレイの通り(free.ts)で共通の数と形。

import type Phaser from 'phaser';
import type { Look, PropKind } from '../../logic';

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
