import Phaser from 'phaser';
import { SCENES } from '../config';

export class SortScene extends Phaser.Scene {
  constructor() { super(SCENES.sort); }

  create(): void {
    this.add.text(8, 8, 'Sort(まだ作っていない)', { fontFamily: 'monospace', fontSize: '10px' });
  }
}
