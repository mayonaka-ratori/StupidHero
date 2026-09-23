// 共有カード。横216×縦270のドット絵を作り、ぼかさずに5倍して 1080×1350 の PNG にする。
// 結果画面が出た時点で作っておく(ボタンを押してから作ると、iPhoneで共有メニューが開かないため)。
//   const card = buildCard(this, { title, stats, saved, shot, scrollX });
//   card.dataUrl      // 大きく出すとき(長押しで保存)
//   await card.file   // navigator.share に渡す File(作れなければ null)
//
// 並び:上に称号とヒーローの勝利ポーズ(背中で爆発)、オペレーターのひとこと。
//       真ん中にいちばんひどかった場面。下に数字、被害額のたとえ、称号の数、ロゴ。

import type Phaser from 'phaser';
import { UI } from '../../config';
import {
  damageAnalogy, formatYen, type AttackKind, type SaveOutcome, type StageStats, type TitleDef, type WorstScene
} from '../../logic';
import { NAMES } from '../../ui/theme';
import { drawAlley, drawSprite, drawText, fill, frameOf, makeCanvas } from './draw';

export const CARD_W = 216;
export const CARD_H = 270;
export const CARD_SCALE = 5;

/** いちばんひどかった場面の見出し(写真の下に出す)。技の分からないときの文 */
export const WORST_CAPTION: Record<WorstScene, string> = {
  grannyHit: 'おばあちゃんをなぐった!',
  specialOnCiv: '市民に必殺技!',
  civHit: '市民をなぐった!',
  bigPropBroken: '街がこわれた!',
  bossDefeated: 'ボスを倒した!'
};

/** 市民に当たった場面は、技の種類で文を変える */
const WORST_CAPTION_BY_ATTACK: Partial<Record<WorstScene, Record<AttackKind, string>>> = {
  grannyHit: {
    charge: 'おばあちゃんに突撃!',
    punch: 'おばあちゃんに全力パンチ!',
    stomp: 'おばあちゃんを踏みつぶし!',
    special: 'おばあちゃんに必殺技!'
  },
  civHit: {
    charge: '市民に突撃!',
    punch: '市民をなぐった!',
    stomp: '市民を踏んだ!',
    special: '市民に必殺技!'
  }
};

/** ワーストシーンの説明の文 */
export function worstCaption(s: Pick<StageStats, 'worstScene' | 'worstAttack'>): string {
  if (!s.worstScene) return 'ひどいことはなかった!';
  const byAttack = s.worstAttack ? WORST_CAPTION_BY_ATTACK[s.worstScene]?.[s.worstAttack] : undefined;
  return byAttack ?? WORST_CAPTION[s.worstScene];
}

/** 説明の文の全部(字を先に読みこむため) */
const ALL_CAPTIONS = [
  ...Object.values(WORST_CAPTION),
  ...Object.values(WORST_CAPTION_BY_ATTACK).flatMap((t) => Object.values(t ?? {}))
];

export interface CardInput {
  title: TitleDef;
  stats: StageStats;
  saved: SaveOutcome;
  /** いちばんひどかった場面(216×214)。なければ代わりの絵を描く */
  shot: CanvasImageSource | null;
  scrollX: number;
}

export interface Card {
  /** 216×270 */
  small: HTMLCanvasElement;
  /** 1080×1350 */
  big: HTMLCanvasElement;
  dataUrl: string;
  /** 共有に渡す PNG。作れなければ null */
  file: Promise<File | null>;
}

/** 共有カードで使う字(先に読みこんでおく) */
export function cardTexts(i: CardInput): string[] {
  return [
    i.title.name, i.title.comment.text, NAMES.operator, 'ワーストシーン', ...ALL_CAPTIONS,
    'ひどいことはなかった!', '悪党撃破', '市民負傷', '逃がした', '被害額', '人', '称号', '#StupidHero',
    formatYen(i.stats.damage), damageAnalogy(i.stats.damage).text, '0123456789/,¥万億'
  ];
}

