// 高層ビル(ステージ4)の波と波の間(波1と2、波2と3)の短い場面。黒い画面に階の数字だけを出し、
// 前の階から数字が上がっていって「18F」のように止まる(docs/STAGE4.md の「ゲームの流れ」)。全部で1秒。
// エレベーターの中は見せない(エレベーターラッシュで初めて見せたいので)。
// 入口:WaveReview の次へ(nextAfterReview が波を進めてから SCENES.floor を返す)。出口:その波の Sort。
// 開発用:?scene=Floor&stage=tower&wave=2

import Phaser from 'phaser';
import { SCENES, UI } from '../config';
import { layout } from '../layout';
import { audio } from '../audio';
import { towerFloorLabel, type WaveNo } from '../logic';
import { currentWave, getRun } from '../run';
import { PixelText, gotoWhenFree } from '../ui';
import { devHook, unlockOnTap } from './sort/common';

/** 場面の長さ(ミリ秒)。数字が上がるのは最初の COUNT_MS */
const TOTAL_MS = 1000;
const COUNT_MS = 550;

/** '18F' → 18 */
const floorNumber = (no: WaveNo): number => parseInt(towerFloorLabel(no), 10) || 1;

export class FloorScene extends Phaser.Scene {
  private label!: PixelText;
  private from = 1;
  private to = 1;
  private shown = 0;
  private elapsed = 0;
  private left = false;

  constructor() { super(SCENES.floor); }

  create(): void {
    const { W, H } = layout;
    const run = getRun(this);
    const no = currentWave(run).no;
    this.to = floorNumber(no);
    this.from = no > 1 ? floorNumber((no - 1) as WaveNo) : this.to;
    this.shown = this.from;
    this.elapsed = 0;
    this.left = false;
    unlockOnTap(this);
    this.add.graphics().fillStyle(UI.black, 1).fillRect(0, 0, W, H);
    this.label = new PixelText(this, Math.round(W / 2), Math.round(layout.actionH / 2) + 20, `${this.from}F`, { size: 32, color: UI.text, outline: true })
      .setOrigin(0.5, 0.5);
    devHook(this, { state: () => ({ shown: this.shown, to: this.to, elapsed: Math.round(this.elapsed) }) });
  }

  override update(_t: number, dt: number): void {
    this.elapsed += dt;
    const k = Math.min(1, this.elapsed / COUNT_MS);
    const n = Math.round(this.from + (this.to - this.from) * k);
    if (n !== this.shown) {
      this.shown = n;
      this.label.setText(`${n}F`);
      if (n === this.to) {
        this.label.setColor(UI.gold);
        audio.sfx('blip', { volume: 0.5, pitch: 1.6 });
      } else if (n % 3 === 0) {
        audio.sfx('blip', { volume: 0.25, pitch: 0.8 + (n - this.from) / Math.max(1, this.to - this.from) * 0.6 });
      }
    }
    if (this.elapsed >= TOTAL_MS && !this.left) {
      this.left = true;
      gotoWhenFree(this, SCENES.sort, undefined, { kind: 'wipe' });
    }
  }
}
