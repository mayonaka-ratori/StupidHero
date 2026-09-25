// カットイン:顔、名前、セリフ。セリフは1文字ずつ出て、しゃべっている間は口が開いたり閉じたりする。
// 使い方:
//   const cut = new CutIn(this, 4, 8, W - 8, CUT_H);                   // 左上の位置と大きさ。ふつうはオペレーター
//   await cut.say('ポケットがふくらんでる…', 'normal');                 // 文字送りが終わると Promise が解決する
//   cut.say('ちょ、ちょっと待ってー!?', 'panic', { alarm: true });       // 赤い警告のカットイン(少し揺れる)
//   cut.say('まかせて!', 'smug', { who: 'hero' });                     // ヒーローに替えて話す
//   cut.skip();                  // 文字送りを飛ばす(カットインをタップしても飛ばせる)
//   cut.hide(); cut.show();
// 表情は face_operator: normal / panic / deadpan / hype、face_hero: smug / oops / smile。
// 箱に入りきらない長いセリフは、ページに分けて出す(次のページへは少し待つかタップで進む)。

import Phaser from 'phaser';
import { frameIndex, sheetByKey } from '../art/sheets';
import { FRAME_PAD, WindowFrame } from './frame';
import { PixelText, countLines, stripMarkup } from './text';
import { DEPTH, FS, NAMES, UIX } from './theme';

export type Speaker = 'operator' | 'hero';

export interface SayOptions {
  /** 赤い警告のカットインにする */
  alarm?: boolean;
  /** 話す人を替える */
  who?: Speaker;
  /** 1秒に出す文字の数(ふつう30) */
  speed?: number;
  /** 文字が1つ出るたびに呼ぶ(音を鳴らすときなど) */
  onChar?: (ch: string) => void;
}

export interface CutInOptions {
  who?: Speaker;
  /** 1秒に出す文字の数 */
  speed?: number;
  /** 長いセリフのとき、次のページへ進むまでの時間(ミリ秒) */
  pageMs?: number;
  /** セリフの文字の大きさ */
  size?: number;
  /**
   * 顔を左上に置き、名前を顔の右に、セリフを顔の下に箱の幅いっぱいで出す。
   * 大きな字(16)でも1行に12文字入るようにするとき(縦に余裕のある画面)に使う
   */
  faceTop?: boolean;
}

const FACE_KEY: Record<Speaker, string> = { operator: 'face_operator', hero: 'face_hero' };
const FACE = 48;
/** 顔を左に置く窓の高さ(顔48と、名前とセリフ3行が入る) */
export const CUT_H = FACE + 12;
/** 顔を左上に置き、セリフを顔の下に出す窓(faceTop)の高さ。大きな字(16)で2行入る */
export const CUT_TOP_H = FACE + 48;
const PAUSE_AFTER = new Set(Array.from('、。…!?!?'));

