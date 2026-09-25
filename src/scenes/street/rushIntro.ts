// ラッシュの始まりの部品。タイムセールラッシュ(street/rush.ts)とエレベーターラッシュ(Elevator.ts)で同じものを使う。
// - rushBand(scene, text):大きな帯。右から入り、out() で左へ去る
// - rushTapIntro(host, lines, lockUntil):オペレーターの説明のカットイン(初めては2つ、見たことがあれば1つ)と「▼タップ」。
//   タップで Promise が解決する。止めてから lockUntil まで、一時停止から戻ってから tapLockSec の間は、タップを受けない

import Phaser from 'phaser';
import { UI } from '../../config';
import { layout } from '../../layout';
import { audio } from '../../audio';
import type { Speech } from '../../logic';
import { FS, PixelText, type CutIn } from '../../ui';

/** 説明を出すシーンの道具 */
export interface RushIntroHost {
  scene: Phaser.Scene;
  cut: CutIn;
  /** 中断、音、早送りのボタン(押しても始めない) */
  icons: readonly Phaser.GameObjects.GameObject[];
}

/** 大きな帯。タップで始めるまで出しておき、out() で左へ去る */
export function rushBand(scene: Phaser.Scene, text: string): { out: () => void } {
  const { W } = layout;
  const bandH = 34;
  const c = scene.add.container(W, 52).setDepth(1500).setScrollFactor(0);
  const g = scene.add.graphics();
  g.fillStyle(UI.black, 1).fillRect(0, 0, W, bandH);
  g.fillStyle(UI.gold, 1).fillRect(0, 2, W, 2).fillRect(0, bandH - 4, W, 2);
  g.fillStyle(UI.bad, 1).fillRect(0, 5, W, 1).fillRect(0, bandH - 6, W, 1);
  const label = new PixelText(scene, Math.floor(W / 2), 9, text, { size: FS.big, color: UI.gold, outline: true }).setOrigin(0.5, 0);
  c.add([g, label]);
  const slide = (x: number, ms: number, ease: string, done?: () => void): void => {
    scene.tweens.add({ targets: c, x, duration: ms, ease, onUpdate: () => { c.x = Math.round(c.x); }, onComplete: () => done?.() });
  };
  slide(0, 180, 'Cubic.easeOut');
  return { out: () => slide(-W, 160, 'Cubic.easeIn', () => c.destroy()) };
}

/**
 * 説明のカットインと、▼タップ。
 * 止めてから lockUntil まではタップを受けない。始めるタップは待てや行けに効かない(このあいだは合図がないので、ボタンは押せない)。
 * 一時停止のメニューの「つづける」のタップでも始まらないように、戻ってから tapLockSec 秒の間も受けない
 */
export async function rushTapIntro(host: RushIntroHost, lines: readonly Speech[], lockUntil: number, tapLockSec: number): Promise<void> {
  const s = host.scene;
  let lock = lockUntil;
  let tapped: (() => void) | null = null;
  const onDown = (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void => {
    if (s.time.now < lock) return;
    // 中断、音、早送りのボタンは、それぞれのボタンとして効かせる
    if (over.some((o) => o.parentContainer && host.icons.includes(o.parentContainer))) return;
    if (host.cut.isTyping) {
      // カットインを押したときは、カットインが自分で文字送りを飛ばす
      if (!over.some((o) => o.parentContainer === host.cut)) host.cut.skip();
      return;
    }
    tapped?.();
  };
  const onResume = (): void => { lock = Math.max(lock, s.time.now + tapLockSec * 1000); };
  s.input.on('pointerdown', onDown);
  s.events.on(Phaser.Scenes.Events.RESUME, onResume);
  // 説明の途中でシーンを出たとき(タイトルへ、など)も外す
  const off = (): void => {
    s.input.off('pointerdown', onDown);
    s.events.off(Phaser.Scenes.Events.RESUME, onResume);
  };
  s.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  /** タップを待つ(ms を渡すと、その時間がたっても進む) */
  const waitTap = (ms?: number): Promise<void> => new Promise((resolve) => {
    let over = false;
    const go = (): void => { if (over) return; over = true; tapped = null; resolve(); };
    tapped = go;
    if (ms !== undefined) s.time.delayedCall(ms, go);
  });
  for (let i = 0; i < lines.length; i++) {
    const sp = lines[i];
    await host.cut.say(sp.text, sp.face, { who: sp.who, alarm: sp.face === 'panic' });
    if (i < lines.length - 1) await waitTap(1200);
  }
  // ▼タップ(ゆっくり点滅)
  const { W, actionH } = layout;
  const tip = new PixelText(s, W - 6, actionH - 18, '▼タップ', { size: FS.big, color: UI.gold, outline: true })
    .setOrigin(1, 0).setScrollFactor(0).setDepth(1500);
  const blinkEv = s.time.addEvent({ delay: 420, loop: true, callback: () => tip.setVisible(!tip.visible) });
  await waitTap();
  blinkEv.remove();
  tip.destroy();
  off();
  s.events.off(Phaser.Scenes.Events.SHUTDOWN, off);
  audio.unlock();
}
