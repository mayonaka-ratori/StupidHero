// ステージ4(高層ビル)の見本の人8種類。ゲームの人と同じ drawPerson で描く。
// 市民とヴィランは同じ絵にする(もれは周りに重ねるので、人の絵は変えない)。
import { md, PixelGrid } from '../../src/art/lib';
import { type Build, HAIR_BUN, HAIR_SHORT, HAIR_SLICK, type HairStyle, type Look, type Pose, clonePose, drawPerson } from '../../src/art/world/figure';
import { HAIR, OUTLINE, SKIN, WHITE, GOLD } from '../../src/art/world/palette';
import { type Painter, type Pt, type Ramp } from '../../src/art/world/pix';
import { STAND, withFace } from '../../src/art/world/poses';

const R = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];

/** ふちで囲んだ小さな絵を置く。rows の文字は map で色にする('.' は塗らない) */
export function sprite(Pn: Painter, x: number, y: number, rows: string[], map: Record<string, string>): void {
  const m = Pn.mask();
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') m.set(x + i, y + j); });
  Pn.fill(m, OUTLINE, { sep: 'outline', flat: true });
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = map[r[i]]; if (c) Pn.px(x + i, y + j, c); } });
}

const lean = (pose: Pose): number => (pose.hip[0] - pose.neck[0]) / Math.max(1, pose.hip[1] - pose.neck[1]);

const SLIM: Build = { sh: 7.5, wa: 6, arm: 2.2, thigh: 2.9, shin: 2.4, hem: 1, chest: 1 };
const WIDE: Build = { sh: 8.5, wa: 7, arm: 2.5, thigh: 3.1, shin: 2.6, hem: 1, chest: 2 };
const LADY: Build = { sh: 6.5, wa: 5.5, arm: 1.9, thigh: 2.6, shin: 2.2, hem: 0, chest: 2 };

const BLACK: Ramp = [md(2, 2, 3), md(1, 1, 2), OUTLINE];
const SHOE: Ramp = [HAIR[1], OUTLINE, OUTLINE];
const SHIRT: Ramp = [WHITE[0], WHITE[0], WHITE[2]];
const LEAF: Ramp = [md(3, 6, 2), md(2, 4, 1), md(1, 2, 1)];

// =====================================================================
// 1階:花屋の店員(緑のエプロン、花束)
// =====================================================================
const APRON_G: Ramp = [md(3, 5, 3), md(2, 4, 2), md(1, 2, 1)];
const CREAM: Ramp = [md(7, 7, 6), md(6, 6, 5), md(5, 4, 4)];
const FLOWER = [md(7, 3, 4), md(7, 6, 2), md(7, 7, 7), md(5, 4, 7)];

function florist(): { look: Look; pose: Pose } {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_BUN,
    top: CREAM, sleeve: 'rolled', bottom: [md(3, 3, 4), md(2, 2, 3), md(1, 1, 2)], legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: LADY,
    torso(Pn, pose, top) {
      const n = pose.neck, l = lean(pose);
      const apron = Pn.mask();
      top.each((x, y) => { if (y >= n[1] + 4) apron.set(x, y); });
      Pn.fill(apron, APRON_G, { sep: 'none', hi: 0.3, lo: 0.7 });
      for (let dy = 0; dy <= 4; dy++) Pn.px(Math.round(n[0] - 2 + l * dy), n[1] + dy, APRON_G[2]);
      // エプロンのポケットと、はさみ(銀)
      Pn.px(Math.round(n[0] + 5 + l * 11), n[1] + 11, WHITE[2]).px(Math.round(n[0] + 5 + l * 11), n[1] + 12, WHITE[0]);
    },
    front(Pn, pose) {
      // 花束(胸の前)。茎は下へ、花は上
      const [hx, hy] = R(pose.aF.h);
      sprite(Pn, hx - 1, hy - 1, ['gg', 'gg', 'g.'], { g: LEAF[1] });
      sprite(Pn, hx - 3, hy - 7, [
        '.pyp.',
        'pwpyl',
        'ylpwp',
        '.pgl.',
        '..gg.'
      ], { p: FLOWER[0], y: FLOWER[1], w: FLOWER[2], l: FLOWER[3], g: LEAF[0] });
    }
  };
  const pose = clonePose(STAND);
  pose.aF = { e: [31, 29], h: [36, 30] };
  pose.face = 'grin';
  return { look, pose };
}

