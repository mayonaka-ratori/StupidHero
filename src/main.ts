import '@fontsource/dotgothic16';
import Phaser from 'phaser';
import { computeLayout, fitCanvas } from './layout';
import { BootScene } from './scenes/Boot';
import { TitleScene } from './scenes/Title';
import { IntroScene } from './scenes/Intro';
import { SortScene } from './scenes/Sort';
import { StreetScene } from './scenes/Street';
import { ResultScene } from './scenes/Result';

const L = computeLayout();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: L.W,
  height: L.H,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE },
  input: { activePointers: 3 },
  disableContextMenu: true,
  audio: { noAudio: true },
  banner: false,
  scene: [BootScene, TitleScene, IntroScene, SortScene, StreetScene, ResultScene]
});

const refit = (): void => {
  fitCanvas(game.canvas, L.W, L.H);
  game.scale.refresh();
};
game.events.once(Phaser.Core.Events.READY, refit);
window.addEventListener('resize', refit);
window.addEventListener('orientationchange', () => setTimeout(refit, 200));

// 2本指での拡大などを止める
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
