// 開発用の見本。?scene=Result で来たとき(run.debug)だけ使う。
//   ?scene=Result&sample=granny      おばあちゃんの敵(ふつう)
//   ?scene=Result&sample=demolition  歩く解体工事(がれきの上で拳)
//   ?scene=Result&sample=flawless    完全無欠のヒーロー
//   ?scene=Result&sample=runaway     正義の暴走機関車(腕組み)
//   ?scene=Result&sample=kind        やさしすぎるヒーロー(いちばんひどい場面なし)
//   &stage=garage を足すと地下駐車場の見本(組ごと撃破、車で逃げた組、駐車場の背景と絵)
//   ?scene=Result&sample=roundup&stage=garage  一網打尽(まとめて吹き飛ばした組が2組)
//   ?scene=Result&sample=driver&stage=garage   ギャングの運転手(車で逃げられた組が2組)
//   &unlock=1 で、路地裏をクリアして地下駐車場が開いた知らせを出す(路地裏の見本のとき)

import { emptyStageRecord } from '../../logic/records';
import type Phaser from 'phaser';
import type { RecordStorage, StageId, StatsTracker } from '../../logic';
import { ACCESSORY_COLORS, RECORDS_KEY, STAGES, loadRecords } from '../../logic';
import { accessorySheet } from '../../art/recolor';
import { drawAlley, drawSprite, frameOf, makeCanvas } from './draw';

export type SampleName = 'granny' | 'demolition' | 'flawless' | 'runaway' | 'kind' | 'roundup' | 'driver';

export function sampleName(): SampleName {
  const q = new URLSearchParams(location.search).get('sample');
  return (['granny', 'demolition', 'flawless', 'runaway', 'kind', 'roundup', 'driver'] as const).find((s) => s === q) ?? 'granny';
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
      stats.defeatBoss(6.4);
      stats.hurtCiv('hero', 'mechanic');
      stats.hurtCiv('collateral', 'officelady');
      stats.breakProp('pillar'); stats.breakProp('car'); stats.breakProp('cone'); stats.breakProp('extinguisher');
      stats.addBossDamage(3_000_000);
      stats.reportScene('bigPropBroken');
      stats.reportScene('civHit');
      break;
  }
}

/** 見本の数字を入れる(撃破、負傷、壊れた物など) */
export function fillSampleStats(stats: StatsTracker, name: SampleName): void {
  if (stats.stageId === 'garage') { fillGarageSample(stats, name); return; }
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
    case 'kind':
    case 'roundup':
    case 'driver':
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

/** 見本の「いちばんひどかった場面」(216×214)。ヒーローが市民を殴った瞬間など */
export function makeSampleShot(scene: Phaser.Scene, name: SampleName, stageId: StageId = 'alley'): HTMLCanvasElement | null {
  if (stageId === 'garage') return garageSampleShot(scene, name);
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
  // 地下駐車場の見本は、路地裏をクリアしたことにしておく
  if (stageId === 'garage') rec.stages.alley = { ...(rec.stages.alley ?? emptyStageRecord()), clears: Math.max(1, rec.stages.alley?.clears ?? 0) };
  // ?unlock=1:路地裏をまだクリアしていないことにして、今回のクリアで地下駐車場が開くようにする
  if (q.get('unlock') === '1' && stageId === 'alley') rec.stages.alley = { ...(rec.stages.alley ?? emptyStageRecord()), clears: 0 };
  m.set(RECORDS_KEY, JSON.stringify(rec));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}
