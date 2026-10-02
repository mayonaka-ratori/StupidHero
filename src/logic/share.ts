// SNSに流す共有文を作る。数字は画像(共有カード)に入っているので、文は短くする。
//
// おばあちゃんに全力パンチ!     ← いちばんひどかった場面の見出し(弱いときは称号)
// #StupidHero
// https://(ゲームのURL)
//
// 使い方:buildShareText({ caption: shareCaption({ worstScene, caption: worstCaption(s), titleName }), url })
// いちばんひどい場面の見出しのうち、ステージで言い方を変えるもの(STAGE_WORST_CAPTIONS)と、
// 「市民がさらわれた!」(ABDUCTED_CAPTION)、「市民に物が落ちた!」(DROPPED_CAPTION)はここに置く。共有カード(src/scenes/result/card.ts)が使う。
// 見出しは共有カードの今の文に合わせて「!」を半角で書く。
// 写真の下の説明の文 worstCaption(s) と freeWorstCaption(s) もここに置く(共有カードと結果画面が使う)。
// 市民に当たった場面の文は、写真と同じ1回がなぐったか巻きぞえか(s.worstCause)で選ぶ。
//
// フリープレイ:1行目はルールと場面をつなげる(「『風船の人はワル!』でおばあちゃんに全力パンチ!」)。
//   const s = stats.snapshot();
//   const caption = freeShareCaption({ worstScene: s.worstScene, caption: worstCaption(s), free: s.free!, titleName });
//   buildShareText({ caption, url })
//   結果画面の小さな1行:heroAccuracyText(s.free!)(「ヒーローだけなら10/27人、あなたが直して25/27人」)

import { FREE_ITEM_NAME, FREE_RULES } from './freeNames';
import type { AttackKind, FreeRule, FreeTally, FreeWorstScene, StageId, StageStats, WorstScene } from './types';

const SHARE_HASHTAG = '#StupidHero';

/**
 * 見出しにして目を引く場面(市民やおばあさんに当たった、市民がさらわれた、街がこわれた)。
 * ボスを倒しただけ、何もなかったは弱い
 */
const STRONG_SCENES: readonly WorstScene[] = ['grannyHit', 'specialOnCiv', 'civHit', 'abducted', 'dropped', 'bigPropBroken'];

/** 買い物客がUFOに連れ去られた場面の見出し(ステージ3) */
export const ABDUCTED_CAPTION = '市民がさらわれた!';

/** 念力で運ばれた物が市民に落ちた場面(WorstScene の 'dropped')の見出し(ステージ4。STAGE4「共有」) */
export const DROPPED_CAPTION = '市民に物が落ちた!';

/**
 * ステージごとに言い方を変える見出し(路地裏の文は「街」なので、ほかのステージは変える)。
 * 大きな物が壊れた場面:地下駐車場「駐車場ボロボロ!」、ショッピングモール「モールがこわれた!」
 */
export const STAGE_WORST_CAPTIONS: Readonly<Partial<Record<StageId, Partial<Record<WorstScene, string>>>>> = {
  garage: { bigPropBroken: '駐車場ボロボロ!' },
  mall: { bigPropBroken: 'モールがこわれた!' },
  tower: { bigPropBroken: 'ビルがこわれた!' }
};

export interface ShareCaptionInput {
  /** いちばんひどかった場面(stats.worstScene) */
  worstScene: WorstScene | null;
  /** その場面の見出し(worstCaption(stats)) */
  caption: string;
  /** 称号の名前 */
  titleName: string;
}

/** ステージのひどい場面の見出し。強い場面で見出しがあればそれ、なければ空の文字 */
function strongCaption(i: Pick<ShareCaptionInput, 'worstScene' | 'caption'>): string {
  return i.worstScene && STRONG_SCENES.includes(i.worstScene) && i.caption ? i.caption : '';
}

/** 共有文の1行目。ひどい場面があればその見出し、なければ称号 */
export function shareCaption(i: ShareCaptionInput): string {
  return strongCaption(i) || `称号「${i.titleName}」`;
}

