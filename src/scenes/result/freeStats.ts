// フリープレイの結果画面の数字の窓(docs/FREEPLAY.md「結果画面」)。
//   const sw = freeWindow(env, s, { analogy });   // 窓を描いて、数え上げる行を返す(result/stats.ts の StatsWindow)
// 並び:クリアまでの時間(大きく。見出しの下に「ゆっくり」の印と NEW)、待てで守った、行けで決めた、市民のけが、
// 逃がした、被害額(その下にたとえ)、いちばん下に小さく heroAccuracyText(s.free)。
// ステージの窓より行が多いので、画面の高さに合わせて詰める(ゆったりした順に試し、いちばんひどい場面の写真が入るものを選ぶ)。
//   1. 全部1行ずつ(市民のけがの内わけも出す)
//   2. 市民のけがと逃がしたを1行にまとめる
//   3. さらに被害額のたとえを出さず、いちばん下の行(「、」で2行に分ける)を小さい字にする
//   4. 待てで守ったと行けで決めたも1行にまとめる(数字は「9/9人」を「9人」にする)。たとえは出す
//   5. いちばん低い画面(高さ384):ボタンも小さくし、たとえを出さない
// まとめた行は、見出しを小さい字にして数字は大きいまま(ステージの窓と同じ)。NEW の札は出さない。

import Phaser from 'phaser';
import { UI } from '../../config';
import { layout } from '../../layout';
import { formatClearTime, formatYen, heroAccuracyText, hurtBreakdown, type StageStats } from '../../logic';
import { FS, PixelText, WindowFrame } from '../../ui';
import type { ButtonFit, StatRow, StatsWindow, WindowEnv } from './stats';

/** 路地裏しかクリアしていない人に、結果画面で一度だけ出すオペレーターのひとこと(Result.ts) */
export const MORE_STAGES_HINT = 'ステージを進めると、\n出てくる人が増えるよ';

/** フリープレイの結果画面と称号の一覧で出す字(フォントを先に読みこむため。Boot.ts と開発用の文字の一覧が使う) */
export const FREE_RESULT_TEXTS = [
  'クリアまでの時間', '待てで守った', '行けで決めた', '市民のけが', '逃がした', '被害額', 'ゆっくり', '人回:', MORE_STAGES_HINT, 'フリープレイだけ'
];

/**
 * いちばんひどい場面の写真を出すのに要る高さ。結果画面が写真を出す高さ(Result.ts の THUMB_MIN - 4)と同じにして、
 * 写真が入るならなるべく行をまとめない
 */
const THUMB_MIN = 54;

interface FreeFit extends ButtonFit {
  rowH: number;
  /** クリアまでの時間の行の高さ(数字を2倍で出す) */
  timeH: number;
  /** 待てで守ったと行けで決めたを1行に */
  mergeGo: boolean;
  /** 市民のけがと逃がしたを1行に */
  mergeHurt: boolean;
  /** 市民のけがの内わけを出す(まとめないときだけ) */
  hurtSub: boolean;
  /** 被害額のたとえを出す */
  analogy: boolean;
  /** いちばん下の1行の字の大きさ */
  accSize: number;
}

const FITS: FreeFit[] = [
  { smallH: 26, shareH: 30, gap: 5, rowH: 17, timeH: 34, mergeGo: false, mergeHurt: false, hurtSub: true, analogy: true, accSize: FS.body },
  { smallH: 24, shareH: 26, gap: 4, rowH: 16, timeH: 30, mergeGo: false, mergeHurt: true, hurtSub: false, analogy: true, accSize: FS.body },
  { smallH: 24, shareH: 26, gap: 4, rowH: 16, timeH: 28, mergeGo: false, mergeHurt: true, hurtSub: false, analogy: false, accSize: FS.small },
  { smallH: 24, shareH: 26, gap: 4, rowH: 16, timeH: 28, mergeGo: true, mergeHurt: true, hurtSub: false, analogy: true, accSize: FS.small },
  { smallH: 22, shareH: 24, gap: 3, rowH: 15, timeH: 26, mergeGo: true, mergeHurt: true, hurtSub: false, analogy: false, accSize: FS.small }
];

