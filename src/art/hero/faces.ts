// 顔のカットイン(48×48、胸から上)。各行が表情、左が口を閉じ、右が口を開ける。
// 1文字が1ドット('.' は透明)。顔の形と髪のかたまりを図形で置いてから、目、口、毛先を手で打って作った
// (元は mocks/hero_art_src/face48.py と op48.py)。
// 表情ごとの絵は、いちばん上の表情の口を閉じた顔(BASE)に、違う行だけを重ねて作る('_' は元のまま)。
import { md, OUTLINE, PixelGrid } from '../lib';
import { patch, stamp } from './sprite';

const S = 48;

// ---------- ヒーロー(ドヤ顔、やっちまった(汗)、笑顔) ----------
// o=ふち、a,b,c=肌、H,1,2,3=髪(明るい→影)、L,B,N=スーツとマスクの青、R,r,d=マントの赤、w=白

const HERO_KEYS: Record<string, string> = { o: OUTLINE, a: md(7, 6, 5), b: md(7, 5, 4), c: md(5, 3, 3), H: md(7, 7, 5), '1': md(7, 6, 1), '2': md(6, 4, 0), '3': md(4, 2, 1), L: md(3, 5, 7), B: md(1, 3, 6), N: md(1, 1, 4), R: md(7, 3, 2), r: md(6, 1, 1), d: md(3, 0, 2), w: md(7, 7, 7) };

const HERO_BASE = [
  '................................................',
  '...................oooooooooooo.................',
  '.................ooHHHHHH111111oo...............',
  '...............ooHHHHHHHHH1111111oo.............',
  '..............oHHHHHHHHHHH111111111o............',
  '.........ooo.oHHHHHHHHHHHH1111111111o...........',
  '.......oo2HHoHHHHHHHHHHHHH11111111111o..........',
  '......o222HHHHHHHH111HHHHH111111111111o.........',
  '.....o2222RrHHHHHHHHH2111HHHHH111112211o........',
  '....o22222rdHH2HHH111111111112HH11111111o.......',
  '...oH22222HHHHH21111112111111211HH112111o.......',
  '..o1H22221HHHH1211111111111112111H1111111o......',
  '..o1H22221HHH11211111122111112211111221112o.....',
  '..oH122221HH111221111121111112211112321123o.....',
  '.o1H1222H1H1111221111232111123211123322222o.....',
  '.o1H1222H11111232111123221123aa21223ab2332o.....',
  '.o1H1222H1111122a21123aa21223aaa223aab23222o....',
  '.o1H12221121223BBB223aaaa223aaaNN3NNNNNNNNNo....',
  '.o1112221BB222LBBB233BNNNN3NNNNNNNNNNNNNNNNo....',
  '.o11122211NL33NNNNN3NNNNNNNNNNNNNNNNNNNNNN3o....',
  '.o11122211NNNNNNoooooooNNNNNNNooooooNNNNNN3o....',
  '.o11122211NNNNNNowwLBNoNNNNNNNowLBNoNNNNNN3o....',
  '.o111222111NNNNNowwBNNoNNNNNNNowBNNoNNNNNNo.....',
  '.o111222111NNNNNNowwwoNNNNNNNNNowwoNNNNNN3o.....',
  '.o2222222222NNNNNNNNNNNNNaaaNNNNNNNNNNNNN3o.....',
  '.o222222222222NNNNNNNNNNaaaaaNNNNNNNNNN333o.....',
  '.o2222232222222acbaaaaaaaaaaaaaaaaaaabb333o.....',
  '.o222223o222222ab2aaaaaaaaaaaaaaaaaabb333o......',
  '.o222223o2222222223aaaaaaaaaaaaaaaaacbo3o.......',
  '..o22223o2222222233aaaaaaaaaaaaaaooaaoo3o.......',
  '..o22223o3333o22333bbbaaaaooooaaaaaaao.o........',
  '..o222233o333oooooooobaaaaaaaaaaaaaao...........',
  '...o22233oo3o.......ocaaaaaaaaaaaaoo............',
  '....o223o..o........occbbbbbbbbbbo..............',
  '.....o2o.............occbbbbbbboo...............',
  '......o..............oaaaaabbbo.................',
  '.......oooooo.......ooaaaaabbbo....oooooo.......',
  '...oooorrddddoooooooBBaaaaabbbooooorrrrrroooo...',
  '..oRRrrrrddddLBBBBBBBBaaaaabbbBBBBBBrrrrrrrrdo..',
  '.oRRrrrrrddo2oLLLLLLBBBaaaabbBBBBBBBo3orrrrrddo.',
  'oRRrrrrrrdL212BBBBBBBBBBBaaBBBBBBBBB313rrrrrdddo',
  'RRrrrrrrLLLo2oBBBBBBBBBBB1BBBBBBBBBBo3oNdddddddd',
  'RrrrrrrLLLLLLLBBBBBBBBB11H11BBBBBBBBBNNNNddddddd',
  'rrrrrrrLLLLLLLBBBBBBBBBB121BBBBBBBBBBNNNNddddddd',
  'rrrrrrrBBBBBBBBBBBBBBBB12B21BBBBBBBBBNNNNNdddddd',
  'rrrrrrrBBBBBBBBBBBBBBBB2BBB2BBBBBBBBBNNNNNdddddd',
  'rrrrrrBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBNNNNNdddddd',
  'rrrrrrBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBNNNNNNddddd'
];

