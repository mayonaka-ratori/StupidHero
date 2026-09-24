// 「ワル」「市民」のハンコ。仕分けが決まった瞬間に、人の絵の上にドンと押す。
//   const s = makeStamp(this, 'bad', 16);     // 真ん中が 0,0 の Container
//   popStamp(this, s);                        // 2倍から1倍へ、ドンと押す
import Phaser from 'phaser';
import { UI } from '../../config';
import type { SortChoice } from '../../logic';
import { PixelText, darker } from '../../ui';

const STAMP_LABEL: Record<SortChoice, string> = { bad: 'ワル', civ: '市民' };
const STAMP_COLOR: Record<SortChoice, number> = { bad: UI.bad, civ: UI.civ };

/** ハンコを作る。真ん中が原点 */
export function makeStamp(scene: Phaser.Scene, choice: SortChoice, size = 16, mark = ''): Phaser.GameObjects.Container {
  const label = new PixelText(scene, 0, 0, STAMP_LABEL[choice] + mark, {
    size, color: 0xffffff, shadow: darker(STAMP_COLOR[choice], 0.55)
  }).setOrigin(0.5, 0.5);
  const pad = size >= 16 ? 7 : 4;
  const w = Math.ceil(label.width) + pad * 2 + 2;
  const h = Math.ceil(label.height) + pad + 2;
  const x0 = -Math.floor(w / 2), y0 = -Math.floor(h / 2);
  const g = new Phaser.GameObjects.Graphics(scene);
  const c = STAMP_COLOR[choice];
  // 黒ふち → 白ふち → 色 → 内側の白い線(ハンコの二重線)
  g.fillStyle(UI.black, 1).fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
  g.fillStyle(0xffffff, 1).fillRect(x0, y0, w, h);
  g.fillStyle(c, 1).fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
  g.fillStyle(0xffffff, 1)
    .fillRect(x0 + 3, y0 + 3, w - 6, 1).fillRect(x0 + 3, y0 + h - 4, w - 6, 1)
    .fillRect(x0 + 3, y0 + 3, 1, h - 6).fillRect(x0 + w - 4, y0 + 3, 1, h - 6);
  label.setPosition(0, 0);
  const box = new Phaser.GameObjects.Container(scene, 0, 0, [g, label]);
  box.setSize(w, h);
  scene.add.existing(box);
  return box;
}

/** 2倍で出して、次のコマで1倍に落とす(ハンコをドンと押す感じ) */
export function popStamp(scene: Phaser.Scene, box: Phaser.GameObjects.Container, frames = 2): void {
  box.setScale(2);
  let n = 0;
  const tick = (): void => {
    n++;
    if (!box.active) { scene.events.off(Phaser.Scenes.Events.UPDATE, tick); return; }
    if (n >= frames) { box.setScale(1); scene.events.off(Phaser.Scenes.Events.UPDATE, tick); }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
}
