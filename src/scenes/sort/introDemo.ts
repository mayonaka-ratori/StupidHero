// ステージ前の掛け合いで、遊び方のセリフに合わせて右側の小さな画面で見せるお手本。
//   const demo = new IntroDemo(this, 118, 34, 94, 118);
//   demo.show(demoKindFor(line.text));   // セリフの言葉から、何を見せるか決める(なければ隠す)
//   demo.update(delta);                  // シーンの update から毎フレーム呼ぶ
import Phaser from 'phaser';
import { UI } from '../../config';
import { animKey, originFor } from '../../art/sheets';
import { Button, FS, PixelText, TimeBar, WindowFrame } from '../../ui';
import { makeStamp } from './stamp';

export type DemoKind = 'swipe' | 'buttons' | 'clues' | 'operator' | 'timeUp' | 'stop' | 'go';

/** セリフの言葉から、お手本の種類を決める */
export function demoKindFor(text: string): DemoKind | null {
  const t = text.replace(/\n/g, '');
  if (/スワイプ|左がワル/.test(t)) return 'swipe';
  if (/ボタン/.test(t)) return 'buttons';
  if (/プロフィール|見た目/.test(t)) return 'clues';
  if (/一言/.test(t)) return 'operator';
  if (/時間切れ|勝手に決める/.test(t)) return 'timeUp';
  if (/待て/.test(t) && /行け/.test(t)) return 'stop';
  if (/待て/.test(t)) return 'stop';
  if (/行け/.test(t)) return 'go';
  return null;
}

/** 指さしの手(白い手袋)。1が白、2が黒のふち */
const HAND = [
  '..22......',
  '.2112.....',
  '.2112.....',
  '.2112222..',
  '.21121212.',
  '22112121212',
  '21111111112',
  '21111111112',
  '.211111112',
  '..2111112.',
  '...22222..'
];

export function drawHand(g: Phaser.GameObjects.Graphics): void {
  HAND.forEach((row, y) => {
    Array.from(row).forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle(ch === '1' ? 0xffffff : 0x000000, 1).fillRect(x - 3, y, 1, 1);
    });
  });
}

export class IntroDemo {
  private root: Phaser.GameObjects.Container;
  private frame: WindowFrame;
  private person: Phaser.GameObjects.Sprite;
  private hand: Phaser.GameObjects.Graphics;
  private stampBad: Phaser.GameObjects.Container;
  private stampCiv: Phaser.GameObjects.Container;
  private arrows: PixelText[];
  private caption: PixelText;
  private extras: Phaser.GameObjects.GameObject[] = [];
  private bar?: TimeBar;
  private kind: DemoKind | null = null;
  private t = 0;
  private readonly cx: number;
  private readonly feetY: number;

  constructor(private scene: Phaser.Scene, x: number, y: number, private w: number, private h: number) {
    this.root = scene.add.container(Math.round(x), Math.round(y)).setDepth(950);
    this.frame = new WindowFrame(scene, 0, 0, w, h, 'win');
    this.cx = Math.floor(w / 2);
    this.feetY = h - 18;
    this.person = scene.add.sprite(this.cx, this.feetY, 'hoodie_bad').setOrigin(...originFor('hoodie_bad'));
    this.hand = scene.add.graphics();
    drawHand(this.hand);
    this.stampBad = makeStamp(scene, 'bad', FS.body);
    this.stampCiv = makeStamp(scene, 'civ', FS.body);
    this.arrows = [
      new PixelText(scene, 5, 5, '◀ワル', { size: FS.small, color: 0xff8a80, outline: true }),
      new PixelText(scene, w - 5, 5, '市民▶', { size: FS.small, color: 0x9ac4ff, outline: true }).setOrigin(1, 0)
    ];
    this.caption = new PixelText(scene, this.cx, h - 15, '', { size: FS.small, color: UI.gold, outline: true }).setOrigin(0.5, 0);
    this.root.add([this.frame, this.person, ...this.arrows, this.stampBad, this.stampCiv, this.hand, this.caption]);
    // 枠の中だけ見せる
    const maskG = scene.make.graphics({}, false);
    maskG.fillStyle(0xffffff, 1).fillRect(this.root.x + 3, this.root.y + 3, w - 6, h - 6);
    this.person.setMask(maskG.createGeometryMask());
    this.root.setVisible(false);
  }

  get visible(): boolean { return this.root.visible; }