// =====================================================================
// 1階:配達員(帽子、つなぎの上着、段ボール)
// =====================================================================
const COURIER: Ramp = [md(3, 5, 6), md(2, 3, 5), md(1, 2, 3)];
const BOX: Ramp = [md(6, 5, 3), md(5, 4, 2), md(3, 2, 1)];
const CAP_ROWS = [
  '..ccccccc....',
  '.cLLcccccc...',
  '.cLccccccccbb',
  'dddddddddbbbb'
];
function courier(): { look: Look; pose: Pose } {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SHORT,
    top: COURIER, sleeve: 'short', bottom: COURIER, legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: WIDE,
    headExtra(g) {
      CAP_ROWS.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) {
          const c = { c: COURIER[1], L: COURIER[0], d: COURIER[2], b: COURIER[2] }[r[x]];
          if (c) g.px(x, y, c);
        }
      });
    },
    torso(Pn, pose) {
      const n = pose.neck, l = lean(pose);
      // 胸の白い線(反射材)
      for (let dx = -5; dx <= 6; dx++) Pn.px(Math.round(n[0] + dx + l * 9), n[1] + 9, WHITE[1]);
    },
    front(Pn, pose) {
      // 両手で持った段ボール
      const [hx, hy] = R(pose.aF.h);
      sprite(Pn, hx - 3, hy - 9, [
        'LLLLLLLLLLL',
        'LbbbbTbbbbd',
        'bbbbbTbbbbd',
        'bbbbbbbbbbd',
        'bbbbbbbbbbd',
        'bbbbbbbbbbd',
        'bbbbbbbbbbd',
        'dddddddddd.'
      ], { L: BOX[0], b: BOX[1], d: BOX[2], T: md(6, 6, 6) });
      Pn.rect(hx - 2, hy - 2, 2, 2, SKIN[0]);
    }
  };
  const pose = clonePose(STAND);
  pose.aF = { e: [31, 29], h: [35, 34] };
  pose.aB = { e: [38, 29], h: [42, 33] };
  return { look, pose };
}

// =====================================================================
// 18階:新人の会社員(明るい紺のスーツ、書類の束)
// =====================================================================
const NAVY: Ramp = [md(3, 4, 6), md(2, 3, 5), md(1, 2, 3)];
const LANYARD = md(6, 2, 1);
function newbie(): { look: Look; pose: Pose } {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SHORT,
    top: NAVY, sleeve: 'long', bottom: NAVY, legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: SLIM, cuff: WHITE[0],
    torso(Pn, pose) {
      const n = pose.neck, l = lean(pose);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + l * dy);
      for (let dy = 0; dy <= 5; dy++) for (let dx = 1; dx <= 4 - Math.floor(dy / 2); dx++) Pn.px(X(dx, dy), n[1] + dy, WHITE[0]);
      // 首から下げた社員証
      for (let dy = 0; dy <= 6; dy++) Pn.px(X(0, dy), n[1] + dy, LANYARD);
      Pn.rect(X(-1, 7), n[1] + 7, 3, 3, WHITE[0]).px(X(0, 8), n[1] + 8, NAVY[1]);
    },
    front(Pn, pose) {
      // 胸にかかえた書類の束(手前の手でおさえる)
      const [hx, hy] = R(pose.aF.h);
      sprite(Pn, hx - 3, hy - 5, [
        'wwwwwww',
        'wgggggw',
        'wwwwwww',
        'ywwwwwW',
        'wwwwwwW'
      ], { w: WHITE[0], W: WHITE[2], g: WHITE[2], y: md(7, 6, 2) });
      Pn.rect(hx - 1, hy + 1, 2, 2, SKIN[0]);
    }
  };
  const pose = withFace(STAND, 'worried');
  pose.aF = { e: [31, 30], h: [36, 32] };
  return { look, pose };
}

