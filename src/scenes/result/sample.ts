// 開発用の見本。?scene=Result で来たとき(run.debug)だけ使う。
//   ?scene=Result&sample=granny      おばあちゃんの敵(ふつう)
//   ?scene=Result&sample=demolition  歩く解体工事(がれきの上で拳)
//   ?scene=Result&sample=flawless    完全無欠のヒーロー
//   ?scene=Result&sample=runaway     正義の暴走機関車(腕組み)
//   ?scene=Result&sample=kind        やさしすぎるヒーロー(いちばんひどい場面なし)

import type Phaser from 'phaser';
import type { RecordStorage, StatsTracker } from '../../logic';
import { RECORDS_KEY, loadRecords } from '../../logic';
import { drawAlley, drawSprite, frameOf, makeCanvas } from './draw';

export type SampleName = 'granny' | 'demolition' | 'flawless' | 'runaway' | 'kind';

export function sampleName(): SampleName {
  const q = new URLSearchParams(location.search).get('sample');
  return (['granny', 'demolition', 'flawless', 'runaway', 'kind'] as const).find((s) => s === q) ?? 'granny';
}

/** 見本の数字を入れる(撃破、負傷、壊れた物など) */
export function fillSampleStats(stats: StatsTracker, name: SampleName): void {
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
      n(6, () => stats.breakProp('car'));
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
      n(3, () => stats.defeatBad('sort'));
      stats.defeatBoss(9.2);
      n(4, () => stats.escaped());
      n(3, () => stats.stopped('civ'));
      n(4, () => stats.mischief('shopper'));
      break;
  }
}

/** 見本の「いちばんひどかった場面」(216×214)。ヒーローが市民を殴った瞬間など */
export function makeSampleShot(scene: Phaser.Scene, name: SampleName): HTMLCanvasElement | null {
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
export function memoryStorage(): RecordStorage {
  const m = new Map<string, string>();
  const rec = loadRecords();
  if (new URLSearchParams(location.search).get('new') !== '0') {
    rec.stages.alley = { mostDefeated: 5, fewestHurt: 4, highestDamage: 12_000_000, fastestBossSec: 9, plays: 3 };
    for (const t of ['soSo', 'tooKind'] as const) if (!rec.titles.includes(t)) rec.titles.push(t);
  }
  m.set(RECORDS_KEY, JSON.stringify(rec));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}