export interface ShareInput {
  /** 1行目(shareCaption の答え) */
  caption: string;
  /** ゲームのURL */
  url: string;
}

/** 共有する文を作る(改行は \n) */
export function buildShareText(i: ShareInput): string {
  return [i.caption, SHARE_HASHTAG, i.url].join('\n');
}

/** 「Xに投稿」ボタン用のURL(共有メニューが使えないとき) */
export function xPostUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

// ─── フリープレイ ─────────────────────────────────

/** フリープレイだけの、いちばんひどい場面の見出し(ワルごとに変える) */
export const FREE_WORST_CAPTION: Readonly<Record<FreeWorstScene, string>> = {
  waveKnife: 'ナイフ男に笑顔で手を振った!',
  waveGang: 'ギャングに手を振って見送った!',
  waveUfo: 'UFOに手を振った!',
  closeCall: 'ギリギリセーフ!'
};

// ─── いちばんひどい場面の説明の文(写真の下と共有カードに出す) ───

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
    uppercut: 'おばあちゃんにアッパー!',
    flykick: 'おばあちゃんに飛び蹴り!',
    throw: 'おばあちゃんを投げた!',
    hip: 'おばあちゃんにヒップアタック!',
    special: 'おばあちゃんに必殺技!'
  },
  civHit: {
    charge: '市民に突撃!',
    punch: '市民をなぐった!',
    stomp: '市民を踏んだ!',
    uppercut: '市民にアッパー!',
    flykick: '市民に飛び蹴り!',
    throw: '市民を投げた!',
    hip: '市民にヒップアタック!',
    special: '市民に必殺技!'
  }
};

/**
 * 市民に当たった場面が巻きぞえだけだったときの見出し。
 * 完全無欠のヒーローなどは巻きぞえを数えないので、「市民に必殺技!」だと称号と食いちがって見える
 */
const COLLATERAL_CAPTION: Partial<Record<WorstScene, string>> = {
  grannyHit: 'おばあちゃんをまきぞえに!',
  specialOnCiv: '市民を必殺技のまきぞえに!',
  civHit: '市民をまきぞえに!'
};

/** 説明の文を決めるのに使う数 */
export type CaptionStats = Pick<StageStats, 'worstScene' | 'worstAttack'>
  & Partial<Pick<StageStats, 'worstCause' | 'stageId' | 'civHurtByHero' | 'civHurtByCollateral' | 'rush' | 'lift'>>;

/**
 * 写真の場面が巻きぞえか。ふつうは写真と同じ1回で残した worstCause(stats.reportScene)で決める。
 * worstCause がないとき(古い形の数字)は、市民のけがが巻きぞえだけか(ヒーローが市民を直接なぐっていない)で決める。
 * タイムセールラッシュとエレベーターラッシュで市民をなぐった場面も「市民をなぐった」の場面になるが、
 * けがには数えないので、ラッシュの数も見る
 */
const shotIsCollateral = (s: CaptionStats): boolean => {
  if (s.worstCause) return s.worstCause === 'collateral';
  return (s.civHurtByHero ?? 0) === 0 && (s.civHurtByCollateral ?? 0) > 0
    && (s.rush?.civsHit ?? 0) === 0 && (s.lift?.civsHit ?? 0) === 0;
};

/** いちばんひどい場面の説明の文 */
export function worstCaption(s: CaptionStats): string {
  if (!s.worstScene) return 'ひどいことはなかった!';
  const collateral = shotIsCollateral(s) ? COLLATERAL_CAPTION[s.worstScene] : undefined;
  if (collateral) return collateral;
  const byAttack = s.worstAttack ? WORST_CAPTION_BY_ATTACK[s.worstScene]?.[s.worstAttack] : undefined;
  const byStage = s.stageId ? STAGE_WORST_CAPTIONS[s.stageId]?.[s.worstScene] : undefined;
  return byAttack ?? byStage ?? WORST_CAPTION[s.worstScene];
}

