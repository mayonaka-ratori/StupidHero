import '@fontsource/dotgothic16';
import Phaser from 'phaser';
import { computeLayout, computeRes, fitCanvas } from './layout';
import { installHiRes, RES } from './hires';
import { BootScene } from './scenes/Boot';
import { TitleScene } from './scenes/Title';
import { StageSelectScene } from './scenes/StageSelect';
import { IntroScene } from './scenes/Intro';
import { SortScene } from './scenes/Sort';
import { StreetScene } from './scenes/Street';
import { BossScene } from './scenes/Boss';
import { WaveReviewScene } from './scenes/WaveReview';
import { ResultScene } from './scenes/Result';
import { EndingScene } from './scenes/Ending';
import { TitleListScene } from './scenes/TitleList';
import { WipeScene } from './ui/transition';
import { PauseOverlay, watchOrientation } from './ui/pause';

const L = computeLayout();
installHiRes(computeRes(L.W, L.H));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: L.W * RES,
  height: L.H * RES,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE },
  input: { activePointers: 3 },
  disableContextMenu: true,
  audio: { noAudio: true },
  banner: false,
  scene: [BootScene, TitleScene, StageSelectScene, IntroScene, SortScene, StreetScene, BossScene, WaveReviewScene, EndingScene, ResultScene, TitleListScene, PauseOverlay, WipeScene]
});

const refit = (): void => {
  fitCanvas(game.canvas, L.W, L.H);
  game.scale.refresh();
};
game.events.once(Phaser.Core.Events.READY, refit);
window.addEventListener('resize', refit);
window.addEventListener('orientationchange', () => setTimeout(refit, 200));
// 横向きになったら止める(縦に戻ったら「タップで再開」)
watchOrientation(game);

// 2本指での拡大などを止める
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// 開発と自動テスト用:ブラウザからゲームの状態を見られるようにする(開発用のサーバーのときだけ)
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
