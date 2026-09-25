// ヒーローの頭(右向き、ふちなし。ふちは重ねるときに付ける)。
// 14×12ドット。ふちを入れて16×13ドットくらい。いちばん下の行はあごの下の影(首のつけ根)。
// 元は承認されたモック(mocks/hero_art_src/idle2.py)の頭。ポニーテールは rig.ts で描く。
// H,1,2,3 = 髪(つや→影)、a,b,c = 肌、N = マスク、B = マスクのつや、w = 白いレンズ、o = 口、d = 口の中
import { patch } from './sprite';

export type FaceId = 'normal' | 'grin' | 'shout' | 'wink' | 'shock' | 'oops' | 'happy' | 'smug' | 'blank';

//            0123456789ABCD
const BASE = [
  '....1HHH12....', // 0
  '..1HH1111122..', // 1
  '.31HH1HH11212.', // 2
  '32H1211121121.', // 3
  '321112ab21ab2.', // 4
  '322NBBNNNNNNN.', // 5
  '32NNNNwwBNwBN.', // 6 目(上)
  '3baNNNwBBNwBN.', // 7 目(下)
  '3cbbaaaaaaaaaa', // 8 鼻
  '32cbaaaaaacoa.', // 9 口
  '.3cbbaaaaaab..', // 10 あご
  '.....cbbbb....'  // 11 あごの下
];

// 目はマスクの白いレンズ。形で表情を出す('_' は元のまま)
const FACES: Record<FaceId, Record<number, string>> = {
  normal: {},
  grin: {
    9: '_________owwo',
    10: '_________ooo'
  },
  shout: {
    9: '_________odoa',
    10: '_________oob'
  },
  wink: {
    6: '______NNN',
    7: '______wwN',
    9: '_________owwo',
    10: '_________ooo'
  },
  shock: {
    6: '______wwwNww',
    7: '______wwwNww',
    9: '__________oo',
    10: '__________ob'
  },
  oops: {
    6: '______wwNNNw',
    7: '______NNwNwN',
    9: '_________oddo',
    10: '_________ooo'
  },
  happy: {
    6: '______NwNNww',
    7: '______wNwNNN',
    9: '_________owwo',
    10: '_________ooo'
  },
  smug: {
    6: '______NNNNNN',
    8: '___________c',
    9: '__________cco'
  },
  blank: {
    6: '______NNNNNN',
    7: '______NwNNwN',
    9: '__________oa'
  }
};

export const HEADS: Record<FaceId, string[]> = Object.fromEntries(
  (Object.keys(FACES) as FaceId[]).map((k) => [k, patch(BASE, FACES[k])])
) as Record<FaceId, string[]>;

/** 首の芯がつく点(頭の表の中の位置、ドットのふち基準)。ここを胴の首の点に合わせる */
export const HEAD_NECK = { x: 7, y: 11.5 };
/** ポニーテールの付け根(髪ゴムの位置) */
export const HEAD_TAIL = { x: 0.3, y: 1.8 };