/** 小さな字の行(内わけ、たとえ)の高さ */
const SUB_H = 13;
/** まとめた行の、左半分の右端と右半分の左端 */
const MID_L = 107;
const MID_R = 111;

export interface FreeWindowOptions {
  /** 被害額のたとえ(damageAnalogy(...).text) */
  analogy: string;
}

/** いちばん下の小さな1行(「、」で2行に分ける。数字は金色) */
export const accuracyLine = (s: Pick<StageStats, 'free'>): string =>
  s.free ? heroAccuracyText(s.free).replace('、', '、\n').replace(/(\d+\/\d+)/g, '{gold}$1{/}') : '';

export function freeWindow(env: WindowEnv, s: StageStats, opt: FreeWindowOptions): StatsWindow {
  const { scene, boxY, bottom } = env;
  const { W } = layout;
  const f = s.free!;
  const hurtParts = hurtBreakdown(s);
  const acc = accuracyLine(s);
  // いちばん下の1行の高さ(字の大きさごとに測る)
  const accH = (size: number): number => {
    const p = new PixelText(scene, 0, 0, acc, { size, lineSpacing: 1 });
    const h = Math.ceil(p.height);
    p.destroy();
    return h;
  };
  const boxHOf = (fit: FreeFit): number => {
    const rows = 1 + (fit.mergeGo ? 1 : 2) + (fit.mergeHurt ? 1 : 2);
    const subs = (fit.hurtSub && !fit.mergeHurt && hurtParts.length ? 1 : 0) + (fit.analogy ? 1 : 0);
    return 5 + fit.timeH + fit.rowH * rows + SUB_H * subs + 1 + accH(fit.accSize) + 4;
  };
  const shareYOf = (fit: FreeFit): number => bottom - fit.smallH - fit.gap - fit.shareH;
  const roomOf = (fit: FreeFit): number => shareYOf(fit) - 5 - (boxY + boxHOf(fit) + 5);
  const fit = FITS.find((x) => roomOf(x) >= THUMB_MIN) ?? FITS.find((x) => roomOf(x) >= -6) ?? FITS[FITS.length - 1];
  const boxH = boxHOf(fit);
  new WindowFrame(scene, 4, boxY, W - 8, boxH, 'win');

  const slow = f.slow;
  const rows: StatRow[] = [
    {
      label: 'クリアまでの時間', target: f.clearSec ?? 0, format: (n) => (f.clearSec === null ? '-' : formatClearTime(n)),
      color: UI.gold, record: slow ? 'bestSlowSec' : 'bestSec', ms: 700
    },
    {
      label: '待てで守った', target: f.stopSaved, format: (n) => (fit.mergeGo ? `${n}人` : `${n}/${f.stopChances}人`),
      color: UI.gold, record: 'mostStopSaved', ms: 350
    },
    {
      label: '行けで決めた', target: f.goScenes, format: (n) => (fit.mergeGo ? `${n}回` : `${n}/${f.goChances}回`),
      color: UI.gold, record: 'mostGoScenes', ms: 350
    },
    { label: '市民のけが', target: s.civHurt, format: (n) => `${n}人`, color: s.civHurt > 0 ? UI.danger : UI.gold, ms: 350 },
    { label: '逃がした', target: s.escaped, format: (n) => `${n}人`, color: s.escaped > 0 ? UI.danger : UI.gold, ms: 300 },
    { label: '被害額', target: s.damage, format: (n) => formatYen(n), color: UI.gold, record: 'highestDamage', ms: 800 }
  ];

  // ─── 行ごとの位置 ───
  const place: { x: number; right: number; y: number; small: boolean }[] = [];
  let cy = boxY + 5;
  const timeY = cy;
  place.push({ x: 11, right: W - 11, y: cy, small: false });
  cy += fit.timeH;
  let hurtSubY = 0;
  let analogyY = 0;
  // 待てと行け
  if (fit.mergeGo) {
    place.push({ x: 11, right: MID_L, y: cy, small: true }, { x: MID_R, right: W - 11, y: cy, small: true });
    cy += fit.rowH;
  } else {
    place.push({ x: 11, right: W - 11, y: cy, small: false }, { x: 11, right: W - 11, y: cy + fit.rowH, small: false });
    cy += fit.rowH * 2;
  }
  // 市民のけがと逃がした
  if (fit.mergeHurt) {
    place.push({ x: 11, right: MID_L, y: cy, small: true }, { x: MID_R, right: W - 11, y: cy, small: true });
    cy += fit.rowH;
  } else {
    place.push({ x: 11, right: W - 11, y: cy, small: false });
    cy += fit.rowH;
    if (fit.hurtSub && hurtParts.length) { hurtSubY = cy - 1; cy += SUB_H; }
    place.push({ x: 11, right: W - 11, y: cy, small: false });
    cy += fit.rowH;
  }
  // 被害額
  place.push({ x: 11, right: W - 11, y: cy, small: false });
  cy += fit.rowH;
  if (fit.analogy) { analogyY = cy; cy += SUB_H; }
  const accY = cy + 1;

  // ─── 字 ───
  const values = rows.map((r, i) => {
    const p = place[i];
    if (i === 0) {
      // クリアまでの時間:見出しは金色、数字は2倍の大きさで右に
      new PixelText(scene, p.x, p.y + 1, r.label, { size: FS.big, color: UI.gold });
      // (右端は窓のふちの近くまで寄せて、見出しとの間をあける)
      const v = new PixelText(scene, p.right + 3, p.y + Math.floor((fit.timeH - 34) / 2), '', { size: FS.big, color: r.color, outline: true })
        .setOrigin(1, 0);
      v.setScale(2);
      return v;
    }
    new PixelText(scene, p.x, p.small ? p.y + 3 : p.y, r.label, { size: p.small ? FS.body : FS.big, color: UI.textDim });
    return new PixelText(scene, p.right, p.y, '', { size: FS.big, color: r.color, outline: true }).setOrigin(1, 0);
  });
  // クリアまでの時間の見出しの下:ゆっくりの印と NEW
  const tagY = timeY + 18;
  let tagX = 11;
  if (slow) tagX += slowTag(scene, tagX, tagY) + 4;
  const newTags = rows.map((r, i) => {
    const p = place[i];
    if (i === 0) return env.newTag(tagX, tagY).setVisible(false);
    const tag = env.newTag(p.x + 16 * r.label.length + 4, p.y + 3).setVisible(false);
    // まとめた行は数字とぶつかるので出さない
    if (p.small) tag.setData('never', true);
    return tag;
  });
  const hurtLine = hurtSubY && hurtParts.length
    ? new PixelText(scene, W - 11, hurtSubY, hurtParts.join('・'), { size: FS.small, color: UI.textDim }).setOrigin(1, 0).setVisible(false)
    : null;
  const analogy = fit.analogy
    ? new PixelText(scene, W - 11, analogyY, `(${opt.analogy})`, { size: FS.small, color: UI.gold, outline: true }).setOrigin(1, 0).setVisible(false)
    : null;
  const accText = new PixelText(scene, 11, accY, acc, { size: fit.accSize, color: UI.textDim, lineSpacing: 1 }).setVisible(false);

  return {
    fit, boxH, rows, values, newTags,
    onRowEnd: (i) => { if (i === 3) hurtLine?.setVisible(true); },
    reveal: () => { analogy?.setVisible(true); accText.setVisible(true); },
    texts: [...rows.map((r) => r.label), hurtParts.join('・'), `(${opt.analogy})`, acc, 'ゆっくり', '0123456789:/人回-']
  };
}

/** 「ゆっくり」の小さな印(青い地に白い字)。幅を返す */
function slowTag(scene: Phaser.Scene, x: number, y: number): number {
  const t = new PixelText(scene, x + 3, y + 1, 'ゆっくり', { size: FS.small, color: 0xffffff });
  const w = Math.ceil(t.width) + 6;
  const g = scene.add.graphics().setDepth(t.depth - 1);
  g.fillStyle(UI.black, 1).fillRect(x - 1, y - 1, w + 2, 13);
  g.fillStyle(UI.civ, 1).fillRect(x, y, w, 11);
  return w;
}
