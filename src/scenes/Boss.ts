import Phaser from 'phaser';
import { SCENES } from '../config';

export class BossScene extends Phaser.Scene {
  constructor() { super(SCENES.boss); }

  create(): void {
    this.add.text(8, 8, 'Boss(まだ作っていない)', { fontFamily: 'monospace', fontSize: '10px' });
  }
}