// =====================================================================
// 18階:清掃員(水色のつなぎ、帽子、モップ)
// =====================================================================
const JANI: Ramp = [md(4, 6, 6), md(3, 5, 5), md(2, 3, 4)];
const MOP_HEAD: Ramp = [md(7, 7, 6), md(6, 6, 5), md(4, 4, 4)];
function janitor(): { look: Look; pose: Pose } {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SHORT,
    top: JANI, sleeve: 'long', bottom: JANI, legs: 'pants', shoes: [md(3, 4, 4), md(2, 3, 3), OUTLINE], sole: OUTLINE,
    build: WIDE,
    headExtra(g) {
      CAP_ROWS.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) {
          const c = { c: JANI[1], L: JANI[0], d: JANI[2], b: JANI[2] }[r[x]];
          if (c) g.px(x, y, c);
        }
      });
    },
    torso(Pn, pose) {
      const n = pose.neck, l = lean(pose);
      // 胸当てのポケットとボタン
      Pn.rect(Math.round(n[0] + 1 + l * 6), n[1] + 6, 4, 3, JANI[2]).px(Math.round(n[0] + 2 + l * 6), n[1] + 6, JANI[0]);
    },
    front(Pn, pose) {
      // モップ(手前の手でにぎり、体の前に立てる)
      const [hx, hy] = R(pose.aF.h);
      Pn.line([hx + 4, hy - 16], [hx + 9, 55], md(5, 3, 1));
      Pn.line([hx + 5, hy - 16], [hx + 10, 55], md(4, 2, 1));
      sprite(Pn, hx + 4, 55, ['.mmmmmmmm.', 'mMmMmMmMmM', 'mMmMmMmMmM'], { m: MOP_HEAD[0], M: MOP_HEAD[2] });
      Pn.rect(hx + 3, hy - 1, 3, 3, SKIN[0]);
    }
  };
  const pose = clonePose(STAND);
  pose.aF = { e: [31, 28], h: [35, 31] };
  pose.face = 'shut';
  return { look, pose };
}

// =====================================================================
// 35階:シェフ(白いコック服、高いコック帽、赤いスカーフ)
// =====================================================================
const CHEF: Ramp = [WHITE[0], md(6, 6, 7), md(5, 5, 6)];
const SCARF = md(6, 1, 1);
function chef(): { look: Look; pose: Pose } {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SHORT,
    top: CHEF, sleeve: 'long', bottom: [md(3, 3, 3), md(2, 2, 2), md(1, 1, 1)], legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: WIDE, cuff: CHEF[2],
    torso(Pn, pose) {
      const n = pose.neck, l = lean(pose);
      // 首のスカーフと、2列のボタン
      Pn.rect(Math.round(n[0] - 1), n[1], 5, 2, SCARF).px(Math.round(n[0] + 4), n[1] + 2, SCARF);
      for (const dy of [5, 9, 13]) Pn.px(Math.round(n[0] + 1 + l * dy), n[1] + dy, CHEF[2]).px(Math.round(n[0] + 5 + l * dy), n[1] + dy, CHEF[2]);
    },
    front(Pn, pose) {
      // コック帽(頭の上)
      const [hx, hy] = R(pose.head);
      const x = hx - 4, y = hy - 17;
      sprite(Pn, x, y, [
        '.wwwWWw..',
        'wwwwwwwW.',
        'wwwwwwwWw',
        'wwwwwwwWW',
        '.wwwwwwW.',
        '.wwwwwwW.',
        '.ssssssS.',
        '.ssssssS.'
      ], { w: CHEF[0], W: CHEF[2], s: CHEF[1], S: CHEF[2] });
      // おたま(手前の手)
      const [ax, ay] = R(pose.aF.h);
      Pn.line([ax, ay], [ax + 1, ay - 9], WHITE[2]);
      sprite(Pn, ax - 1, ay - 13, ['.ss', 'sSs', '.s.'], { s: WHITE[1], S: WHITE[2] });
    }
  };
  const pose = withFace(STAND, 'grin');
  pose.aF = { e: [30, 29], h: [34, 32] };
  return { look, pose };
}

