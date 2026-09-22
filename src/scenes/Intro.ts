import Phaser from 'phaser';
import { SCENES } from '../config';

export class IntroScene extends Phaser.Scene {
  constructor() { super(SCENES.intro); }

  create(): void {
    this.add.text(8, 8, 'Intro(まだ作っていない)', { fontFamily: 'monospace', fontSize: '10px' });
  }
}