/**
 * フリープレイのいちばんひどい場面の説明の文。ステージの場面(市民を殴ったなど)があればその文、
 * なければフリープレイだけの場面(ワルに手を振った、ギリギリセーフ)の文
 */
export function freeWorstCaption(s: CaptionStats & Pick<StageStats, 'free'>): string {
  // 波ごとに背景が変わるので、ステージの名前で言い方を変える文(「駐車場ボロボロ!」など)は使わない
  const plain = {
    worstScene: s.worstScene, worstAttack: s.worstAttack, worstCause: s.worstCause,
    civHurtByHero: s.civHurtByHero, civHurtByCollateral: s.civHurtByCollateral
  };
  if (s.worstScene) return worstCaption(plain);
  if (s.free?.worst) return FREE_WORST_CAPTION[s.free.worst];
  return worstCaption(plain);
}

/** 説明の文の全部(共有カードが字を先に読みこむため) */
export const ALL_WORST_CAPTIONS: readonly string[] = [
  ...Object.values(WORST_CAPTION),
  ...Object.values(STAGE_WORST_CAPTIONS).flatMap((t) => Object.values(t ?? {})),
  ...Object.values(WORST_CAPTION_BY_ATTACK).flatMap((t) => Object.values(t ?? {})),
  ...Object.values(COLLATERAL_CAPTION)
];

/**
 * ルールを共有の文に入れるときの言い方(かぎかっこの中身)。
 * 小物のルールは「風船の人はワル!」、みんなワルは「みんなワル!」、みんないい人は「みんないい人!」
 * (ルールの札の「みんなワル」「みんないいひと」と同じ言い方)
 */
export function ruleQuote(rule: FreeRule): string {
  if (rule.kind === 'allBad') return 'みんなワル!';
  if (rule.kind === 'allCiv') return 'みんないい人!';
  return `${FREE_ITEM_NAME[rule.item]}の人はワル!`;
}

export interface FreeShareCaptionInput {
  /** ステージの場面(stats.worstScene) */
  worstScene: WorstScene | null;
  /** ステージの場面の見出し(worstCaption(stats)。ステージの場面がないときは使わない) */
  caption: string;
  /** フリープレイの数(stats.free)。worst と worstRule を見る */
  free: Pick<FreeTally, 'worst' | 'worstRule'>;
  /** 称号の名前 */
  titleName: string;
}

/**
 * フリープレイの共有文の1行目。ステージの場面(市民を殴った、など)があればその見出し、
 * なければフリープレイだけの場面(ワルに手を振った、ギリギリセーフ)の見出しにし、
 * そのときのルールを前につける(「『風船の人はワル!』でおばあちゃんに全力パンチ!」)。
 * どちらもなければ称号(ルールはつけない)
 */
export function freeShareCaption(i: FreeShareCaptionInput): string {
  let scene = strongCaption(i);
  if (!scene && i.free.worst) scene = FREE_WORST_CAPTION[i.free.worst];
  if (!scene) return `称号「${i.titleName}」`;
  return i.free.worstRule ? `『${ruleQuote(i.free.worstRule)}』で${scene}` : scene;
}

/** 「ヒーローだけなら10/27人、あなたが直して25/27人」(結果画面のいちばん下の小さな1行) */
export function heroAccuracyText(t: Pick<FreeTally, 'heroRight' | 'fixedRight' | 'units'>): string {
  return `ヒーローだけなら${t.heroRight}/${t.units}人、あなたが直して${t.fixedRight}/${t.units}人`;
}

/** フリープレイの共有と結果画面の文の全部(字を先に読みこむため。数字は別に読みこむ) */
export function freeShareTexts(): string[] {
  return [...Object.values(FREE_WORST_CAPTION), ...FREE_RULES.map((r) => `『${ruleQuote(r)}』で`), 'ヒーローだけなら人、あなたが直して人'];
}