const HERO_FACES: Record<number, string>[][] = [
  [
    {},
    {
      29: '______________________________oooaa',
      30: '_____________________________Ro',
      31: '__________________________odRdo',
      32: '___________________________ooo'
    }
  ],
  [
    {
      12: '___________________________________________o',
      13: '___________________________________________oo',
      14: '_________________________________________oLLoo',
      15: '_________________________________________oLwoo',
      16: '_________________________________________oLLoo',
      17: '__________________________________________o_o',
      19: '________________ooa_aaa_______aaaaao',
      20: '________________aa___aa_______aa___a',
      21: '________________aaaaooa_______aooaaa',
      22: '________________aaoooaa_______aaoooa',
      23: '________________o_aaaaa_______aaaaao',
      29: '___________________________o___o_aa',
      30: '___________________________a_ao',
      31: '_____________________________o'
    },
    {
      12: '___________________________________________o',
      13: '___________________________________________oo',
      14: '_________________________________________oLLoo',
      15: '_________________________________________oLwoo',
      16: '_________________________________________oLLoo',
      17: '__________________________________________o_o',
      19: '________________ooa_aaa_______aaaaao',
      20: '________________aa___aa_______aa___a',
      21: '________________aaaaooa_______aooaaa',
      22: '________________aaoooaa_______aaoooa',
      23: '________________o_aaaaa_______aaaaao',
      28: '___________________________oooo',
      29: '__________________________oddddo_aa',
      30: '___________________________dddRo',
      31: '__________________________oRRRRo',
      32: '___________________________oooo'
    }
  ],
  [
    {
      19: '________________aaa_aaa_______aaaaaa',
      20: '________________aa___aa_______a___aa',
      21: '________________aoaaaoa________aaaoa',
      22: '_________________aaaaa________aaaaaa',
      23: '________________aaaaaaa_______aaaaaa',
      28: '_________________RRR_____________RR',
      29: '_________________________o_____o_aa',
      30: '______________________________o'
    },
    {
      19: '________________aaa_aaa_______aaaaaa',
      20: '________________aa___aa_______a___aa',
      21: '________________aoaaaoa________aaaoa',
      22: '_________________aaaaa________aaaaaa',
      23: '________________aaaaaaa_______aaaaaa',
      28: '_________________RRR_____________RR',
      29: '_________________________ooooooo_aa',
      30: '_________________________owwwwwo',
      31: '_________________________oddRRdo',
      32: '__________________________ooooo'
    }
  ]
];

// ---------- オペレーター(ふつう、あせり(汗)、あきれ、ノリノリ) ----------
// o=ふち、a,b,c=肌、K,k,q=髪(明るい→影)、T,t,D=制服と瞳の青緑、w=白、R,p=リボンと口の中、s,S=ヘッドセット

const OP_KEYS: Record<string, string> = { o: OUTLINE, a: md(7, 6, 5), b: md(7, 5, 4), c: md(5, 3, 3), K: md(3, 3, 6), k: md(1, 1, 4), q: md(0, 0, 2), T: md(2, 6, 5), t: md(1, 4, 4), D: md(0, 2, 3), w: md(7, 7, 7), R: md(6, 1, 1), p: md(7, 4, 4), s: md(5, 5, 6), S: md(2, 2, 3) };

