// 開発用の見本。?scene=Result で来たとき(run.debug)だけ使う。
//   ?scene=Result&sample=granny      おばあちゃんの敵(ふつう)
//   ?scene=Result&sample=demolition  歩く解体工事(がれきの上で拳)
//   ?scene=Result&sample=flawless    完全無欠のヒーロー
//   ?scene=Result&sample=runaway     正義の暴走機関車(腕組み)
//   ?scene=Result&sample=kind        やさしすぎるヒーロー(いちばんひどい場面なし)
//   &stage=garage を足すと地下駐車場の見本(組ごと撃破、車で逃げた組、駐車場の背景と絵)
//   ?scene=Result&sample=roundup&stage=garage  一網打尽(まとめて吹き飛ばした組が2組)
//   ?scene=Result&sample=driver&stage=garage   ギャングの運転手(車で逃げられた組が2組)
//   &stage=mall を足すとショッピングモールの見本(UFO、さらわれた、タイムセールのまとめ、モールの背景と絵)。
//   ふつう(書かないとき)は買い物客が1人さらわれて、まあまあヒーロー
//   ?scene=Result&sample=guide&stage=mall   宇宙人の案内係(2人さらわれた)
//   ?scene=Result&sample=sale&stage=mall    タイムセールの守り神(セールで1人も間違えない)
//   ?scene=Result&sample=hunter&stage=mall  UFOハンター(UFOを2機落とした。エスカレーターが壊れた)
//   &unlock=1 で、そのステージのクリアで次のステージが開いた知らせを出す(路地裏なら地下駐車場、地下駐車場ならモール)
// フリープレイ(?scene=Result&free=1。Boot の debugJump が startFreeRun する):
//   ?scene=Result&free=1                 ふつう:『風船の人はワル!』でおばあちゃんを殴った(おばあちゃんの敵)
//   ?scene=Result&free=1&sample=sitter   ヒーローのお守り役(だれも傷つけず、逃がさない。ギリギリセーフ)
//   ?scene=Result&free=1&sample=interp   ヒーローの通訳(待ても行けもほとんど決めた。ナイフ男に手を振った。ゆっくりモード)
//   ?scene=Result&free=1&sample=letitbe  なすがまま(待ても行けも押さない)
//   &more=1 で、路地裏しかクリアしていない人の「ステージを進めると、出てくる人が増えるよ」を出す(タップで出る)

import { emptyFreeRecord, emptyStageRecord } from '../../logic/records';
import type Phaser from 'phaser';
import type { RecordStorage, StageId, StatsTracker } from '../../logic';
import { ACCESSORY_COLORS, RECORDS_KEY, STAGES, STAGE_IDS, loadRecords } from '../../logic';
import { accessorySheet } from '../../art/recolor';
import { FREE_ITEM_SHEETS, itemAnchor } from '../../art/free/items';
import { drawAlley, drawSprite, frameOf, makeCanvas } from './draw';

const SAMPLE_NAMES = [
  'granny', 'demolition', 'flawless', 'runaway', 'kind', 'roundup', 'driver', 'guide', 'sale', 'hunter', 'sitter', 'interp', 'letitbe'
] as const;
export type SampleName = typeof SAMPLE_NAMES[number];

export function sampleName(): SampleName {
  const q = new URLSearchParams(location.search).get('sample');
  return SAMPLE_NAMES.find((s) => s === q) ?? 'granny';
}

