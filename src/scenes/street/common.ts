// 結果発表(Street)とその部品(gang.ts、ufo.ts、rush.ts)で共通の数と形。

import type Phaser from 'phaser';
import type { Look, PropKind } from '../../logic';

/** ヒーローの走る速さ(ドット/秒) */
export const RUN = 84;

export interface PropObj { kind: PropKind; x: number; y: number; wall: boolean; sprite: Phaser.GameObjects.Sprite; broken: boolean }
export interface Walker { toX: number; fromX: number; fromY: number; toY: number; speed: number; resolve: () => void }
export interface CivHit { look: Look; collateral: boolean }
export type HitMode = 'bad' | 'civ' | 'go' | 'reveal';
