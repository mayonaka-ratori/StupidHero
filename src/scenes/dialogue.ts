// ステージ前の掛け合い(Intro)と終わりの場面(Ending)の会話の窓。セリフを順に出し、タップで次へ進める。
//   const d = new Dialogue(this, { x, y, w, h, tall, lines, to, onLine })   カットイン、▼、「1/5」の数を置く
//   d.advance()  文字送りの途中なら全部出す。出し終わっていれば次のセリフへ
//   d.next()     次のセリフへ(最後のセリフのあとは to のシーンへ)
//   d.leave()    to のシーンへ
//   d.update()   毎フレーム呼ぶ(文字を出し終わったら▼を出す)

import Phaser from 'phaser';
import { UI } from '../config';
import { audio } from '../audio';
import type { Speech } from '../logic';
import { CutIn, FS, PixelText } from '../ui';
import { gotoSafe } from './sort/common';

export interface DialogueOptions {
  /** カットインの位置と大きさ */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 縦に余裕があるとき:大きな字にして、顔を上に置く */
  tall: boolean;
  lines: readonly Speech[];
  /** 最後のセリフのあとと、とばしたときに行くシーン */
  to: string;
  /** セリフを出すたびに呼ぶ(ヒーローの動きなど) */
  onLine?: (line: Speech) => void;
}

export class Dialogue {
  readonly cut: CutIn;
  /** いま出しているセリフの番号(まだ出していなければ -1) */
  index = -1;
  private leaving = false;
  private readonly nextMark: PixelText;
  private readonly counter: PixelText;

  constructor(private scene: Phaser.Scene, private opt: DialogueOptions) {
    const { x, y, w, h, tall } = opt;
    this.cut = new CutIn(scene, x, y, w, h, { speed: 32, size: tall ? FS.big : FS.body, faceTop: tall });
    // カットインをタップしたときも、シーンのタップとして扱う(二重に進まないように)
    for (const o of this.cut.list) if (o instanceof Phaser.GameObjects.Zone) o.disableInteractive();
    // 出し終わったら右下に▼(上下にゆれる)
    const markY = y + h - 14;
    const mark = new PixelText(scene, x + w - 8, markY, '▼', { size: FS.small, color: UI.gold }).setOrigin(1, 0).setDepth(1200);
    this.nextMark = mark;
    scene.time.addEvent({ delay: 300, loop: true, callback: () => { mark.y = markY + (mark.y === markY ? 1 : 0); } });
    this.counter = new PixelText(scene, x + 2, y + h + 5, '', { size: FS.small, color: UI.textDim });
  }

  get total(): number { return this.opt.lines.length; }

  update(): void {
    this.nextMark.setVisible(!this.cut.isTyping && this.index >= 0);
  }

  /** タップ:文字送りの途中なら全部出す。出し終わっていれば次のセリフへ */
  advance(): void {
    if (this.leaving || this.index < 0) return;
    if (this.cut.isTyping) { this.cut.skip(); return; }
    this.next();
  }

  next(): void {
    const lines = this.opt.lines;
    this.index++;
    if (this.index >= lines.length) { this.leave(); return; }
    const line = lines[this.index];
    this.counter.setText(`${this.index + 1}/${lines.length}`);
    let n = 0;
    void this.cut.say(line.text, line.face, {
      who: line.who,
      onChar: () => { if (n++ % 2 === 0) audio.sfx('blip', { volume: 0.4, pitch: line.who === 'hero' ? 1.25 : 1 }); }
    });
    this.opt.onLine?.(line);
  }

  leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.sfx('button');
    // 切り替えの途中で受け付けられなかったら、また入力を受け付ける
    gotoSafe(this.scene, this.opt.to, undefined, undefined, (ok) => { if (!ok) this.leaving = false; });
  }
}