export class CutIn extends Phaser.GameObjects.Container {
  override readonly w: number;
  readonly h: number;
  who: Speaker;
  private frameG: WindowFrame;
  private faceBg: Phaser.GameObjects.Graphics;
  private face: Phaser.GameObjects.Sprite;
  private nameText: PixelText;
  private line: PixelText;
  private hit: Phaser.GameObjects.Zone;
  private speed: number;
  /** いま出しているセリフの速さ(say で指定されたもの) */
  private curSpeed = 30;
  private pageMs: number;
  private timer?: Phaser.Time.TimerEvent;
  private shakeTimer?: Phaser.Time.TimerEvent;
  private shakeBase = 0;
  private resolveSay?: () => void;
  private pages: string[] = [];
  private expr = 'normal';
  private typing = false;
  private onChar?: (ch: string) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, w = 208, h = CUT_H, opt: CutInOptions = {}) {
    super(scene, Math.round(x), Math.round(y));
    this.w = w;
    this.h = h;
    this.who = opt.who ?? 'operator';
    this.speed = opt.speed ?? 30;
    this.pageMs = opt.pageMs ?? 900;
    this.frameG = new WindowFrame(scene, 0, 0, w, h, 'cut');
    const fx = FRAME_PAD + 2;
    const fy = opt.faceTop ? FRAME_PAD + 2 : Math.max(FRAME_PAD + 2, Math.floor((h - FACE - 2) / 2));
    this.faceBg = new Phaser.GameObjects.Graphics(scene);
    this.faceBg.fillStyle(UIX.faceEdge, 1).fillRect(fx, fy, FACE + 2, FACE + 2);
    this.faceBg.fillStyle(UIX.faceBg, 1).fillRect(fx + 1, fy + 1, FACE, FACE);
    this.face = new Phaser.GameObjects.Sprite(scene, fx + 1, fy + 1, '__DEFAULT').setOrigin(0, 0);
    const tx = fx + FACE + 2 + 4;
    if (opt.faceTop) {
      // 名前は顔の右に大きめに。セリフは顔の下に、箱の幅いっぱいで
      this.nameText = new PixelText(scene, tx, fy + Math.floor((FACE + 2 - FS.body) / 2), NAMES[this.who], { size: FS.body, color: UIX.name });
      const lx = FRAME_PAD + 3;
      this.line = new PixelText(scene, lx, fy + FACE + 2 + 3, '', {
        size: opt.size ?? FS.body, wrap: w - lx * 2, lineSpacing: 2
      });
    } else {
      this.nameText = new PixelText(scene, tx, FRAME_PAD + 1, NAMES[this.who], { size: FS.small, color: UIX.name });
      this.line = new PixelText(scene, tx, FRAME_PAD + 1 + FS.small + 2, '', {
        size: opt.size ?? FS.body, wrap: w - tx - FRAME_PAD - 2, lineSpacing: 2
      });
    }
    this.hit = new Phaser.GameObjects.Zone(scene, 0, 0, w, h).setOrigin(0, 0);
    this.add([this.frameG, this.faceBg, this.face, this.nameText, this.line, this.hit]);
    this.setSize(w, h);
    this.setDepth(DEPTH.cutin);
    scene.add.existing(this);
    this.hit.setInteractive();
    this.hit.on('pointerdown', () => this.skip());
    this.setWho(this.who);
    this.setExpression('normal', false);
  }

  /** いま文字送りをしているか */
  get isTyping(): boolean { return this.typing; }

  /** セリフの欄に何行入るか */
  get maxLines(): number {
    const st = this.line.style;
    return Math.max(1, Math.floor((this.h - FRAME_PAD - 1 - this.line.y + st.lineSpacing) / (st.size + st.lineSpacing)));
  }

  setWho(who: Speaker): this {
    this.who = who;
    this.nameText.setText(NAMES[who]);
    return this;
  }

  /** 表情を変える。talking=true で口を動かす */
  setExpression(expr: string, talking: boolean): this {
    this.expr = expr;
    const key = FACE_KEY[this.who];
    if (!this.scene.textures.exists(key)) return this;
    const def = sheetByKey(key);
    if (!def.rows.some((r) => r.name === expr)) expr = def.rows[0].name;
    const anim = `${key}.${expr}`;
    if (talking && this.scene.anims.exists(anim)) this.face.play(anim, true);
    else { this.face.stop(); this.face.setTexture(key, frameIndex(def, expr, 0)); }
    return this;
  }

  /** セリフを1文字ずつ出す。出し終わると解決する */
  say(text: string, expr = 'normal', opt: SayOptions = {}): Promise<void> {
    this.finish();
    if (opt.who && opt.who !== this.who) this.setWho(opt.who);
    this.frameG.setKind(opt.alarm ? 'alarm' : 'cut');
    if (opt.alarm) this.shake();
    if (!this.visible) this.show();
    this.onChar = opt.onChar;
    this.curSpeed = opt.speed ?? this.speed;
    this.pages = this.paginate(text);
    this.setExpression(expr, true);
    return new Promise<void>((resolve) => {
      this.resolveSay = resolve;
      this.typePage(this.curSpeed);
    });
  }

  /** 文字送りを飛ばして、いまのページを全部出す。最後のページなら終わる */
  skip(): void {
    if (!this.typing && !this.pages.length) return;
    if (this.typing) {
      this.timer?.remove();
      this.line.setVisibleChars(-1);
      this.typing = false;
      if (!this.pages.length) this.finish();
      else this.timer = this.scene.time.delayedCall(this.pageMs, () => this.typePage(this.curSpeed));
      return;
    }
    // ページの待ち時間中なら次のページへ
    this.timer?.remove();
    this.typePage(this.curSpeed);
  }

  show(): this {
    this.setVisible(true);
    // 縦に開く(3コマ)
    const steps = [0.25, 0.6, 1];
    this.setScale(1, steps[0]);
    let i = 0;
    this.scene.time.addEvent({ delay: 33, repeat: steps.length - 1, callback: () => this.setScale(1, steps[++i] ?? 1) });
    return this;
  }

  hide(): this {
    this.finish();
    this.setVisible(false);
    return this;
  }

  /** 全部出し終えた状態にして、待っている say を解決する */
  private finish(): void {
    this.timer?.remove();
    this.timer = undefined;
    if (this.pages.length) { this.line.setText(this.pages[this.pages.length - 1]); this.pages = []; }
    this.line.setVisibleChars(-1);
    this.typing = false;
    this.setExpression(this.expr, false);
    const r = this.resolveSay;
    this.resolveSay = undefined;
    r?.();
  }

  private typePage(speed: number): void {
    const page = this.pages.shift();
    if (page === undefined) { this.finish(); return; }
    this.line.setText(page);
    this.line.setVisibleChars(0);
    this.setExpression(this.expr, true);
    this.typing = true;
    const plain = Array.from(stripMarkup(page).replace(/\n/g, ''));
    let n = 0;
    let wait = 0;
    const tick = 1000 / speed;
    this.timer = this.scene.time.addEvent({
      delay: tick, loop: true, callback: () => {
        if (wait > 0) { wait--; return; }
        n++;
        this.line.setVisibleChars(n);
        const ch = plain[n - 1];
        if (ch && ch !== ' ' && ch !== ' ') this.onChar?.(ch);
        if (ch && PAUSE_AFTER.has(ch)) wait = 3;
        if (n >= this.line.length) {
          this.timer?.remove();
          this.typing = false;
          if (this.pages.length) {
            this.setExpression(this.expr, false);
            this.timer = this.scene.time.delayedCall(this.pageMs, () => this.typePage(speed));
          } else this.finish();
        }
      }
    });
  }

  /** 箱に入る行数ごとにページに分ける */
  private paginate(text: string): string[] {
    const max = this.maxLines;
    const lines = (t: string): number => countLines(t, this.line.style);
    if (lines(text) <= max) return [text];
    // 1文字ずつ足していき、行があふれたところで切る(色の書き方はページをまたがない前提)
    const chars = Array.from(text);
    const pages: string[] = [];
    let cur = '';
    for (const ch of chars) {
      if (lines(cur + ch) > max && cur) { pages.push(cur); cur = ch === '\n' ? '' : ch; } else cur += ch;
    }
    if (cur) pages.push(cur);
    return pages;
  }

  /** 警告のときに少し揺れる */
  private shake(): void {
    if (this.shakeTimer && this.shakeTimer.getOverallProgress() < 1) { this.shakeTimer.remove(); this.x = this.shakeBase; }
    const baseX = this.x;
    this.shakeBase = baseX;
    let i = 0;
    const seq = [2, -2, 1, -1, 1, 0];
    this.shakeTimer = this.scene.time.addEvent({
      delay: 40, repeat: seq.length - 1, callback: () => { this.x = baseX + seq[i++]; }
    });
  }
}