/** 地下駐車場の見本の数字 */
function fillGarageSample(stats: StatsTracker, name: SampleName): void {
  const n = (k: number, f: () => void): void => { for (let i = 0; i < k; i++) f(); };
  switch (name) {
    case 'roundup':
      // 全員は倒していない(ほかの称号にならないように)
      stats.defeatBad('sort');
      stats.groupWiped(3); stats.groupWiped(2);
      stats.escaped();
      stats.defeatBoss(7.9);
      stats.breakProp('cone'); stats.breakProp('extinguisher'); stats.breakProp('barrier');
      stats.reportScene('bigPropBroken');
      break;
    case 'driver':
      n(2, () => stats.defeatBad('sort'));
      stats.groupEscaped(3); stats.groupEscaped(2);
      stats.defeatBoss(8.1);
      stats.hurtCiv('collateral', 'guard');
      stats.breakProp('cone');
      stats.reportScene('civHit');
      break;
    case 'demolition':
      n(5, () => stats.defeatBad('sort'));
      stats.vanStopped(3);
      stats.defeatBoss(4.8);
      n(6, () => stats.breakProp('pillar'));
      n(8, () => stats.breakProp('car'));
      n(4, () => stats.breakProp('barrier'));
      stats.bossRampage();
      stats.addBossDamage(4_000_000);
      stats.reportScene('specialOnCiv');
      break;
    case 'flawless':
      n(stats.villainTotal - 1, () => stats.defeatBad('sort'));
      stats.defeatBoss(5.6);
      stats.breakProp('cone');
      stats.stopped('civ');
      stats.reportScene('bossDefeated');
      break;
    case 'kind':
      n(3, () => stats.defeatBad('sort'));
      stats.defeatBoss(9.2);
      stats.groupEscaped(2);
      n(3, () => stats.stopped('civ'));
      break;
    default:
      // ふつう:組を1つまとめて吹き飛ばし、1つに逃げられた。市民を殴った
      n(5, () => stats.defeatBad('sort'));
      stats.groupWiped(3);
      stats.groupEscaped(2);
      stats.defeatBoss(7.6);
      stats.hurtCiv('hero', 'mechanic');
      stats.hurtCiv('collateral', 'officelady');
      stats.breakProp('pillar'); stats.breakProp('car'); stats.breakProp('cone'); stats.breakProp('extinguisher');
      stats.addBossDamage(3_000_000);
      stats.reportScene('bigPropBroken');
      stats.reportScene('civHit');
      break;
  }
}

/**
 * ショッピングモールの見本の数字。ラッシュは宇宙人4人と市民4人。
 * miss は間違えた数(宇宙人を逃がした数、市民を殴った数)
 */
function fillMallSample(stats: StatsTracker, name: SampleName): void {
  const n = (k: number, f: () => void): void => { for (let i = 0; i < k; i++) f(); };
  const rush = (alienMiss: number, civMiss: number): void => {
    stats.startRush({ alienCount: 4, civCount: 4 });
    n(4 - alienMiss, () => stats.rushHit('bad')); n(alienMiss, () => stats.rushStopped('bad'));
    n(4 - civMiss, () => stats.rushStopped('civ')); n(civMiss, () => stats.rushHit('civ'));
  };
  switch (name) {
    case 'guide':
      // 2人さらわれた(宇宙人の案内係)
      n(5, () => stats.defeatBad('sort'));
      n(2, () => stats.ufoEscaped());
      stats.defeatBoss(8.4);
      stats.breakProp('gacha'); stats.breakProp('mannequin');
      stats.addBossDamage(3_000_000);
      rush(1, 2);
      stats.reportScene('abducted');
      break;
    case 'sale':
      // セールは全部正しい。1人だけ逃がした(全員倒していないので、ほかの称号にならない)
      n(stats.villainTotal - 3, () => stats.defeatBad('sort'));
      stats.ufoDowned(); stats.breakProp('showcase');
      stats.escaped();
      stats.defeatBoss(8.8);
      stats.breakProp('fountain');
      rush(0, 0);
      stats.reportScene('bossDefeated');
      break;
    case 'hunter':
      // UFOを2機落として、エスカレーターが壊れた。市民を1人殴った
      n(5, () => stats.defeatBad('sort'));
      n(2, () => stats.ufoDowned());
      stats.breakProp('escalator'); stats.breakProp('gacha');
      stats.hurtCiv('hero', 'clerk');
      stats.defeatBoss(9.5);
      stats.breakProp('fountain');
      rush(1, 1);
      stats.reportScene('bigPropBroken');
      break;
    case 'demolition':
      n(6, () => stats.defeatBad('sort'));
      stats.ufoDowned();
      n(4, () => stats.breakProp('escalator'));
      n(3, () => stats.breakProp('showcase'));
      stats.bossRampage();
      stats.addBossDamage(4_500_000);
      stats.hurtCiv('collateral', 'dancer');
      rush(2, 1);
      stats.reportScene('specialOnCiv');
      break;
    case 'flawless':
      n(stats.villainTotal - 2, () => stats.defeatBad('sort'));
      stats.ufoDowned();
      stats.defeatBoss(5.6);
      stats.breakProp('gacha');
      stats.stopped('civ');
      rush(0, 0);
      stats.reportScene('bossDefeated');
      break;
    case 'runaway':
      n(stats.villainTotal - 2, () => stats.defeatBad('sort'));
      stats.ufoDowned();
      stats.defeatBoss(7.3);
      n(2, () => stats.hurtCiv('hero', 'dancer'));
      stats.hurtCiv('collateral', 'uncle');
      stats.breakProp('mannequin'); stats.breakProp('showcase');
      rush(1, 2);
      stats.reportScene('civHit');
      break;
    case 'kind':
      n(3, () => stats.defeatBad('sort'));
      stats.defeatBoss(9.2);
      stats.ufoEscaped();
      n(2, () => stats.escaped());
      n(2, () => stats.stopped('civ'));
      rush(3, 0);
      break;
    default:
      // ふつう:買い物客が1人さらわれ、UFOを1機落とした。セールは少し間違えた
      n(5, () => stats.defeatBad('sort'));
      stats.ufoDowned(); stats.breakProp('mannequin');
      stats.ufoEscaped();
      stats.defeatBoss(7.6);
      stats.breakProp('gacha'); stats.breakProp('showcase'); stats.breakProp('fountain');
      stats.addBossDamage(3_000_000);
      rush(1, 2);
      stats.reportScene('bigPropBroken');
      stats.reportScene('abducted');
      break;
  }
}