// =====================================================================
// 35階:ウェイター(黒いベスト、白いシャツ、蝶ネクタイ、グラスをのせたお盆)
// =====================================================================
function waiter(): { look: Look; pose: Pose } {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SLICK,
    top: SHIRT, sleeve: 'long', bottom: BLACK, legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: SLIM,
    torso(Pn, pose, top) {
      const n = pose.neck, l = lean(pose);
      const vest = Pn.mask();
      top.each((x, y) => {
        const cx = n[0] + 2 + l * (y - n[1]);
        const open = Math.max(0, 3 - (y - n[1]) / 2.5);
        if (y >= n[1] + 1 && Math.abs(x - cx) > open) vest.set(x, y);
      });
      Pn.fill(vest, BLACK, { sep: 'none', hi: 0.3, lo: 0.7 });
      // 蝶ネクタイ
      const bx = Math.round(n[0] + 2), by = n[1];
      Pn.rect(bx - 2, by, 2, 2, OUTLINE).rect(bx + 1, by, 2, 2, OUTLINE).px(bx, by, md(4, 0, 1));
    },
    front(Pn, pose) {
      // 上げた奥の手のお盆とグラス(顔の右上)
      const [hx, hy] = R(pose.aB.h);
      sprite(Pn, hx - 6, hy - 2, ['ssssssssssss'], { s: WHITE[2] });
      for (const gx of [hx - 4, hx, hx + 4]) {
        sprite(Pn, gx, hy - 7, ['gg', 'yy', '.g', '.g'], { g: md(6, 7, 7), y: md(7, 6, 2) });
      }
    }
  };
  const pose = clonePose(STAND);
  pose.aB = { e: [43, 25], h: [46, 19] };
  return { look, pose };
}

// =====================================================================
// 最上階:ドレスの女性(ワイン色のドレス、羽の髪飾り)
// =====================================================================
const WINE: Ramp = [md(6, 2, 3), md(4, 1, 2), md(3, 0, 1)];
const FEATHER = [WHITE[0], md(6, 6, 7), GOLD[1]];
function lady(): { look: Look; pose: Pose } {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_BUN,
    top: WINE, sleeve: 'none', bottom: WINE, legs: 'longskirt', shoes: [GOLD[1], GOLD[2], GOLD[2]], sole: GOLD[2],
    build: LADY,
    headExtra(g) {
      // 髪飾りの羽(頭の後ろ上に2本)
      g.px(1, 0, FEATHER[0]).px(0, 1, FEATHER[0]).px(1, 1, FEATHER[1]).px(2, 1, FEATHER[1]).px(1, 2, FEATHER[1]).px(3, 2, FEATHER[2]).px(2, 3, FEATHER[2]);
    },
    torso(Pn, pose) {
      const n = pose.neck;
      // 首かざり
      Pn.px(Math.round(n[0] + 1), n[1] + 1, GOLD[0]).px(Math.round(n[0] + 2), n[1] + 2, GOLD[1]).px(Math.round(n[0] + 3), n[1] + 1, GOLD[0]);
    },
    front(Pn, pose) {
      // 小さな金のバッグ
      const [hx, hy] = R(pose.aF.h);
      sprite(Pn, hx - 2, hy, ['.o.', 'ggg', 'gGg'], { o: GOLD[2], g: GOLD[1], G: GOLD[2] });
    }
  };
  const pose = withFace(STAND, 'sly');
  pose.aF = { e: [30, 28], h: [31, 35] };
  return { look, pose };
}

