import Phaser from 'phaser';
import { SCENES } from '../config';

export class StreetScene extends Phaser.Scene {
  constructor() { super(SCENES.street); }

  create(): void {
    this.add.text(8, 8, 'Street(まだ作っていない)', { fontFamily: 'monospace', fontSize: '10px' });
  }
}