/**
 * フリープレイの見本の数字(待てのチャンス9、行けのチャンス8、場面27)。
 * 波1はみんなワル、波2はみんないい人、波3は風船の人はワル(6人目のあとで帽子に言い直す)
 */
function fillFreeSample(stats: StatsTracker, name: SampleName): void {
  const n = (k: number, f: () => void): void => { for (let i = 0; i < k; i++) f(); };
  const wave = (w: 1 | 2 | 3): void => stats.setFreeRule(
    w === 1 ? { kind: 'allBad' } : w === 2 ? { kind: 'allCiv' } : { kind: 'item', item: 'balloon' }
  );
  switch (name) {
    case 'sitter':
      // だれも傷つけず、逃がさない。拳が当たる寸前に待てで止めた
      wave(1); n(6, () => stats.stopped('civ')); n(2, () => stats.defeatBad('sort'));
      stats.reportFreeScene('closeCall');
      wave(2); n(3, () => stats.defeatBad('go')); stats.groupWiped(2); stats.breakProp('vending');
      wave(3); n(2, () => stats.stopped('civ')); stats.defeatBad('go'); n(3, () => stats.defeatBad('sort'));
      stats.breakProp('trash'); stats.breakProp('sign'); stats.dryPress();
      stats.finishFree(92.6);
      break;
    case 'interp':
      // 待て9人、行け7回、空押し2回。モヒカンを1人逃がした(財布をとられた)。ゆっくりモード
      stats.setFreeSlow(true);
      wave(1); n(6, () => stats.stopped('civ')); n(2, () => stats.defeatBad('sort'));
      wave(2); n(4, () => stats.defeatBad('go')); stats.ufoDowned(); stats.breakProp('car');
      stats.setFreeRule({ kind: 'item', item: 'hat' });
      stats.reportFreeScene('waveKnife');
      stats.escaped(true);
      wave(3); n(3, () => stats.stopped('civ')); n(2, () => stats.defeatBad('go')); n(3, () => stats.defeatBad('sort'));
      n(2, () => stats.dryPress()); stats.breakProp('vending');
      stats.finishFree(131.4);
      break;
    case 'letitbe':
      // 待ても行けも押さない。ヒーローは市民を全員殴り、素通りしたワルは全員逃げた
      wave(1); n(6, () => stats.hurtCiv('hero', 'suit')); n(2, () => stats.defeatBad('sort'));
      stats.reportScene('civHit', 'punch');
      n(4, () => stats.breakProp('car')); n(6, () => stats.breakProp('vending'));
      wave(2); n(3, () => stats.escaped(true)); stats.groupEscaped(2); stats.ufoEscaped();
      wave(3); n(3, () => stats.hurtCiv('hero', 'shopper')); n(3, () => stats.defeatBad('sort')); n(3, () => stats.escaped(true));
      n(5, () => stats.breakProp('sign'));
      stats.finishFree(83.9);
      break;
    default:
      // ふつう:波3の『風船の人はワル!』で、風船を持ったおばあちゃんに全力パンチ
      wave(1); n(5, () => stats.stopped('civ')); stats.hurtCiv('hero', 'suit'); n(2, () => stats.defeatBad('sort'));
      stats.breakProp('trash');
      wave(2); n(3, () => stats.defeatBad('go')); stats.groupWiped(2); stats.escaped(true);
      stats.breakProp('car'); stats.breakProp('vending');
      wave(3); n(2, () => stats.stopped('civ')); stats.hurtCiv('hero', 'granny');
      stats.reportScene('grannyHit', 'punch');
      n(2, () => stats.defeatBad('go')); n(3, () => stats.defeatBad('sort')); stats.escaped();
      n(4, () => stats.dryPress()); n(3, () => stats.breakProp('sign'));
      stats.finishFree(104.2);
      break;
  }
}

