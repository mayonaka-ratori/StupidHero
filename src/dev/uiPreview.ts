// UIの部品を並べて見るための開発用ページ(/dev/ui.html)。ゲームには入らない。
// ?page=sort    仕分けの画面のように並べる(ふつう)
// ?page=result  結果発表の画面のように並べる
// ?page=parts   部品を1つずつ(ボタンの状態、吹き出しのしっぽ、バー、札、アイコン、演出)
// ?page=swipe   スワイプを試す(カードが指について動く)
// ?page=text    文字の大きさの見比べ
// 画面の右上の「>」で次のページへ(ワイプで切り替わる)。window.uiDev から中身をさわれる(テスト用)。
import '@fontsource/dotgothic16';
import Phaser from 'phaser';
import { UI } from '../config';
import { computeLayout, fitCanvas, layout } from '../layout';
import { generateArt } from '../art';
import {
  Bubble, Button, CutIn, CUT_H, EdgeAlarm, FS, HpBar, IconButton, MuteButton, PauseControl, PixelText, SwipeInput, Tag,
  TimeBar, WindowFrame, addPanel, ditherTexture, banner, blink, enableTapSparks, flash, goto, impact, panelRect, popText,
  preloadFont, shake, type TailDir
} from '../ui';

const params = new URLSearchParams(location.search);
const PAGES = ['sort', 'result', 'parts', 'swipe', 'text'];
const first = PAGES.includes(params.get('page') ?? '') ? params.get('page')! : 'sort';

interface DevHandle { scene?: Phaser.Scene; log: string[]; [k: string]: unknown }
const dev: DevHandle = { log: [] };
(window as unknown as { uiDev: DevHandle }).uiDev = dev;
const log = (s: string): void => { dev.log.push(s); console.log('[ui]', s); };

let muted = false;

/** どのページにもある:背景の絵、次のページへのボタン、中断ボタン、音のボタン */
abstract class Page extends Phaser.Scene {
  pause!: PauseControl;
  abstract next: string;
  init(): void {
    dev.scene = this;
    if (!this.textures.exists('face_operator')) generateArt(this, new Set());
  }

  protected chrome(): void {
    this.pause = new PauseControl(this, { onPause: (r) => log(`pause:${r}`), onResume: () => log('resume') });
    new IconButton(this, layout.W - 12, 12, 'play', () => goto(this, this.next));
    new IconButton(this, layout.W - 34, 12, 'pause', () => this.pause.pause());
    new MuteButton(this, layout.W - 56, 12, { isMuted: () => muted, toggle: () => { muted = !muted; log(`muted:${muted}`); } });
  }

  protected drawStreet(dim = false): void {
    const { W, actionH } = layout;
    for (const k of ['bg_alley_far', 'bg_alley_wall', 'bg_alley_ground']) if (!this.textures.exists(k)) return;
    this.add.image(0, 0, 'bg_alley_far').setOrigin(0);
    this.add.image(0, 0, 'bg_alley_wall').setOrigin(0);
    this.add.image(0, 124, 'bg_alley_ground').setOrigin(0);
    if (dim) this.add.tileSprite(0, 0, W, actionH, ditherTexture(this)).setOrigin(0);
  }

  protected person(key: string, x: number, feetY: number, scale = 1, anim = 'idle'): Phaser.GameObjects.Sprite {
    const s = this.add.sprite(x, feetY, key, 0).setOrigin(0.5, (64 - 4) / 64).setScale(scale);
    const a = `${key}.${anim}`;
    if (this.anims.exists(a)) s.play(a);
    return s;
  }
}

