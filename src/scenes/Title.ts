import Phaser from 'phaser';
import { SCENES } from '../config';

export class TitleScene extends Phaser.Scene {
  constructor() { super(SCENES.title); }

  create(): void {
    this.add.text(8, 8, 'Title(まだ作っていない)', { fontFamily: 'monospace', fontSize: '10px' });
  }
}
