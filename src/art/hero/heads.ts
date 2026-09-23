// ヒーローの頭(右向き、ふちなし。ふちは重ねるときに付ける)。
// 12×10ドット。ふちを入れて高さ12ドット。
// 1,2,3 = 髪(明るい→影)、a,b,c = 肌、m,n = マスク、w = 白目、o = 瞳と口
import { patch } from './sprite';

export type FaceId = 'normal' | 'grin' | 'shout' | 'wink' | 'shock' | 'oops' | 'happy' | 'smug' | 'blank';

//            0123456789AB
const BASE = [
  '...222222...', // 0
  '.2211111122.', // 1
  '21111111112.', // 2
  '211121121212', // 3
  '32122m2m2mm.', // 4
  '3222mwwmwwmm', // 5
  '3322mwomwom.', // 6
  '.332baaaaaa.', // 7
  '..33caaaaoa.', // 8
  '.....cbaaa..'  // 9
];

const FACES: Record<FaceId, Record<number, string>> = {
  normal: {},
  grin: {
    8: '____caaowwo.',
    9: '_____cbaoo..'
  },
  shout: {
    8: '____caaoddo.',
    9: '_____cbaoo..'
  },
  wink: {
    5: '____mmmmwwmm',
    6: '____boomwom.',
    8: '____caaowwo.',
    9: '_____cbaoo..'
  },
  shock: {
    5: '____mwwmwwmm',
    6: '____bwwmwwm.',
    8: '____caaaooa.',
    9: '_____cbaoo..'
  },
  oops: {
    5: '____mwmmwmmm',
    6: '____bmwmmwm.',
    8: '____caodddo.',
    9: '_____cbooo..'
  },
  happy: {
    5: '____mwwmwwmm',
    6: '____bmmmmmm.',
    8: '____caaowwo.',
    9: '_____cbaoo..'
  },
  smug: {
    5: '____mmmmmmmm',
    6: '____bwomwom.',
    8: '____caaacoa.'
  },
  blank: {
    5: '____mmmmmmmm',
    6: '____bmommom.',
    8: '____caaooaa.'
  }
};

export const HEADS: Record<FaceId, string[]> = Object.fromEntries(
  (Object.keys(FACES) as FaceId[]).map((k) => [k, patch(BASE, FACES[k])])
) as Record<FaceId, string[]>;

/** 首がつく点(頭の表の中の位置)。ここを胴の首の点に合わせる */
export const HEAD_NECK = { x: 6, y: 10 };
/** ポニーテールの付け根 */
export const HEAD_TAIL = { x: 1, y: 2 };