// =====================================================================
// 最上階:手品師(えんび服、シルクハット、つえ。つえの先から糸でカードを吊る)
// =====================================================================
const THREAD = md(5, 5, 6);
function magician(withCard = true): { look: Look; pose: Pose } {
  const look: Look = {
    skin: SKIN, hair: HAIR, hairStyle: HAIR_SLICK,
    top: BLACK, sleeve: 'long', bottom: BLACK, legs: 'pants', shoes: SHOE, sole: OUTLINE,
    build: SLIM, cuff: WHITE[0],
    behind(Pn, pose) {
      // えんび服のすそ(後ろにのびる)
      const p = pose.hip;
      sprite(Pn, Math.round(p[0] + 3), Math.round(p[1] - 2), ['bb.', 'bbb', 'bbb', '.bb', '.bb', '..b'], { b: BLACK[1] });
    },
    torso(Pn, pose) {
      const n = pose.neck, l = lean(pose);
      const X = (dx: number, dy: number) => Math.round(n[0] + dx + l * dy);
      for (let dy = 0; dy <= 8; dy++) for (let dx = 1; dx <= 4 - Math.floor(dy / 3); dx++) Pn.px(X(dx, dy), n[1] + dy, WHITE[0]);
      Pn.rect(X(1, 0), n[1], 4, 1, OUTLINE).px(X(3, 1), n[1] + 1, OUTLINE);
      Pn.px(X(3, 10), n[1] + 10, md(4, 0, 1));
    },
    front(Pn, pose) {
      // シルクハット
      const [hx, hy] = R(pose.head);
      sprite(Pn, hx - 5, hy - 16, [
        '..hhhhhhh...',
        '..hHhhhhh...',
        '..hHhhhhh...',
        '..rrrrrrr...',
        'bbbbbbbbbbbb'
      ], { h: BLACK[1], H: BLACK[0], r: md(6, 1, 1), b: OUTLINE });
      // つえ(白い先)
      const [ax, ay] = R(pose.aF.h);
      const tip: Pt = [ax + 9, ay - 8];
      Pn.line([ax - 2, ay + 2], tip, OUTLINE);
      Pn.px(tip[0], tip[1], WHITE[0]).px(tip[0] - 1, tip[1] + 1, WHITE[0]);
      if (withCard) {
        // 糸で吊ったカード(糸が見えるのが、手品のしるし)
        for (let y = tip[1] + 1; y <= tip[1] + 6; y++) Pn.px(tip[0] + 1, y, THREAD);
        sprite(Pn, tip[0] - 1, tip[1] + 7, ['www', 'wrw', 'www', 'wrw'], { w: WHITE[0], r: md(6, 1, 1) });
      }
    }
  };
  const pose = withFace(STAND, 'sly');
  pose.aF = { e: [31, 28], h: [35, 31] };
  return { look, pose };
}

export interface Person { id: string; name: string; floor: string; look: Look; pose: Pose; frame: PixelGrid }

export function buildPeople(): Person[] {
  const list: [string, string, string, () => { look: Look; pose: Pose }][] = [
    ['florist', '花屋の店員', '1階', florist],
    ['courier', '配達員', '1階', courier],
    ['newbie', '新人の会社員', '18階', newbie],
    ['janitor', '清掃員', '18階', janitor],
    ['chef', 'シェフ', '35階', chef],
    ['waiter', 'ウェイター', '35階', waiter],
    ['lady', 'ドレスの女性', '最上階', lady],
    ['magician', '手品師', '最上階', () => magician(true)]
  ];
  return list.map(([id, name, floor, make]) => {
    const { look, pose } = make();
    return { id, name, floor, look, pose, frame: drawPerson(look, pose) };
  });
}

/** ポーズを変えて描き直す(見本の場面用) */
export function redraw(p: Person, edit: (pose: Pose) => void): PixelGrid {
  const pose = clonePose(p.pose);
  edit(pose);
  return drawPerson(p.look, pose);
}

export { magician };
export type { HairStyle };
