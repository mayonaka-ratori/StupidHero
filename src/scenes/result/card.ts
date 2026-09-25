// 共有カード。横216×縦270のドット絵を作り、ぼかさずに5倍して 1080×1350 の PNG にする。
// 結果画面が出た時点で作っておく(ボタンを押してから作ると、iPhoneで共有メニューが開かないため)。
//   const card = buildCard(this, { title, stats, saved, shot, scrollX, stage: run.stage.def });
//   card.dataUrl      // 大きく出すとき(長押しで保存)
//   await card.file   // navigator.share に渡す File(作れなければ null)
//
// 並び:上に称号とヒーローの勝利ポーズ(背中で爆発)、オペレーターのひとこと。
//       真ん中にいちばんひどかった場面(右上にステージの名前)。下に数字、被害額のたとえ、称号の数、ロゴ。
// 背景とボスの絵は stage(stage.def)から。省略すると路地裏。
//
// フリープレイ(stats.free がある。docs/FREEPLAY.md「結果画面」):
// - 右上のステージ名は「フリープレイ」(stage に FREE_NAME を入れて渡す)
// - 場面のときのルールの札(絵とひらがな)を、写真の右上の角の上に、つまみのように小さく出す(オペレーターの顔の左)。
//   写真の中に置くと、見出しとステージ名の下の段で人の顔が隠れるため
// - 写真の見出しは、ステージの場面がなければフリープレイだけの場面(freeWorstCaption)
// - 数字は結果画面の窓と同じ並び:クリアまでの時間(大きく)、待てで守った、行けで決めた、市民のけが、逃がした、被害額。
//   4行に入れるため、時間は右に2段ぶんの大きさで出し、その左下に待て、行け。市民のけがと被害額は右に寄せる。
//   ゆっくりモードの印は、いちばん下の「#StupidHero」の左。
//   結果画面の窓のいちばん下の小さな1行(ヒーローだけなら…)は入れない(ステージのカードが内わけや足しの行を入れないのと同じ。
//   入れると写真を低くするしかなく、人の顔が見出しに隠れるため)

import type Phaser from 'phaser';
import { UI } from '../../config';
import {
  ABDUCTED_CAPTION, DROPPED_CAPTION, FREE_NAME, FREE_WORST_CAPTION, STAGES, STAGE_WORST_CAPTIONS, damageAnalogy, formatClearTime, formatYen, ruleSignText,
  titleCommentFor, type AttackKind, type FreeRule, type SaveOutcome, type StageDef, type StageId, type StageStats, type TitleDef,
  type WorstScene
} from '../../logic';
import { FREE_ITEM_ICONS } from '../../art/free/items';
import { NAMES } from '../../ui/theme';
import { paintStageBg, drawSprite, drawText, fill, frameOf, makeCanvas } from './draw';

const CARD_W = 216;
const CARD_H = 270;
const CARD_SCALE = 5;