class SortPage extends Page {
  next = 'result';
  constructor() { super('sort'); }
  create(): void {
    const { W } = layout;
    this.drawStreet(true);
    const guy = this.person('hoodie_bad', W / 2, 206, 2, 'sortIdle');
    new PixelText(this, 6, 6, 'STAGE1', { size: FS.body, color: UI.gold, outline: true });
    new PixelText(this, 6, 22, '4/5人目', { size: FS.body, outline: true });
    const time = new TimeBar(this, 8, 40, 66, 5);
    time.setValue(0.62);
    const cut = new CutIn(this, 80, 30, 132, CUT_H);
    cut.say('ポケットがふくらんでる…', 'normal');
    this.chrome();
    addPanel(this);
    const r = panelRect();
    const prof = new WindowFrame(this, r.x, r.y, r.w, 52, 'win');
    void prof;
    new PixelText(this, r.x + 6, r.y + 5, 'タカシ(24)', { size: FS.body, color: UI.gold });
    new PixelText(this, r.x + 6, r.y + 5 + 16, '夜になるとこのへんをうろうろしている', { size: FS.body, wrap: r.w - 12 });
    const by = r.y + 60;
    const bh = Math.min(56, r.bottom - by - 16);
    const bw = Math.floor((r.w - 8) / 2);
    const bad = new Button(this, r.x, by, bw, bh, '◀ワル', { color: 'bad', onPress: () => log('press:bad') });
    const civ = new Button(this, r.x + bw + 8, by, bw, bh, '市民▶', { color: 'civ', onPress: () => log('press:civ') });
    new PixelText(this, W / 2, by + bh + 5, '左右にスワイプでもOK', { size: FS.body, color: UI.textDim }).setOrigin(0.5, 0);
    const alarm = new EdgeAlarm(this).start();
    Object.assign(dev, { cut, time, bad, civ, alarm, guy });
  }
}

class ResultPage extends Page {
  next = 'parts';
  constructor() { super('result'); }
  create(): void {
    this.drawStreet();
    const woman = this.person('shopper_civ', 176, 150);
    new Tag(this, woman.x, woman.y - 58, 'civ');
    const thug = this.person('villain_mohawk', 140, 146);
    thug.setFlipX(true);
    new Tag(this, thug.x, thug.y - 58, 'civ');
    const worker = this.person('suit_bad', 96, 200);
    worker.setFlipX(true);
    new Tag(this, worker.x, worker.y - 58, 'bad').pop();
    const hero = this.person('hero', 40, 204, 1, 'punch');
    new Bubble(this, 30, 132, '光の鉄拳ーッ!!', { tail: 'down-left' });
    new PixelText(this, 6, 6, '結果発表', { size: FS.body, color: UI.gold, outline: true });
    this.chrome();
    addPanel(this);
    const r = panelRect();
    const hud = new WindowFrame(this, r.x, r.y, r.w, 22, 'win');
    void hud;
    new PixelText(this, r.x + 6, r.y + 5, '撃破{gold}1{/} 負傷{red}0{/} 被害額{gold}¥32万{/}', { size: FS.body });
    const cut = new CutIn(this, r.x, r.y + 28, r.w, CUT_H);
    cut.say('ちょ、ちょっと待ってー!?', 'panic', { alarm: true });
    const by = r.y + 28 + CUT_H + 8;
    const bh = Math.min(64, r.bottom - by);
    const bw = Math.floor((r.w - 8) / 2);
    const stop = new Button(this, r.x, by, bw, bh, '待て!', { color: 'stop', onPress: () => { log('press:stop'); } });
    const go = new Button(this, r.x + bw + 8, by, bw, bh, '行け!', {
      color: 'go', onPress: () => { log('press:go'); impact(this, 'big'); popText(this, worker.x, worker.y - 40, '¥80万', { color: UI.danger }); }
    });
    Object.assign(dev, { cut, stop, go, hero });
  }
}