/** 見本の数字を入れる(撃破、負傷、壊れた物など) */
export function fillSampleStats(stats: StatsTracker, name: SampleName): void {
  if (stats.isFree) { fillFreeSample(stats, name); return; }
  if (stats.stageId === 'garage') { fillGarageSample(stats, name); return; }
  if (stats.stageId === 'mall') { fillMallSample(stats, name); return; }
  const n = (k: number, f: () => void): void => { for (let i = 0; i < k; i++) f(); };
  switch (name) {
    case 'granny':
      n(6, () => stats.defeatBad('sort'));
      stats.defeatBad('go');
      stats.defeatBoss(6.4);
      stats.hurtCiv('hero', 'granny');
      stats.hurtCiv('collateral', 'suit');
      stats.hurtCiv('villain');
      stats.breakProp('vending'); stats.breakProp('window'); stats.breakProp('trash'); stats.breakProp('car');
      n(4, () => stats.breakProp('sign'));
      stats.mischief('hoodie');
      stats.escaped();
      stats.addBossDamage(2_500_000);
      stats.reportScene('bigPropBroken');
      stats.reportScene('grannyHit');
      break;
    case 'demolition':
      n(7, () => stats.defeatBad('sort'));
      stats.defeatBoss(4.8);
      stats.hurtCiv('collateral', 'suit');
      n(14, () => stats.breakProp('car'));
      n(12, () => stats.breakProp('vending'));
      n(3, () => stats.breakProp('sign'));
      stats.bossRampage();
      stats.addBossDamage(3_000_000);
      stats.reportScene('specialOnCiv');
      break;
    case 'flawless':
      n(stats.villainTotal - 1, () => stats.defeatBad('sort'));
      stats.defeatBoss(5.6);
      stats.breakProp('trash'); stats.breakProp('window');
      stats.stopped('civ');
      stats.reportScene('bossDefeated');
      break;
    case 'runaway':
      n(stats.villainTotal - 3, () => stats.defeatBad('sort'));
      n(2, () => stats.defeatBad('go'));
      stats.defeatBoss(7.1);
      n(2, () => stats.hurtCiv('hero', 'hoodie'));
      stats.hurtCiv('collateral', 'shopper');
      stats.breakProp('vending'); stats.breakProp('window'); stats.breakProp('sign');
      stats.reportScene('civHit');
      break;
    default:
      n(3, () => stats.defeatBad('sort'));
      stats.defeatBoss(9.2);
      n(4, () => stats.escaped());
      n(3, () => stats.stopped('civ'));
      n(4, () => stats.mischief('shopper'));
      break;
  }
}