  show(kind: DemoKind | null): void {
    if (kind === this.kind) return;
    this.kind = kind;
    this.t = 0;
    for (const o of this.extras) o.destroy();
    this.extras = [];
    this.bar = undefined;
    if (!kind) { this.root.setVisible(false); return; }
    this.root.setVisible(true);
    // 開くときに縦に広がる(3コマ)
    const steps = [0.3, 0.7, 1];
    let i = 0;
    this.root.setScale(1, steps[0]);
    this.scene.time.addEvent({ delay: 33, repeat: 2, callback: () => this.root.setScale(1, steps[++i] ?? 1) });

    this.person.setVisible(true).setPosition(this.cx, this.feetY).setAngle(0).setTexture('hoodie_bad');
    this.person.play(animKey('hoodie_bad', 'sortIdle'));
    this.hand.setVisible(false);
    this.stampBad.setVisible(false);
    this.stampCiv.setVisible(false);
    for (const a of this.arrows) a.setVisible(kind === 'swipe');
    this.caption.setText('');
    const sc = this.scene;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.root.add(o); this.extras.push(o); return o; };
    const bw = this.w - 16;
    switch (kind) {
      case 'swipe':
        this.hand.setVisible(true);
        break;
      case 'buttons': {
        this.person.setY(this.feetY - 22);
        const b1 = add(new Button(sc, 6, this.h - 32, Math.floor(bw / 2), 24, '◀ワル', { color: 'bad', size: FS.small }));
        const b2 = add(new Button(sc, 10 + Math.floor(bw / 2), this.h - 32, Math.floor(bw / 2), 24, '市民▶', { color: 'civ', size: FS.small }));
        b1.hit.disableInteractive(); b2.hit.disableInteractive();
        this.hand.setVisible(true);
        break;
      }
      case 'clues':
        this.caption.setText('どっち？');
        break;
      case 'operator': {
        this.person.setVisible(false);
        const face = add(sc.add.sprite(this.cx, 50, 'face_operator').setScale(2));
        face.play(animKey('face_operator', 'hype'));
        add(new PixelText(sc, this.cx + 34, 22, '!', { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0));
        this.caption.setText('ヒント');
        break;
      }
      case 'timeUp': {
        this.bar = add(new TimeBar(sc, 8, 22, this.w - 16, 5));
        this.caption.setText('');
        break;
      }
      case 'stop': {
        this.person.setVisible(false);
        const hero = add(sc.add.sprite(this.cx, this.feetY - 16, 'hero').setOrigin(...originFor('hero')));
        hero.play(animKey('hero', 'run'));
        const b = add(new Button(sc, 8, this.h - 34, bw, 26, '待て!', { color: 'stop', size: FS.body }));
        b.hit.disableInteractive();
        this.hand.setVisible(true);
        break;
      }
      case 'go': {
        this.person.setVisible(false);
        const hero = add(sc.add.sprite(this.cx, this.feetY - 16, 'hero').setOrigin(...originFor('hero')));
        hero.play(animKey('hero', 'run'));
        const b = add(new Button(sc, 8, this.h - 34, bw, 26, '行け!', { color: 'go', size: FS.body }));
        b.hit.disableInteractive();
        this.hand.setVisible(true);
        break;
      }
    }
    this.root.bringToTop(this.hand);
    this.update(0);
  }

  update(dt: number): void {
    if (!this.kind) return;
    this.t += dt;
    switch (this.kind) {
      case 'swipe': this.swipeStep(); break;
      case 'buttons': this.buttonStep(); break;
      case 'clues': this.cluesStep(); break;
      case 'timeUp': this.timeStep(); break;
      case 'stop':
      case 'go': this.tapStep(); break;
      default: break;
    }
  }

  /** 左へスワイプして「ワル」、右へスワイプして「市民」をくり返す */
  private swipeStep(): void {
    const cycle = 3200;
    const t = this.t % cycle;
    const half = cycle / 2;
    const dir = t < half ? -1 : 1;
    const k = t % half;
    const stamp = dir < 0 ? this.stampBad : this.stampCiv;
    const other = dir < 0 ? this.stampCiv : this.stampBad;
    other.setVisible(false);
    const handY = this.feetY - 30;
    let dx = 0;
    let fly = 0;
    if (k < 350) dx = 0;
    else if (k < 800) dx = Math.round(((k - 350) / 450) * 22) * dir;
    else if (k < 1000) { dx = 22 * dir; fly = Math.round(((k - 800) / 200) * 60) * dir; }
    else { dx = 0; fly = 999; }
    // 人
    if (fly === 999) {
      // 次の人が入ってくる
      const inK = Math.min(1, (k - 1000) / 180);
      this.person.setVisible(true).setAngle(0).setX(this.cx + Math.round((1 - inK) * 30));
    } else {
      this.person.setVisible(true).setX(this.cx + dx + fly).setAngle(Math.round((dx + fly) / 3));
    }
    // 手
    this.hand.setVisible(k < 1000 && k > 150);
    this.hand.setPosition(this.cx + dx, handY);
    // ハンコ
    stamp.setVisible(k >= 800 && k < 1350);
    stamp.setPosition(this.cx, this.feetY - 50);
    stamp.setScale(k < 840 ? 2 : 1);
  }

  /** ボタンを交互に押す */
  private buttonStep(): void {
    const cycle = 2000;
    const t = this.t % cycle;
    const left = t < cycle / 2;
    const k = t % (cycle / 2);
    const bx = left ? 6 + Math.floor((this.w - 16) / 4) : 10 + Math.floor((this.w - 16) * 3 / 4);
    this.hand.setPosition(bx, this.h - 20 + (k > 300 && k < 450 ? 2 : 0));
    const stamp = left ? this.stampBad : this.stampCiv;
    (left ? this.stampCiv : this.stampBad).setVisible(false);
    stamp.setVisible(k > 320 && k < 900).setPosition(this.cx, 22).setScale(k < 360 ? 2 : 1);
  }

  /** 人のまわりに「?」を点滅させる */
  private cluesStep(): void {
    const on = Math.floor(this.t / 250) % 2 === 0;
    this.caption.setVisible(on);
  }

  /** 時間のバーが減って、なくなると「?」のハンコ */
  private timeStep(): void {
    const cycle = 2600;
    const t = this.t % cycle;
    const v = Math.max(0, 1 - t / 1600);
    this.bar?.setValue(v).setDanger(v < 0.3);
    const done = t >= 1600;
    const bad = Math.floor(this.t / cycle) % 2 === 0;
    this.stampBad.setVisible(done && bad).setPosition(this.cx, this.feetY - 50).setScale(t < 1640 ? 2 : 1);
    this.stampCiv.setVisible(done && !bad).setPosition(this.cx, this.feetY - 50).setScale(t < 1640 ? 2 : 1);
  }

  /** ボタンをトントンと押す */
  private tapStep(): void {
    const k = this.t % 700;
    this.hand.setPosition(this.cx + 10, this.h - 24 + (k < 120 ? 2 : 0));
  }

  destroy(): void {
    this.root.destroy();
  }
}
