// ステージ前の掛け合いで、遊び方のセリフに合わせて右側の小さな画面で見せるお手本。
//   const demo = new IntroDemo(this, 118, 34, 94, 118);   // 6つ目に人の絵のキーを渡すと、ふつうのお手本の人がその人になる
//   demo.show(demoKindFor(line.text));   // セリフの言葉から、何を見せるか決める(なければ隠す)
//   demo.update(delta);                  // シーンの update から毎フレーム呼ぶ
// ステージ4(高層ビル)の4つ(surround、psyLeak、thread、psyCarry)は、仕分けの画面と同じ照明と机(towerDesk.ts)を小さく置いて見せる。
import Phaser from 'phaser';
import { UI } from '../../config';
import { animKey, originFor } from '../../art/sheets';
import { accessorySheet } from '../../art/recolor';
import { ACCESSORY_COLORS } from '../../logic';
import { Button, FS, PixelText, TimeBar, WindowFrame } from '../../ui';
import { makeStamp } from './stamp';
import { CALM_LOOK, leakLook } from '../../art/towerSpots';
import { TowerDesk, caneTipOf } from './towerDesk';

/** 念力で運ぶ物のふち(超能力の紫のまん中の色。src/art/world4/palette.ts の PSY[1]) */
const PSY_EDGE = 0xdb6dff;

export type DemoKind = 'swipe' | 'buttons' | 'clues' | 'operator' | 'timeUp' | 'stop' | 'go'
  | 'match' | 'signal' | 'whistle' | 'van' | 'glitch' | 'awkward' | 'ufo'
  | 'surround' | 'psyLeak' | 'thread' | 'psyCarry';