/** 地下駐車場の見本の場面 */
function garageSampleShot(scene: Phaser.Scene, name: SampleName): HTMLCanvasElement | null {
  if (name === 'kind') return null;
  const { canvas, ctx } = makeCanvas(216, 214);
  drawAlley(ctx, scene, 0, 0, 180, 216, STAGES.garage.bg);
  const feet = 196;
  const gang = ACCESSORY_COLORS.aqua.color;
  if (name === 'roundup' || name === 'demolition') {
    drawSprite(ctx, scene, 'prop_van', 3, 160, feet - 4, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'special', 6), 40, feet, { anchor: 'feet' });
    for (let x = 74; x < 216; x += 32) drawSprite(ctx, scene, 'fx_beam', frameOf('fx_beam', 'play', (x / 32) % 4), x, feet - 36, { anchor: 'center' });
    const g = accessorySheet(scene, 'guard_bad', gang), c = accessorySheet(scene, 'clubber_bad', gang);
    drawSprite(ctx, scene, g, frameOf('guard_bad', 'knocked', 1), 120, feet - 14, { anchor: 'feet' });
    drawSprite(ctx, scene, c, frameOf('clubber_bad', 'knocked', 1), 150, feet - 20, { anchor: 'feet' });
  } else if (name === 'flawless') {
    drawSprite(ctx, scene, 'prop_bosscar', 3, 170, feet - 2, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'boss2', frameOf('boss2', 'defeat', 3), 130, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'punch', 5), 80, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_hit_big', frameOf('fx_hit_big', 'play', 1), 120, feet - 40, { anchor: 'center' });
  } else {
    // ふつう、ギャングの運転手:整備士の市民を殴ってしまい、柱が折れた
    drawSprite(ctx, scene, 'prop_pillar', 1, 176, feet - 6, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'punch', 2), 86, feet, { anchor: 'feet' });
    const m = accessorySheet(scene, 'mechanic_civ', ACCESSORY_COLORS.orange.color);
    drawSprite(ctx, scene, m, frameOf('mechanic_civ', 'knocked', 1), 130, feet - 10, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_hit', frameOf('fx_hit', 'play', 1), 118, feet - 30, { anchor: 'center' });
  }
  return canvas;
}

/**
 * ショッピングモールの見本の場面。共有カードは写真の下のほう(y 126〜196)だけを使うので、UFOも低めに描く
 */
function mallSampleShot(scene: Phaser.Scene, name: SampleName): HTMLCanvasElement | null {
  if (name === 'kind') return null;
  const { canvas, ctx } = makeCanvas(216, 214);
  drawAlley(ctx, scene, 0, 0, 180, 216, STAGES.mall.bg);
  const feet = 196;
  if (name === 'granny' || name === 'guide' || name === 'roundup' || name === 'driver') {
    // 買い物客がUFOに吸い上げられている。ヒーローは笑顔で手をふっている
    drawSprite(ctx, scene, 'prop_gacha', 0, 196, feet - 4, { anchor: 'bottom' });
    // (左上と右上はカードの札が重なるので、UFOはその間。説明の字は左下に出る。結果発表の写真と同じ置き方)
    drawSprite(ctx, scene, 'uncle_civ', frameOf('uncle_civ', 'surprised'), 144, feet - 8, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_ufobeam', frameOf('fx_ufobeam', 'play', 1), 144, 146, { anchor: 'top' });
    drawSprite(ctx, scene, 'prop_ufo', 2, 144, 150, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'pass', 1), 64, feet, { anchor: 'feet' });
  } else if (name === 'hunter' || name === 'demolition') {
    // UFOが落ちて、エスカレーターが壊れた
    drawSprite(ctx, scene, 'prop_escalator', 1, 158, feet - 2, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'prop_ufo', 3, 150, feet, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'punch', 5), 76, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_hit_big', frameOf('fx_hit_big', 'play', 1), 116, feet - 40, { anchor: 'center' });
  } else if (name === 'runaway') {
    drawSprite(ctx, scene, 'prop_mannequin', 1, 190, feet - 2, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'stomp', 4), 100, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_shockwave', frameOf('fx_shockwave', 'play', 1), 100, feet - 12, { anchor: 'center' });
    drawSprite(ctx, scene, 'dancer_civ', frameOf('dancer_civ', 'knocked', 1), 150, feet - 6, { anchor: 'feet' });
  } else {
    // 母艦が噴水に落ちて、親玉が目を回している
    drawSprite(ctx, scene, 'prop_fountain', 1, 176, feet - 2, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'prop_mothership', 3, 176, feet - 18, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'boss3', frameOf('boss3', 'defeat', 3), 126, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'punch', 5), 70, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_stars', frameOf('fx_stars', 'play', 1), 120, feet - 34, { anchor: 'center' });
  }
  return canvas;
}