/** 場面の写真がないときの代わり:ボスがのびていて、ヒーローが決めている */
export function makeFallbackShot(scene: Phaser.Scene, stats: StageStats, scrollX: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(216, 214);
  drawAlley(ctx, scene, 0, 0, scrollX);
  const feet = 194;
  if (stats.bossDefeated) {
    drawSprite(ctx, scene, 'boss', frameOf('boss', 'defeat', 3), 140, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_stars', frameOf('fx_stars', 'play', 1), 132, feet - 30, { anchor: 'center' });
  }
  drawSprite(ctx, scene, 'hero', frameOf('hero', 'win_arms', 0), 76, feet, { anchor: 'feet' });
  return canvas;
}

export function buildCard(scene: Phaser.Scene, i: CardInput): Card {
  // 論理ドット216×270で描き、中身は5倍の細かさ(1080×1350)。絵はドットのまま、字はくっきり
  const { canvas, ctx } = makeCanvas(CARD_W, CARD_H, CARD_SCALE);
  const W = CARD_W;
  const s = i.stats;
  fill(ctx, UI.panel, [0, 0, W, CARD_H]);

  // ─── 上:勝利ポーズ ───
  const TOP = 96;
  {
    const bg = makeCanvas(W, 214);
    drawAlley(bg.ctx, scene, 0, 0, i.scrollX);
    ctx.drawImage(bg.canvas, 0, 100, W, TOP, 0, 0, W, TOP);
    const hx = 46;
    const feet = i.title.pose === 'win_fist' ? 84 : 90;
    // 背中で爆発(大きさの違う2つ)
    drawSprite(ctx, scene, 'fx_explosion', frameOf('fx_explosion', 'play', 4), hx - 30, 50, { anchor: 'center' });
    drawSprite(ctx, scene, 'fx_explosion', frameOf('fx_explosion', 'play', 3), hx + 34, 46, { anchor: 'center' });
    drawSprite(ctx, scene, 'fx_explosion', frameOf('fx_explosion', 'play', 2), hx - 6, 30, { anchor: 'center' });
    if (i.title.pose === 'win_fist') drawSprite(ctx, scene, 'fx_rubble', 0, hx, 96, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'hero', frameOf('hero', i.title.pose, 0), hx, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_kiran', frameOf('fx_kiran', 'play', 1), hx + 16, feet - 44, { anchor: 'center' });

    // 称号の帯
    fill(ctx, 0x000000, [0, 0, W, 24]);
    fill(ctx, UI.bad, [0, 1, W, 2], [0, 21, W, 2]);
    drawText(ctx, scene, W / 2, 4, i.title.name, { size: 16, color: UI.gold, outline: true }, [0.5, 0]);

    // オペレーターのひとこと(白い吹き出しと顔)
    const face = i.title.comment.who === 'operator' ? 'face_operator' : 'face_hero';
    const fx = W - 36, fy = TOP - 36;
    fill(ctx, 0xffffff, [fx - 1, fy - 1, 34, 34]);
    fill(ctx, 0x7fb0e6, [fx, fy, 32, 32]);
    drawSprite(ctx, scene, face, frameOf(face, i.title.comment.face, 1), fx, fy);
    const bubbleStyle = { size: 12, color: 0x111111, lineSpacing: 2 };
    const tsz = drawText(makeCanvas(1, 1).ctx, scene, 0, 0, i.title.comment.text, bubbleStyle);
    const bw = tsz.w + 8, bh = tsz.h + 6;
    const bx = Math.min(W - 4 - bw, fx - 6 - Math.floor(bw / 2) + 8);
    const by = fy - bh - 3;
    fill(ctx, 0x000000, [bx + 1, by - 1, bw - 2, bh + 2], [bx - 1, by + 1, bw + 2, bh - 2], [bx, by, bw, bh]);
    fill(ctx, 0xffffff, [bx + 1, by, bw - 2, bh], [bx, by + 1, bw, bh - 2]);
    // しっぽ(顔の方へ)
    const tx = Math.min(fx + 6, bx + bw - 6);
    for (let k = 0; k < 4; k++) fill(ctx, 0x000000, [tx + k - 1, by + bh + k, 3, 1]);
    for (let k = 0; k < 3; k++) fill(ctx, 0xffffff, [tx + k, by + bh - 1 + k, 1, 1]);
    drawText(ctx, scene, bx + 4, by + 3, i.title.comment.text, bubbleStyle);
  }

  // ─── 真ん中:いちばんひどかった場面 ───
  const MID = TOP + 2;
  // 下の数字を4行にするので、写真は少し低め(下の端は前と同じところで切る)
  const MID_H = 70;
  {
    const shot = i.shot ?? makeFallbackShot(scene, s, i.scrollX);
    fill(ctx, 0xffffff, [0, MID - 1, W, 1], [0, MID + MID_H, W, 1]);
    ctx.drawImage(shot, 0, 196 - MID_H, W, MID_H, 0, MID, W, MID_H);
    // 見出し
    const lab = drawText(makeCanvas(1, 1).ctx, scene, 0, 0, 'ワーストシーン', { size: 12 });
    fill(ctx, 0x000000, [0, MID, lab.w + 8, lab.h + 5]);
    fill(ctx, UI.bad, [0, MID, lab.w + 7, lab.h + 4]);
    drawText(ctx, scene, 4, MID + 2, 'ワーストシーン', { size: 12, color: 0xffffff });
    const cap = worstCaption(s);
    drawText(ctx, scene, W - 4, MID + MID_H - 3, cap, { size: 12, color: 0xffffff, outline: true }, [1, 1]);
  }

  // ─── 下:数字 ───
  {
    const y0 = MID + MID_H + 2;
    const rowH = 16;
    const st = { size: 16, outline: true } as const;
    /** 見出しと数字を少しあけて並べる。right=true なら右端を x にそろえる */
    const pair = (x: number, y: number, label: string, value: string, color: number, right = false): void => {
      const m = makeCanvas(1, 1).ctx;
      const a = drawText(m, scene, 0, 0, label, st);
      const b = drawText(m, scene, 0, 0, value, { ...st, color });
      const left = right ? x - (a.w + 2 + b.w) : x;
      drawText(ctx, scene, left, y, label, st);
      drawText(ctx, scene, left + a.w + 2, y, value, { ...st, color });
    };
    // 並び:1行目に撃破と負傷、2行目に逃がした、3行目に被害額、4行目にたとえ(右寄せ)。
    // 金額やたとえの桁が増えても(¥1億2,000万、一軒家40軒分)、ほかの字とぶつからない
    pair(6, y0, '悪党撃破', `${s.defeated}人`, UI.gold);
    pair(W - 6, y0, '市民負傷', `${s.civHurt}人`, s.civHurt > 0 ? UI.danger : UI.gold, true);
    pair(6, y0 + rowH, '逃がした', `${s.escaped}人`, s.escaped > 0 ? UI.danger : UI.gold);
    pair(6, y0 + rowH * 2, '被害額', formatYen(s.damage), UI.gold);
    drawText(ctx, scene, W - 6, y0 + rowH * 3, `(${damageAnalogy(s.damage).text})`, { size: 16, color: UI.gold, outline: true }, [1, 0]);
  }

  // ─── いちばん下:ロゴと称号の数 ───
  {
    const fy = CARD_H - 34;
    fill(ctx, 0x000000, [0, fy - 1, W, 1]);
    fill(ctx, 0x15122a, [0, fy, W, CARD_H - fy]);
    // ロゴは半分の大きさ(1ドットおきに拾う)
    if (scene.textures.exists('logo')) {
      const lf = scene.textures.getFrame('logo', '__BASE');
      const src = lf.source.image as CanvasImageSource;
      const half = makeCanvas(Math.floor(lf.cutWidth / 2), Math.floor(lf.cutHeight / 2));
      half.ctx.drawImage(src, 0, 0, lf.cutWidth, lf.cutHeight, 0, 0, half.canvas.width, half.canvas.height);
      ctx.drawImage(half.canvas, 2, fy + 1);
    }
    drawText(ctx, scene, W - 6, fy + 3, `称号{gold}${i.saved.titlesCollected}{/}/${i.saved.titlesTotal}`, { size: 16, outline: true }, [1, 0]);
    drawText(ctx, scene, W - 6, CARD_H - 3, '#StupidHero', { size: 10, color: UI.textDim }, [1, 1]);
  }

  // 外わく
  drawBoxEdge(ctx);

  const big = canvas;
  const dataUrl = big.toDataURL('image/png');
  const file = new Promise<File | null>((resolve) => {
    try {
      big.toBlob((b) => {
        if (!b) { resolve(null); return; }
        try { resolve(new File([b], 'stupid-hero.png', { type: 'image/png' })); } catch { resolve(null); }
      }, 'image/png');
    } catch { resolve(null); }
  });
  return { small: canvas, big, dataUrl, file };
}

function drawBoxEdge(ctx: CanvasRenderingContext2D): void {
  fill(ctx, 0x000000, [0, 0, CARD_W, 1], [0, CARD_H - 1, CARD_W, 1], [0, 0, 1, CARD_H], [CARD_W - 1, 0, 1, CARD_H]);
}


