// 仕分けの画面の下の窓で使う、文字送りの道具。
//   const t = new Typer(this, lineText);                 // PixelText を1文字ずつ出す
//   await t.type('ポケットが\nふくらんでる…', 60);       // 出し終わると解決する。t.skip() で全部すぐ出す
//   const row = new RemarkRow(this, x, y, w);            // 小さな顔とセリフの1行(オペレーターの一言)
//   await row.say('袋が重そう', 'normal');              // 口を動かしながら1文字ずつ出す
//   row.say('あと5秒！', 'panic', { alarm: true });      // 赤い字(急かすとき)
//   row.say('どんと来い！', 'smug', { who: 'hero' });     // ヒーローの顔にする
// 文字送りの間は時計を止めるので(Sort.ts)、いま文字送り中かを isTyping で見られるようにしてある。

import Phaser from 'phaser';
import { UI } from '../../config';
import { frameIndex, sheetByKey } from '../../art/sheets';
import { FS, PixelText, UIX, type Speaker } from '../../ui';

/** この字のあとは少し間をあける */
const PAUSE_AFTER = new Set(Array.from('、。…!?！？'));

/** PixelText の字を1文字ずつ出す */
export class Typer {
  private timer?: Phaser.Time.TimerEvent;
  private resolve?: () => void;
  private typing = false;
  /** 1文字出るたびに呼ぶ */
  onChar?: () => void;

  constructor(private scene: Phaser.Scene, readonly text: PixelText) {}

  get isTyping(): boolean { return this.typing; }

  /** 文字を替えて1文字ずつ出す。speed は1秒に出す字の数 */
  type(s: string, speed: number): Promise<void> {
    this.finish();
    this.text.setText(s);
    this.text.setVisibleChars(0);
    this.typing = true;
    return new Promise<void>((resolve) => {
      this.resolve = resolve;
      const plain = Array.from(this.text.text.replace(/\{(\/|#[0-9a-fA-F]{6}|[a-z]+)\}/g, '').replace(/\n/g, ''));
      let n = 0;
      let wait = 0;
      this.timer = this.scene.time.addEvent({
        delay: 1000 / speed, loop: true, callback: () => {
          if (wait > 0) { wait--; return; }
          n++;
          this.text.setVisibleChars(n);
          this.onChar?.();
          if (PAUSE_AFTER.has(plain[n - 1] ?? '')) wait = 2;
          if (n >= this.text.length) this.finish();
        }
      });
    });
  }

  /** すぐに全部出す(文字送りの途中なら、待っている type を解決する) */
  show(s: string): void {
    this.finish();
    this.text.setText(s);
    this.text.setVisibleChars(-1);
  }

  /** 文字送りを飛ばして全部出す */
  skip(): void { this.finish(); }

  private finish(): void {
    this.timer?.remove();
    this.timer = undefined;
    if (this.typing) this.text.setVisibleChars(-1);
    this.typing = false;
    const r = this.resolve;
    this.resolve = undefined;
    r?.();
  }
}

const FACE_KEY: Record<Speaker, string> = { operator: 'face_operator', hero: 'face_hero' };
/** 顔の大きさ(32ドットの顔を 3/4 にする。2行のセリフと同じくらいの高さ) */
const FACE_SCALE = 0.75;
export const REMARK_FACE = 32 * FACE_SCALE;

export interface RemarkOptions {
  who?: Speaker;
  /** 赤い字にする(急かすとき、時間切れのとき) */
  alarm?: boolean;
  /** 1秒に出す字の数 */
  speed?: number;
  /** 文字送りをせずにすぐ出す */
  instant?: boolean;
}

/** 小さな顔と、その右のセリフ(2行まで) */
export class RemarkRow {
  readonly typer: Typer;
  private faceBg: Phaser.GameObjects.Graphics;
  private face: Phaser.GameObjects.Sprite;
  private line: PixelText;
  private who: Speaker = 'operator';
  private expr = 'normal';

  constructor(private scene: Phaser.Scene, x: number, y: number, w: number) {
    const f = REMARK_FACE;
    this.faceBg = scene.add.graphics();
    this.faceBg.fillStyle(UIX.faceEdge, 1).fillRect(x, y, f + 2, f + 2);
    this.faceBg.fillStyle(UIX.faceBg, 1).fillRect(x + 1, y + 1, f, f);
    this.faceBg.setDepth(1000);
    this.face = scene.add.sprite(x + 1, y + 1, FACE_KEY.operator).setOrigin(0, 0).setScale(FACE_SCALE).setDepth(1000);
    const tx = x + f + 2 + 5;
    this.line = new PixelText(scene, tx, y + Math.max(0, Math.floor((f + 2 - (FS.body * 2 + 2)) / 2)), '', {
      size: FS.body, color: UI.cutEdge, wrap: x + w - tx, lineSpacing: 2
    });
    this.typer = new Typer(scene, this.line);
    this.setFace('normal', false);
  }

  get isTyping(): boolean { return this.typer.isTyping; }

  /** セリフを出す。文字送りが終わると解決する */
  async say(text: string, expr = 'normal', opt: RemarkOptions = {}): Promise<void> {
    this.who = opt.who ?? 'operator';
    const color = opt.alarm ? UI.danger : this.who === 'hero' ? UI.text : UI.cutEdge;
    if (this.line.style.color !== color) this.line.setColor(color);
    if (opt.instant) {
      this.typer.show(text);
      this.setFace(expr, false);
      return;
    }
    this.setFace(expr, true);
    await this.typer.type(text, opt.speed ?? 60);
    // 次の say が始まっていたら、顔はそちらにまかせる
    if (!this.typer.isTyping) this.setFace(this.expr, false);
  }

  skip(): void { this.typer.skip(); }

  clear(): void {
    this.typer.show('');
    this.setFace(this.expr, false);
  }

  /** 見せる/隠す(中断のとき) */
  get objects(): Phaser.GameObjects.Components.Visible[] { return [this.faceBg, this.face, this.line]; }

  private setFace(expr: string, talking: boolean): void {
    this.expr = expr;
    const key = FACE_KEY[this.who];
    if (!this.scene.textures.exists(key)) return;
    const def = sheetByKey(key);
    const name = def.rows.some((r) => r.name === expr) ? expr : def.rows[0].name;
    const anim = `${key}.${name}`;
    if (talking && this.scene.anims.exists(anim)) this.face.play(anim, true);
    else { this.face.stop(); this.face.setTexture(key, frameIndex(def, name, 0)); }
  }
}
