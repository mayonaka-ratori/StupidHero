// 頭の上に出す小さな札。「ワル」(赤)と「市民」(青)。
// 使い方:
//   const tag = new Tag(this, person.x, person.y - 40, 'bad');   // x, y は札の下のとがった先(頭のすぐ上)
//   tag.follow(person, -40);                                      // 毎フレーム person の頭の上について行く
//   tag.pop();                                                    // ぴょんと出る
// 'bad' は「ワル」、'civ' は「市民」。文字を変えたいときは new Tag(this, x, y, 'bad', '?')。

import Phaser from 'phaser';
import { UI } from '../config';
import { PixelText } from './text';
import { DEPTH, FS, darker } from './theme';

export type TagKind = 'bad' | 'civ';

/** 札の文字の大きさ */
const TAG_SIZE = FS.small;

const LABEL: Record<TagKind, string> = { bad: 'ワル', civ: '市民' };

export class Tag extends Phaser.GameObjects.Container {
  kind: TagKind;
  private g: Phaser.GameObjects.Graphics;
  private label: PixelText;
  private custom?: string;
  private target?: { x: number; y: number };
  private offsetY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: TagKind, text?: string, size: number = TAG_SIZE) {
    super(scene, Math.round(x), Math.round(y));
    this.kind = kind;
    this.custom = text;
    this.g = new Phaser.GameObjects.Graphics(scene);
    this.label = new PixelText(scene, 0, 0, '', { size, align: 'center' });
    this.add([this.g, this.label]);
    this.setDepth(DEPTH.ui);
    scene.add.existing(this);
    this.redraw();
  }

  /** 相手について行く(相手の x と、y + offsetY の位置) */
  follow(target: { x: number; y: number } | undefined, offsetY = 0): this {
    this.target = target;
    this.offsetY = offsetY;
    if (target) this.addToUpdateList(); else this.removeFromUpdateList();
    return this;
  }

  preUpdate(): void {
    if (this.target) this.setPosition(Math.round(this.target.x), Math.round(this.target.y + this.offsetY));
  }

  /** ぴょんと出る */
  pop(): this {
    const seq = [-4, -6, -3, 0];
    let i = 0;
    this.label.y = this.baseY + seq[0];
    this.g.y = seq[0];
    this.scene.time.addEvent({ delay: 40, repeat: seq.length - 1, callback: () => { const d = seq[++i] ?? 0; this.g.y = d; this.label.y = this.baseY + d; } });
    return this;
  }

  private baseY = 0;

  private redraw(): this {
    const color = this.kind === 'bad' ? UI.bad : UI.civ;
    this.label.setText(this.custom ?? LABEL[this.kind]);
    const w = this.label.width + 6;
    const h = this.label.height + 3;
    const x = -Math.floor(w / 2);
    const y = -h - 3; // 下に3ドットのとがり
    const g = this.g;
    g.clear();
    // 黒いふち
    g.fillStyle(UI.black, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillRect(-3, y + h + 1, 7, 1).fillRect(-2, y + h + 2, 5, 1).fillRect(-1, y + h + 3, 3, 1);
    g.fillStyle(color, 1).fillRect(x, y, w, h);
    g.fillRect(-2, y + h, 5, 1).fillRect(-1, y + h + 1, 3, 1).fillRect(0, y + h + 2, 1, 1);
    g.fillStyle(darker(color, 0.35), 1).fillRect(x, y + h - 1, w, 1);
    this.baseY = y + 1;
    this.label.setPosition(x + 3, this.baseY);
    this.label.setStyle({ shadow: darker(color, 0.55) });
    return this;
  }
}