/**
 * フリープレイの見本の場面(背景は stageId のステージ)。
 * ふつうは風船を持ったおばあちゃんを殴った瞬間、お守り役は拳が当たる寸前、通訳はナイフ男に笑顔で手を振った瞬間
 */
function freeSampleShot(scene: Phaser.Scene, name: SampleName, stageId: StageId): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(216, 214);
  drawAlley(ctx, scene, 0, 0, 180, 216, STAGES[stageId].bg);
  const feet = 196;
  if (name === 'sitter') {
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'punch', 1), 70, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'suit_civ', frameOf('suit_civ', 'surprised'), 112, feet, { anchor: 'feet', flipX: true });
  } else if (name === 'interp') {
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'pass', 1), 60, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fp_mohawk', frameOf('fp_mohawk', 'mischief', 2), 116, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'shopper_civ', frameOf('shopper_civ', 'surprised'), 172, feet, { anchor: 'feet', flipX: true });
  } else if (name === 'letitbe') {
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'punch', 2), 86, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'suit_civ', frameOf('suit_civ', 'knocked', 1), 130, feet - 10, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_hit', frameOf('fx_hit', 'play', 1), 118, feet - 30, { anchor: 'center' });
  } else {
    // 風船を持ったおばあちゃん(ひもの下の端を手に合わせる)
    const gx = 124;
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'punch', 2), 80, feet, { anchor: 'feet' });
    const a = itemAnchor('granny_civ', 'balloon');
    if (a) drawSprite(ctx, scene, FREE_ITEM_SHEETS.balloon, 0, gx - a.dx, feet + a.dy, { anchor: 'bottom', flipX: true });
    drawSprite(ctx, scene, 'granny_civ', frameOf('granny_civ', 'surprised'), gx, feet, { anchor: 'feet', flipX: true });
    drawSprite(ctx, scene, 'fx_hit', frameOf('fx_hit', 'play', 1), 110, feet - 30, { anchor: 'center' });
  }
  return canvas;
}

/** 見本の「いちばんひどかった場面」(216×214)。ヒーローが市民を殴った瞬間など。free ならフリープレイの見本 */
export function makeSampleShot(scene: Phaser.Scene, name: SampleName, stageId: StageId = 'alley', free = false): HTMLCanvasElement | null {
  if (free) return freeSampleShot(scene, name, stageId);
  if (stageId === 'garage') return garageSampleShot(scene, name);
  if (stageId === 'mall') return mallSampleShot(scene, name);
  if (name === 'kind') return null;
  const { canvas, ctx } = makeCanvas(216, 214);
  drawAlley(ctx, scene, 0, 0, 180);
  const feet = 196;
  if (name === 'granny') {
    drawSprite(ctx, scene, 'prop_vending', 1, 176, 150, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'shopper_civ', frameOf('shopper_civ', 'surprised'), 172, 152, { anchor: 'feet', flipX: true });
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'punch', 2), 86, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'granny_civ', frameOf('granny_civ', 'knocked', 1), 130, feet - 10, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_hit', frameOf('fx_hit', 'play', 1), 118, feet - 30, { anchor: 'center' });
  } else if (name === 'demolition') {
    drawSprite(ctx, scene, 'prop_car', 1, 150, feet - 2, { anchor: 'bottom' });
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'special', 6), 40, feet, { anchor: 'feet' });
    for (let x = 74; x < 216; x += 32) drawSprite(ctx, scene, 'fx_beam', frameOf('fx_beam', 'play', (x / 32) % 4), x, feet - 36, { anchor: 'center' });
    drawSprite(ctx, scene, 'suit_civ', frameOf('suit_civ', 'knocked', 1), 120, feet - 14, { anchor: 'feet' });
  } else if (name === 'runaway') {
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'stomp', 4), 100, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_shockwave', frameOf('fx_shockwave', 'play', 1), 100, feet - 12, { anchor: 'center' });
    drawSprite(ctx, scene, 'hoodie_civ', frameOf('hoodie_civ', 'knocked', 1), 150, feet - 6, { anchor: 'feet' });
  } else {
    drawSprite(ctx, scene, 'boss', frameOf('boss', 'defeat', 3), 130, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'hero', frameOf('hero', 'punch', 5), 80, feet, { anchor: 'feet' });
    drawSprite(ctx, scene, 'fx_hit_big', frameOf('fx_hit_big', 'play', 1), 120, feet - 40, { anchor: 'center' });
  }
  return canvas;
}