/** いちばんひどかった場面の見出し(写真の下に出す)。技の分からないときの文 */
const WORST_CAPTION: Record<WorstScene, string> = {
  grannyHit: 'おばあちゃんをなぐった!',
  specialOnCiv: '市民に必殺技!',
  civHit: '市民をなぐった!',
  abducted: ABDUCTED_CAPTION,
  dropped: DROPPED_CAPTION,
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

/** ステージごとに言い方を変える見出し(地下駐車場とショッピングモールは「街」ではない。logic/share.ts) */
const WORST_CAPTION_BY_STAGE: Partial<Record<StageId, Partial<Record<WorstScene, string>>>> = STAGE_WORST_CAPTIONS;

/** いちばんひどい場面の説明の文 */
export function worstCaption(s: Pick<StageStats, 'worstScene' | 'worstAttack'> & Partial<Pick<StageStats, 'stageId'>>): string {
  if (!s.worstScene) return 'ひどいことはなかった!';
  const byAttack = s.worstAttack ? WORST_CAPTION_BY_ATTACK[s.worstScene]?.[s.worstAttack] : undefined;
  const byStage = s.stageId ? WORST_CAPTION_BY_STAGE[s.stageId]?.[s.worstScene] : undefined;
  return byAttack ?? byStage ?? WORST_CAPTION[s.worstScene];
}

/**
 * フリープレイのいちばんひどい場面の説明の文。ステージの場面(市民を殴ったなど)があればその文、
 * なければフリープレイだけの場面(ワルに手を振った、ギリギリセーフ)の文
 */
export function freeWorstCaption(s: Pick<StageStats, 'worstScene' | 'worstAttack' | 'free'> & Partial<Pick<StageStats, 'stageId'>>): string {
  // 波ごとに背景が変わるので、ステージの名前で言い方を変える文(「駐車場ボロボロ!」など)は使わない
  const plain = { worstScene: s.worstScene, worstAttack: s.worstAttack };
  if (s.worstScene) return worstCaption(plain);
  if (s.free?.worst) return FREE_WORST_CAPTION[s.free.worst];
  return worstCaption(plain);
}

/** 説明の文の全部(字を先に読みこむため) */
const ALL_CAPTIONS = [
  ...Object.values(WORST_CAPTION),
  ...Object.values(WORST_CAPTION_BY_STAGE).flatMap((t) => Object.values(t ?? {})),
  ...Object.values(WORST_CAPTION_BY_ATTACK).flatMap((t) => Object.values(t ?? {}))
];

export interface CardInput {
  title: TitleDef;
  stats: StageStats;
  /** 称号の数(SaveOutcome か FreeSaveOutcome) */
  saved: Pick<SaveOutcome, 'titlesCollected' | 'titlesTotal'>;
  /** いちばんひどかった場面(216×214)。なければ代わりの絵を描く */
  shot: CanvasImageSource | null;
  scrollX: number;
  /** どのステージか(背景、ボスの絵、名前)。省略すると路地裏 */
  stage?: CardStage;
  /** ひとことと被害額のたとえの言い方をどのステージに合わせるか。省略すると stats.stageId(フリープレイは波3の背景) */
  textStage?: StageId;
}

/** 共有カードに使うステージの中身 */
export type CardStage = Pick<StageDef, 'bg' | 'bossSheet' | 'name' | 'shortName'>;

/**
 * カードに出すステージの名前(「地下駐車場」)。
 * 「ステージ」はつけない(左の「いちばんひどい場面」と並べると、「地下駐車場ステージ」では幅が足りない)
 */
const stageLabel = (st: CardStage): string => st.shortName;

export interface Card {
  /** 216×270 */
  small: HTMLCanvasElement;
  /** 1080×1350 */
  big: HTMLCanvasElement;
  dataUrl: string;
  /** 共有に渡す PNG。作れなければ null */
  file: Promise<File | null>;
}

/** どのステージのカードか(ひとことと被害額のたとえの言い方が変わる) */
const stageIdOf = (i: CardInput): StageId => i.textStage ?? i.stats.stageId ?? 'alley';
/** 称号のひとこと(ステージに合った言い方) */
const commentOf = (i: CardInput): ReturnType<typeof titleCommentFor> => titleCommentFor(i.title.id, stageIdOf(i));

/** 共有カードで使う字(先に読みこんでおく) */
export function cardTexts(i: CardInput): string[] {
  return [
    i.title.name, commentOf(i).text, NAMES.operator, 'いちばんひどい場面', ...ALL_CAPTIONS, stageLabel(i.stage ?? STAGES.alley),
    'ひどいことはなかった!', '悪党を倒した', '市民のけが', '逃がした', '被害額', '人', '称号', '#StupidHero',
    formatYen(i.stats.damage), damageAnalogy(i.stats.damage, stageIdOf(i)).text, '0123456789/,¥万億',
    ...(i.stats.free ? [...FREE_CARD_TEXTS, freeWorstCaption(i.stats), i.stats.free.worstRule ? ruleSignText(i.stats.free.worstRule) : ''] : [])
  ];
}

/** フリープレイのカードで使う字 */
const FREE_CARD_TEXTS = [FREE_NAME, 'クリアまでの時間', '待てで守った', '行けで決めた', 'ゆっくり', '人回:', ...Object.values(FREE_WORST_CAPTION)];

/** 場面の写真がないときの代わり:ボスがのびていて、ヒーローが決めている(背景とボスはそのステージの絵) */
export function makeFallbackShot(scene: Phaser.Scene, stats: StageStats, scrollX: number, stage: CardStage = STAGES[stats.stageId ?? 'alley']): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(216, 214);
  paintStageBg(ctx, scene, 0, 0, scrollX, 216, stage.bg);
  const feet = 194;
  if (stats.bossDefeated) {
    const boss = stage.bossSheet;
    drawSprite(ctx, scene, boss, frameOf(boss, 'defeat', 3), 140, feet, { anchor: 'feet' });
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
  const stage = i.stage ?? STAGES[s.stageId ?? 'alley'];
  fill(ctx, UI.panel, [0, 0, W, CARD_H]);

  // ─── 上:勝利ポーズ ───
  const TOP = 96;
  {
    const bg = makeCanvas(W, 214);
    paintStageBg(bg.ctx, scene, 0, 0, i.scrollX, W, stage.bg);
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
    const comment = commentOf(i);
    const face = comment.who === 'operator' ? 'face_operator' : 'face_hero';
    const fx = W - 36, fy = TOP - 36;
    fill(ctx, 0xffffff, [fx - 1, fy - 1, 34, 34]);
    fill(ctx, 0x7fb0e6, [fx, fy, 32, 32]);
    // 顔の絵は48×48。カードは5倍の細かさで描くので、2/3にしてもドットは消えない
    drawSprite(ctx, scene, face, frameOf(face, comment.face, 1), fx, fy, { scale: 32 / 48 });
    const bubbleStyle = { size: 12, color: 0x111111, lineSpacing: 2 };
    const tsz = drawText(makeCanvas(1, 1).ctx, scene, 0, 0, comment.text, bubbleStyle);
    const bw = tsz.w + 8, bh = tsz.h + 6;
    const bx = Math.min(W - 4 - bw, fx - 6 - Math.floor(bw / 2) + 8);
    const by = fy - bh - 3;
    fill(ctx, 0x000000, [bx + 1, by - 1, bw - 2, bh + 2], [bx - 1, by + 1, bw + 2, bh - 2], [bx, by, bw, bh]);
    fill(ctx, 0xffffff, [bx + 1, by, bw - 2, bh], [bx, by + 1, bw, bh - 2]);
    // しっぽ(顔の方へ)
    const tx = Math.min(fx + 6, bx + bw - 6);
    for (let k = 0; k < 4; k++) fill(ctx, 0x000000, [tx + k - 1, by + bh + k, 3, 1]);
    for (let k = 0; k < 3; k++) fill(ctx, 0xffffff, [tx + k, by + bh - 1 + k, 1, 1]);
    drawText(ctx, scene, bx + 4, by + 3, comment.text, bubbleStyle);
  }

  // ─── 真ん中:いちばんひどかった場面 ───
  const MID = TOP + 2;
  // 下の数字を4行にするので、写真は少し低め(下の端は前と同じところで切る)
  const MID_H = 70;
  const free = s.free;
  {
    const shot = i.shot ?? makeFallbackShot(scene, s, i.scrollX, stage);
    fill(ctx, 0xffffff, [0, MID - 1, W, 1], [0, MID + MID_H, W, 1]);
    ctx.drawImage(shot, 0, 196 - MID_H, W, MID_H, 0, MID, W, MID_H);
    // 見出し
    const lab = drawText(makeCanvas(1, 1).ctx, scene, 0, 0, 'いちばんひどい場面', { size: 12 });
    fill(ctx, 0x000000, [0, MID, lab.w + 8, lab.h + 5]);
    fill(ctx, UI.bad, [0, MID, lab.w + 7, lab.h + 4]);
    drawText(ctx, scene, 4, MID + 2, 'いちばんひどい場面', { size: 12, color: 0xffffff });
    // ステージの名前(右上)
    const sl = stageLabel(stage);
    const sz = drawText(makeCanvas(1, 1).ctx, scene, 0, 0, sl, { size: 12 });
    fill(ctx, 0x000000, [W - sz.w - 8, MID, sz.w + 8, sz.h + 4]);
    fill(ctx, UI.gold, [W - sz.w - 8, MID + sz.h + 3, sz.w + 8, 1]);
    drawText(ctx, scene, W - 4, MID + 2, sl, { size: 12, color: UI.gold }, [1, 0]);
    // 説明の字は右下。さらわれた場面は写真の真ん中から右にUFOと浮いた買い物客がいるので、左下に置く
    const cap = free ? freeWorstCaption(s) : worstCaption(s);
    const capLeft = s.worstScene === 'abducted';
    // フリープレイ:写真の右上の角の上(オペレーターの顔の左)に、その場面のときのルールの札
    if (free?.worstRule) drawRuleSign(ctx, scene, W - 39, MID - 1, free.worstRule);
    drawText(ctx, scene, capLeft ? 4 : W - 4, MID + MID_H - 3, cap, { size: 12, color: 0xffffff, outline: true }, [capLeft ? 0 : 1, 1]);
  }

  // ─── 下:数字 ───
  if (free) drawFreeNumbers(ctx, scene, s, MID + MID_H + 2);
  else {
    const y0 = MID + MID_H + 2;
    const rowH = 16;
    const st = { size: 16, outline: true } as const;
    // 見出しは12ドット、数字は16ドット(見出しが長くなったので、16だと1行に2つ入らない)。字の下をそろえる
    const lst = { size: 12, outline: true } as const;
    /** 見出しと数字を少しあけて並べる。right=true なら右端を x にそろえる */
    const pair = (x: number, y: number, label: string, value: string, color: number, right = false): void => {
      const m = makeCanvas(1, 1).ctx;
      const a = drawText(m, scene, 0, 0, label, lst);
      const b = drawText(m, scene, 0, 0, value, { ...st, color });
      const left = right ? x - (a.w + 2 + b.w) : x;
      drawText(ctx, scene, left, y + 4, label, lst);
      drawText(ctx, scene, left + a.w + 2, y, value, { ...st, color });
    };
    // 並び:1行目に撃破と負傷、2行目に逃がした、3行目に被害額、4行目にたとえ(右寄せ)。
    // 金額やたとえの桁が増えても(¥1億2,000万、一軒家40軒分)、ほかの字とぶつからない
    pair(6, y0, '悪党を倒した', `${s.defeated}人`, UI.gold);
    pair(W - 6, y0, '市民のけが', `${s.civHurt}人`, s.civHurt > 0 ? UI.danger : UI.gold, true);
    pair(6, y0 + rowH, '逃がした', `${s.escaped}人`, s.escaped > 0 ? UI.danger : UI.gold);
    pair(6, y0 + rowH * 2, '被害額', formatYen(s.damage), UI.gold);
    drawText(ctx, scene, W - 6, y0 + rowH * 3, `(${damageAnalogy(s.damage, stageIdOf(i)).text})`, { size: 16, color: UI.gold, outline: true }, [1, 0]);
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
    const tag = drawText(ctx, scene, W - 6, CARD_H - 3, '#StupidHero', { size: 10, color: UI.textDim }, [1, 1]);
    // フリープレイをゆっくりモードで遊んだ印
    if (free?.slow) {
      const m = drawText(makeCanvas(1, 1).ctx, scene, 0, 0, 'ゆっくり', { size: 10 });
      const x = W - 6 - tag.w - 6 - (m.w + 6);
      const y = CARD_H - 3 - m.h - 1;
      fill(ctx, 0x000000, [x - 1, y - 1, m.w + 8, m.h + 4]);
      fill(ctx, UI.civ, [x, y, m.w + 6, m.h + 2]);
      drawText(ctx, scene, x + 3, y + 1, 'ゆっくり', { size: 10, color: 0xffffff });
    }
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

/**
 * フリープレイの数字(4行)。
 *   クリアまでの時間              [ 1:38 ](2段ぶんの大きさ)
 *   待てで守った 9/9人           [      ]
 *   行けで決めた 8/8回        市民のけが 0人
 *   逃がした 0人              被害額 ¥721万
 * 左と右がぶつかるとき(けがが2けたなど)は、左の数字の「/9」を省く
 */
function drawFreeNumbers(ctx: CanvasRenderingContext2D, scene: Phaser.Scene, s: StageStats, y0: number): void {
  const f = s.free!;
  const W = CARD_W;
  const rowH = 16;
  // 左右の端を少しだけ広く使う(左の「9/9人」と右の「市民のけが」がぶつからないように)
  const L = 5, R = W - 5;
  const m = makeCanvas(1, 1).ctx;
  const lst = { size: 12, outline: true } as const;
  const vst = { size: 16, outline: true } as const;
  const width = (label: string, value: string): number =>
    drawText(m, scene, 0, 0, label, lst).w + 2 + drawText(m, scene, 0, 0, value, vst).w;
  /** 見出しと数字。right=true なら右端を x にそろえる */
  const pair = (x: number, y: number, label: string, value: string, color: number, right = false): void => {
    const a = drawText(m, scene, 0, 0, label, lst);
    const w = width(label, value);
    const left = right ? x - w : x;
    drawText(ctx, scene, left, y + 4, label, lst);
    drawText(ctx, scene, left + a.w + 2, y, value, { ...vst, color });
  };
  // クリアまでの時間:見出しは左、数字は右に大きく(2段ぶん)
  drawText(ctx, scene, L, y0 + 4, 'クリアまでの時間', { ...lst, color: UI.gold });
  const time = f.clearSec === null ? '-' : formatClearTime(f.clearSec);
  drawText(ctx, scene, R, y0 - 3, time, { size: 32, color: UI.gold, outline: true }, [1, 0]);
  // 待てと行け(左)、市民のけがと逃がした(右)
  const hurt = { label: '市民のけが', value: `${s.civHurt}人`, color: s.civHurt > 0 ? UI.danger : UI.gold };
  const hurtW = width(hurt.label, hurt.value);
  const long = { stop: `${f.stopSaved}/${f.stopChances}人`, go: `${f.goScenes}/${f.goChances}回` };
  const fits = L + width('行けで決めた', long.go) + 3 <= R - hurtW;
  pair(L, y0 + rowH, '待てで守った', fits ? long.stop : `${f.stopSaved}人`, UI.gold);
  pair(L, y0 + rowH * 2, '行けで決めた', fits ? long.go : `${f.goScenes}回`, UI.gold);
  pair(R, y0 + rowH * 2, hurt.label, hurt.value, hurt.color, true);
  pair(L, y0 + rowH * 3, '逃がした', `${s.escaped}人`, s.escaped > 0 ? UI.danger : UI.gold);
  pair(R, y0 + rowH * 3, '被害額', formatYen(s.damage), UI.gold, true);
}

/**
 * ルールの札。黒い地に白いふち、絵とひらがな(字が読めなくても分かるように)。right が右端、bottom が下端。
 * みんなワルは拳、みんないいひとは手のひら、小物のルールは小物の絵と拳
 */
function drawRuleSign(ctx: CanvasRenderingContext2D, scene: Phaser.Scene, right: number, bottom: number, rule: FreeRule): void {
  const icons = rule.kind === 'allBad' ? ['ui_rule_fist'] : rule.kind === 'allCiv' ? ['ui_rule_palm'] : [FREE_ITEM_ICONS[rule.item], 'ui_rule_fist'];
  const text = ruleSignText(rule);
  const t = drawText(makeCanvas(1, 1).ctx, scene, 0, 0, text, { size: 10 });
  const w = 3 + icons.length * 16 + 2 + t.w + 4;
  const h = 18;
  const x = right - w, y = bottom - h;
  fill(ctx, 0x000000, [x - 1, y - 1, w + 2, h + 1]);
  fill(ctx, 0xffffff, [x, y, w, h]);
  fill(ctx, 0x000000, [x + 1, y + 1, w - 2, h - 1]);
  icons.forEach((k, n) => drawSprite(ctx, scene, k, 0, x + 3 + n * 16, y + 1));
  drawText(ctx, scene, x + 3 + icons.length * 16 + 2, y + 5, text, { size: 10, color: 0xffffff });
}

function drawBoxEdge(ctx: CanvasRenderingContext2D): void {
  fill(ctx, 0x000000, [0, 0, CARD_W, 1], [0, CARD_H - 1, CARD_W, 1], [0, 0, 1, CARD_H], [CARD_W - 1, 0, 1, CARD_H]);
}