class PartsPage extends Page {
  next = 'swipe';
  constructor() { super('parts'); }
  create(): void {
    const { W, H } = layout;
    this.cameras.main.setBackgroundColor('#2a2638');
    this.chrome();
    // ボタンの状態
    const b1 = new Button(this, 6, 30, 64, 32, 'ふつう', { color: 'civ', size: FS.body });
    const b2 = new Button(this, 76, 30, 64, 32, '押した', { color: 'bad', size: FS.body });
    const b3 = new Button(this, 146, 30, 64, 32, '使えない', { color: 'go', size: FS.body });
    b3.setEnabled(false);
    // 押した見た目を見せるために、押したことにする
    (b2 as unknown as { down: Set<number> }).down.add(99);
    (b2 as unknown as { redraw(): void }).redraw();
    new Button(this, 6, 68, 100, 28, '待て!', { color: 'stop' });
    new Button(this, 112, 68, 98, 28, 'もう一回', { color: UI.gold, textColor: 0x2a1a00, size: FS.body });
    // 札
    new Tag(this, 24, 124, 'bad');
    new Tag(this, 60, 124, 'civ');
    new Tag(this, 100, 124, 'bad', '?');
    new Tag(this, 140, 124, 'bad', 'ワル', FS.body);
    new Tag(this, 180, 124, 'civ', '市民', FS.body);
    // 吹き出しのしっぽ
    const tails: [TailDir, number, number, string][] = [
      ['down-left', 12, 170, '了解!'], ['down', 108, 170, 'まあいいか!'], ['down-right', 204, 170, 'え?'],
      ['up-left', 12, 180, '上へ'], ['up', 108, 180, 'ガーン'], ['up-right', 204, 180, 'キラーン'],
      ['left', 4, 222, 'ひだり'], ['right', 212, 222, 'みぎ']
    ];
    for (const [tail, x, y, t] of tails) {
      new Bubble(this, x, y, t, { tail, pop: false });
      this.add.rectangle(x, y, 1, 1, 0xff00ff).setOrigin(0);
    }
    // バー
    const tb = new TimeBar(this, 8, 250, 96, 5);
    tb.setValue(0.3).setDanger(true);
    const tb2 = new TimeBar(this, 112, 250, 96, 5);
    tb2.setValue(0.8);
    const hp = new HpBar(this, 8, 276, 200, 8, 'ボス', { ticks: 4 });
    hp.setValue(1);
    this.time.addEvent({ delay: 700, loop: true, callback: () => { hp.setValue(hp.value - 0.1 < 0 ? 1 : hp.value - 0.1); hp.hit(); } });
    // ウィンドウの枠
    new WindowFrame(this, 6, 294, 64, 30, 'win');
    new WindowFrame(this, 76, 294, 64, 30, 'cut');
    new WindowFrame(this, 146, 294, 64, 30, 'alarm');
    new PixelText(this, 12, 302, '青', { size: FS.body });
    new PixelText(this, 82, 302, '赤紫', { size: FS.body });
    new PixelText(this, 152, 302, '警告', { size: FS.body });
    // 演出のボタン
    const fx: [string, () => void][] = [
      ['光る', () => flash(this)], ['揺れ', () => shake(this, 4, 300)], ['ドン', () => impact(this, 'huge')],
      ['帯', () => { void banner(this, 'ボス出現!'); }], ['点滅', () => blink(b1, 800)], ['数字', () => popText(this, 108, 250, '¥300万', { color: UI.danger })]
    ];
    fx.forEach(([label, fn], i) => {
      new Button(this, 6 + (i % 3) * 70, 332 + Math.floor(i / 3) * 30, 64, 24, label, { color: 0x3a3354, size: FS.body, onPress: fn });
    });
    new PixelText(this, 6, H - 14, `W${W} H${H} safe${layout.safeBottom}`, { size: FS.small, color: UI.textDim });
    enableTapSparks(this);
    Object.assign(dev, { hp, tb });
  }
}

