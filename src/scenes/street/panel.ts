// 結果発表(Street)とエレベーターラッシュ(Elevator)の、下の操作部分。
//   const p = buildStreetPanel(this, stats, onStop, onGo)   数字の窓、カットイン、待てと行けのボタン(L.inUi の中で呼ぶ)
//   buttonPulse(ms)                                        押せるボタンをゆっくり光らせるときの明るさ(0〜1)

import type Phaser from 'phaser';
import { UI } from '../../config';
import { formatYen, type StatsTracker } from '../../logic';
import { Button, CutIn, CUT_H, CUT_TOP_H, FS, PixelText, UIX, WindowFrame, addPanel, panelRect } from '../../ui';

export interface StreetPanel {
  /** 撃破、負傷、被害額の数字 */
  tDefeat: PixelText;
  tHurt: PixelText;
  tDamage: PixelText;
  cut: CutIn;
  stopBtn: Button;
  goBtn: Button;
}

/**
 * 下の操作部分を作る。上から、撃破・負傷・被害額の窓、カットイン、待てと行けのボタン。
 * 数字は stats のいまの値で出す。onGo を省くと、行けは押しても何も起きない。ボタンは押せない状態で作る
 */
export function buildStreetPanel(
  scene: Phaser.Scene, stats: Pick<StatsTracker, 'defeated' | 'civHurt' | 'damage'>, onStop: () => void, onGo?: () => void
): StreetPanel {
  addPanel(scene);
  // 縦に余裕があれば(縦長の画面)、横いっぱいに使い、セリフを大きな字にして、ボタンも大きくする
  const tall = panelRect().h >= 200;
  // 会話の窓のセリフに1行12字が入るように、横いっぱい(左右4)を使う
  const r = panelRect(4);
  const hudH = 40;
  new WindowFrame(scene, r.x, r.y, r.w, hudH, 'win');
  const lx = r.x + 7;
  new PixelText(scene, lx, r.y + 4, '撃破', { size: FS.big });
  const tDefeat = new PixelText(scene, lx + 36, r.y + 4, String(stats.defeated), { size: FS.big, color: UI.gold });
  new PixelText(scene, lx + 92, r.y + 4, '負傷', { size: FS.big });
  const tHurt = new PixelText(scene, lx + 128, r.y + 4, String(stats.civHurt), { size: FS.big, color: UI.danger });
  new PixelText(scene, lx, r.y + 21, '被害額', { size: FS.big });
  const tDamage = new PixelText(scene, r.right - 7, r.y + 21, formatYen(stats.damage), { size: FS.big, color: UI.gold }).setOrigin(1, 0);

  const cutY = r.y + hudH + 4;
  const cutH = tall ? CUT_TOP_H : CUT_H;
  const cut = new CutIn(scene, r.x, cutY, r.w, cutH, tall ? { size: FS.big, faceTop: true } : {});
  // ボタンは親指が届く下の端にそろえる
  const bh = Math.max(40, Math.min(tall ? 120 : 72, r.bottom - (cutY + cutH + 5)));
  const by = r.bottom - bh;
  const bw = Math.floor((r.w - 8) / 2);
  const stopBtn = new Button(scene, r.x, by, bw, bh, '待て!', { color: 'stop', textColor: UIX.stopText, onPress: onStop });
  const goBtn = new Button(scene, r.x + bw + 8, by, bw, bh, '行け!', { color: 'go', onPress: onGo });
  stopBtn.setEnabled(false);
  goBtn.setEnabled(false);
  return { tDefeat, tHurt, tDamage, cut, stopBtn, goBtn };
}

/**
 * 押せるボタンをゆっくり明るくしたり戻したりするときの明るさ(0〜1。1.1秒で1回)。ms はシーンの時計など。
 * 強く点滅させると、正しくワルにした人にも待てを押したくなるので、やさしく光らせるだけにする
 */
export function buttonPulse(ms: number): number {
  return (1 - Math.cos((ms / 1100) * Math.PI * 2)) / 2;
}
