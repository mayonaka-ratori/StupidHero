// 結果画面の数字の窓の、ステージとフリープレイで共通の形。
// 窓を作る関数(ステージは Result.ts の stageWindow、フリープレイは result/freeStats.ts の freeWindow)が
// StatsWindow を返し、結果画面はそれを数え上げる(行ごとに 0 から target まで数え、終わったら onRowEnd、全部のあと reveal)。

import type Phaser from 'phaser';
import type { PixelText } from '../../ui';

export interface StatRow {
  label: string;
  target: number;
  format: (n: number) => string;
  color: number;
  /** 新記録の項目の名前(SaveOutcome.newRecords か FreeSaveOutcome.newRecords に入っていれば NEW を出す) */
  record?: string;
  ms: number;
}

/** ボタンの高さとすきま */
export interface ButtonFit {
  smallH: number;
  shareH: number;
  gap: number;
}

export interface StatsWindow {
  fit: ButtonFit;
  boxH: number;
  rows: StatRow[];
  /** 行ごとの数字の字(数え上げで書きかえる) */
  values: PixelText[];
  /** 行ごとの NEW の札(出さない行は getData('never') が true) */
  newTags: Phaser.GameObjects.Container[];
  /** i 行目を数え終えたとき(内わけの行を出すなど) */
  onRowEnd: (i: number) => void;
  /** 全部の行を数え終えたあと(たとえ、足しの行を出す) */
  reveal: () => void;
  /** この窓で使う字(フォントを先に読みこむため) */
  texts: string[];
}

/** 窓を作るのに要るもの */
export interface WindowEnv {
  scene: Phaser.Scene;
  /** 窓の上端 */
  boxY: number;
  /** ボタンのいちばん下 */
  bottom: number;
  /** NEW の札を作る(結果画面の newTag) */
  newTag: (x: number, y: number) => Phaser.GameObjects.Container;
}