class SwipePage extends Page {
  next = 'text';
  constructor() { super('swipe'); }
  create(): void {
    const { W } = layout;
    this.drawStreet(true);
    const cx = W / 2;
    const card = this.person('suit_civ', cx, 200, 2, 'sortIdle');
    const status = new PixelText(this, W / 2, 222, 'カードを左右にスワイプ', { size: FS.body, align: 'center' }).setOrigin(0.5, 0);
    const area = new Phaser.Geom.Rectangle(cx - 60, 60, 120, 150);
    const g = this.add.graphics();
    g.lineStyle(1, UI.gold, 1).strokeRect(area.x + 0.5, area.y + 0.5, area.width - 1, area.height - 1);
    const reset = (): void => { card.x = cx; card.angle = 0; };
    const swipe = new SwipeInput(this, area, {
      onStart: () => log('swipe:start'),
      onMove: (dx) => { card.x = cx + dx; card.angle = dx / 12; status.setText(`dx ${dx}`); },
      onSwipe: (dir, dx) => {
        log(`swipe:${dir}:${dx}`);
        status.setText(dir === 'left' ? '◀ワル' : '市民▶').setColor(dir === 'left' ? UI.bad : 0x7fb0ff);
        this.tweens.add({ targets: card, x: dir === 'left' ? -60 : W + 60, duration: 160, onComplete: () => reset() });
      },
      onCancel: () => { log('swipe:cancel'); reset(); status.setText('足りない').setColor(UI.text); }
    });
    this.chrome();
    addPanel(this);
    const r = panelRect();
    new PixelText(this, r.x, r.y + 18, '黄色い四角の中から始めたときだけ動く。画面の左右の端から始めた動きは無視する。', { size: FS.body, wrap: r.w, color: UI.textDim });
    Object.assign(dev, { swipe, card });
  }
}

const SAMPLE = 'ポケットがふくらんでる…タカシ(24)夜になるとこのへんをうろうろしている。撃破1負傷0被害額¥32万';

class TextPage extends Page {
  next = 'sort';
  constructor() { super('text'); }
  create(): void {
    this.cameras.main.setBackgroundColor('#0e1646');
    let y = 26;
    for (const size of [8, 10, 12, 16]) {
      const t = new PixelText(this, 2, y, `${size}:${SAMPLE}`, { size, wrap: 212, lineSpacing: 2 });
      y += t.height + 4;
    }
    const o = new PixelText(this, 2, y, 'ふち取り:光の鉄拳ーッ!!', { size: 16, outline: true, color: UI.gold });
    y += o.height + 2;
    const s = new PixelText(this, 2, y, '影つき:撃破{gold}1234{/} 負傷{red}0{/} {civ}市民{/}', { size: 12, shadow: true });
    y += s.height + 4;
    new PixelText(this, 108, y, '真ん中寄せ\nふたつめの行は長め', { size: 12, align: 'center' }).setOrigin(0.5, 0);
    this.chrome();
  }
}

const L = computeLayout();
preloadFont([SAMPLE, 'STAGE1人目結果発表光の鉄拳ーッ待て行け撃破負傷被害額ちょ、ちょっと待ってー!?ワル市民◀▶左右にスワイプでもOK',
  'ふつう押した使えないもう一回了解まあいいか!え?上へガーンキラーンひだりみぎボス青赤紫警告光る揺れドン帯点滅数字¥万出現',
  'ひとやすみ中タップで再開カードを左右足りない黄色い四角の中から始めたときだけ動く。画面の端無視するオペレーターヒーロー',
  'ふち取り影つき真ん中寄せふたつめの行は長め'], [8, 10, 12, 16]).then(() => {
  const scenes = { sort: SortPage, result: ResultPage, parts: PartsPage, swipe: SwipePage, text: TextPage };
  const order = [first, ...PAGES.filter((p) => p !== first)];
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', width: L.W, height: L.H, backgroundColor: '#000000',
    pixelArt: true, roundPixels: true, antialias: false, scale: { mode: Phaser.Scale.NONE },
    input: { activePointers: 3 }, disableContextMenu: true, audio: { noAudio: true }, banner: false,
    scene: order.map((k) => scenes[k as keyof typeof scenes])
  });
  const refit = (): void => { fitCanvas(game.canvas, layout.W, layout.H); game.scale.refresh(); };
  game.events.once(Phaser.Core.Events.READY, refit);
  window.addEventListener('resize', refit);
  dev.game = game;
});
