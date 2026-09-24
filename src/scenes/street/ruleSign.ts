// フリープレイの左上の札:ヒーローの決めつけ(ルール)と、その下にクリアまでの時間(docs/FREEPLAY.md「波の始め」)。
// 札は絵とひらがなで、字が読めなくても分かるようにする。
//   波1:拳の絵と「みんなワル」 / 波2:手のひらの絵と「みんないいひと」
//   波3:小物の絵に拳で「ふうせん=ワル」、その下に手のひらで「ほか=いいひと」
// 使い方:
//   const sign = new RuleSign(scene, 1);        // 波の番号
//   sign.setRule(rule);                         // 出す(波の始め)。setRule(rule, true) は札をくるっと返して変える(言い直し)
//   sign.setTime('0:12');  sign.penalty(3);     // 時間と、足した秒数を小さく飛ばす
// アクション部分のカメラに置き、画面に固定する(スクロールしない)。絵がまだないときは字だけにする。

import Phaser from 'phaser';
import { UI } from '../../config';
import { FREE_ITEM_ICONS } from '../../art/free/items';
import { ruleSignText, type FreeRule } from '../../logic';
import { settings } from '../../settings';
import { FS, PixelText, popText } from '../../ui';

const X = 4;
const Y = 4;
const PAD = 3;
const ICON = 16;
/** 吹き出し(1100)と帯(1500)の間 */
const DEPTH = 1300;

export class RuleSign {
  readonly box: Phaser.GameObjects.Container;
  private parts: Phaser.GameObjects.GameObject[] = [];
  private bg: Phaser.GameObjects.Graphics;
  private time: PixelText;
  private waveNo: number;
  private h = 0;

  constructor(private scene: Phaser.Scene, waveNo: number) {
    this.waveNo = waveNo;
    this.box = scene.add.container(X, Y).setScrollFactor(0).setDepth(DEPTH);
    this.bg = scene.add.graphics();
    this.time = new PixelText(scene, 0, 0, '', { size: FS.small, color: UI.gold, outline: true });
    this.box.add([this.bg, this.time]);
    this.box.setVisible(false);
  }

  /** ルールを出す。animate なら札をくるっと返して変える(言い直し) */
  setRule(rule: FreeRule, animate = false): void {
    if (!animate) { this.build(rule); this.box.setVisible(true); return; }
    const b = this.box;
    this.scene.tweens.add({
      targets: b, scaleY: 0, duration: 110, ease: 'Quad.easeIn',
      onComplete: () => {
        this.build(rule);
        this.scene.tweens.add({ targets: b, scaleY: 1, duration: 140, ease: 'Back.easeOut' });
        // ふちを何回か光らせて、変わったことを見せる(光と揺れを弱くするときは点滅させず、1回だけ白くする)
        if (settings.reduceFx) {
          this.drawBg(UI.text);
          this.scene.time.delayedCall(700, () => this.drawBg(UI.gold));
        } else {
          for (let i = 0; i < 6; i++) this.scene.time.delayedCall(i * 110, () => this.drawBg(i % 2 === 0 ? UI.text : UI.gold));
        }
      }
    });
  }

  setTime(text: string): void {
    const t = `WAVE${this.waveNo} ${text}`;
    if (this.time.text !== t) this.time.setText(t);
  }

  /** 足した秒数を、時間の横に小さく飛ばす */
  penalty(sec: number): void {
    if (!this.box.visible || sec <= 0) return;
    const x = X + PAD + this.time.width + 14;
    const y = Y + this.time.y + FS.small;
    const t = popText(this.scene, x, y, `+${sec}`, { color: UI.go, size: FS.small, rise: 10, ms: 900 });
    t.setScrollFactor(0).setDepth(DEPTH + 1);
  }

  /** 撮るときに隠すもの */
  get shotHidden(): Phaser.GameObjects.Components.Visible[] {
    return [this.box];
  }

  private icon(key: string, x: number, y: number): number {
    if (!this.scene.textures.exists(key)) return 0;
    const img = this.scene.add.image(x, y, key, 0).setOrigin(0, 0);
    this.box.add(img);
    this.parts.push(img);
    return ICON + 1;
  }

  private text(s: string, x: number, y: number, size: number): PixelText {
    const t = new PixelText(this.scene, x, y, s, { size, color: UI.text, outline: true });
    this.box.add(t);
    this.parts.push(t);
    return t;
  }

  private build(rule: FreeRule): void {
    for (const p of this.parts) p.destroy();
    this.parts = [];
    let w = 0;
    let y = PAD;
    // 1行目:当てはまる人の絵(小物)、拳、ルールの文
    let x = PAD;
    if (rule.kind === 'item') x += this.icon(FREE_ITEM_ICONS[rule.item], x, y);
    x += this.icon(rule.kind === 'allCiv' ? 'ui_rule_palm' : 'ui_rule_fist', x, y);
    const t1 = this.text(ruleSignText(rule), x + 1, y + 2, FS.body);
    w = Math.max(w, x + 1 + t1.width);
    y += ICON + 2;
    // 波3:それ以外の人には手のひら
    if (rule.kind === 'item') {
      x = PAD;
      x += this.icon('ui_rule_palm', x, y);
      const t2 = this.text('ほか=いいひと', x + 1, y + 3, FS.small);
      w = Math.max(w, x + 1 + t2.width);
      y += ICON + 2;
    }
    this.time.setPosition(PAD, y);
    y += FS.small + 3;
    w = Math.max(w, PAD + 64) + PAD;
    this.h = y;
    this.bgW = w;
    this.drawBg(UI.gold);
  }

  private bgW = 0;

  private drawBg(edge: number): void {
    const g = this.bg;
    g.clear();
    g.fillStyle(UI.black, 1).fillRect(0, 0, this.bgW, this.h);
    g.fillStyle(edge, 1).fillRect(0, 0, this.bgW, 1).fillRect(0, this.h - 1, this.bgW, 1).fillRect(0, 0, 1, this.h).fillRect(this.bgW - 1, 0, 1, this.h);
  }
}