const OP_BASE = [
  '....................oooooooo....................',
  '...................ossssssSSoo..................',
  '................ooosSSSSSSSSSkoo................',
  '..............ooKssSKKkkkkkkSSSkooo.............',
  '.............oKKsSSKKKkkkkkkkSSSkkko............',
  '............oKKsSKsssssssskkkkkSSkkko...........',
  '...........oKKsSssKKKKKKKKsskkkkSSkkko..........',
  '..........oKKsSsKKKKKKkkkkKKssskkSkkkko.........',
  '.........oKsssKKkkkkkkkkkkkkKKKskkSkkkko........',
  '.........oKKsSkkkkkkkkkkkkkkkkkKkkSSkkko........',
  '........oKksSkkqkkkkkkqkkkkkkkqkkkkSSkkko.......',
  '.......oKKkSkkkqkkkkkkqkkkkkkkqkkkkkSkkkqo......',
  '.......oKKskkkqkkkkkkqkkkkkkkqkkkkkkkSkkqo......',
  '.......oKsSkkkqkkqkkkqkqkkqkkqkqkkkkkSSkqo......',
  '.......oKSqqqqqkkqqqqqqqkkqqqqqqkqqqqkSkko......',
  '.......osKKkkkkqqaaaaaaaqqaaaaaaqaakkqqSko......',
  '......osSKKkkkkqqqqaaaaaaaaaaqqqaaabkkkSSo......',
  '....oooSKKKkkkkkaaaaaaaaaaaaaaaaaaabkkkkSqo.....',
  '..ooooooKKKkkkkkoooooaaaaaaaaooooaabkkkkkSo.....',
  '.oossssSoKKkkkkowwTTDoaaaaaaowTTDoabkkkkkSo.....',
  '.oosssSSoKKkkkkowTwtDoaaaaaaoTwtDoabkkkkkqo.....',
  '.oossRSSoKKkkkkowTtDDoaaaaaaoTtDDoabqqqqqqo.....',
  '.oosssSSokkkkkkowtDDDoaaaaaaotDDDoabqqqqqqo.....',
  '.oossSSSokkkkkkkowwwoaaaaaaaaowwoaabqqqqqqo.....',
  '.oosSSSSokkkkkkkaaaaaaaaaaaaaaaaaaabqqqqqqo.....',
  '..ooooookkkkkkkkaaaaaaaaaaaaaaaaaaabqqqqqqo.....',
  '....oookskkkkkkkaaaaaaaaaaaaaaaaababqqqqqqo.....',
  '......okkskkkkkkkaaaaaaaaaaaaaaaacaqqqqqqqo.....',
  '......okkkskkkkkqaaaaaaaaaaaaaaaaaaqqqqqqqo.....',
  '......okkkkskkkqqqbbaaaaaaaaaaaaaaqqqqqqqqo.....',
  '......okqqqqssqqoobbaaaaaoooaaaaaqqqqqqqqqo.....',
  '......okqqqqqqssssSoaaaaaaaaaaaaqqqqqqqqqqo.....',
  '......okkqqqqqqooooocbbbbbbbbbboooqqqqqqqo......',
  '.......okqqqqqo.oo.oaabbbbbbboo...oqqqqqqo......',
  '.......okqqqqqo....oaaaaaabbo......oqqqqqo......',
  '........ooqqoo.....oaaaaaabbo.......oqqoo.......',
  '..........oo......owaaaaaabbwo.......oo.........',
  '...........ooooooowwaaaaaabbwwooooooo...........',
  '.........ooTTttttttwwaaaaabwwDDDDttttoo.........',
  '.......ooTTTTTTtttttwwwaawwwtDDDDDDDDtDo........',
  '.....ooTTTTTTTTtttttRRwRRwwtDDDDDDDDDtDDoo......',
  '....oTTTTTTTTTTttttttRpRwwwtDDDDDDDDttDDDDo.....',
  '...oTTTTTTTTTTTtttttRRwRRwttDDDDDDDDttDDDDDo....',
  '...oTTTTTTTTTTTttttttttwwttDDDDDDDDtttDDDDDo....',
  '...oTTTTTTTTTTTttttttttttttDDDDDDDDtttDDDDDDo...',
  '...ottttttttttTttttttttttttDDDDDDDttttDDDDDDo...',
  '..otttttttttttTtttttttttttDDDDDDDDttttDDDDDDo...',
  '..otttttttttttttttttttttttDDDDDDDtttttDDDDDDDo..'
];

