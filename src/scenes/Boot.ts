import Phaser from 'phaser';
import { SCENES } from '../config';
import { type ArtManifest, generateArt, loadArtPngs } from '../art';
import { layout } from '../layout';
import { allTexts, NAMES } from '../logic/content';
import { isStageId, STAGE_IDS, stageTexts } from '../logic/stages';
import { TITLES } from '../logic/titles';
import { FREE_ITEMS, FREE_NAME, ruleSignText } from '../logic/freeNames';
import { freeShareTexts } from '../logic/share';
import { preloadFont } from '../ui/text';
import { currentFreeWave, setSort, startFreeRun, startRun } from '../run';
import { settings } from '../settings';
import { FREE_RESULT_TEXTS } from './result/freeStats';
import { FREE_BUTTON_TEXTS } from './stageselect/freeButton';

/** 画面の部品やボタンに出る字。ひらがな、カタカナ、数字、英字は全部入れておく */
const range = (a: number, b: number): string => Array.from({ length: b - a + 1 }, (_, i) => String.fromCharCode(a + i)).join('');
const BASIC_CHARS = range(0x3041, 0x3096) + range(0x30a1, 0x30fc) + range(0x21, 0x7e) + range(0xff01, 0xff5e)
  + '、。「」…ー¥円万億人秒目撃破負傷被害額逃称号記録新全国市民悪党待行共有一回遊方中断再開音声仕分結果発表路地裏面画縦横最多少高速取集'

/** フリープレイで画面に足した字(ボタン、結果画面、共有、ルールの札) */
const FREE_TEXTS = [
  ...freeShareTexts(), FREE_NAME, ...FREE_BUTTON_TEXTS, ...FREE_RESULT_TEXTS,
  ...[{ kind: 'allBad' } as const, { kind: 'allCiv' } as const, ...FREE_ITEMS.map((item) => ({ kind: 'item', item } as const))].map(ruleSignText)
];

/** 読み込み。public/art/manifest.json にあるPNGは読み込み、ないものはコードで作る。 */
export class BootScene extends Phaser.Scene {
  constructor() { super(SCENES.boot); }

  preload(): void {
    const { W, H } = layout;
    const txt = this.add.text(W / 2, H / 2, 'よみこみちゅう…', { fontFamily: 'monospace', fontSize: '12px', color: '#f5c542' });
    txt.setOrigin(0.5);
    this.load.json('art-manifest', 'art/manifest.json');
  }

  create(): void {
    const skip = loadArtPngs(this, this.cache.json.get('art-manifest') as ArtManifest | undefined);
    const fontReady = preloadFont([...allTexts(), ...stageTexts(), ...Object.values(NAMES).flat(), ...TITLES.map((t) => t.name), BASIC_CHARS, ...FREE_TEXTS], [10, 12, 16]);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      fontReady.then(() => {
        generateArt(this, skip);
        // 途中のシーンから始めるのは開発用のサーバーのときだけ
        this.scene.start((import.meta.env.DEV ? debugJump(this) : null) ?? SCENES.title);
      });
    });
    this.load.start();
  }
}

/**
 * 開発用:URLで途中のシーンから始める(import.meta.env.DEV のときだけ使う)。
 *   ?scene=Sort&wave=2&seed=123
 *   ?scene=Street&wave=3&sorts=truth   (sorts: truth=全部正しく、random=でたらめ、bad=全員ワル、civ=全員市民)
 *   ?scene=Boss   ?scene=Result   (&stage=garage でステージ2、&stage=mall でステージ3)
 *   ?scene=Street&free=1&wave=3&unlocked=alley,garage,mall   (フリープレイの波3。unlocked は開いているステージ。
 *     書かなければ路地裏だけ。ゆっくりモードは一時停止のメニューの設定のまま)
 *   ?scene=Result&free=1   フリープレイの結果画面(見本の数字。result/sample.ts)
 * 始める波より前の波と、Street以降なら始める波の仕分けも sorts の決め方で埋める。
 * scene の名前は大文字と小文字を区別しない(street でもよい)。
 */
function debugJump(scene: Phaser.Scene): string | null {
  const q = new URLSearchParams(location.search);
  const name = (q.get('scene') ?? '').toLowerCase();
  const target = (Object.values(SCENES) as string[]).find((k) => k.toLowerCase() === name);
  if (!target || target === SCENES.boot) return null;
  // フリープレイの結果画面(&more=1 なら路地裏だけクリアした人)
  if (target === SCENES.result && q.get('free') === '1') { startFreeRun(scene, Number(q.get('seed') ?? 12345), { debug: true, unlocked: q.get('more') === '1' ? ['alley', 'garage'] : STAGE_IDS }); return target; }
  if (q.get('free') === '1') {
    // フリープレイ:波の始めの時計は0から(飛ばした波の時間は数えない)
    const unlocked = (q.get('unlocked') ?? 'alley').split(',').filter(isStageId);
    const run = startFreeRun(scene, Number(q.get('seed') ?? 12345), { unlocked, slow: settings.slowMode, debug: true });
    run.waveIndex = Math.min(3, Math.max(1, Number(q.get('wave') ?? 1))) - 1;
    run.stats.setFreeRule(currentFreeWave(run).rule);
    return target;
  }
  const stageParam = q.get('stage');
  const stageId = isStageId(stageParam) ? stageParam : 'alley';
  const run = startRun(scene, Number(q.get('seed') ?? 12345), true, stageId);
  const wave = Math.min(3, Math.max(1, Number(q.get('wave') ?? (target === SCENES.boss || target === SCENES.result ? 3 : 1))));
  run.waveIndex = wave - 1;
  const mode = q.get('sorts') ?? 'random';
  const lastFilled = target === SCENES.sort || target === SCENES.intro || target === SCENES.title ? wave - 1 : wave;
  for (const w of run.stage.waves.slice(0, lastFilled)) {
    for (const p of w.people) {
      const truthChoice = p.truth === 'civ' ? 'civ' : 'bad';
      const choice = mode === 'truth' ? truthChoice : mode === 'bad' ? 'bad' : mode === 'civ' ? 'civ' : (run.rng.chance(0.5) ? 'bad' : 'civ');
      setSort(run, p, choice);
    }
  }
  return target;
}
