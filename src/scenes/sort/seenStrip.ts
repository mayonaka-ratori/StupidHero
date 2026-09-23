// ステージ2の仕分けの画面の上の「見た小物」。その波でもう見た人の小物の色を、1人1つの札で並べる。
// 今の人の札には「いま」、前の人の札には「1人目」「2人目」…と書く(オペレーターのつながりの一言と同じ番号)。
//   const strip = new SeenStrip(this, 72, 21);
//   strip.show(wave.people, idx);     // idx 番目(0始まり)の人がいまの人
// 色が見分けにくい人のために、色ごとに模様もつける(赤は斜めのしま、緑は点、黄は横じま、水色は市松、
// 紫は縦じま、オレンジは十字、金は星)。

import Phaser from 'phaser';
import { UI } from '../../config';
import type { AccessoryColorId, Person } from '../../logic';
import { FS, PixelText, darker, lighter } from '../../ui';

/** 札の大きさ(黒いふちを含む) */
export const CHIP = 12;
/** 1行に並べる札の数と、1つぶんの幅 */
const PER_ROW = 4;
const SLOT_W = 34;
/** 1行の高さ(札と、その下の番号) */
const ROW_H = 26;

/** 模様のドットを打つか(x, y は札の中の色の部分の中で 0〜9) */
const PATTERN: Record<AccessoryColorId, (x: number, y: number) => boolean> = {
  red: (x, y) => (x + y) % 4 === 0,
  green: (x, y) => x % 3 === 1 && y % 3 === 1,
  yellow: (_x, y) => y % 3 === 1,
  aqua: (x, y) => ((x >> 1) + (y >> 1)) % 2 === 0,
  purple: (x) => x % 3 === 1,
  orange: (x, y) => x === 4 || x === 5 || y === 4 || y === 5,
  // 星:真ん中の十字と、斜めの短い光
  gold: (x, y) => ((x === 4 || x === 5) && y >= 1 && y <= 8) || ((y === 4 || y === 5) && x >= 1 && x <= 8) ||
    ((x === 2 || x === 7) && (y === 2 || y === 7))
};

/** 札を1つ描く(左上が x, y) */
export function drawChip(g: Phaser.GameObjects.Graphics, x: number, y: number, id: AccessoryColorId, color: number): void {
  const inner = CHIP - 2;
  g.fillStyle(UI.black, 1).fillRect(x, y, CHIP, CHIP);
  g.fillStyle(color, 1).fillRect(x + 1, y + 1, inner, inner);
  // 模様の色:暗い色(紫)には明るく、金は白く光らせる、ほかは暗く
  const dot = id === 'gold' ? 0xffffff : id === 'purple' ? lighter(color, 0.6) : darker(color, 0.55);
  g.fillStyle(dot, 1);
  const f = PATTERN[id];
  for (let py = 0; py < inner; py++) for (let px = 0; px < inner; px++) if (f(px, py)) g.fillRect(x + 1 + px, y + 1 + py, 1, 1);
}

export class SeenStrip {
  private g: Phaser.GameObjects.Graphics;
  private title: PixelText;
  private labels: PixelText[] = [];

  constructor(private scene: Phaser.Scene, private x: number, private y: number) {
    this.g = scene.add.graphics().setDepth(1000);
    // 見出しは、最初の人が出てきてから出す
    this.title = new PixelText(scene, x, y, '見た小物', { size: FS.body, color: UI.gold, outline: true }).setVisible(false);
  }

  /** 中断のときに隠すもの */
  get objects(): Phaser.GameObjects.Components.Visible[] { return [this.g, this.title, ...this.labels]; }

  /** 0〜idx 番目の人の札を並べる。idx 番目がいまの人 */
  show(people: readonly Person[], idx: number): void {
    const g = this.g;
    g.clear();
    const n = Math.min(idx + 1, people.length);
    this.title.setVisible(n > 0);
    for (let i = 0; i < n; i++) {
      const p = people[i];
      const col = i % PER_ROW, row = Math.floor(i / PER_ROW);
      const sx = this.x + col * SLOT_W;
      const cy = this.y + FS.body + 3 + row * ROW_H;
      const cx = sx + Math.floor((SLOT_W - CHIP) / 2);
      const now = i === idx;
      if (p.accessory) drawChip(g, cx, cy, p.accessory.id, p.accessory.color);
      if (now) {
        // いまの人は白いわくで囲む
        g.fillStyle(0xffffff, 1)
          .fillRect(cx - 2, cy - 2, CHIP + 4, 1).fillRect(cx - 2, cy + CHIP + 1, CHIP + 4, 1)
          .fillRect(cx - 2, cy - 2, 1, CHIP + 4).fillRect(cx + CHIP + 1, cy - 2, 1, CHIP + 4);
      }
      let t = this.labels[i];
      if (!t) {
        t = new PixelText(this.scene, 0, 0, '', { size: FS.small, outline: true, align: 'center' }).setOrigin(0.5, 0);
        this.labels[i] = t;
      }
      t.setText(now ? 'いま' : `${i + 1}人目`).setColor(now ? UI.gold : UI.text);
      t.setPosition(cx + CHIP / 2, cy + CHIP + 2).setVisible(true);
    }
    for (let i = n; i < this.labels.length; i++) this.labels[i].setVisible(false);
  }
}