/**
 * 本当の記録を汚さないための、その場かぎりの保存先。
 * 見本として「前の記録」を入れておき、NEW と称号の数が出るようにする(?new=0 で入れない)
 */
export function memoryStorage(stageId: StageId = 'alley'): RecordStorage {
  const m = new Map<string, string>();
  const rec = loadRecords();
  const q = new URLSearchParams(location.search);
  if (q.get('new') !== '0') {
    rec.stages[stageId] = { ...emptyStageRecord(), mostDefeated: 5, fewestHurt: 4, highestDamage: 12_000_000, fastestBossSec: 9, plays: 3, clears: 1 };
    for (const t of ['soSo', 'tooKind'] as const) if (!rec.titles.includes(t)) rec.titles.push(t);
  }
  // 地下駐車場(とそのあと)の見本は、開くのに必要なステージをクリアしたことにしておく
  const need = STAGES[stageId].unlockAfter;
  if (need) rec.stages[need] = { ...(rec.stages[need] ?? emptyStageRecord()), clears: Math.max(1, rec.stages[need]?.clears ?? 0) };
  // ?unlock=1:このステージをまだクリアしていないことにして、今回のクリアで次のステージが開くようにする
  // (路地裏なら地下駐車場、地下駐車場ならショッピングモール。次のステージがなければ何もしない)
  const opens = STAGE_IDS.some((id) => STAGES[id].unlockAfter === stageId);
  if (q.get('unlock') === '1' && opens) rec.stages[stageId] = { ...(rec.stages[stageId] ?? emptyStageRecord()), clears: 0 };
  m.set(RECORDS_KEY, JSON.stringify(rec));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}

/**
 * フリープレイの見本の、その場かぎりの保存先。前の記録(ベスト 1:50 など)を入れておき、NEW が出るようにする(?new=0 で入れない)。
 * 路地裏と地下駐車場をクリアした(全部のステージが開いている)ことにする。?more=1 なら路地裏だけクリアしたことにして、
 * 「ステージを進めると、出てくる人が増えるよ」を出す
 */
export function memoryFreeStorage(): RecordStorage {
  const m = new Map<string, string>();
  const rec = loadRecords();
  const q = new URLSearchParams(location.search);
  rec.stages.alley = { ...(rec.stages.alley ?? emptyStageRecord()), plays: Math.max(1, rec.stages.alley?.plays ?? 0), clears: 1 };
  if (q.get('more') === '1') {
    rec.stages.garage = { ...(rec.stages.garage ?? emptyStageRecord()), clears: 0 };
    rec.freeMoreHintShown = false;
  } else {
    rec.stages.garage = { ...(rec.stages.garage ?? emptyStageRecord()), clears: Math.max(1, rec.stages.garage?.clears ?? 0) };
  }
  if (q.get('new') !== '0') {
    rec.free = { ...emptyFreeRecord(), bestSec: 110.5, bestSlowSec: 140.2, mostStopSaved: 6, mostGoScenes: 5, highestDamage: 4_000_000, plays: 4 };
    for (const t of ['soSo', 'grannyFoe'] as const) if (!rec.titles.includes(t)) rec.titles.push(t);
  }
  m.set(RECORDS_KEY, JSON.stringify(rec));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}