const OP_FACES: Record<number, string>[][] = [
  [
    {},
    {
      29: '_________________________ooo',
      30: '________________________oRRRo',
      31: '_________________________ooo'
    }
  ],
  [
    {
      9: '__________________________________________o',
      10: '_________________________________________ooo',
      11: '________________________________________oTToo',
      12: '________________________________________oTwoo',
      13: '________________________________________oTToo',
      14: '__________________________________________oo',
      15: '__________________________________________o',
      16: '_______________kaa_q___________a',
      17: '_______________qq______________qq',
      19: '__________________www_________www',
      20: '_________________wTww________wTww',
      21: '_________________w_ww________w_ww',
      22: '_________________wwww________wwww',
      23: '_________________ooo__________oo',
      30: '________________________oaaao',
      31: '_______________________o_o_o',
      32: '__________________________o'
    },
    {
      9: '__________________________________________o',
      10: '_________________________________________ooo',
      11: '________________________________________oTToo',
      12: '________________________________________oTwoo',
      13: '________________________________________oTToo',
      14: '__________________________________________oo',
      15: '__________________________________________o',
      16: '_______________kaa_q___________a',
      17: '_______________qq______________qq',
      19: '__________________www_________www',
      20: '_________________wTww________wTww',
      21: '_________________w_ww________w_ww',
      22: '_________________wwww________wwww',
      23: '_________________ooo__________oo',
      28: '________________________oooo',
      29: '_______________________owwwwo',
      30: '_______________________oRRRRo',
      31: '_______________________oRppRo',
      32: '________________________oooo'
    }
  ],
  [
    {
      16: '_______________kaa_q___________a',
      17: '_______________qq______________qq',
      18: '________________aaaaa________aaaa',
      19: '_______________kaaaaaa______aaaaaa',
      20: '________________ooooo________oooo',
      30: '________________________o'
    },
    {
      16: '_______________kaa_q___________a',
      17: '_______________qq______________qq',
      18: '________________aaaaa________aaaa',
      19: '_______________kaaaaaa______aaaaaa',
      20: '________________ooooo________oooo',
      29: '________________________oooo',
      30: '________________________oRR',
      31: '_________________________oo'
    }
  ],
  [
    {
      16: '_______________k',
      18: '________________aaaaa________aaaa',
      19: '_______________kaaaaaa______aaaaaa',
      20: '_______________kaoooaa______aoooaa',
      21: '_______________koaaaoa_______aaaoa',
      22: '________________aaaaa_______aaaaaa',
      23: '________________aaaaa________aaaa',
      25: '_____________________________________ooooo',
      26: '___________________________________ooooooo_o',
      27: '________________ppp____________pp_ooaaaaaabo',
      28: '__________________________________oocccccbbo',
      29: '_______________________o___o______ooaaaaaabo',
      30: '________________________o__a______oocccccbbo',
      31: '__________________________________ooaaaaaabo',
      32: '__________________________________oocccccbbo',
      33: '___________________________________oaaaaaboo',
      34: '____________________________________obbbbboo',
      35: '___________________________________oabbbbbbo',
      36: '____________________________________owwwwwwo',
      37: '_____________________________________wwwwwwo',
      38: '____________________________________oTtttDDo',
      39: '___________________________________oTTtttDDo',
      40: '___________________________________oTTtttDDo',
      41: '___________________________________oTTttt_Do',
      42: '___________________________________oTTttt',
      43: '__________________________________oTTTttt__Do',
      44: '__________________________________oTTTttt',
      45: '__________________________________oTTTttt',
      46: '_________________________________oTTTTttt',
      47: '_________________________________oTTTTttt___o'
    },
    {
      16: '_______________k',
      18: '________________aaaaa________aaaa',
      19: '_______________kaaaaaa______aaaaaa',
      20: '_______________kaoooaa______aoooaa',
      21: '_______________koaaaoa_______aaaoa',
      22: '________________aaaaa_______aaaaaa',
      23: '________________aaaaa________aaaa',
      25: '_____________________________________ooooo',
      26: '___________________________________ooooooo_o',
      27: '________________ppp____________pp_ooaaaaaabo',
      28: '__________________________________oocccccbbo',
      29: '______________________ooooooo_____ooaaaaaabo',
      30: '______________________owwwwwo_____oocccccbbo',
      31: '______________________oRRpRRo_____ooaaaaaabo',
      32: '_______________________ooooo______oocccccbbo',
      33: '___________________________________oaaaaaboo',
      34: '____________________________________obbbbboo',
      35: '___________________________________oabbbbbbo',
      36: '____________________________________owwwwwwo',
      37: '_____________________________________wwwwwwo',
      38: '____________________________________oTtttDDo',
      39: '___________________________________oTTtttDDo',
      40: '___________________________________oTTtttDDo',
      41: '___________________________________oTTttt_Do',
      42: '___________________________________oTTttt',
      43: '__________________________________oTTTttt__Do',
      44: '__________________________________oTTTttt',
      45: '__________________________________oTTTttt',
      46: '_________________________________oTTTTttt',
      47: '_________________________________oTTTTttt___o'
    }
  ]
];

function draw(base: readonly string[], over: Record<number, string>, keys: Record<string, string>): PixelGrid {
  const g = new PixelGrid(S, S);
  stamp(g, patch(base, over), keys, 0, 0);
  return g;
}

export function drawFaceSheet(kind: 'hero' | 'operator'): PixelGrid[][] {
  const [base, faces, keys] = kind === 'hero' ? [HERO_BASE, HERO_FACES, HERO_KEYS] as const : [OP_BASE, OP_FACES, OP_KEYS] as const;
  return faces.map((row) => row.map((over) => draw(base, over, keys)));
}