/** セリフの言葉から、お手本の種類を決める */
export function demoKindFor(text: string): DemoKind | null {
  const t = text.replace(/\n/g, '');
  // ステージ4(高層ビル)の、照明と机、紫のもれ、手品の糸、念力で運ぶ物。「見た目」で手がかりのお手本を出さないように先に見る
  if (/周り/.test(t)) return 'surround';
  if (/紫/.test(t)) return 'psyLeak';
  if (/手品|風船/.test(t)) return 'thread';
  if (/念力/.test(t)) return 'psyCarry';
  // ステージ3(ショッピングモール)の、動きのくずれ、ぎこちない市民、UFO。「待てない」で待てのお手本を出さないように先に見る
  if (/くずれ/.test(t)) return 'glitch';
  if (/ぎこちない/.test(t)) return 'awkward';
  if (/UFO/.test(t)) return 'ufo';
  if (/手がかり/.test(t)) return 'clues';
  // ステージ2(地下駐車場)の手がかりと、仲間を呼ぶ、車で逃げる
  if (/おそろい|同じ色|前の人と似/.test(t)) return 'match';
  if (/合図/.test(t)) return 'signal';
  if (/口笛/.test(t)) return 'whistle';
  // 「地下駐車場」の車では出さない
  if (/車[にもごで]|走り出/.test(t)) return 'van';
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
  private mask!: Phaser.Display.Masks.GeometryMask;
  private van?: Phaser.GameObjects.Sprite;
  private bar?: TimeBar;
  /** くずれを見せる宇宙人(glitch、awkward) */
  private alien?: Phaser.GameObjects.Sprite;
  /** UFO と光と、吸い上げられる市民(ufo) */
  private ufo?: { ship: Phaser.GameObjects.Sprite; beam: Phaser.GameObjects.Sprite; civ: Phaser.GameObjects.Sprite };
  /** ステージ4の照明と机 */
  private desk?: TowerDesk;
  /** 念力で運ばれる観葉植物と、その紫のふち(psyCarry) */
  private carry?: { plant: Phaser.GameObjects.Image; edges: Phaser.GameObjects.Image[]; spark: Phaser.GameObjects.Sprite };
  private kind: DemoKind | null = null;
  private t = 0;
  private readonly cx: number;
  private readonly feetY: number;

  constructor(
    private scene: Phaser.Scene, x: number, y: number, private w: number, private h: number, private baseKey = 'hoodie_bad'
  ) {
    this.root = scene.add.container(Math.round(x), Math.round(y)).setDepth(950);
    this.frame = new WindowFrame(scene, 0, 0, w, h, 'win');
    this.cx = Math.floor(w / 2);
    this.feetY = h - 18;
    this.person = scene.add.sprite(this.cx, this.feetY, baseKey).setOrigin(...originFor(baseKey));
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
    this.mask = maskG.createGeometryMask();
    this.person.setMask(this.mask);
    this.root.setVisible(false);
  }

  show(kind: DemoKind | null): void {
    if (kind === this.kind) return;
    this.kind = kind;
    this.t = 0;
    for (const o of this.extras) o.destroy();
    this.extras = [];
    this.bar = undefined;
    this.van = undefined;
    this.alien = undefined;
    this.ufo = undefined;
    this.desk?.destroy();
    this.desk = undefined;
    this.carry = undefined;
    if (!kind) { this.root.setVisible(false); return; }
    this.root.setVisible(true);
    // 開くときに縦に広がる(3コマ)
    const steps = [0.3, 0.7, 1];
    let i = 0;
    this.root.setScale(1, steps[0]);
    this.scene.time.addEvent({ delay: 33, repeat: 2, callback: () => this.root.setScale(1, steps[++i] ?? 1) });

    this.person.setVisible(true).setPosition(this.cx, this.feetY).setAngle(0).setTexture(this.baseKey).setOrigin(...originFor(this.baseKey));
    this.person.play(animKey(this.baseKey, 'sortIdle'));
    this.hand.setVisible(false);
    this.stampBad.setVisible(false);
    this.stampCiv.setVisible(false);
    for (const a of this.arrows) a.setVisible(kind === 'swipe');
    this.caption.setText('');
    const sc = this.scene;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.root.add(o); this.extras.push(o); return o; };
    const bw = this.w - 16;
    // ステージ2の人(小物をその色に塗る)
    const gang = (key: string, color: number, x: number): Phaser.GameObjects.Sprite => {
      const k = accessorySheet(sc, key, color);
      const p = add(sc.add.sprite(x, this.feetY, k).setOrigin(...originFor(key)));
      p.setMask(this.mask);
      p.play(animKey(k, 'sortIdle'));
      return p;
    };
    const red = ACCESSORY_COLORS.red.color;
    switch (kind) {
      case 'match': {
        // おそろいの色の小物をつけた2人。小物の色の「!」を点滅させる
        this.person.setVisible(false);
        gang('guard_bad', red, this.cx - 20);
        gang('clubber_bad', red, this.cx + 20).setFlipX(true);
        this.caption.setText('おそろい？');
        break;
      }
      case 'signal': {
        const k = accessorySheet(sc, 'mechanic_bad', red);
        this.person.setTexture(k).setOrigin(...originFor('mechanic_bad'));
        this.person.play(animKey(k, 'sortIdle'));
        this.caption.setText('合図？');
        break;
      }
      case 'whistle': {
        const k = accessorySheet(sc, 'guard_bad', red);
        this.person.setTexture(k).setOrigin(...originFor('guard_bad'));
        this.person.play({ key: animKey(k, 'mischief'), repeat: -1, repeatDelay: 300 });
        this.caption.setText('ピューッ');
        break;
      }
      case 'van': {
        this.person.setVisible(false);
        this.van = add(sc.add.sprite(this.cx, this.h - 37, 'prop_van', 1).setOrigin(0.5, 1));
        this.van.setMask(this.mask);
        const b = add(new Button(sc, 8, this.h - 34, bw, 26, '行け!', { color: 'go', size: FS.body }));
        b.hit.disableInteractive();
        this.hand.setVisible(true);
        break;
      }
      case 'glitch': {
        // 宇宙人がときどきくずれる(着ぐるみの首が回る)
        this.person.setTexture('mascot_bad').setOrigin(...originFor('mascot_bad'));
        this.person.play(animKey('mascot_bad', 'sortIdle'));
        this.alien = this.person;
        break;
      }
      case 'awkward': {
        // 同じ見た目の市民と宇宙人。どちらもふらつくが、くずれるのは宇宙人だけ
        this.person.setVisible(false);
        const sp = (key: string, x: number): Phaser.GameObjects.Sprite => {
          const p = add(sc.add.sprite(x, this.feetY, key).setOrigin(...originFor(key)));
          p.setMask(this.mask);
          p.play(animKey(key, 'sortIdle'));
          return p;
        };
        sp('clerk_civ', this.cx - 20);
        this.alien = sp('clerk_bad', this.cx + 20).setFlipX(true);
        this.caption.setText('どっち？');
        break;
      }
      case 'ufo': {
        // UFOが光で市民を吸い上げる
        this.person.setVisible(false);
        const beam = add(sc.add.sprite(this.cx, 36, 'fx_ufobeam').setOrigin(...originFor('fx_ufobeam')));
        beam.play(animKey('fx_ufobeam', 'play'));
        const civ = add(sc.add.sprite(this.cx, this.feetY, 'uncle_civ', 0).setOrigin(...originFor('uncle_civ')));
        civ.play(animKey('uncle_civ', 'surprised'));
        const ship = add(sc.add.sprite(this.cx, 42, 'prop_ufo', 2).setOrigin(...originFor('prop_ufo')));
        for (const o of [beam, civ, ship]) o.setMask(this.mask);
        this.ufo = { ship, beam, civ };
        this.caption.setText('たすけて！');
        break;
      }
      case 'surround':
      case 'psyLeak':
      case 'thread': {
        // 仕分けの画面と同じ、左上の照明と左下の机(小さく)。人は右に立つ
        const thread = kind === 'thread';
        this.desk = this.makeDesk(thread ? 1 : 2);
        const key = thread ? 'tw_magician' : 'tw_newbie';
        this.person.setTexture(key).setOrigin(...originFor(key)).setX(this.cx + 20);
        this.person.play(animKey(key, 'sortIdle'));
        if (kind === 'psyLeak') this.desk.setLook(leakLook({ light: 'leak', item: 'leak' }));
        if (thread) this.desk.setLook(leakLook({ light: null, item: 'thread' }), caneTipOf(this.person, 1));
        this.caption.setText(kind === 'surround' ? '照明と机' : kind === 'psyLeak' ? '紫に光った！' : '糸で吊ってる');
        break;
      }
      case 'psyCarry': {
        // ヴィランが手を前に出すと、観葉植物が浮いて右の市民の上へ運ばれる
        const key = 'tw_courier';
        this.person.setTexture(key).setOrigin(...originFor(key)).setX(this.cx - 26);
        this.person.play({ key: animKey(key, 'mischief'), repeat: -1, repeatDelay: 1800 });
        const civ = add(sc.add.sprite(this.cx + 28, this.feetY, 'tw_florist').setOrigin(...originFor('tw_florist')).setFlipX(true));
        civ.play(animKey('tw_florist', 'idle'));
        const edges = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([ex, ey]) =>
          add(sc.add.image(ex, ey, 'prop_plant', 0).setOrigin(0.5, 1).setTintFill(PSY_EDGE)));
        const plant = add(sc.add.image(0, 0, 'prop_plant', 0).setOrigin(0.5, 1));
        const spark = add(sc.add.sprite(0, 0, 'fx_psy_spark', 0));
        spark.play(animKey('fx_psy_spark', 'play'));
        for (const o of [civ, plant, spark, ...edges]) o.setMask(this.mask);
        this.carry = { plant, edges, spark };
        this.caption.setText('あぶない！');
        break;
      }
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
        const face = add(sc.add.sprite(this.cx, 50, 'face_operator'));
        face.play(animKey('face_operator', 'hype'));
        add(new PixelText(sc, this.cx + 28, 22, '!', { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0));
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
      case 'match':
      case 'signal':
      case 'whistle': this.cluesStep(); break;
      case 'van': this.vanStep(); break;
      case 'glitch':
      case 'awkward': this.glitchStep(); break;
      case 'ufo': this.ufoStep(); break;
      case 'surround': this.cluesStep(); this.desk?.update(this.scene.time.now); break;
      case 'psyLeak':
      case 'thread': this.desk?.update(this.scene.time.now); break;
      case 'psyCarry': this.carryStep(); break;
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

  /** ワゴンが走り出して、行けを押すと止まる */
  private vanStep(): void {
    this.tapStep();
    if (!this.van) return;
    const cycle = 1800;
    const t = this.t % cycle;
    if (t < 1100) {
      // 走る(2コマ)。右へ少しずつ
      this.van.setFrame(1 + (Math.floor(this.t / 90) % 2));
      this.van.x = this.cx - 10 + Math.round((t / 1100) * 24);
    } else {
      // 行けで止まった:こわれたワゴン
      this.van.setFrame(3);
      this.van.x = this.cx + 14 + (t < 1200 ? (Math.floor(t / 30) % 2 ? 2 : -2) : 0);
    }
  }

  /** 1.6秒ごとに宇宙人がくずれる(ゲームの0.2秒では見落とすので、お手本は少しゆっくり)。くずれている間は「!?」 */
  private glitchStep(): void {
    const a = this.alien;
    if (!a) return;
    const cycle = 1600;
    const k = this.t % cycle;
    const on = k >= 1000 && k < 1400;
    const glitching = a.anims.currentAnim?.key === animKey(a.texture.key, 'glitch');
    if (on && !glitching) a.play({ key: animKey(a.texture.key, 'glitch'), frameRate: 10 });
    if (!on && glitching) a.play(animKey(a.texture.key, 'sortIdle'));
    const cap = on ? 'くずれた!?' : '';
    if (this.kind === 'glitch' && this.caption.text !== cap) this.caption.setText(cap);
  }

  /** 市民が光の中を浮き上がって、UFOに吸いこまれる。光は1コマおきに点滅させる */
  private ufoStep(): void {
    const u = this.ufo;
    if (!u) return;
    const cycle = 2400;
    const k = this.t % cycle;
    u.ship.y = 42 + (Math.floor(this.t / 300) % 2);
    u.beam.setVisible(k < 2000 && Math.floor(this.t / 33) % 2 === 0);
    // UFOの下まで浮いたら、1コマおきに点滅して消える(吸いこまれた)
    const lift = Phaser.Math.Clamp((k - 300) / 1400, 0, 1);
    u.civ.y = Math.round(this.feetY - lift * (this.feetY - 72));
    u.civ.setVisible(lift < 0.8 || (lift < 1 && Math.floor(this.t / 50) % 2 === 0));
    this.cluesStep();
  }

  /** 仕分けの画面と同じ照明と机を、小さな画面の左に置く。floor は小物を決める階(1は名刺とペン、2はペンとマグカップ) */
  private makeDesk(floor: 1 | 2): TowerDesk {
    const desk = new TowerDesk(this.scene, {
      floor, lamp: { x: 26, y: 3 }, desk: { x: 24, y: this.feetY }, depth: 0, container: this.root
    });
    for (const o of desk.objects) (o as unknown as Phaser.GameObjects.Components.Mask).setMask(this.mask);
    desk.setLook(CALM_LOOK);
    return desk;
  }

  /** 観葉植物が浮いて(0.8秒)、右の市民の上へ運ばれ(1.4秒)、少し止まってまた初めから */
  private carryStep(): void {
    const c = this.carry;
    if (!c) return;
    const cycle = 3000;
    const k = this.t % cycle;
    const x0 = this.cx - 4, x1 = this.cx + 28, ground = this.feetY, high = this.feetY - 58;
    let x = x0, y = ground;
    if (k < 400) { x = x0; y = ground; }
    else if (k < 1200) { y = Math.round(ground + (high - ground) * ((k - 400) / 800)); }
    else if (k < 2600) { x = Math.round(x0 + (x1 - x0) * ((k - 1200) / 1400)); y = high; }
    else { x = x1; y = high; }
    const lifted = k >= 400;
    c.plant.setPosition(x, y);
    c.edges.forEach((e, i) => e.setPosition(x + [-1, 1, 0, 0][i], y + [0, 0, -1, 1][i]).setVisible(lifted));
    c.spark.setPosition(x + 10, y - 40).setVisible(lifted);
    this.caption.setVisible(k >= 1200 && Math.floor(this.t / 250) % 2 === 0);
  }

  /** ボタンをトントンと押す */
  private tapStep(): void {
    const k = this.t % 700;
    this.hand.setPosition(this.cx + 10, this.h - 24 + (k < 120 ? 2 : 0));
  }
}
