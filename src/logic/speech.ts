// セリフを短く書くための道具(content.ts、garageContent.ts、mallContent.ts で使う)。

import type { HeroFace, OperatorFace, OperatorHint, Speech } from './types';

export const hero = (face: HeroFace, text: string): Speech => ({ who: 'hero', face, text });
export const op = (face: OperatorFace, text: string): Speech => ({ who: 'operator', face, text });
export const hint = (face: OperatorFace, text: string): OperatorHint => ({ face, text });
