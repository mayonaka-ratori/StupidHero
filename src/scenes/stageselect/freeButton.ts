// ステージを選ぶ画面の下の「フリープレイ▶」のボタン(docs/FREEPLAY.md「始め方」「記録」)。
//   const fb = new FreeButton(this, x, y, w, h, freeSelectInfo(), () => this.chooseFree());
//   fb.update(dt)        毎フレーム(NEW の札の点滅)
//   fb.shakeLock()       開いていないときに押したとき(鍵が揺れて、「路地裏をクリアすると遊べる」の吹き出し)
//   await fb.unlock()    鍵がこわれて開く演出(路地裏をクリアした直後)
// 開いていないときは暗くして、左に鍵のマーク。開いているときは、いちばん速い時間を下に小さく「ベスト 1:38」
// (ふつうの記録がなくてゆっくりの記録だけあれば「ゆっくりベスト 2:10」。どちらもなければ出さない)。
// 開いていて一度も遊んでいなければ、右上に「NEW!」の札を出す(ステージのカードと同じ)。
// ステージのカードの鍵(stageselect/card.ts の drawLock)と同じ絵を使う。

import Phaser from 'phaser';
import { UI } from '../../config';
import { STAGES, formatClearTime, type FreeSelectInfo } from '../../logic';
import { Bubble, Button, FS, PixelText } from '../../ui';
import { drawLock } from './card';

/** ボタンの色(開いている / 開いていない) */
const OPEN_COLOR = 0x9a2a6a;
const LOCKED_COLOR = 0x24203a;
const LOCKED_TEXT = 0x8a84a0;

/** 画面に出す文(フォントを先に読みこむため。Boot.ts が使う) */
export const FREE_BUTTON_TEXTS = ['フリープレイ▶', 'フリープレイ', 'ベスト', 'ゆっくりベスト', 'NEW!', STAGES.garage.lockedText ?? ''];

/** ボタンの下の段に出す、いちばん速い時間(記録がなければ null) */
export function freeBestText(info: Pick<FreeSelectInfo, 'bestSec' | 'bestSlowSec'>): string | null {
  if (info.bestSec !== null) return `ベスト ${formatClearTime(info.bestSec)}`;
  if (info.bestSlowSec !== null) return `ゆっくりベスト ${formatClearTime(info.bestSlowSec)}`;
  return null;
}

export class FreeButton {
  readonly btn: Button;
  locked: boolean;
  private lockG: Phaser.GameObjects.Graphics;
  private texts: PixelText[] = [];
  private badge?: Phaser.GameObjects.Container;
  private bubble?: Bubble;
  private t = 0;

  constructor(
    private scene: Phaser.Scene, x: number, y: number, w: number, h: number, readonly info: FreeSelectInfo, onPress: () => void
  ) {
    this.locked = !info.unlocked;
    this.btn = new Button(scene, x, y, w, h, '', { color: OPEN_COLOR, size: FS.body, onPress: () => onPress() });
    this.lockG = scene.add.graphics();
    this.btn.add(this.lockG);
    this.applyLocked();
  }

  get x(): number { return this.btn.x; }
  get y(): number { return this.btn.y; }
  get w(): number { return this.btn.w; }
  get h(): number { return this.btn.h; }

  /** 開いているかに合わせて、色と字と鍵を描き直す */
  private applyLocked(): void {
    const sc = this.scene;
    const { w, h } = this.btn;
    for (const t of this.texts) t.destroy();
    this.texts = [];
    this.lockG.clear();
    this.btn.setColor(this.locked ? LOCKED_COLOR : OPEN_COLOR);
    const cx = Math.floor(w / 2);
    if (this.locked) {
      // 左に鍵、右に名前(暗い字)
      drawLock(this.lockG, 11, Math.floor((h - 3) / 2), 1);
      this.texts.push(new PixelText(sc, cx + 6, Math.floor((h - 3) / 2), 'フリープレイ', { size: FS.body, color: LOCKED_TEXT }).setOrigin(0.5, 0.5));
    } else {
      const best = freeBestText(this.info);
      if (best) {
        // 2段:名前と、下に小さくいちばん速い時間
        this.texts.push(
          new PixelText(sc, cx, 2, 'フリープレイ▶', { size: FS.body, color: UI.text, shadow: 0x3a0e28 }).setOrigin(0.5, 0),
          new PixelText(sc, cx, 14, best, { size: FS.small, color: UI.gold, shadow: 0x3a0e28 }).setOrigin(0.5, 0)
        );
      } else {
        this.texts.push(new PixelText(sc, cx, Math.floor((h - 3) / 2), 'フリープレイ▶', { size: FS.body, color: UI.text, shadow: 0x3a0e28 }).setOrigin(0.5, 0.5));
      }
    }
    this.btn.add(this.texts);
    this.btn.bringToTop(this.btn.hit);
    this.setBadge(!this.locked && !this.info.record);
  }

  /** 右上の「NEW!」の札(一度も遊んでいないとき) */
  private setBadge(on: boolean): void {
    this.badge?.destroy();
    this.badge = undefined;
    if (!on) return;
    const sc = this.scene;
    const t = new PixelText(sc, 3, 1, 'NEW!', { size: FS.small, color: 0xffffff });
    const bw = Math.ceil(t.width) + 6;
    const g = sc.add.graphics();
    g.fillStyle(0x000000, 1).fillRect(-1, -1, bw + 2, 13);
    g.fillStyle(UI.bad, 1).fillRect(0, 0, bw, 11);
    const c = sc.add.container(this.btn.x + this.btn.w - bw + 2, this.btn.y - 7, [g, t]).setDepth(this.btn.depth + 1);
    this.badge = c;
  }

  update(dt: number): void {
    this.t += dt;
    // NEW の札は、見える/見えないを切り替えて点滅させる(半透明は使わない)
    this.badge?.setVisible(Math.floor(this.t / 250) % 3 !== 2);
  }

  /** 開いていないときに押した:鍵がガタガタ揺れて、開き方の吹き出しを出す */
  shakeLock(): void {
    let n = 0;
    this.scene.time.addEvent({
      delay: 40, repeat: 7, callback: () => {
        n++;
        this.lockG.x = n >= 8 ? 0 : n % 2 === 0 ? -2 : 2;
      }
    });
    this.bubble?.destroy();
    this.bubble = new Bubble(this.scene, this.btn.x + Math.floor(this.btn.w / 2), this.btn.y - 3, STAGES.garage.lockedText ?? '', {
      tail: 'down', life: 2000, pop: true
    });
  }

  /** 鍵がこわれて開く。こわれた瞬間に onBreak(鍵のあった所) を呼ぶ */
  unlock(onBreak: (x: number, y: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let n = 0;
      this.scene.time.addEvent({
        delay: 50, repeat: 11, callback: () => {
          n++;
          this.lockG.x = n % 2 === 0 ? -2 : 2;
          if (n < 12) return;
          this.lockG.x = 0;
          const lx = this.btn.x + 11, ly = this.btn.y + Math.floor((this.btn.h - 3) / 2);
          this.locked = false;
          this.applyLocked();
          onBreak(lx, ly);
          resolve();
        }
      });
    });
  }

  /** 開いていない見た目にする(開く演出の前) */
  setLockedLook(on: boolean): void {
    this.locked = on;
    this.applyLocked();
  }

  contains(x: number, y: number): boolean {
    const b = this.btn;
    return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  }
}
