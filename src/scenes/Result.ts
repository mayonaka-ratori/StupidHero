import Phaser from 'phaser';
import { SCENES } from '../config';

export class ResultScene extends Phaser.Scene {
  constructor() { super(SCENES.result); }

  create(): void {
    this.add.text(8, 8, 'Result(まだ作っていない)', { fontFamily: 'monospace', fontSize: '10px' });
  }
}
